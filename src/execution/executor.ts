import type {
  DocumentNode,
  GraphQLSchema,
  GraphQLObjectType,
  GraphQLOutputType,
  GraphQLLeafType,
  GraphQLAbstractType,
  GraphQLField,
  GraphQLFieldResolver,
  GraphQLResolveInfo,
  GraphQLTypeResolver,
  GraphQLList,
  OperationDefinitionNode,
  FieldNode,
  FragmentDefinitionNode,
  OperationTypeNode,
  SelectionSetNode,
  FragmentSpreadNode,
  InlineFragmentNode,
} from 'graphql';

import {
  GraphQLIncludeDirective,
  GraphQLSkipDirective,
  GraphQLError,
  Kind,
  TypeNameMetaFieldDef,
  locatedError,
} from 'graphql';

import type { Path } from '../jsutils/Path';
import type { ObjMap } from '../jsutils/ObjMap';
import type { PromiseOrValue } from '../jsutils/PromiseOrValue';
import type { Maybe } from '../jsutils/Maybe';
import { inspect } from '../jsutils/inspect';
import { memoize1 } from '../jsutils/memoize1';
import { memoize1and1 } from '../jsutils/memoize1and1';
import { memoize2 } from '../jsutils/memoize2';
import { invariant } from '../jsutils/invariant';
import { devAssert } from '../jsutils/devAssert';
import { isPromise } from '../jsutils/isPromise';
import { isObjectLike } from '../jsutils/isObjectLike';
import { promiseReduce } from '../jsutils/promiseReduce';
import { addPath, pathToArray } from '../jsutils/Path';
import { isAsyncIterable } from '../jsutils/isAsyncIterable';
import { isIterableObject } from '../jsutils/isIterableObject';
import { resolveAfterAll } from '../jsutils/resolveAfterAll';
import { toError } from '../jsutils/toError';

import {
  GraphQLDeferDirective,
  GraphQLStreamDirective,
} from '../type/directives';
import {
  SchemaMetaFieldDef,
  TypeMetaFieldDef,
  DirectiveMetaFieldDef,
} from '../type/introspection';

import type { ExecutorSchema } from './executorSchema';
import { toExecutorSchema } from './toExecutorSchema';
import {
  getVariableValues,
  getArgumentValues,
  getDirectiveValues,
} from './values';
import { Publisher } from './publisher';
import { Bundler } from './bundler';
import { getSequentialBundler } from './getSequentialBundler';
import { mapAsyncIterable } from './mapAsyncIterable';
import { flattenAsyncIterable } from './flattenAsyncIterable';

/**
 * Terminology
 *
 * "Definitions" are the generic name for top-level statements in the document.
 * Examples of this include:
 * 1) Operations (such as a query)
 * 2) Fragments
 *
 * "Operations" are a generic name for requests in the document.
 * Examples of this include:
 * 1) query,
 * 2) mutation
 *
 * "Selections" are the definitions that can appear legally and at
 * single level of the query. These include:
 * 1) field references e.g `a`
 * 2) fragment "spreads" e.g. `...c`
 * 3) inline fragment "spreads" e.g. `...on Type { a }`
 */

/**
 * Data that must be available at all points during query execution.
 */
export interface ExecutionContext {
  fragments: ObjMap<FragmentDefinitionNode>;
  rootValue: unknown;
  contextValue: unknown;
  operation: OperationDefinitionNode;
  variableValues: { [variable: string]: unknown };
  fieldResolver: GraphQLFieldResolver<any, any>;
  typeResolver: GraphQLTypeResolver<any, any>;
  forceQueryAlgorithm: boolean;
  enableIncremental: boolean;
  getArgumentValues: ArgumentValuesGetter;
  getDeferValues: DeferValuesGetter;
  getStreamValues: StreamValuesGetter;
  rootFieldCollector: RootFieldCollector;
  subFieldCollector: SubFieldCollector;
  resolveField: FieldResolver;
  rootResponseNode: ResponseNode;
  publisher: Publisher<IncrementalResult, AsyncExecutionResult>;
  state: ExecutionState;
}

interface ExecutionState {
  pendingPushes: number;
  pendingStreamResults: number;
  iterators: Set<AsyncIterator<unknown>>;
}

interface FieldContext {
  fieldDef: GraphQLField<unknown, unknown>;
  initialFieldNode: FieldNode;
  fieldName: string;
  fieldNodes: ReadonlyArray<FieldNode>;
  returnType: GraphQLOutputType;
  parentType: GraphQLObjectType;
}

interface StreamContext {
  initialCount: number;
  path: Path;
  bundler: BundlerInterface;
}

interface BundlerInterface {
  queueData: (index: number, result: StreamDataResult) => void;
  queueError: (index: number, result: ResponseNode) => void;
  setTotal: (total: number) => void;
}

interface StreamDataResult {
  responseNode: ResponseNode;
  data: unknown;
}

interface ResponseNode {
  errors: Array<GraphQLError>;
}

interface ResponseContext {
  responseNodes: Array<ResponseNode>;
}

interface SubsequentResponseContext extends ResponseContext {
  parentResponseNode: ResponseNode;
}

interface IncrementalResult {
  responseContext: SubsequentResponseContext;
  data: unknown;
  path: Path | undefined;
  atIndex?: number;
  atIndices?: ReadonlyArray<number>;
  label: string | undefined;
}

export interface PatchFields {
  label?: string;
  fields: Map<string, ReadonlyArray<FieldNode>>;
}

export interface FieldsAndPatches {
  fields: Map<string, ReadonlyArray<FieldNode>>;
  patches: Array<PatchFields>;
}

export interface ExecutorArgs {
  schema: GraphQLSchema;
  executorSchema?: ExecutorSchema;
}

export interface ExecutorExecutionArgs {
  document: DocumentNode;
  rootValue?: unknown;
  contextValue?: unknown;
  variableValues?: Maybe<{ readonly [variable: string]: unknown }>;
  operationName?: Maybe<string>;
  fieldResolver?: Maybe<GraphQLFieldResolver<any, any>>;
  typeResolver?: Maybe<GraphQLTypeResolver<any, any>>;
  subscribeFieldResolver?: Maybe<GraphQLFieldResolver<any, any>>;
  forceQueryAlgorithm?: Maybe<boolean>;
  enableIncremental?: Maybe<boolean>;
}

/**
 * The result of GraphQL execution.
 *
 *   - `errors` is included when any errors occurred as a non-empty array.
 *   - `data` is the result of a successful execution of the query.
 *   - `hasNext` is true if a future payload is expected.
 *   - `extensions` is reserved for adding non-standard properties.
 */
export interface ExecutionResult<
  TData = ObjMap<unknown>,
  TExtensions = ObjMap<unknown>,
> {
  errors?: ReadonlyArray<GraphQLError>;
  data?: TData | null;
  hasNext?: boolean;
  extensions?: TExtensions;
}

/**
 * The result of an asynchronous GraphQL patch.
 *
 *   - `errors` is included when any errors occurred as a non-empty array.
 *   - `data` is the result of the additional asynchronous data.
 *   - `path` is the location of data.
 *   - `label` is the label provided to `@defer` or `@stream`.
 *   - `hasNext` is true if a future payload is expected.
 *   - `extensions` is reserved for adding non-standard properties.
 */
export interface ExecutionPatchResult<
  TData = ObjMap<unknown> | unknown,
  TExtensions = ObjMap<unknown>,
> {
  errors?: ReadonlyArray<GraphQLError>;
  data?: TData | null;
  path?: ReadonlyArray<string | number>;
  atIndex?: number;
  atIndices?: ReadonlyArray<number>;
  label?: string;
  hasNext: boolean;
  extensions?: TExtensions;
}

export type AsyncExecutionResult = ExecutionResult | ExecutionPatchResult;

export type FieldsExecutor<TReturnType> = (
  exeContext: ExecutionContext,
  parentType: GraphQLObjectType,
  sourceValue: unknown,
  path: Path | undefined,
  fields: Map<string, ReadonlyArray<FieldNode>>,
  responseNode: ResponseNode,
) => PromiseOrValue<TReturnType>;

export type ResponseBuilder<TRootFieldsExecutorReturnType, TReturnType> = (
  exeContext: ExecutionContext,
  data: TRootFieldsExecutorReturnType | null,
) => TReturnType;

export type FieldResolver = (
  exeContext: ExecutionContext,
  fieldContext: FieldContext,
  source: unknown,
  info: GraphQLResolveInfo,
) => unknown;

export type ValueCompleter = (
  exeContext: ExecutionContext,
  fieldContext: FieldContext,
  info: GraphQLResolveInfo,
  path: Path,
  result: unknown,
  responseNode: ResponseNode,
) => PromiseOrValue<unknown>;

export type ArgumentValuesGetter = (
  def: GraphQLField<unknown, unknown>,
  node: FieldNode,
  variableValues: ObjMap<unknown>,
) => { [argument: string]: unknown };

export type DeferValuesGetter = (
  variableValues: { [variable: string]: unknown },
  node: FragmentSpreadNode | InlineFragmentNode,
) => undefined | { label?: string };

export interface StreamValues {
  initialCount: number;
  maxChunkSize: number;
  maxInterval: Maybe<number>;
  inParallel: boolean;
  label?: string;
}

export type StreamValuesGetter = (
  variableValues: { [variable: string]: unknown },
  fieldContext: FieldContext,
) => undefined | StreamValues;

export type RootFieldCollector = (
  runtimeType: GraphQLObjectType,
  operation: OperationDefinitionNode,
) => FieldsAndPatches;

export type SubFieldCollector = (
  returnType: GraphQLObjectType,
  fieldNodes: ReadonlyArray<FieldNode>,
) => FieldsAndPatches;

/**
 * Executor class responsible for implementing the Execution section of the GraphQL spec.
 *
 * This class is exported only to assist people in implementing their own executors
 * without duplicating too much code and should be used only as last resort for cases
 * such as experimental syntax or if certain features could not be contributed upstream.
 *
 * It is still part of the internal API and is versioned, so any changes to it are never
 * considered breaking changes. If you still need to support multiple versions of the
 * library, please use the `versionInfo` variable for version detection.
 *
 * @internal
 */
export class Executor {
  splitDefinitions = memoize1((document: DocumentNode) =>
    this._splitDefinitions(document),
  );

  selectOperation = memoize1and1(
    (
      operations: ReadonlyArray<OperationDefinitionNode>,
      operationName: Maybe<string>,
    ) => this._selectOperation(operations, operationName),
  );

  /**
   * A memoized method that looks up the field context given a parent type
   * and an array of field nodes.
   */
  getFieldContext = memoize2(
    (parentType: GraphQLObjectType, fieldNodes: ReadonlyArray<FieldNode>) =>
      this._getFieldContext(parentType, fieldNodes),
  );

  /**
   * A memoized method that retrieves a value completer given a return type.
   */
  getValueCompleter = memoize1((returnType: GraphQLOutputType) =>
    this._getValueCompleter(returnType),
  );

  /**
   * Creates a field list, memoizing so that functions operating on the
   * field list can be memoized.
   */
  createFieldList = memoize1((node: FieldNode): Array<FieldNode> => [node]);

  /**
   * Appends to a field list, memoizing so that functions operating on the
   * field list can be memoized.
   */
  updateFieldList = memoize2(
    (fieldList: Array<FieldNode>, node: FieldNode): Array<FieldNode> => [
      ...fieldList,
      node,
    ],
  );

  private _schema: GraphQLSchema;
  private _executorSchema: ExecutorSchema;

  constructor(executorArgs: ExecutorArgs) {
    const { schema, executorSchema } = executorArgs;

    // Schema must be provided.
    devAssert(schema, 'Must provide schema.');

    this._schema = schema;
    this._executorSchema = executorSchema ?? toExecutorSchema(schema);
  }

  /**
   * Implements the "Executing requests" section of the spec.
   *
   * If the client-provided arguments to this function do not result in a
   * compliant subscription, a GraphQL Response (ExecutionResult) with
   * descriptive errors and no data will be returned.
   */
  execute(
    args: ExecutorExecutionArgs,
  ): PromiseOrValue<
    ExecutionResult | AsyncGenerator<AsyncExecutionResult, void, void>
  > {
    const exeContext = this.buildExecutionContext(args);

    // If a valid execution context cannot be created due to incorrect arguments,
    // a "Response" with only errors is returned.
    if (!('fragments' in exeContext)) {
      return { errors: exeContext };
    }

    const { operation, forceQueryAlgorithm } = exeContext;

    if (forceQueryAlgorithm) {
      return this.executeQueryImpl(exeContext);
    }

    switch (operation.operation) {
      case 'query':
        return this.executeQueryImpl(exeContext);
      case 'mutation':
        return this.executeMutationImpl(exeContext);
      default:
        return this.executeSubscriptionImpl(exeContext);
    }
  }

  /**
   * Implements the "CreateSourceEventStream" algorithm described in the
   * GraphQL specification, resolving the subscription source event stream.
   *
   * Returns a Promise which resolves to either an AsyncIterable (if successful)
   * or an ExecutionResult (error). The promise will be rejected if the schema or
   * other arguments to this function are invalid, or if the resolved event stream
   * is not an async iterable.
   *
   * If the client-provided arguments to this function do not result in a
   * compliant subscription, a GraphQL Response (ExecutionResult) with
   * descriptive errors and no data will be returned.
   *
   * If the the source stream could not be created due to faulty subscription
   * resolver logic or underlying systems, the promise will resolve to a single
   * ExecutionResult containing `errors` and no `data`.
   *
   * If the operation succeeded, the promise resolves to the AsyncIterable for the
   * event stream returned by the resolver.
   *
   * A Source Event Stream represents a sequence of events, each of which triggers
   * a GraphQL execution for that event.
   *
   * This may be useful when hosting the stateful subscription service in a
   * different process or machine than the stateless GraphQL execution engine,
   * or otherwise separating these two steps. For more on this, see the
   * "Supporting Subscriptions at Scale" information in the GraphQL specification.
   */
  async createSourceEventStream(
    args: ExecutorExecutionArgs,
  ): Promise<AsyncIterable<unknown> | ExecutionResult> {
    const exeContext = this.buildExecutionContext(args);

    // If a valid execution context cannot be created due to incorrect arguments,
    // a "Response" with only errors is returned.
    if (!('fragments' in exeContext)) {
      return { errors: exeContext };
    }

    return this.createSourceEventStreamImpl(exeContext);
  }

  /**
   * Implements the ExecuteQuery algorithm described in the GraphQL
   * specification. This algorithm is used to execute query operations
   * and to implement the ExecuteSubscriptionEvent algorithm.
   *
   * If errors are encountered while executing a GraphQL field, only that
   * field and its descendants will be omitted, and sibling fields will still
   * be executed. An execution which encounters errors will still result in a
   * resolved Promise.
   *
   * Errors from sub-fields of a NonNull type may propagate to the top level,
   * at which point we still log the error and null the parent field, which
   * in this case is the entire response.
   */
  executeQueryImpl(
    exeContext: ExecutionContext,
  ): PromiseOrValue<
    ExecutionResult | AsyncGenerator<AsyncExecutionResult, void, void>
  > {
    return this.executeOperationImpl(
      exeContext,
      this.executeFields.bind(this),
      this.buildResponse.bind(this),
    );
  }

  /**
   * Implements the ExecuteMutation algorithm described in the Graphql
   * specification.
   */
  executeMutationImpl(
    exeContext: ExecutionContext,
  ): PromiseOrValue<
    ExecutionResult | AsyncGenerator<AsyncExecutionResult, void, void>
  > {
    return this.executeOperationImpl(
      exeContext,
      this.executeFieldsSerially.bind(this),
      this.buildResponse.bind(this),
    );
  }

  /**
   * Implements the Execute algorithm described in the GraphQL specification
   * using the provided root fields executor and response builder.
   */
  executeOperationImpl<TRootFieldsExecutorReturnType, TReturnType>(
    exeContext: ExecutionContext,
    rootFieldsExecutor: FieldsExecutor<TRootFieldsExecutorReturnType>,
    responseBuilder: ResponseBuilder<
      TRootFieldsExecutorReturnType,
      TReturnType
    >,
  ): PromiseOrValue<TReturnType> {
    let data: PromiseOrValue<TRootFieldsExecutorReturnType | null>;
    try {
      const { rootValue, rootResponseNode } = exeContext;

      const {
        rootType,
        fieldsAndPatches: { fields, patches },
      } = this.getRootContext(exeContext);
      const path = undefined;

      data = rootFieldsExecutor(
        exeContext,
        rootType,
        rootValue,
        path,
        fields,
        rootResponseNode,
      );

      this.addPatches(
        exeContext,
        patches,
        rootType,
        rootValue,
        path,
        rootResponseNode,
      );
    } catch (error) {
      exeContext.rootResponseNode.errors.push(error);
      data = null;
    }

    if (isPromise(data)) {
      return data.then(
        (resolvedData) => responseBuilder(exeContext, resolvedData),
        (error) => {
          exeContext.rootResponseNode.errors.push(error);
          return responseBuilder(exeContext, null);
        },
      );
    }

    return responseBuilder(exeContext, data);
  }

  /**
   * Given a completed execution context and data, build the `{ errors, data }`
   * response defined by the "Response" section of the GraphQL specification.
   */
  buildResponse(
    exeContext: ExecutionContext,
    data: ObjMap<unknown> | null,
  ): ExecutionResult | AsyncGenerator<AsyncExecutionResult, void, void> {
    const rootResponseNode = exeContext.rootResponseNode;

    const errors = rootResponseNode.errors;
    const initialResult = errors.length === 0 ? { data } : { errors, data };

    if (this.hasNext(exeContext.state)) {
      const publisher = exeContext.publisher;
      publisher.emit([rootResponseNode], {
        ...initialResult,
        hasNext: true,
      });
      return publisher.subscribe();
    }

    return initialResult;
  }

  /**
   * Essential assertions before executing to provide developer feedback for
   * improper use of the GraphQL library.
   */
  assertValidExecutionArguments(
    document: DocumentNode,
    rawVariableValues: Maybe<{ readonly [variable: string]: unknown }>,
  ): void {
    devAssert(document, 'Must provide document.');

    // Variables, if provided, must be an object.
    devAssert(
      rawVariableValues == null || isObjectLike(rawVariableValues),
      'Variables must be provided as an Object where each property is a variable value. Perhaps look to see if an unparsed JSON string was provided.',
    );
  }

  buildFieldResolver =
    (
      resolverKey: 'resolve' | 'subscribe',
      defaultResolver: GraphQLFieldResolver<unknown, unknown>,
    ) =>
    (
      exeContext: ExecutionContext,
      fieldContext: FieldContext,
      source: unknown,
      info: GraphQLResolveInfo,
    ) => {
      const { fieldDef, initialFieldNode } = fieldContext;

      const resolveFn = fieldDef[resolverKey] ?? defaultResolver;

      const { contextValue, variableValues } = exeContext;

      // Build a JS object of arguments from the field.arguments AST, using the
      // variables scope to fulfill any variable references.
      const args = exeContext.getArgumentValues(
        fieldDef,
        initialFieldNode,
        variableValues,
      );

      // The resolve function's optional third argument is a context value that
      // is provided to every resolve function within an execution. It is commonly
      // used to represent an authenticated user, or request-specific caches.
      return resolveFn(source, args, contextValue, info);
    };

  _splitDefinitions(document: DocumentNode): {
    operations: ReadonlyArray<OperationDefinitionNode>;
    fragments: ObjMap<FragmentDefinitionNode>;
  } {
    const operations: Array<OperationDefinitionNode> = [];
    const fragments: ObjMap<FragmentDefinitionNode> = Object.create(null);
    for (const definition of document.definitions) {
      switch (definition.kind) {
        case Kind.OPERATION_DEFINITION:
          operations.push(definition);
          break;
        case Kind.FRAGMENT_DEFINITION:
          fragments[definition.name.value] = definition;
          break;
        default:
        // ignore non-executable definitions
      }
    }
    return {
      operations,
      fragments,
    };
  }

  _selectOperation(
    operations: ReadonlyArray<OperationDefinitionNode>,
    operationName: Maybe<string>,
  ): ReadonlyArray<GraphQLError> | OperationDefinitionNode {
    let operation: OperationDefinitionNode | undefined;
    for (const possibleOperation of operations) {
      if (operationName == null) {
        if (operation !== undefined) {
          return [
            new GraphQLError(
              'Must provide operation name if query contains multiple operations.',
            ),
          ];
        }
        operation = possibleOperation;
      } else if (possibleOperation.name?.value === operationName) {
        operation = possibleOperation;
      }
    }

    if (!operation) {
      if (operationName != null) {
        return [
          new GraphQLError(`Unknown operation named "${operationName}".`),
        ];
      }
      return [new GraphQLError('Must provide an operation.')];
    }

    return operation;
  }

  createPublisher(
    state: ExecutionState,
  ): Publisher<IncrementalResult, AsyncExecutionResult> {
    return new Publisher({
      payloadFromSource: (result, hasNext) => {
        const { responseContext, data, path, atIndex, atIndices, label } =
          result;
        const errors = [];
        for (const responseNode of responseContext.responseNodes) {
          errors.push(...responseNode.errors);
        }

        const value: ExecutionPatchResult = {
          data,
          path: path ? pathToArray(path) : [],
          hasNext,
        };

        if (atIndex != null) {
          value.atIndex = atIndex;
        } else if (atIndices != null) {
          value.atIndices = atIndices;
        }

        if (label != null) {
          value.label = label;
        }

        if (errors.length > 0) {
          value.errors = errors;
        }

        return value;
      },
      onReady: () => state.pendingPushes--,
      hasNext: () => this.hasNext(state),
      onStop: () =>
        Promise.all(
          Array.from(state.iterators.values()).map((iterator) =>
            iterator.return?.(),
          ),
        ),
    });
  }

  /**
   * Constructs a ExecutionContext object from the arguments passed to
   * execute, which we will pass throughout the other execution methods.
   *
   * Returns an array of GraphQLErrors if a valid execution context
   * cannot be created.
   */
  buildExecutionContext(
    args: ExecutorExecutionArgs,
  ): ReadonlyArray<GraphQLError> | ExecutionContext {
    const {
      document,
      rootValue,
      contextValue,
      variableValues: rawVariableValues,
      operationName,
      fieldResolver,
      typeResolver,
      subscribeFieldResolver,
      forceQueryAlgorithm,
      enableIncremental,
    } = args;

    // If arguments are missing or incorrectly typed, this is an internal
    // developer mistake which should throw an error.
    this.assertValidExecutionArguments(document, rawVariableValues);

    const { operations, fragments } = this.splitDefinitions(document);
    const operation = this.selectOperation(operations, operationName);

    if ('length' in operation) {
      return operation;
    }

    // See: 'https://github.com/graphql/graphql-js/issues/2203'
    const variableDefinitions =
      /* c8 ignore next */ operation.variableDefinitions ?? [];

    const coercedVariableValues = getVariableValues(
      this._executorSchema,
      variableDefinitions,
      rawVariableValues ?? {},
      { maxErrors: 50 },
    );

    if (coercedVariableValues.errors) {
      return coercedVariableValues.errors;
    }

    const enableIncrementalFlagValue = enableIncremental ?? true;
    const defaultResolveFieldValueFn = fieldResolver ?? defaultFieldResolver;
    const getDeferValues = enableIncrementalFlagValue
      ? this.getDeferValues.bind(this)
      : () => undefined;
    const coercedVariableValuesValues = coercedVariableValues.coerced;

    const state: ExecutionState = {
      pendingPushes: 0,
      pendingStreamResults: 0,
      iterators: new Set(),
    };

    return {
      fragments,
      rootValue,
      contextValue,
      operation,
      variableValues: coercedVariableValues.coerced,
      fieldResolver: defaultResolveFieldValueFn,
      typeResolver: typeResolver ?? defaultTypeResolver,
      forceQueryAlgorithm: forceQueryAlgorithm ?? false,
      enableIncremental: enableIncrementalFlagValue,
      getArgumentValues: memoize2(
        (def: GraphQLField<unknown, unknown>, node: FieldNode) =>
          getArgumentValues(
            this._executorSchema,
            def,
            node,
            coercedVariableValuesValues,
          ),
      ),
      getDeferValues,
      getStreamValues: enableIncrementalFlagValue
        ? this.getStreamValues.bind(this)
        : () => undefined,
      rootFieldCollector: this.buildRootFieldCollector(
        fragments,
        coercedVariableValuesValues,
        getDeferValues,
      ),
      subFieldCollector: this.buildSubFieldCollector(
        fragments,
        coercedVariableValuesValues,
        getDeferValues,
      ),
      resolveField:
        operation.operation === 'subscription' && !forceQueryAlgorithm
          ? this.buildFieldResolver(
              'subscribe',
              subscribeFieldResolver ?? defaultFieldResolver,
            )
          : this.buildFieldResolver('resolve', defaultResolveFieldValueFn),
      rootResponseNode: {
        errors: [],
      },
      state,
      publisher: this.createPublisher(state),
    };
  }

  /**
   * Constructs a perPayload ExecutionContext object from an initial
   * ExecutionObject and the payload value.
   */
  buildPerPayloadExecutionContext(
    exeContext: ExecutionContext,
    payload: unknown,
  ): ExecutionContext {
    const state: ExecutionState = {
      pendingPushes: 0,
      pendingStreamResults: 0,
      iterators: new Set(),
    };

    return {
      ...exeContext,
      rootValue: payload,
      forceQueryAlgorithm: true,
      resolveField: this.buildFieldResolver(
        'resolve',
        exeContext.fieldResolver,
      ),
      rootResponseNode: {
        errors: [],
      },
      state,
      publisher: this.createPublisher(state),
    };
  }

  getRootContext(exeContext: ExecutionContext): {
    rootType: GraphQLObjectType;
    fieldsAndPatches: FieldsAndPatches;
  } {
    const { operation, rootFieldCollector } = exeContext;

    const rootType = this._executorSchema.getRootType(operation.operation);
    if (rootType == null) {
      throw new GraphQLError(
        `Schema is not configured to execute ${operation.operation} operation.`,
        operation,
      );
    }

    const fieldsAndPatches = rootFieldCollector(rootType, operation);

    return {
      rootType,
      fieldsAndPatches,
    };
  }

  /**
   * Implements the "Executing selection sets" section of the spec
   * for fields that must be executed serially.
   */
  executeFieldsSerially(
    exeContext: ExecutionContext,
    parentType: GraphQLObjectType,
    sourceValue: unknown,
    path: Path | undefined,
    fields: Map<string, ReadonlyArray<FieldNode>>,
  ): PromiseOrValue<ObjMap<unknown>> {
    const parentTypeName = parentType.name;
    return promiseReduce(
      fields.entries(),
      (results, [responseName, fieldNodes]) => {
        const fieldPath = addPath(path, responseName, parentTypeName);
        const result = this.executeField(
          exeContext,
          parentType,
          sourceValue,
          fieldNodes,
          fieldPath,
          exeContext.rootResponseNode,
        );
        if (result === undefined) {
          return results;
        }
        if (isPromise(result)) {
          return result.then((resolvedResult) => {
            results[responseName] = resolvedResult;
            return results;
          });
        }
        results[responseName] = result;
        return results;
      },
      Object.create(null),
    );
  }

  /**
   * Implements the "Executing selection sets" section of the spec
   * for fields that may be executed in parallel.
   */
  executeFields(
    exeContext: ExecutionContext,
    parentType: GraphQLObjectType,
    sourceValue: unknown,
    path: Path | undefined,
    fields: Map<string, ReadonlyArray<FieldNode>>,
    responseNode: ResponseNode,
  ): PromiseOrValue<ObjMap<unknown>> {
    const results = Object.create(null);
    const promises: Array<Promise<void>> = [];

    const parentTypeName = parentType.name;
    for (const [responseName, fieldNodes] of fields.entries()) {
      const fieldPath = addPath(path, responseName, parentTypeName);
      const result = this.executeField(
        exeContext,
        parentType,
        sourceValue,
        fieldNodes,
        fieldPath,
        responseNode,
      );

      if (result !== undefined) {
        if (isPromise(result)) {
          // set key to undefined to preserve key order
          results[responseName] = undefined;
          const promise = result.then((resolved) => {
            results[responseName] = resolved;
          });
          promises.push(promise);
        } else {
          results[responseName] = result;
        }
      }
    }

    // If there are no promises, we can just return the object
    if (!promises.length) {
      return results;
    }

    // Otherwise, results will only eventually be a map from field name to the
    // result of resolving that field, which is possibly a promise. Return a
    // promise that will return this map after resolution is complete.
    return resolveAfterAll(results, promises);
  }

  /**
   * Implements the "Executing field" section of the spec
   * In particular, this function figures out the value that the field returns by
   * calling its resolve function, then calls completeValue to complete promises,
   * serialize scalars, or execute the sub-selection-set for objects.
   */
  executeField(
    exeContext: ExecutionContext,
    parentType: GraphQLObjectType,
    source: unknown,
    fieldNodes: ReadonlyArray<FieldNode>,
    path: Path,
    responseNode: ResponseNode,
  ): PromiseOrValue<unknown> {
    const fieldContext = this.getFieldContext(parentType, fieldNodes);
    if (!fieldContext) {
      return;
    }

    const returnType = fieldContext.returnType;

    const info = this.buildResolveInfo(exeContext, fieldContext, path);

    // Get the resolved field value, regardless of if its result is normal or abrupt (error).
    // Then, complete the field
    try {
      const result = exeContext.resolveField(
        exeContext,
        fieldContext,
        source,
        info,
      );

      let completed;
      const valueCompleter = this.getValueCompleter(returnType);
      if (isPromise(result)) {
        completed = result.then((resolved) =>
          valueCompleter(
            exeContext,
            fieldContext,
            info,
            path,
            resolved,
            responseNode,
          ),
        );
      } else {
        completed = valueCompleter(
          exeContext,
          fieldContext,
          info,
          path,
          result,
          responseNode,
        );
      }

      if (isPromise(completed)) {
        // Note: we don't rely on a `catch` method, but we do expect "thenable"
        // to take a second callback for the error case.
        return completed.then(undefined, (rawError) =>
          this.handleRawError(
            rawError,
            fieldNodes,
            path,
            returnType,
            responseNode.errors,
          ),
        );
      }
      return completed;
    } catch (rawError) {
      return this.handleRawError(
        rawError,
        fieldNodes,
        path,
        returnType,
        responseNode.errors,
      );
    }
  }

  buildResolveInfo(
    exeContext: ExecutionContext,
    fieldContext: FieldContext,
    path: Path,
  ): GraphQLResolveInfo {
    const { fieldName, fieldNodes, returnType, parentType } = fieldContext;
    const { _schema: schema, _executorSchema: executorSchema } = this;
    const { fragments, rootValue, operation, variableValues } = exeContext;
    // The resolve function's optional fourth argument is a collection of
    // information about the current execution state.
    return {
      fieldName,
      fieldNodes,
      returnType,
      parentType,
      path,
      schema,
      executorSchema,
      fragments,
      rootValue,
      operation,
      variableValues,
    };
  }

  toLocatedError(
    rawError: unknown,
    fieldNodes: ReadonlyArray<FieldNode>,
    path: Path,
  ): GraphQLError {
    return locatedError(toError(rawError), fieldNodes, pathToArray(path));
  }

  handleRawError(
    rawError: unknown,
    fieldNodes: ReadonlyArray<FieldNode>,
    path: Path,
    returnType: GraphQLOutputType,
    errors: Array<GraphQLError>,
  ): null {
    const error = this.toLocatedError(rawError, fieldNodes, path);

    // If the field type is non-nullable, then it is resolved without any
    // protection from errors, however it still properly locates the error.
    if (this._executorSchema.isNonNullType(returnType)) {
      throw error;
    }

    // Otherwise, error protection is applied, logging the error and resolving
    // a null value for this field if one is encountered.
    errors.push(error);
    return null;
  }

  buildNullableValueCompleter(valueCompleter: ValueCompleter): ValueCompleter {
    return (
      exeContext: ExecutionContext,
      fieldContext: FieldContext,
      info: GraphQLResolveInfo,
      path: Path,
      result: unknown,
      responseNode: ResponseNode,
    ): PromiseOrValue<unknown> => {
      // If result is an Error, throw a located error.
      if (result instanceof Error) {
        throw result;
      }

      // If result value is null or undefined then return null.
      if (result == null) {
        return null;
      }

      return valueCompleter(
        exeContext,
        fieldContext,
        info,
        path,
        result,
        responseNode,
      );
    };
  }

  /**
   * Implements the instructions for completeValue as defined in the
   * "Field entries" section of the spec.
   *
   * If the field type is Non-Null, then this recursively completes the value
   * for the inner type. It throws a field error if that completion returns null,
   * as per the "Nullability" section of the spec.
   *
   * If the field type is a List, then this recursively completes the value
   * for the inner type on each item in the list.
   *
   * If the field type is a Scalar or Enum, ensures the completed value is a legal
   * value of the type by calling the `serialize` method of GraphQL type
   * definition.
   *
   * If the field is an abstract type, determine the runtime type of the value
   * and then complete based on that type
   *
   * Otherwise, the field type expects a sub-selection set, and will complete the
   * value by executing all sub-selections.
   */
  _getValueCompleter(returnType: GraphQLOutputType): ValueCompleter {
    if (this._executorSchema.isNonNullType(returnType)) {
      return (
        exeContext: ExecutionContext,
        fieldContext: FieldContext,
        info: GraphQLResolveInfo,
        path: Path,
        result: unknown,
        responseNode: ResponseNode,
      ): PromiseOrValue<unknown> => {
        // If field type is NonNull, complete for inner type, and throw field error
        // if result is null.
        const innerValueCompleter = this.getValueCompleter(returnType.ofType);
        const completed = innerValueCompleter(
          exeContext,
          fieldContext,
          info,
          path,
          result,
          responseNode,
        );
        if (completed === null) {
          throw new Error(
            `Cannot return null for non-nullable field ${info.parentType.name}.${info.fieldName}.`,
          );
        }
        return completed;
      };
    }

    if (this._executorSchema.isListType(returnType)) {
      return this.buildNullableValueCompleter(
        (
          exeContext: ExecutionContext,
          fieldContext: FieldContext,
          info: GraphQLResolveInfo,
          path: Path,
          result: unknown,
          responseNode: ResponseNode,
        ): PromiseOrValue<unknown> =>
          // If field type is List, complete each item in the list with the inner type
          this.completeListValue(
            exeContext,
            returnType,
            fieldContext,
            info,
            path,
            result,
            responseNode,
          ),
      );
    }

    if (this._executorSchema.isLeafType(returnType)) {
      return this.buildNullableValueCompleter(
        (
          _exeContext: ExecutionContext,
          _fieldContext: FieldContext,
          _info: GraphQLResolveInfo,
          _path: Path,
          result: unknown,
          _responseNode: ResponseNode,
        ): PromiseOrValue<unknown> =>
          // If field type is a leaf type, Scalar or Enum, serialize to a valid value,
          // returning null if serialization is not possible.
          this.completeLeafValue(returnType, result),
      );
    }

    if (this._executorSchema.isAbstractType(returnType)) {
      return this.buildNullableValueCompleter(
        (
          exeContext: ExecutionContext,
          fieldContext: FieldContext,
          info: GraphQLResolveInfo,
          path: Path,
          result: unknown,
          responseNode: ResponseNode,
        ): PromiseOrValue<unknown> =>
          // If field type is an abstract type, Interface or Union, determine the
          // runtime Object type and complete for that type.
          this.completeAbstractValue(
            exeContext,
            returnType,
            fieldContext,
            info,
            path,
            result,
            responseNode,
          ),
      );
    }

    if (this._executorSchema.isObjectType(returnType)) {
      return this.buildNullableValueCompleter(
        (
          exeContext: ExecutionContext,
          fieldContext: FieldContext,
          info: GraphQLResolveInfo,
          path: Path,
          result: unknown,
          responseNode: ResponseNode,
        ): PromiseOrValue<unknown> =>
          // If field type is Object, execute and complete all sub-selections.
          this.completeObjectValue(
            exeContext,
            returnType,
            fieldContext,
            info,
            path,
            result,
            responseNode,
          ),
      );
    }
    /* c8 ignore next 6 */
    // Not reachable. All possible output types have been considered
    invariant(
      false,
      'Cannot complete value of unexpected output type: ' + inspect(returnType),
    );
  }

  /**
   * Complete a list value by completing each item in the list with the
   * inner type
   */
  completeListValue(
    exeContext: ExecutionContext,
    returnType: GraphQLList<GraphQLOutputType>,
    fieldContext: FieldContext,
    info: GraphQLResolveInfo,
    path: Path,
    result: unknown,
    responseNode: ResponseNode,
  ): PromiseOrValue<ReadonlyArray<unknown>> {
    const itemType = returnType.ofType;

    const valueCompleter = this.getValueCompleter(itemType);

    // This is specified as a simple map, however we're optimizing the path
    // where the list contains no Promises by avoiding creating another Promise.
    const completedResults: Array<unknown> = [];
    const promises: Array<Promise<void>> = [];

    const stream = exeContext.getStreamValues(
      exeContext.variableValues,
      fieldContext,
    );

    if (isAsyncIterable(result)) {
      const iterator = result[Symbol.asyncIterator]();

      return this.completeAsyncIteratorValue(
        exeContext,
        itemType,
        fieldContext,
        info,
        valueCompleter,
        path,
        iterator,
        responseNode,
        stream,
        completedResults,
        promises,
      );
    }

    if (!isIterableObject(result)) {
      throw new GraphQLError(
        `Expected Iterable, but did not find one for field "${info.parentType.name}.${info.fieldName}".`,
      );
    }

    const iterator = result[Symbol.iterator]();
    this.completeIteratorValue(
      exeContext,
      itemType,
      fieldContext,
      info,
      valueCompleter,
      path,
      iterator,
      responseNode,
      stream,
      completedResults,
      promises,
    );

    return promises.length
      ? resolveAfterAll(completedResults, promises)
      : completedResults;
  }

  /**
   * Returns an object containing the `@stream` arguments if a field should be
   * streamed based on the experimental flag, stream directive present and
   * not disabled by the "if" argument.
   */
  getStreamValues(
    variableValues: { [variable: string]: unknown },
    fieldContext: FieldContext,
  ): undefined | StreamValues {
    // validation only allows equivalent streams on multiple fields, so it is
    // safe to only check the first fieldNode for the stream directive
    const stream = getDirectiveValues(
      this._executorSchema,
      GraphQLStreamDirective,
      fieldContext.initialFieldNode,
      variableValues,
    );

    if (!stream) {
      return;
    }

    if (stream.if === false) {
      return;
    }

    const { initialCount, maxChunkSize, maxInterval, inParallel, label } =
      stream;

    invariant(
      typeof initialCount === 'number',
      'initialCount must be a number',
    );

    invariant(
      initialCount >= 0,
      'initialCount must be an integer greater than or equal to zero',
    );

    invariant(
      typeof maxChunkSize === 'number',
      'maxChunkSize must be a number',
    );

    invariant(
      maxChunkSize >= 1,
      'maxChunkSize must be an integer greater than or equal to one',
    );

    if (maxInterval != null) {
      invariant(
        typeof maxInterval === 'number',
        'maxInterval must be a number',
      );

      invariant(
        maxInterval >= 0,
        'maxInterval must be an integer greater than or equal to zero',
      );
    }

    return {
      initialCount,
      maxChunkSize,
      maxInterval,
      inParallel: inParallel === true,
      label: typeof label === 'string' ? label : undefined,
    };
  }

  /**
   * Complete an iterator value by completing each result.
   */
  completeIteratorValue(
    exeContext: ExecutionContext,
    itemType: GraphQLOutputType,
    fieldContext: FieldContext,
    info: GraphQLResolveInfo,
    valueCompleter: ValueCompleter,
    path: Path,
    iterator: Iterator<unknown>,
    responseNode: ResponseNode,
    stream: StreamValues | undefined,
    completedResults: Array<unknown>,
    promises: Array<Promise<void>>,
  ): void {
    if (stream) {
      this.completeIteratorValueWithStream(
        exeContext,
        itemType,
        fieldContext,
        info,
        valueCompleter,
        path,
        iterator,
        responseNode,
        stream,
        completedResults,
        0,
        promises,
      );
      return;
    }

    this.completeIteratorValueWithoutStream(
      exeContext,
      itemType,
      fieldContext,
      info,
      valueCompleter,
      path,
      iterator,
      responseNode,
      completedResults,
      0,
      promises,
    );
  }

  onNewBundleContext<T extends SubsequentResponseContext>(
    state: ExecutionState,
    context: T,
    responseNode: ResponseNode,
  ): T {
    state.pendingPushes++;
    state.pendingStreamResults--;
    context.responseNodes.push(responseNode);
    return context;
  }

  onSubsequentResponseNode<T extends SubsequentResponseContext>(
    state: ExecutionState,
    context: T,
    responseNode: ResponseNode,
  ): void {
    state.pendingStreamResults--;
    context.responseNodes.push(responseNode);
  }

  createBundler<
    TDataContext extends SubsequentResponseContext,
    TErrorContext extends SubsequentResponseContext,
  >(
    exeContext: ExecutionContext,
    parentResponseNode: ResponseNode,
    initialCount: number,
    maxChunkSize: number,
    maxInterval: Maybe<number>,
    resultToNewDataContext: (
      index: number,
      result: StreamDataResult,
    ) => TDataContext,
    indexToNewErrorContext: (index: number) => TErrorContext,
    onSubsequentData: (
      index: number,
      result: StreamDataResult,
      context: TDataContext,
    ) => void,
    onSubsequentError: (index: number, context: TErrorContext) => void,
    dataContextToIncrementalResult: (
      context: TDataContext,
    ) => IncrementalResult,
    errorContextToIncrementalResult: (
      context: TErrorContext,
    ) => IncrementalResult,
  ): Bundler<StreamDataResult, ResponseNode, TDataContext, TErrorContext> {
    return new Bundler<
      StreamDataResult,
      ResponseNode,
      TDataContext,
      TErrorContext
    >({
      initialIndex: initialCount,
      maxBundleSize: maxChunkSize,
      maxInterval,
      createDataBundleContext: (index, result) =>
        this.onNewBundleContext(
          exeContext.state,
          resultToNewDataContext(index, result),
          result.responseNode,
        ),
      createErrorBundleContext: (index, responseNode) =>
        this.onNewBundleContext(
          exeContext.state,
          indexToNewErrorContext(index),
          responseNode,
        ),
      onSubsequentData: (index, result, context) => {
        this.onSubsequentResponseNode(
          exeContext.state,
          context,
          result.responseNode,
        );
        onSubsequentData(index, result, context);
      },
      onSubsequentError: (index, responseNode, context) => {
        this.onSubsequentResponseNode(exeContext.state, context, responseNode);
        onSubsequentError(index, context);
      },
      onDataBundle: (context) =>
        exeContext.publisher.queue(
          context.responseNodes,
          dataContextToIncrementalResult(context),
          parentResponseNode,
        ),
      onErrorBundle: (context) =>
        exeContext.publisher.queue(
          context.responseNodes,
          errorContextToIncrementalResult(context),
          parentResponseNode,
        ),
    });
  }

  createStreamContext(
    exeContext: ExecutionContext,
    initialCount: number,
    maxChunkSize: number,
    maxInterval: Maybe<number>,
    inParallel: boolean,
    path: Path,
    label: string | undefined,
    parentResponseNode: ResponseNode,
  ): StreamContext {
    if (maxChunkSize === 1) {
      const bundler = this.createBundler(
        exeContext,
        parentResponseNode,
        initialCount,
        maxChunkSize,
        maxInterval,
        (index, result) => ({
          responseNodes: [],
          parentResponseNode,
          result: result.data,
          atIndex: index,
        }),
        (index) => ({
          responseNodes: [],
          parentResponseNode,
          atIndex: index,
        }) /* c8 ignore start */,
        () => {
          /* with maxBundleSize of 1, this function will never be called */
        },
        () => {
          /* with maxBundleSize of 1, this function will never be called */
        } /* c8 ignore stop */,
        (context) => ({
          responseContext: context,
          data: context.result,
          path: addPath(path, context.atIndex, undefined),
          label,
        }),
        (context) => ({
          responseContext: context,
          data: null,
          path: addPath(path, context.atIndex, undefined),
          label,
        }),
      );

      return {
        initialCount,
        path,
        bundler: inParallel
          ? bundler
          : getSequentialBundler(initialCount, bundler),
      };
    }

    if (inParallel) {
      return {
        initialCount,
        path,
        bundler: this.createBundler(
          exeContext,
          parentResponseNode,
          initialCount,
          maxChunkSize,
          maxInterval,
          (index, result) => ({
            responseNodes: [],
            parentResponseNode,
            atIndices: [index],
            results: [result.data],
          }),
          (index) => ({
            responseNodes: [],
            parentResponseNode,
            atIndices: [index],
          }),
          (index, result, context) => {
            context.results.push(result.data);
            context.atIndices.push(index);
          },
          (index, context) => {
            context.atIndices.push(index);
          },
          (context) => ({
            responseContext: context,
            data: context.results,
            path,
            atIndices: context.atIndices,
            label,
          }),
          (context) => ({
            responseContext: context,
            data: null,
            path,
            atIndices: context.atIndices,
            label,
          }),
        ),
      };
    }

    return {
      initialCount,
      path,
      bundler: getSequentialBundler(
        initialCount,
        this.createBundler(
          exeContext,
          parentResponseNode,
          initialCount,
          maxChunkSize,
          maxInterval,
          (index, result) => ({
            responseNodes: [],
            parentResponseNode,
            atIndex: index,
            results: [result.data],
          }),
          (index) => ({
            responseNodes: [],
            parentResponseNode,
            atIndex: index,
          }),
          (_index, result, context) => {
            context.results.push(result.data);
          } /* c8 ignore start */,
          () => {
            /* with serial bundlers and no data, no additional action is needed */
          } /* c8 ignore stop */,
          (context) => ({
            responseContext: context,
            data: context.results,
            path,
            atIndex: context.atIndex,
            label,
          }),
          (context) => ({
            responseContext: context,
            data: null,
            path,
            atIndex: context.atIndex,
            label,
          }),
        ),
      ),
    };
  }

  /**
   * Complete an iterator value by completing each result, possibly adding a new stream.
   */
  completeIteratorValueWithStream(
    exeContext: ExecutionContext,
    itemType: GraphQLOutputType,
    fieldContext: FieldContext,
    info: GraphQLResolveInfo,
    valueCompleter: ValueCompleter,
    path: Path,
    iterator: Iterator<unknown>,
    responseNode: ResponseNode,
    stream: StreamValues,
    completedResults: Array<unknown>,
    _index: number,
    promises: Array<Promise<void>>,
  ): void {
    const initialCount = stream.initialCount;

    let index = _index;
    while (true) {
      if (index >= initialCount) {
        const { maxChunkSize, maxInterval, inParallel, label } = stream;
        const streamContext = this.createStreamContext(
          exeContext,
          initialCount,
          maxChunkSize,
          maxInterval,
          inParallel,
          path,
          label,
          responseNode,
        );
        const nextIndex = this.addIteratorValue(
          index,
          iterator,
          exeContext,
          itemType,
          fieldContext,
          info,
          valueCompleter,
          streamContext,
        );
        streamContext.bundler.setTotal(nextIndex);
        break;
      }

      const iteration = iterator.next();
      if (iteration.done) {
        return;
      }

      const itemPath = addPath(path, index, undefined);

      this.completeListItemValue(
        completedResults,
        index,
        promises,
        iteration.value,
        exeContext,
        itemType,
        valueCompleter,
        fieldContext,
        info,
        itemPath,
        responseNode,
      );

      index++;
    }
  }

  /**
   * Complete an iterator value by completing each result.
   *
   * Returns the next index.
   */
  completeIteratorValueWithoutStream(
    exeContext: ExecutionContext,
    itemType: GraphQLOutputType,
    fieldContext: FieldContext,
    info: GraphQLResolveInfo,
    valueCompleter: ValueCompleter,
    path: Path,
    iterator: Iterator<unknown>,
    responseNode: ResponseNode,
    completedResults: Array<unknown>,
    _index: number,
    promises: Array<Promise<void>>,
  ): number {
    let index = _index;

    while (true) {
      const iteration = iterator.next();
      if (iteration.done) {
        return index;
      }

      const itemPath = addPath(path, index, undefined);

      this.completeListItemValue(
        completedResults,
        index,
        promises,
        iteration.value,
        exeContext,
        itemType,
        valueCompleter,
        fieldContext,
        info,
        itemPath,
        responseNode,
      );

      index++;
    }
  }

  /**
   * Complete an async iterator value by completing each result.
   */
  async completeAsyncIteratorValue(
    exeContext: ExecutionContext,
    itemType: GraphQLOutputType,
    fieldContext: FieldContext,
    info: GraphQLResolveInfo,
    valueCompleter: ValueCompleter,
    path: Path,
    iterator: AsyncIterator<unknown>,
    responseNode: ResponseNode,
    stream: StreamValues | undefined,
    completedResults: Array<unknown>,
    promises: Array<Promise<void>>,
  ): Promise<ReadonlyArray<unknown>> {
    if (stream) {
      await this.completeAsyncIteratorValueWithStream(
        exeContext,
        itemType,
        fieldContext,
        info,
        valueCompleter,
        path,
        iterator,
        responseNode,
        stream,
        completedResults,
        promises,
      );
    } else {
      await this.completeAsyncIteratorValueWithoutStream(
        exeContext,
        itemType,
        fieldContext,
        info,
        valueCompleter,
        path,
        iterator,
        responseNode,
        completedResults,
        promises,
      );
    }

    return promises.length
      ? resolveAfterAll(completedResults, promises)
      : completedResults;
  }

  async completeAsyncIteratorValueWithStream(
    exeContext: ExecutionContext,
    itemType: GraphQLOutputType,
    fieldContext: FieldContext,
    info: GraphQLResolveInfo,
    valueCompleter: ValueCompleter,
    path: Path,
    iterator: AsyncIterator<unknown>,
    responseNode: ResponseNode,
    stream: StreamValues,
    completedResults: Array<unknown>,
    promises: Array<Promise<void>>,
  ): Promise<void> {
    const initialCount = stream.initialCount;
    let index = 0;
    try {
      while (true) {
        if (index >= initialCount) {
          const { maxChunkSize, maxInterval, inParallel, label } = stream;
          const streamContext = this.createStreamContext(
            exeContext,
            initialCount,
            maxChunkSize,
            maxInterval,
            inParallel,
            path,
            label,
            responseNode,
          );
          // eslint-disable-next-line @typescript-eslint/no-floating-promises
          this.addAsyncIteratorValue(
            index,
            iterator,
            exeContext,
            itemType,
            fieldContext,
            info,
            valueCompleter,
            streamContext,
          );
          return;
        }

        // eslint-disable-next-line no-await-in-loop
        const iteration = await iterator.next();
        if (iteration.done) {
          break;
        }

        const itemPath = addPath(path, index, undefined);

        this.completeListItemValue(
          completedResults,
          index,
          promises,
          iteration.value,
          exeContext,
          itemType,
          valueCompleter,
          fieldContext,
          info,
          itemPath,
          responseNode,
        );

        index++;
      }
    } catch (rawError) {
      const itemPath = addPath(path, index, undefined);
      completedResults.push(
        this.handleRawError(
          rawError,
          fieldContext.fieldNodes,
          itemPath,
          itemType,
          responseNode.errors,
        ),
      );
    }
  }

  async completeAsyncIteratorValueWithoutStream(
    exeContext: ExecutionContext,
    itemType: GraphQLOutputType,
    fieldContext: FieldContext,
    info: GraphQLResolveInfo,
    valueCompleter: ValueCompleter,
    path: Path,
    iterator: AsyncIterator<unknown>,
    responseNode: ResponseNode,
    completedResults: Array<unknown>,
    promises: Array<Promise<void>>,
  ): Promise<void> {
    let index = 0;
    try {
      while (true) {
        // eslint-disable-next-line no-await-in-loop
        const iteration = await iterator.next();
        if (iteration.done) {
          break;
        }

        const itemPath = addPath(path, index, undefined);

        this.completeListItemValue(
          completedResults,
          index,
          promises,
          iteration.value,
          exeContext,
          itemType,
          valueCompleter,
          fieldContext,
          info,
          itemPath,
          responseNode,
        );

        index++;
      }
    } catch (rawError) {
      const itemPath = addPath(path, index, undefined);
      completedResults.push(
        this.handleRawError(
          rawError,
          fieldContext.fieldNodes,
          itemPath,
          itemType,
          responseNode.errors,
        ),
      );
    }
  }

  completeListItemValue(
    completedResults: Array<unknown>,
    index: number,
    promises: Array<Promise<void>>,
    item: unknown,
    exeContext: ExecutionContext,
    itemType: GraphQLOutputType,
    valueCompleter: ValueCompleter,
    fieldContext: FieldContext,
    info: GraphQLResolveInfo,
    itemPath: Path,
    responseNode: ResponseNode,
  ): void {
    try {
      let completedItem;
      if (isPromise(item)) {
        completedItem = item.then((resolved) =>
          valueCompleter(
            exeContext,
            fieldContext,
            info,
            itemPath,
            resolved,
            responseNode,
          ),
        );
      } else {
        completedItem = valueCompleter(
          exeContext,
          fieldContext,
          info,
          itemPath,
          item,
          responseNode,
        );
      }

      completedResults[index] = completedItem;

      if (!isPromise(completedItem)) {
        return;
      }

      // Note: we don't rely on a `catch` method, but we do expect "thenable"
      // to take a second callback for the error case.
      const promise = completedItem
        .then(undefined, (rawError) =>
          this.handleRawError(
            rawError,
            fieldContext.fieldNodes,
            itemPath,
            itemType,
            responseNode.errors,
          ),
        )
        .then((resolved) => {
          completedResults[index] = resolved;
        });

      promises.push(promise);
    } catch (rawError) {
      completedResults[index] = this.handleRawError(
        rawError,
        fieldContext.fieldNodes,
        itemPath,
        itemType,
        responseNode.errors,
      );
    }
  }

  /**
   * Complete a Scalar or Enum by serializing to a valid value, returning
   * null if serialization is not possible.
   */
  completeLeafValue(returnType: GraphQLLeafType, result: unknown): unknown {
    const serializedResult = returnType.serialize(result);
    if (serializedResult == null) {
      throw new Error(
        `Expected \`${inspect(returnType)}.serialize(${inspect(
          result,
        )})\` to ` +
          `return non-nullable value, returned: ${inspect(serializedResult)}`,
      );
    }
    return serializedResult;
  }

  /**
   * Complete a value of an abstract type by determining the runtime object type
   * of that value, then complete the value for that type.
   */
  completeAbstractValue(
    exeContext: ExecutionContext,
    returnType: GraphQLAbstractType,
    fieldContext: FieldContext,
    info: GraphQLResolveInfo,
    path: Path,
    result: unknown,
    responseNode: ResponseNode,
  ): PromiseOrValue<ObjMap<unknown>> {
    const resolveTypeFn = returnType.resolveType ?? exeContext.typeResolver;
    const contextValue = exeContext.contextValue;
    const runtimeType = resolveTypeFn(result, contextValue, info, returnType);

    if (isPromise(runtimeType)) {
      return runtimeType.then((resolvedRuntimeType) =>
        this.completeObjectValue(
          exeContext,
          this.ensureValidRuntimeType(
            resolvedRuntimeType,
            returnType,
            fieldContext,
            result,
          ),
          fieldContext,
          info,
          path,
          result,
          responseNode,
        ),
      );
    }

    return this.completeObjectValue(
      exeContext,
      this.ensureValidRuntimeType(
        runtimeType,
        returnType,
        fieldContext,
        result,
      ),
      fieldContext,
      info,
      path,
      result,
      responseNode,
    );
  }

  ensureValidRuntimeType(
    runtimeTypeOrName: unknown,
    returnType: GraphQLAbstractType,
    fieldContext: FieldContext,
    result: unknown,
  ): GraphQLObjectType {
    if (runtimeTypeOrName == null) {
      throw new GraphQLError(
        `Abstract type "${returnType.name}" must resolve to an Object type at runtime for field "${fieldContext.parentType.name}.${fieldContext.fieldName}". Either the "${returnType.name}" type should provide a "resolveType" function or each possible type should provide an "isTypeOf" function.`,
        fieldContext.fieldNodes,
      );
    }

    const runtimeTypeName =
      typeof runtimeTypeOrName === 'object' &&
      this._executorSchema.isNamedType(runtimeTypeOrName)
        ? runtimeTypeOrName.name
        : runtimeTypeOrName;

    if (typeof runtimeTypeName !== 'string') {
      throw new GraphQLError(
        `Abstract type "${returnType.name}" must resolve to an Object type at runtime for field "${fieldContext.parentType.name}.${fieldContext.fieldName}" with ` +
          `value ${inspect(result)}, received "${inspect(runtimeTypeName)}".`,
      );
    }

    const runtimeType = this._executorSchema.getNamedType(runtimeTypeName);
    if (runtimeType == null) {
      throw new GraphQLError(
        `Abstract type "${returnType.name}" was resolved to a type "${runtimeTypeName}" that does not exist inside the schema.`,
        fieldContext.fieldNodes,
      );
    }

    if (!this._executorSchema.isObjectType(runtimeType)) {
      throw new GraphQLError(
        `Abstract type "${returnType.name}" was resolved to a non-object type "${runtimeTypeName}".`,
        fieldContext.fieldNodes,
      );
    }

    if (!this._executorSchema.isSubType(returnType, runtimeType)) {
      throw new GraphQLError(
        `Runtime Object type "${runtimeType.name}" is not a possible type for "${returnType.name}".`,
        fieldContext.fieldNodes,
      );
    }

    return runtimeType;
  }

  /**
   * Complete an Object value by executing all sub-selections.
   */
  completeObjectValue(
    exeContext: ExecutionContext,
    returnType: GraphQLObjectType,
    fieldContext: FieldContext,
    info: GraphQLResolveInfo,
    path: Path,
    result: unknown,
    responseNode: ResponseNode,
  ): PromiseOrValue<ObjMap<unknown>> {
    // If there is an isTypeOf predicate function, call it with the
    // current result. If isTypeOf returns false, then raise an error rather
    // than continuing execution.
    if (returnType.isTypeOf) {
      const isTypeOf = returnType.isTypeOf(
        result,
        exeContext.contextValue,
        info,
      );

      if (isPromise(isTypeOf)) {
        return isTypeOf.then((resolvedIsTypeOf) => {
          if (!resolvedIsTypeOf) {
            throw this.invalidReturnTypeError(
              returnType,
              result,
              fieldContext.fieldNodes,
            );
          }
          return this.collectAndExecuteSubfields(
            exeContext,
            returnType,
            fieldContext,
            path,
            result,
            responseNode,
          );
        });
      }

      if (!isTypeOf) {
        throw this.invalidReturnTypeError(
          returnType,
          result,
          fieldContext.fieldNodes,
        );
      }
    }

    return this.collectAndExecuteSubfields(
      exeContext,
      returnType,
      fieldContext,
      path,
      result,
      responseNode,
    );
  }

  invalidReturnTypeError(
    returnType: GraphQLObjectType,
    result: unknown,
    fieldNodes: ReadonlyArray<FieldNode>,
  ): GraphQLError {
    return new GraphQLError(
      `Expected value of type "${returnType.name}" but got: ${inspect(
        result,
      )}.`,
      fieldNodes,
    );
  }

  collectAndExecuteSubfields(
    exeContext: ExecutionContext,
    returnType: GraphQLObjectType,
    fieldContext: FieldContext,
    path: Path,
    result: unknown,
    responseNode: ResponseNode,
  ): PromiseOrValue<ObjMap<unknown>> {
    const { subFieldCollector } = exeContext;
    // Collect sub-fields to execute to complete this value.
    const { fields: subFieldNodes, patches: subPatches } = subFieldCollector(
      returnType,
      fieldContext.fieldNodes,
    );

    const subFields = this.executeFields(
      exeContext,
      returnType,
      result,
      path,
      subFieldNodes,
      responseNode,
    );

    this.addPatches(
      exeContext,
      subPatches,
      returnType,
      result,
      path,
      responseNode,
    );

    return subFields;
  }

  /**
   * This method looks up the field on the given type definition.
   * It has special casing for the three introspection fields,
   * __schema, __type and __typename. __typename is special because
   * it can always be queried as a field, even in situations where no
   * other fields are allowed, like on a Union. __schema and __type
   * could get automatically added to the query type, but that would
   * require mutating type definitions, which would cause issues.
   *
   * Returns: the field definition and a class for constructing the info
   * argument for field resolvers.
   */
  _getFieldDef(
    fieldName: string,
    parentType: GraphQLObjectType,
  ): Maybe<GraphQLField<unknown, unknown>> {
    const fieldDef = parentType.getFields()[fieldName];

    if (fieldDef) {
      return fieldDef;
    }

    if (
      fieldName === SchemaMetaFieldDef.name &&
      this._executorSchema.getRootType('query' as OperationTypeNode) ===
        parentType
    ) {
      return SchemaMetaFieldDef;
    } else if (
      fieldName === TypeMetaFieldDef.name &&
      this._executorSchema.getRootType('query' as OperationTypeNode) ===
        parentType
    ) {
      return TypeMetaFieldDef;
    } else if (
      fieldName === DirectiveMetaFieldDef.name &&
      this._executorSchema.getRootType('query' as OperationTypeNode) ===
        parentType
    ) {
      return DirectiveMetaFieldDef;
    } else if (fieldName === TypeNameMetaFieldDef.name) {
      return TypeNameMetaFieldDef;
    }
  }

  _getFieldContext(
    parentType: GraphQLObjectType,
    fieldNodes: ReadonlyArray<FieldNode>,
  ): Maybe<FieldContext> {
    const initialFieldNode = fieldNodes[0];
    const fieldName = initialFieldNode.name.value;

    const fieldDef = this._getFieldDef(fieldName, parentType);

    if (!fieldDef) {
      return;
    }

    return {
      fieldDef,
      initialFieldNode,
      fieldName: fieldDef.name,
      fieldNodes,
      returnType: fieldDef.type,
      parentType,
    };
  }

  /**
   * Implements the "Subscribe" algorithm described in the GraphQL specification.
   *
   * Returns a Promise which resolves to either an AsyncIterator (if successful)
   * or an ExecutionResult (error). The promise will be rejected if the schema or
   * other arguments to this function are invalid, or if the resolved event stream
   * is not an async iterable.
   *
   * If the client-provided arguments to this function do not result in a
   * compliant subscription, a GraphQL Response (ExecutionResult) with
   * descriptive errors and no data will be returned.
   *
   * If the source stream could not be created due to faulty subscription
   * resolver logic or underlying systems, the promise will resolve to a single
   * ExecutionResult containing `errors` and no `data`.
   *
   * If the operation succeeded, the promise resolves to an AsyncIterator, which
   * yields a stream of ExecutionResults representing the response stream.
   */
  async executeSubscriptionImpl(
    exeContext: ExecutionContext,
  ): Promise<
    AsyncGenerator<AsyncExecutionResult, void, void> | ExecutionResult
  > {
    return this.executeOperationImpl(
      exeContext,
      this.executeRootSubscriptionFields.bind(this),
      this.buildSubscribeResponse.bind(this),
    );
  }

  /**
   * Implements the "Executing selection sets" section of the spec
   * for root subscription fields.
   */
  async executeRootSubscriptionFields(
    exeContext: ExecutionContext,
    parentType: GraphQLObjectType,
    sourceValue: unknown,
    path: Path | undefined,
    fields: Map<string, ReadonlyArray<FieldNode>>,
    responseNode: ResponseNode,
  ): Promise<unknown> {
    // TODO: consider allowing multiple root subscription fields
    const [responseName, fieldNodes] = [...fields.entries()][0];
    const fieldPath = addPath(path, responseName, parentType.name);
    return this.executeRootSubscriptionField(
      exeContext,
      parentType,
      sourceValue,
      fieldNodes,
      fieldPath,
      responseNode,
    );
  }

  buildCreateSourceEventStreamResponse(
    exeContext: ExecutionContext,
    eventStream: unknown,
  ): AsyncIterable<unknown> | ExecutionResult {
    const { rootResponseNode } = exeContext;

    const errors = rootResponseNode.errors;
    if (errors.length) {
      return { errors };
    }

    if (!isAsyncIterable(eventStream)) {
      throw new Error(
        'Subscription field must return Async Iterable. ' +
          `Received: ${inspect(eventStream)}.`,
      );
    }

    return eventStream;
  }

  buildSubscribeResponse(
    exeContext: ExecutionContext,
    _eventStream: unknown,
  ): AsyncGenerator<AsyncExecutionResult, void, void> | ExecutionResult {
    const eventStream = this.buildCreateSourceEventStreamResponse(
      exeContext,
      _eventStream,
    );

    if (!isAsyncIterable(eventStream)) {
      return eventStream;
    }

    // For each payload yielded from a subscription, map it over the normal
    // GraphQL `execute` function, with `payload` as the rootValue.
    // This implements the "MapSourceToResponseEvent" algorithm described in
    // the GraphQL specification. The `execute` function provides the
    // "ExecuteSubscriptionEvent" algorithm, as it is nearly identical to the
    // "ExecuteQuery" algorithm, for which `execute` is also used.
    const mapSourceToResponse = (payload: unknown) => {
      const perPayloadExecutionContext = this.buildPerPayloadExecutionContext(
        exeContext,
        payload,
      );
      return this.executeQueryImpl(perPayloadExecutionContext);
    };

    // Map every source value to a ExecutionResult value as described above.
    return flattenAsyncIterable<ExecutionResult, AsyncExecutionResult>(
      mapAsyncIterable(eventStream, mapSourceToResponse),
    );
  }

  async createSourceEventStreamImpl(
    exeContext: ExecutionContext,
  ): Promise<AsyncIterable<unknown> | ExecutionResult> {
    return this.executeOperationImpl(
      exeContext,
      this.executeRootSubscriptionFields.bind(this),
      this.buildCreateSourceEventStreamResponse.bind(this),
    );
  }

  async executeRootSubscriptionField(
    exeContext: ExecutionContext,
    parentType: GraphQLObjectType,
    sourceValue: unknown,
    fieldNodes: ReadonlyArray<FieldNode>,
    fieldPath: Path,
    responseNode: ResponseNode,
  ): Promise<unknown> {
    const fieldContext = this.getFieldContext(parentType, fieldNodes);

    if (!fieldContext) {
      const fieldName = fieldNodes[0].name.value;
      responseNode.errors.push(
        new GraphQLError(
          `The subscription field "${fieldName}" is not defined.`,
          fieldNodes,
        ),
      );
      return null;
    }

    const info = this.buildResolveInfo(exeContext, fieldContext, fieldPath);

    try {
      const eventStream = await exeContext.resolveField(
        exeContext,
        fieldContext,
        sourceValue,
        info,
      );

      if (eventStream instanceof Error) {
        throw eventStream;
      }
      return eventStream;
    } catch (rawError) {
      responseNode.errors.push(
        this.toLocatedError(rawError, fieldNodes, fieldPath),
      );
      return null;
    }
  }

  addPatches(
    exeContext: ExecutionContext,
    patches: Array<PatchFields>,
    parentType: GraphQLObjectType,
    source: unknown,
    path: Path | undefined,
    parentResponseNode: ResponseNode,
  ): void {
    const { state, publisher } = exeContext;
    for (const patch of patches) {
      state.pendingPushes++;
      const { label, fields: patchFields } = patch;
      const errors: Array<GraphQLError> = [];
      const responseNode = { errors };
      const responseContext: SubsequentResponseContext = {
        responseNodes: [responseNode],
        parentResponseNode,
      };
      Promise.resolve(source)
        .then(() =>
          this.executeFields(
            exeContext,
            parentType,
            source,
            path,
            patchFields,
            responseNode,
          ),
        )
        .then(
          (data) =>
            publisher.queue(
              responseContext.responseNodes,
              { responseContext, data, path, label },
              responseContext.parentResponseNode,
            ),
          (error) => {
            // executeFields will never throw a raw error
            errors.push(error);
            publisher.queue(
              responseContext.responseNodes,
              { responseContext, data: null, path, label },
              responseContext.parentResponseNode,
            );
          },
        );
    }
  }

  addIteratorValue(
    initialIndex: number,
    iterator: Iterator<unknown>,
    exeContext: ExecutionContext,
    itemType: GraphQLOutputType,
    fieldContext: FieldContext,
    info: GraphQLResolveInfo,
    valueCompleter: ValueCompleter,
    streamContext: StreamContext,
  ): number {
    let index = initialIndex;
    let iteration = iterator.next();
    while (!iteration.done) {
      this.addValue(
        iteration.value,
        exeContext,
        itemType,
        fieldContext,
        info,
        valueCompleter,
        index,
        streamContext,
      );

      index++;
      iteration = iterator.next();
    }

    return index;
  }

  async addAsyncIteratorValue(
    initialIndex: number,
    iterator: AsyncIterator<unknown>,
    exeContext: ExecutionContext,
    itemType: GraphQLOutputType,
    fieldContext: FieldContext,
    info: GraphQLResolveInfo,
    valueCompleter: ValueCompleter,
    streamContext: StreamContext,
  ): Promise<void> {
    exeContext.state.iterators.add(iterator);

    let index = initialIndex;
    try {
      let iteration = await iterator.next();
      while (!iteration.done) {
        this.addValue(
          iteration.value,
          exeContext,
          itemType,
          fieldContext,
          info,
          valueCompleter,
          index,
          streamContext,
        );
        index++;
        // eslint-disable-next-line no-await-in-loop
        iteration = await iterator.next();
      }

      streamContext.bundler.setTotal(index);
    } catch (rawError) {
      exeContext.state.pendingStreamResults++;

      this.handleRawStreamError(
        fieldContext,
        itemType,
        streamContext,
        rawError,
        index,
      );

      streamContext.bundler.setTotal(index + 1);
    }

    this.closeAsyncIterator(exeContext, iterator);
  }

  handleRawStreamError(
    fieldContext: FieldContext,
    itemType: GraphQLOutputType,
    streamContext: StreamContext,
    rawError: unknown,
    index: number,
  ): void {
    const { path } = streamContext;
    const itemPath = addPath(path, index, undefined);
    const error = this.toLocatedError(
      rawError,
      fieldContext.fieldNodes,
      itemPath,
    );

    if (this._executorSchema.isNonNullType(itemType)) {
      streamContext.bundler.queueError(index, { errors: [error] });
    } else {
      streamContext.bundler.queueData(index, {
        responseNode: { errors: [error] },
        data: null,
      });
    }
  }

  addValue(
    value: unknown,
    exeContext: ExecutionContext,
    itemType: GraphQLOutputType,
    fieldContext: FieldContext,
    info: GraphQLResolveInfo,
    valueCompleter: ValueCompleter,
    index: number,
    streamContext: StreamContext,
  ): void {
    const itemPath = addPath(streamContext.path, index, undefined);

    const responseNode: ResponseNode = { errors: [] };
    exeContext.state.pendingStreamResults++;
    Promise.resolve(value)
      .then((resolved) =>
        valueCompleter(
          exeContext,
          fieldContext,
          info,
          itemPath,
          resolved,
          responseNode,
        ),
      )
      // Note: we don't rely on a `catch` method, but we do expect "thenable"
      // to take a second callback for the error case.
      .then(
        (data) =>
          streamContext.bundler.queueData(index, {
            responseNode,
            data,
          }),
        (rawError) =>
          this.handleRawStreamError(
            fieldContext,
            itemType,
            streamContext,
            rawError,
            index,
          ),
      );
  }

  closeAsyncIterator(
    exeContext: ExecutionContext,
    iterator: AsyncIterator<unknown>,
  ): void {
    const { state, publisher } = exeContext;
    state.iterators.delete(iterator);
    if (!this.hasNext(exeContext.state)) {
      publisher.stop({
        hasNext: false,
      });
    }
  }

  hasNext(state: ExecutionState): boolean {
    return (
      state.pendingPushes > 0 ||
      state.pendingStreamResults > 0 ||
      state.iterators.size > 0
    );
  }

  /**
   * Given an operation, collects all of the root fields and returns them.
   *
   * CollectFields requires the "runtime type" of an object. For a field that
   * returns an Interface or Union type, the "runtime type" will be the actual
   * object type returned by that field.
   */
  buildRootFieldCollector =
    (
      fragments: ObjMap<FragmentDefinitionNode>,
      variableValues: { [variable: string]: unknown },
      getDeferValues: DeferValuesGetter,
    ) =>
    (
      runtimeType: GraphQLObjectType,
      operation: OperationDefinitionNode,
    ): FieldsAndPatches => {
      const fields = new Map();
      const patches: Array<PatchFields> = [];
      this.collectFieldsImpl(
        fragments,
        variableValues,
        getDeferValues,
        runtimeType,
        operation.selectionSet,
        fields,
        patches,
        new Set(),
      );
      return { fields, patches };
    };

  /**
   * Given an array of field nodes, collects all of the subfields of the passed
   * in fields, and returns them at the end.
   *
   * CollectSubFields requires the "return type" of an object. For a field that
   * returns an Interface or Union type, the "return type" will be the actual
   * object type returned by that field.
   *
   * Memoizing ensures the subfields are not repeatedly calculated, which
   * saves overhead when resolving lists of values.
   */
  buildSubFieldCollector = (
    fragments: ObjMap<FragmentDefinitionNode>,
    variableValues: { [variable: string]: unknown },
    getDeferValues: DeferValuesGetter,
  ) =>
    memoize2(
      (
        returnType: GraphQLObjectType,
        fieldNodes: ReadonlyArray<FieldNode>,
      ): FieldsAndPatches => {
        const subFieldNodes = new Map();
        const visitedFragmentNames = new Set<string>();

        const subPatches: Array<PatchFields> = [];
        const subFieldsAndPatches = {
          fields: subFieldNodes,
          patches: subPatches,
        };

        for (const node of fieldNodes) {
          if (node.selectionSet) {
            this.collectFieldsImpl(
              fragments,
              variableValues,
              getDeferValues,
              returnType,
              node.selectionSet,
              subFieldNodes,
              subPatches,
              visitedFragmentNames,
            );
          }
        }
        return subFieldsAndPatches;
      },
    );

  collectFieldsImpl(
    fragments: ObjMap<FragmentDefinitionNode>,
    variableValues: { [variable: string]: unknown },
    getDeferValues: DeferValuesGetter,
    runtimeType: GraphQLObjectType,
    selectionSet: SelectionSetNode,
    fields: Map<string, Array<FieldNode>>,
    patches: Array<PatchFields>,
    visitedFragmentNames: Set<string>,
  ): void {
    for (const selection of selectionSet.selections) {
      switch (selection.kind) {
        case Kind.FIELD: {
          if (!this.shouldIncludeNode(variableValues, selection)) {
            continue;
          }
          const name = this.getFieldEntryKey(selection);
          const fieldList = fields.get(name);
          if (fieldList !== undefined) {
            fields.set(name, this.updateFieldList(fieldList, selection));
          } else {
            fields.set(name, this.createFieldList(selection));
          }
          break;
        }
        case Kind.INLINE_FRAGMENT: {
          if (
            !this.shouldIncludeNode(variableValues, selection) ||
            !this.doesFragmentConditionMatch(selection, runtimeType)
          ) {
            continue;
          }

          const defer = getDeferValues(variableValues, selection);

          if (defer) {
            const patchFields = new Map();
            this.collectFieldsImpl(
              fragments,
              variableValues,
              getDeferValues,
              runtimeType,
              selection.selectionSet,
              patchFields,
              patches,
              visitedFragmentNames,
            );
            patches.push({
              label: defer.label,
              fields: patchFields,
            });
          } else {
            this.collectFieldsImpl(
              fragments,
              variableValues,
              getDeferValues,
              runtimeType,
              selection.selectionSet,
              fields,
              patches,
              visitedFragmentNames,
            );
          }
          break;
        }
        case Kind.FRAGMENT_SPREAD: {
          const fragName = selection.name.value;

          if (!this.shouldIncludeNode(variableValues, selection)) {
            continue;
          }

          const defer = getDeferValues(variableValues, selection);
          if (visitedFragmentNames.has(fragName) && !defer) {
            continue;
          }

          const fragment = fragments[fragName];
          if (
            !fragment ||
            !this.doesFragmentConditionMatch(fragment, runtimeType)
          ) {
            continue;
          }

          if (defer) {
            const patchFields = new Map();
            this.collectFieldsImpl(
              fragments,
              variableValues,
              getDeferValues,
              runtimeType,
              fragment.selectionSet,
              patchFields,
              patches,
              visitedFragmentNames,
            );
            patches.push({
              label: defer.label,
              fields: patchFields,
            });
          } else {
            visitedFragmentNames.add(fragName);

            this.collectFieldsImpl(
              fragments,
              variableValues,
              getDeferValues,
              runtimeType,
              fragment.selectionSet,
              fields,
              patches,
              visitedFragmentNames,
            );
          }
          break;
        }
      }
    }
  }

  /**
   * Returns an object containing the `@defer` arguments if a field should be
   * deferred based on the experimental flag, defer directive present and
   * not disabled by the "if" argument.
   */
  getDeferValues(
    variableValues: { [variable: string]: unknown },
    node: FragmentSpreadNode | InlineFragmentNode,
  ): undefined | { label?: string } {
    const defer = getDirectiveValues(
      this._executorSchema,
      GraphQLDeferDirective,
      node,
      variableValues,
    );

    if (!defer) {
      return;
    }

    if (defer.if === false) {
      return;
    }

    return {
      label: typeof defer.label === 'string' ? defer.label : undefined,
    };
  }

  /**
   * Determines if a field should be included based on the `@include` and `@skip`
   * directives, where `@skip` has higher precedence than `@include`.
   */
  shouldIncludeNode(
    variableValues: { [variable: string]: unknown },
    node: FragmentSpreadNode | FieldNode | InlineFragmentNode,
  ): boolean {
    const skip = getDirectiveValues(
      this._executorSchema,
      GraphQLSkipDirective,
      node,
      variableValues,
    );
    if (skip?.if === true) {
      return false;
    }

    const include = getDirectiveValues(
      this._executorSchema,
      GraphQLIncludeDirective,
      node,
      variableValues,
    );
    if (include?.if === false) {
      return false;
    }
    return true;
  }

  /**
   * Determines if a fragment is applicable to the given type.
   */
  doesFragmentConditionMatch(
    fragment: FragmentDefinitionNode | InlineFragmentNode,
    type: GraphQLObjectType,
  ): boolean {
    const typeConditionNode = fragment.typeCondition;
    if (!typeConditionNode) {
      return true;
    }
    const conditionalType = this._executorSchema.getType(typeConditionNode);
    if (conditionalType === type) {
      return true;
    }
    if (
      conditionalType &&
      this._executorSchema.isAbstractType(conditionalType)
    ) {
      return this._executorSchema.isSubType(conditionalType, type);
    }
    return false;
  }

  /**
   * Implements the logic to compute the key of a given field's entry
   */
  getFieldEntryKey(node: FieldNode): string {
    return node.alias ? node.alias.value : node.name.value;
  }
}

/**
 * If a resolve function is not given, then a default resolve behavior is used
 * which takes the property of the source object of the same name as the field
 * and returns it as the result, or if it's a function, returns the result
 * of calling that function while passing along args and context value.
 */
export const defaultFieldResolver: GraphQLFieldResolver<unknown, unknown> =
  function (source: any, args, contextValue, info) {
    // ensure source is a value for which property access is acceptable.
    if (isObjectLike(source) || typeof source === 'function') {
      const property = source[info.fieldName];
      if (typeof property === 'function') {
        return source[info.fieldName](args, contextValue, info);
      }
      return property;
    }
  };

/**
 * If a resolveType function is not given, then a default resolve behavior is
 * used which attempts two strategies:
 *
 * First, See if the provided value has a `__typename` field defined, if so, use
 * that value as name of the resolved type.
 *
 * Otherwise, test each possible type for the abstract type by calling
 * isTypeOf for the object being coerced, returning the first type that matches.
 */
export const defaultTypeResolver: GraphQLTypeResolver<unknown, unknown> =
  function (value, contextValue, info, abstractType) {
    // First, look for `__typename`.
    if (isObjectLike(value) && typeof value.__typename === 'string') {
      return value.__typename;
    }

    // Otherwise, test each possible type.
    const possibleTypes = info.executorSchema.getPossibleTypes(abstractType);

    const promisedIsTypeOfResults = [];

    for (let i = 0; i < possibleTypes.length; i++) {
      const type = possibleTypes[i];

      if (type.isTypeOf) {
        const isTypeOfResult = type.isTypeOf(value, contextValue, info);

        if (isPromise(isTypeOfResult)) {
          promisedIsTypeOfResults[i] = isTypeOfResult;
        } else if (isTypeOfResult) {
          return type.name;
        }
      }
    }

    if (promisedIsTypeOfResults.length) {
      return Promise.all(promisedIsTypeOfResults).then((isTypeOfResults) => {
        for (let i = 0; i < isTypeOfResults.length; i++) {
          if (isTypeOfResults[i]) {
            return possibleTypes[i].name;
          }
        }
      });
    }
  };
