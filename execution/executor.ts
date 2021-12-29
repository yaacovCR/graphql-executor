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
} from 'graphql';
import {
  GraphQLError,
  Kind,
  SchemaMetaFieldDef,
  TypeMetaFieldDef,
  TypeNameMetaFieldDef,
  getOperationRootType,
  locatedError,
} from 'graphql';
import { GraphQLStreamDirective } from '../type/directives.ts';
import type { Path } from '../jsutils/Path.ts';
import type { ObjMap } from '../jsutils/ObjMap.ts';
import type { PromiseOrValue } from '../jsutils/PromiseOrValue.ts';
import type { Maybe } from '../jsutils/Maybe.ts';
import type { Push, Stop } from '../jsutils/repeater.ts';
import { inspect } from '../jsutils/inspect.ts';
import { memoize3 } from '../jsutils/memoize3.ts';
import { invariant } from '../jsutils/invariant.ts';
import { devAssert } from '../jsutils/devAssert.ts';
import { isPromise } from '../jsutils/isPromise.ts';
import { isObjectLike } from '../jsutils/isObjectLike.ts';
import { promiseReduce } from '../jsutils/promiseReduce.ts';
import { addPath, pathToArray } from '../jsutils/Path.ts';
import { isAsyncIterable } from '../jsutils/isAsyncIterable.ts';
import { isIterableObject } from '../jsutils/isIterableObject.ts';
import { resolveAfterAll } from '../jsutils/resolveAfterAll.ts';
import { Repeater } from '../jsutils/repeater.ts';
import { toError } from '../jsutils/toError.ts';
import { isGraphQLError } from '../error/isGraphQLError.ts';
import {
  isAbstractType,
  isLeafType,
  isListType,
  isNamedType,
  isNonNullType,
  isObjectType,
} from '../type/definition.ts';
import { isSubType } from '../utilities/isSubType.ts';
import { getPossibleTypes } from '../utilities/getPossibleTypes.ts';
import {
  getVariableValues,
  getArgumentValues as _getArgumentValues,
  getDirectiveValues,
} from './values.ts';
import type { FieldsAndPatches, PatchFields } from './collectFields.ts';
import {
  collectFields,
  collectSubfields as _collectSubfields,
} from './collectFields.ts';
import { mapAsyncIterable } from './mapAsyncIterable.ts';
import { flattenAsyncIterable } from './flattenAsyncIterable.ts';
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
 *
 * Namely, schema of the type system that is currently executing,
 * and the fragments defined in the query document
 */

interface ExecutionContext {
  schema: GraphQLSchema;
  fragments: ObjMap<FragmentDefinitionNode>;
  rootValue: unknown;
  contextValue: unknown;
  operation: OperationDefinitionNode;
  variableValues: {
    [variable: string]: unknown;
  };
  fieldResolver: GraphQLFieldResolver<any, any>;
  typeResolver: GraphQLTypeResolver<any, any>;
  forceQueryAlgorithm: boolean;
  disableIncremental: boolean;
  resolveField: FieldResolver;
  rootPayloadContext: PayloadContext;
  iterators: Set<AsyncIterator<unknown>>;
  publisher: Publisher | undefined;
  pendingPushes: number;
  pushedPayloads: WeakMap<PayloadContext, boolean>;
  pendingPayloads: WeakMap<PayloadContext, Array<IncrementalResult>>;
}
interface PayloadContext {
  errors: Array<GraphQLError>;
  label?: string;
}
interface IncrementalResult {
  payloadContext: PayloadContext;
  data: ObjMap<unknown> | unknown | null;
  path: Path | undefined;
}
interface Publisher {
  push: Push<ExecutionPatchResult>;
  stop: Stop;
}
export interface ExecutionArgs {
  schema: GraphQLSchema;
  document: DocumentNode;
  rootValue?: unknown;
  contextValue?: unknown;
  variableValues?: Maybe<{
    readonly [variable: string]: unknown;
  }>;
  operationName?: Maybe<string>;
  fieldResolver?: Maybe<GraphQLFieldResolver<any, any>>;
  typeResolver?: Maybe<GraphQLTypeResolver<any, any>>;
  subscribeFieldResolver?: Maybe<GraphQLFieldResolver<any, any>>;
  forceQueryAlgorithm?: Maybe<boolean>;
  disableIncremental?: Maybe<boolean>;
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
  label?: string;
  hasNext: boolean;
  extensions?: TExtensions;
}
export type AsyncExecutionResult = ExecutionResult | ExecutionPatchResult;
export type FieldsExecutor = (
  exeContext: ExecutionContext,
  parentType: GraphQLObjectType,
  sourceValue: unknown,
  path: Path | undefined,
  fields: Map<string, ReadonlyArray<FieldNode>>,
  payloadContext: PayloadContext,
) => PromiseOrValue<ObjMap<unknown>>;
export type FieldResolver = (
  exeContext: ExecutionContext,
  fieldDef: GraphQLField<unknown, unknown>,
  source: unknown,
  info: GraphQLResolveInfo,
  fieldNodes: ReadonlyArray<FieldNode>,
) => unknown;
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
  /**
   * A memoized collection of relevant subfields with regard to the return
   * type. Memoizing ensures the subfields are not repeatedly calculated, which
   * saves overhead when resolving lists of values.
   */
  collectSubfields = memoize3(
    (
      exeContext: ExecutionContext,
      returnType: GraphQLObjectType,
      fieldNodes: ReadonlyArray<FieldNode>,
    ) => {
      const { schema, fragments, variableValues, disableIncremental } =
        exeContext;
      return _collectSubfields(
        schema,
        fragments,
        variableValues,
        returnType,
        fieldNodes,
        disableIncremental,
      );
    },
  );
  /**
   * A memoized collection of field argument values.
   * Memoizing ensures the subfields are not repeatedly calculated, which
   * saves overhead when resolving lists of values.
   */

  getArgumentValues = memoize3(
    (
      def: GraphQLField<unknown, unknown>,
      node: FieldNode,
      variableValues: ObjMap<unknown>,
    ) => _getArgumentValues(def, node, variableValues),
  );
  /**
   * Implements the "Executing requests" section of the spec.
   */

  execute(
    args: ExecutionArgs,
  ): PromiseOrValue<
    ExecutionResult | AsyncGenerator<AsyncExecutionResult, void, void>
  > {
    const exeContext = this.buildExecutionContext(args); // If a valid execution context cannot be created due to incorrect arguments,
    // a "Response" with only errors is returned.

    if (!('schema' in exeContext)) {
      return {
        errors: exeContext,
      };
    }

    return this.executeImpl(exeContext);
  }

  async createSourceEventStream(
    args: ExecutionArgs,
  ): Promise<AsyncIterable<unknown> | ExecutionResult> {
    const exeContext = this.buildExecutionContext(args); // If a valid execution context cannot be created due to incorrect arguments,
    // a "Response" with only errors is returned.

    if (!('schema' in exeContext)) {
      return {
        errors: exeContext,
      };
    }

    return this.createSourceEventStreamImpl(exeContext);
  }

  executeImpl(
    exeContext: ExecutionContext,
  ): PromiseOrValue<
    ExecutionResult | AsyncGenerator<AsyncExecutionResult, void, void>
  > {
    const { operation, forceQueryAlgorithm } = exeContext;

    if (forceQueryAlgorithm) {
      return this.executeQueryAlgorithm(exeContext);
    }

    const operationType = operation.operation;

    switch (operationType) {
      case 'query':
        return this.executeQueryImpl(exeContext);

      case 'mutation':
        return this.executeMutationImpl(exeContext);

      default:
        return this.executeSubscriptionImpl(exeContext);
    }
  }

  executeQueryImpl(
    exeContext: ExecutionContext,
  ): PromiseOrValue<
    ExecutionResult | AsyncGenerator<AsyncExecutionResult, void, void>
  > {
    return this.executeQueryAlgorithm(exeContext);
  }
  /**
   * Implements the ExecuteQuery algorithm described in the GraphQL
   * specification. This algorithm is used to execute query operations
   * and to implement the ExecuteSubscriptionEvent algorith,
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

  executeQueryAlgorithm(
    exeContext: ExecutionContext,
  ): PromiseOrValue<
    ExecutionResult | AsyncGenerator<AsyncExecutionResult, void, void>
  > {
    return this.executeQueryOrMutationImpl(
      exeContext,
      this.executeFields.bind(this),
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
    return this.executeQueryOrMutationImpl(
      exeContext,
      this.executeFieldsSerially.bind(this),
    );
  }
  /**
   * Implements the Execute algorithm described in the GraphQL specification
   * for queries/mutations, using the provided parallel or serial fields
   * executor.
   */

  executeQueryOrMutationImpl(
    exeContext: ExecutionContext,
    fieldsExecutor: FieldsExecutor,
  ): PromiseOrValue<
    ExecutionResult | AsyncGenerator<AsyncExecutionResult, void, void>
  > {
    let data: PromiseOrValue<ObjMap<unknown> | null>;

    try {
      data = this.executeRootFields(exeContext, fieldsExecutor);
    } catch (error) {
      exeContext.rootPayloadContext.errors.push(error);
      return this.buildResponse(exeContext, null);
    }

    if (isPromise(data)) {
      return data.then(
        (resolvedData) => this.buildResponse(exeContext, resolvedData),
        (error) => {
          exeContext.rootPayloadContext.errors.push(error);
          return this.buildResponse(exeContext, null);
        },
      );
    }

    return this.buildResponse(exeContext, data);
  }
  /**
   * Given a completed execution context and data, build the `{ errors, data }`
   * response defined by the "Response" section of the GraphQL specification.
   */

  buildResponse(
    exeContext: ExecutionContext,
    data: ObjMap<unknown> | null,
  ): ExecutionResult | AsyncGenerator<AsyncExecutionResult, void, void> {
    const { rootPayloadContext } = exeContext;
    const errors = rootPayloadContext.errors;
    const initialResult =
      errors.length === 0
        ? {
            data,
          }
        : {
            errors,
            data,
          };

    if (this.hasNext(exeContext)) {
      return new Repeater((push, stop) => {
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        stop.then(() =>
          Promise.all(
            Array.from(exeContext.iterators.values()).map((iterator) =>
              iterator.return?.(),
            ),
          ),
        );
        exeContext.publisher = {
          push,
          stop,
        };
        const { pushedPayloads, pendingPayloads } = exeContext;
        pushedPayloads.set(rootPayloadContext, true); // eslint-disable-next-line @typescript-eslint/no-floating-promises

        push({ ...initialResult, hasNext: true });
        const parentPendingPayloads = pendingPayloads.get(rootPayloadContext);

        if (parentPendingPayloads) {
          this.pushResults(exeContext, push, stop, parentPendingPayloads);
        }

        pendingPayloads.delete(rootPayloadContext);
      });
    }

    return initialResult;
  }
  /**
   * Essential assertions before executing to provide developer feedback for
   * improper use of the GraphQL library.
   */

  assertValidExecutionArguments(
    schema: GraphQLSchema,
    document: DocumentNode,
    rawVariableValues: Maybe<{
      readonly [variable: string]: unknown;
    }>,
  ): void {
    document || devAssert(false, 'Must provide document.'); // Schema must be provided.

    schema || devAssert(false, 'Must provide schema.'); // Variables, if provided, must be an object.

    rawVariableValues == null ||
      isObjectLike(rawVariableValues) ||
      devAssert(
        false,
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
      fieldDef: GraphQLField<unknown, unknown>,
      source: unknown,
      info: GraphQLResolveInfo,
      fieldNodes: ReadonlyArray<FieldNode>,
    ) => {
      const resolveFn = fieldDef[resolverKey] ?? defaultResolver; // Build a JS object of arguments from the field.arguments AST, using the
      // variables scope to fulfill any variable references.

      const args = this.getArgumentValues(
        fieldDef,
        fieldNodes[0],
        exeContext.variableValues,
      ); // The resolve function's optional third argument is a context value that
      // is provided to every resolve function within an execution. It is commonly
      // used to represent an authenticated user, or request-specific caches.

      const contextValue = exeContext.contextValue;
      return resolveFn(source, args, contextValue, info);
    };
  /**
   * Constructs a ExecutionContext object from the arguments passed to
   * execute, which we will pass throughout the other execution methods.
   *
   * Returns an array of GraphQLErrors if a valid execution context
   * cannot be created.
   */

  buildExecutionContext(
    args: ExecutionArgs,
  ): ReadonlyArray<GraphQLError> | ExecutionContext {
    const {
      schema,
      document,
      rootValue,
      contextValue,
      variableValues: rawVariableValues,
      operationName,
      fieldResolver,
      typeResolver,
      subscribeFieldResolver,
      forceQueryAlgorithm,
      disableIncremental,
    } = args; // If arguments are missing or incorrectly typed, this is an internal
    // developer mistake which should throw an error.

    this.assertValidExecutionArguments(schema, document, rawVariableValues);
    let operation: OperationDefinitionNode | undefined;
    const fragments: ObjMap<FragmentDefinitionNode> = Object.create(null);

    for (const definition of document.definitions) {
      switch (definition.kind) {
        case Kind.OPERATION_DEFINITION:
          if (operationName == null) {
            if (operation !== undefined) {
              return [
                new GraphQLError(
                  'Must provide operation name if query contains multiple operations.',
                ),
              ];
            }

            operation = definition;
          } else if (definition.name?.value === operationName) {
            operation = definition;
          }

          break;

        case Kind.FRAGMENT_DEFINITION:
          fragments[definition.name.value] = definition;
          break;

        default: // ignore non-executable definitions
      }
    }

    if (!operation) {
      if (operationName != null) {
        return [
          new GraphQLError(`Unknown operation named "${operationName}".`),
        ];
      }

      return [new GraphQLError('Must provide an operation.')];
    } // See: 'https://github.com/graphql/graphql-js/issues/2203'

    const variableDefinitions =
      /* c8 ignore next */
      operation.variableDefinitions ?? [];
    const coercedVariableValues = getVariableValues(
      schema,
      variableDefinitions,
      rawVariableValues ?? {},
      {
        maxErrors: 50,
      },
    );

    if (coercedVariableValues.errors) {
      return coercedVariableValues.errors;
    }

    const defaultResolveFieldValueFn = fieldResolver ?? defaultFieldResolver;
    return {
      schema,
      fragments,
      rootValue,
      contextValue,
      operation,
      variableValues: coercedVariableValues.coerced,
      fieldResolver: defaultResolveFieldValueFn,
      typeResolver: typeResolver ?? defaultTypeResolver,
      forceQueryAlgorithm: forceQueryAlgorithm ?? false,
      disableIncremental: disableIncremental ?? false,
      resolveField:
        operation.operation === 'subscription' && !forceQueryAlgorithm
          ? this.buildFieldResolver(
              'subscribe',
              subscribeFieldResolver ?? defaultFieldResolver,
            )
          : this.buildFieldResolver('resolve', defaultResolveFieldValueFn),
      rootPayloadContext: {
        errors: [],
      },
      iterators: new Set(),
      publisher: undefined,
      pendingPushes: 0,
      pushedPayloads: new WeakMap(),
      pendingPayloads: new WeakMap(),
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
    return {
      ...exeContext,
      rootValue: payload,
      forceQueryAlgorithm: true,
      resolveField: this.buildFieldResolver(
        'resolve',
        exeContext.fieldResolver,
      ),
      rootPayloadContext: {
        errors: [],
      },
      iterators: new Set(),
      publisher: undefined,
      pendingPushes: 0,
      pushedPayloads: new WeakMap(),
      pendingPayloads: new WeakMap(),
    };
  }
  /**
   * Executes the root fields specified by the operation.
   */

  executeRootFields(
    exeContext: ExecutionContext,
    fieldsExecutor: FieldsExecutor,
  ): PromiseOrValue<ObjMap<unknown> | null> {
    const {
      schema,
      fragments,
      rootValue,
      operation,
      variableValues,
      disableIncremental,
      rootPayloadContext,
    } = exeContext;
    const {
      rootType,
      fieldsAndPatches: { fields, patches },
    } = this.parseOperationRoot(
      schema,
      fragments,
      variableValues,
      operation,
      disableIncremental,
    );
    const path = undefined;
    const result = fieldsExecutor(
      exeContext,
      rootType,
      rootValue,
      path,
      fields,
      rootPayloadContext,
    );
    this.addPatches(
      exeContext,
      patches,
      rootType,
      rootValue,
      path,
      rootPayloadContext,
    );
    return result;
  }

  parseOperationRoot(
    schema: GraphQLSchema,
    fragments: ObjMap<FragmentDefinitionNode>,
    variableValues: {
      [variable: string]: unknown;
    },
    operation: OperationDefinitionNode,
    disableIncremental: boolean,
  ): {
    rootType: GraphQLObjectType;
    fieldsAndPatches: FieldsAndPatches;
  } {
    // TODO: replace getOperationRootType with schema.getRootType
    // after pre-v16 is dropped
    const rootType = getOperationRootType(schema, operation);
    const fieldsAndPatches = collectFields(
      schema,
      fragments,
      variableValues,
      rootType,
      operation.selectionSet,
      disableIncremental,
    );
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
    return promiseReduce(
      fields.entries(),
      (results, [responseName, fieldNodes]) => {
        const fieldPath = addPath(path, responseName, parentType.name);
        const result = this.executeField(
          exeContext,
          parentType,
          sourceValue,
          fieldNodes,
          fieldPath,
          exeContext.rootPayloadContext,
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
    payloadContext: PayloadContext,
  ): PromiseOrValue<ObjMap<unknown>> {
    const results = Object.create(null);
    const promises: Array<Promise<void>> = [];

    for (const [responseName, fieldNodes] of fields.entries()) {
      const fieldPath = addPath(path, responseName, parentType.name);
      const result = this.executeField(
        exeContext,
        parentType,
        sourceValue,
        fieldNodes,
        fieldPath,
        payloadContext,
      );

      if (result !== undefined) {
        if (isPromise(result)) {
          const promise = result.then((resolved) => {
            results[responseName] = resolved;
          });
          promises.push(promise);
        } else {
          results[responseName] = result;
        }
      }
    } // If there are no promises, we can just return the object

    if (!promises.length) {
      return results;
    } // Otherwise, results will only eventually be a map from field name to the
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
    payloadContext: PayloadContext,
  ): PromiseOrValue<unknown> {
    const fieldDef = this.getFieldDef(
      exeContext.schema,
      parentType,
      fieldNodes[0],
    );

    if (!fieldDef) {
      return;
    }

    const returnType = fieldDef.type;
    const info = this.buildResolveInfo(
      exeContext,
      fieldDef,
      fieldNodes,
      parentType,
      path,
    ); // Get the resolved field value, regardless of if its result is normal or abrupt (error).
    // Then, complete the field

    try {
      const result = exeContext.resolveField(
        exeContext,
        fieldDef,
        source,
        info,
        fieldNodes,
      );
      let completed;

      if (isPromise(result)) {
        completed = result.then((resolved) =>
          this.completeValue(
            exeContext,
            returnType,
            fieldNodes,
            info,
            path,
            resolved,
            payloadContext,
          ),
        );
      } else {
        completed = this.completeValue(
          exeContext,
          returnType,
          fieldNodes,
          info,
          path,
          result,
          payloadContext,
        );
      }

      if (isPromise(completed)) {
        // Note: we don't rely on a `catch` method, but we do expect "thenable"
        // to take a second callback for the error case.
        return completed.then(undefined, (rawError) => {
          const error = locatedError(
            toError(rawError),
            fieldNodes,
            pathToArray(path),
          );
          return this.handleFieldError(
            error,
            returnType,
            payloadContext.errors,
          );
        });
      }

      return completed;
    } catch (rawError) {
      const error = locatedError(
        toError(rawError),
        fieldNodes,
        pathToArray(path),
      );
      return this.handleFieldError(error, returnType, payloadContext.errors);
    }
  }

  buildResolveInfo(
    exeContext: ExecutionContext,
    fieldDef: GraphQLField<unknown, unknown>,
    fieldNodes: ReadonlyArray<FieldNode>,
    parentType: GraphQLObjectType,
    path: Path,
  ): GraphQLResolveInfo {
    // The resolve function's optional fourth argument is a collection of
    // information about the current execution state.
    return {
      fieldName: fieldDef.name,
      fieldNodes,
      returnType: fieldDef.type,
      parentType,
      path,
      schema: exeContext.schema,
      fragments: exeContext.fragments,
      rootValue: exeContext.rootValue,
      operation: exeContext.operation,
      variableValues: exeContext.variableValues,
    };
  }

  handleFieldError(
    error: GraphQLError,
    returnType: GraphQLOutputType,
    errors: Array<GraphQLError>,
  ): null {
    // If the field type is non-nullable, then it is resolved without any
    // protection from errors, however it still properly locates the error.
    if (isNonNullType(returnType)) {
      throw error;
    } // Otherwise, error protection is applied, logging the error and resolving
    // a null value for this field if one is encountered.

    errors.push(error);
    return null;
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

  completeValue(
    exeContext: ExecutionContext,
    returnType: GraphQLOutputType,
    fieldNodes: ReadonlyArray<FieldNode>,
    info: GraphQLResolveInfo,
    path: Path,
    result: unknown,
    payloadContext: PayloadContext,
  ): PromiseOrValue<unknown> {
    // If result is an Error, throw a located error.
    if (result instanceof Error) {
      throw result;
    } // If field type is NonNull, complete for inner type, and throw field error
    // if result is null.

    if (isNonNullType(returnType)) {
      const completed = this.completeValue(
        exeContext,
        returnType.ofType,
        fieldNodes,
        info,
        path,
        result,
        payloadContext,
      );

      if (completed === null) {
        throw new Error(
          `Cannot return null for non-nullable field ${info.parentType.name}.${info.fieldName}.`,
        );
      }

      return completed;
    } // If result value is null or undefined then return null.

    if (result == null) {
      return null;
    } // If field type is List, complete each item in the list with the inner type

    if (isListType(returnType)) {
      return this.completeListValue(
        exeContext,
        returnType,
        fieldNodes,
        info,
        path,
        result,
        payloadContext,
      );
    } // If field type is a leaf type, Scalar or Enum, serialize to a valid value,
    // returning null if serialization is not possible.

    if (isLeafType(returnType)) {
      return this.completeLeafValue(returnType, result);
    } // If field type is an abstract type, Interface or Union, determine the
    // runtime Object type and complete for that type.

    if (isAbstractType(returnType)) {
      return this.completeAbstractValue(
        exeContext,
        returnType,
        fieldNodes,
        info,
        path,
        result,
        payloadContext,
      );
    } // If field type is Object, execute and complete all sub-selections.

    if (isObjectType(returnType)) {
      return this.completeObjectValue(
        exeContext,
        returnType,
        fieldNodes,
        info,
        path,
        result,
        payloadContext,
      );
    }
    /* c8 ignore next 6 */
    // Not reachable. All possible output types have been considered

    false ||
      invariant(
        false,
        'Cannot complete value of unexpected output type: ' +
          inspect(returnType),
      );
  }
  /**
   * Complete a list value by completing each item in the list with the
   * inner type
   */

  completeListValue(
    exeContext: ExecutionContext,
    returnType: GraphQLList<GraphQLOutputType>,
    fieldNodes: ReadonlyArray<FieldNode>,
    info: GraphQLResolveInfo,
    path: Path,
    result: unknown,
    payloadContext: PayloadContext,
  ): PromiseOrValue<ReadonlyArray<unknown>> {
    const itemType = returnType.ofType;

    if (isAsyncIterable(result)) {
      const iterator = result[Symbol.asyncIterator]();
      return this.completeAsyncIteratorValue(
        exeContext,
        itemType,
        fieldNodes,
        info,
        path,
        iterator,
        payloadContext,
      );
    }

    if (!isIterableObject(result)) {
      throw new GraphQLError(
        `Expected Iterable, but did not find one for field "${info.parentType.name}.${info.fieldName}".`,
      );
    }

    const iterator = result[Symbol.iterator]();
    return this.completeIteratorValue(
      exeContext,
      itemType,
      fieldNodes,
      info,
      path,
      iterator,
      payloadContext,
    );
  }
  /**
   * Returns an object containing the `@stream` arguments if a field should be
   * streamed based on the experimental flag, stream directive present and
   * not disabled by the "if" argument.
   */

  getStreamValues(
    exeContext: ExecutionContext,
    fieldNodes: ReadonlyArray<FieldNode>,
  ):
    | undefined
    | {
        initialCount?: number;
        label?: string;
      } {
    if (exeContext.disableIncremental) {
      return;
    } // validation only allows equivalent streams on multiple fields, so it is
    // safe to only check the first fieldNode for the stream directive

    const stream = getDirectiveValues(
      GraphQLStreamDirective,
      fieldNodes[0],
      exeContext.variableValues,
    );

    if (!stream) {
      return;
    }

    if (stream.if === false) {
      return;
    }

    typeof stream.initialCount === 'number' ||
      invariant(false, 'initialCount must be a number');
    stream.initialCount >= 0 ||
      invariant(false, 'initialCount must be a positive integer');
    return {
      initialCount: stream.initialCount,
      label: typeof stream.label === 'string' ? stream.label : undefined,
    };
  }
  /**
   * Complete an iterator value by completing each result.
   */

  completeIteratorValue(
    exeContext: ExecutionContext,
    itemType: GraphQLOutputType,
    fieldNodes: ReadonlyArray<FieldNode>,
    info: GraphQLResolveInfo,
    path: Path,
    iterator: Iterator<unknown>,
    payloadContext: PayloadContext,
  ): PromiseOrValue<ReadonlyArray<unknown>> {
    const stream = this.getStreamValues(exeContext, fieldNodes); // This is specified as a simple map, however we're optimizing the path
    // where the list contains no Promises by avoiding creating another Promise.

    const promises: Array<Promise<void>> = [];
    const completedResults: Array<unknown> = [];
    let index = 0; // eslint-disable-next-line no-constant-condition

    while (true) {
      if (
        stream &&
        typeof stream.initialCount === 'number' &&
        index >= stream.initialCount
      ) {
        this.addIteratorValue(
          index,
          iterator,
          exeContext,
          fieldNodes,
          info,
          itemType,
          path,
          stream.label,
          payloadContext,
        );
        break;
      }

      const itemPath = addPath(path, index, undefined);
      const iteration = iterator.next();

      if (iteration.done) {
        break;
      }

      this.completeListItemValue(
        completedResults,
        index,
        promises,
        iteration.value,
        exeContext,
        itemType,
        fieldNodes,
        info,
        itemPath,
        payloadContext,
      );
      index++;
    }

    return promises.length
      ? resolveAfterAll(completedResults, promises)
      : completedResults;
  }
  /**
   * Complete an async iterator value by completing each result.
   */

  async completeAsyncIteratorValue(
    exeContext: ExecutionContext,
    itemType: GraphQLOutputType,
    fieldNodes: ReadonlyArray<FieldNode>,
    info: GraphQLResolveInfo,
    path: Path,
    iterator: AsyncIterator<unknown>,
    payloadContext: PayloadContext,
  ): Promise<ReadonlyArray<unknown>> {
    const stream = this.getStreamValues(exeContext, fieldNodes); // This is specified as a simple map, however we're optimizing the path
    // where the list contains no Promises by avoiding creating another Promise.

    const promises: Array<Promise<void>> = [];
    const completedResults: Array<unknown> = [];
    let index = 0; // eslint-disable-next-line no-constant-condition

    while (true) {
      if (
        stream &&
        typeof stream.initialCount === 'number' &&
        index >= stream.initialCount
      ) {
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        this.addAsyncIteratorValue(
          index,
          iterator,
          exeContext,
          fieldNodes,
          info,
          itemType,
          path,
          stream.label,
          payloadContext,
        );
        break;
      }

      const itemPath = addPath(path, index, undefined);
      let iteration: IteratorResult<unknown>;

      try {
        // eslint-disable-next-line no-await-in-loop
        iteration = await iterator.next();
      } catch (rawError) {
        const error = locatedError(
          toError(rawError),
          fieldNodes,
          pathToArray(itemPath),
        );
        completedResults.push(
          this.handleFieldError(error, itemType, payloadContext.errors),
        );
        break;
      }

      if (iteration.done) {
        break;
      }

      this.completeListItemValue(
        completedResults,
        index,
        promises,
        iteration.value,
        exeContext,
        itemType,
        fieldNodes,
        info,
        itemPath,
        payloadContext,
      );
      index++;
    }

    return promises.length
      ? resolveAfterAll(completedResults, promises)
      : completedResults;
  }

  completeListItemValue(
    completedResults: Array<unknown>,
    index: number,
    promises: Array<Promise<void>>,
    item: unknown,
    exeContext: ExecutionContext,
    itemType: GraphQLOutputType,
    fieldNodes: ReadonlyArray<FieldNode>,
    info: GraphQLResolveInfo,
    itemPath: Path,
    payloadContext: PayloadContext,
  ): void {
    try {
      let completedItem;

      if (isPromise(item)) {
        completedItem = item.then((resolved) =>
          this.completeValue(
            exeContext,
            itemType,
            fieldNodes,
            info,
            itemPath,
            resolved,
            payloadContext,
          ),
        );
      } else {
        completedItem = this.completeValue(
          exeContext,
          itemType,
          fieldNodes,
          info,
          itemPath,
          item,
          payloadContext,
        );
      }

      completedResults[index] = completedItem;

      if (!isPromise(completedItem)) {
        return;
      } // Note: we don't rely on a `catch` method, but we do expect "thenable"
      // to take a second callback for the error case.

      const promise = completedItem
        .then(undefined, (rawError) => {
          const error = locatedError(
            toError(rawError),
            fieldNodes,
            pathToArray(itemPath),
          );
          return this.handleFieldError(error, itemType, payloadContext.errors);
        })
        .then((resolved) => {
          completedResults[index] = resolved;
        });
      promises.push(promise);
    } catch (rawError) {
      const error = locatedError(
        toError(rawError),
        fieldNodes,
        pathToArray(itemPath),
      );
      completedResults[index] = this.handleFieldError(
        error,
        itemType,
        payloadContext.errors,
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
    fieldNodes: ReadonlyArray<FieldNode>,
    info: GraphQLResolveInfo,
    path: Path,
    result: unknown,
    payloadContext: PayloadContext,
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
            exeContext,
            returnType,
            fieldNodes,
            info,
            result,
          ),
          fieldNodes,
          info,
          path,
          result,
          payloadContext,
        ),
      );
    }

    return this.completeObjectValue(
      exeContext,
      this.ensureValidRuntimeType(
        runtimeType,
        exeContext,
        returnType,
        fieldNodes,
        info,
        result,
      ),
      fieldNodes,
      info,
      path,
      result,
      payloadContext,
    );
  }

  ensureValidRuntimeType(
    runtimeTypeOrName: unknown,
    exeContext: ExecutionContext,
    returnType: GraphQLAbstractType,
    fieldNodes: ReadonlyArray<FieldNode>,
    info: GraphQLResolveInfo,
    result: unknown,
  ): GraphQLObjectType {
    if (runtimeTypeOrName == null) {
      throw new GraphQLError(
        `Abstract type "${returnType.name}" must resolve to an Object type at runtime for field "${info.parentType.name}.${info.fieldName}". Either the "${returnType.name}" type should provide a "resolveType" function or each possible type should provide an "isTypeOf" function.`,
        fieldNodes,
      );
    }

    const runtimeTypeName =
      typeof runtimeTypeOrName === 'object' && isNamedType(runtimeTypeOrName)
        ? runtimeTypeOrName.name
        : runtimeTypeOrName;

    if (typeof runtimeTypeName !== 'string') {
      throw new GraphQLError(
        `Abstract type "${returnType.name}" must resolve to an Object type at runtime for field "${info.parentType.name}.${info.fieldName}" with ` +
          `value ${inspect(result)}, received "${inspect(runtimeTypeName)}".`,
      );
    }

    const runtimeType = exeContext.schema.getType(runtimeTypeName);

    if (runtimeType == null) {
      throw new GraphQLError(
        `Abstract type "${returnType.name}" was resolved to a type "${runtimeTypeName}" that does not exist inside the schema.`,
        fieldNodes,
      );
    }

    if (!isObjectType(runtimeType)) {
      throw new GraphQLError(
        `Abstract type "${returnType.name}" was resolved to a non-object type "${runtimeTypeName}".`,
        fieldNodes,
      );
    }

    if (!isSubType(exeContext.schema, returnType, runtimeType)) {
      throw new GraphQLError(
        `Runtime Object type "${runtimeType.name}" is not a possible type for "${returnType.name}".`,
        fieldNodes,
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
    fieldNodes: ReadonlyArray<FieldNode>,
    info: GraphQLResolveInfo,
    path: Path,
    result: unknown,
    payloadContext: PayloadContext,
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
            throw this.invalidReturnTypeError(returnType, result, fieldNodes);
          }

          return this.collectAndExecuteSubfields(
            exeContext,
            returnType,
            fieldNodes,
            path,
            result,
            payloadContext,
          );
        });
      }

      if (!isTypeOf) {
        throw this.invalidReturnTypeError(returnType, result, fieldNodes);
      }
    }

    return this.collectAndExecuteSubfields(
      exeContext,
      returnType,
      fieldNodes,
      path,
      result,
      payloadContext,
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
    fieldNodes: ReadonlyArray<FieldNode>,
    path: Path,
    result: unknown,
    payloadContext: PayloadContext,
  ): PromiseOrValue<ObjMap<unknown>> {
    // Collect sub-fields to execute to complete this value.
    const { fields: subFieldNodes, patches: subPatches } =
      this.collectSubfields(exeContext, returnType, fieldNodes);
    const subFields = this.executeFields(
      exeContext,
      returnType,
      result,
      path,
      subFieldNodes,
      payloadContext,
    );
    this.addPatches(
      exeContext,
      subPatches,
      returnType,
      result,
      path,
      payloadContext,
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
   */

  getFieldDef(
    schema: GraphQLSchema,
    parentType: GraphQLObjectType,
    fieldNode: FieldNode,
  ): Maybe<GraphQLField<unknown, unknown>> {
    const fieldName = fieldNode.name.value;

    if (
      fieldName === SchemaMetaFieldDef.name &&
      schema.getQueryType() === parentType
    ) {
      return SchemaMetaFieldDef;
    } else if (
      fieldName === TypeMetaFieldDef.name &&
      schema.getQueryType() === parentType
    ) {
      return TypeMetaFieldDef;
    } else if (fieldName === TypeNameMetaFieldDef.name) {
      return TypeNameMetaFieldDef;
    }

    return parentType.getFields()[fieldName];
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
   *
   * Accepts either an object with named arguments, or individual arguments.
   */

  async executeSubscriptionImpl(
    exeContext: ExecutionContext,
  ): Promise<
    AsyncGenerator<AsyncExecutionResult, void, void> | ExecutionResult
  > {
    const resultOrStream = await this.createSourceEventStreamImpl(exeContext);

    if (!isAsyncIterable(resultOrStream)) {
      return resultOrStream;
    } // For each payload yielded from a subscription, map it over the normal
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
      return this.executeSubscriptionEvent(perPayloadExecutionContext);
    }; // Map every source value to a ExecutionResult value as described above.

    return flattenAsyncIterable<ExecutionResult, AsyncExecutionResult>(
      mapAsyncIterable(resultOrStream, mapSourceToResponse),
    );
  }

  async createSourceEventStreamImpl(
    exeContext: ExecutionContext,
  ): Promise<AsyncIterable<unknown> | ExecutionResult> {
    try {
      const eventStream = await this.executeSubscriptionRootField(exeContext); // Assert field returned an event stream, otherwise yield an error.

      if (!isAsyncIterable(eventStream)) {
        throw new Error(
          'Subscription field must return Async Iterable. ' +
            `Received: ${inspect(eventStream)}.`,
        );
      }

      return eventStream;
    } catch (error) {
      // If it GraphQLError, report it as an ExecutionResult, containing only errors and no data.
      // Otherwise treat the error as a system-class error and re-throw it.
      if (isGraphQLError(error)) {
        return {
          errors: [error],
        };
      }

      throw error;
    }
  }

  async executeSubscriptionRootField(
    exeContext: ExecutionContext,
  ): Promise<unknown> {
    const {
      schema,
      fragments,
      rootValue,
      operation,
      variableValues,
      disableIncremental,
    } = exeContext;
    const {
      rootType,
      fieldsAndPatches: { fields },
    } = this.parseOperationRoot(
      schema,
      fragments,
      variableValues,
      operation,
      disableIncremental,
    );
    const [responseName, fieldNodes] = [...fields.entries()][0];
    const fieldDef = this.getFieldDef(schema, rootType, fieldNodes[0]);

    if (!fieldDef) {
      const fieldName = fieldNodes[0].name.value;
      throw new GraphQLError(
        `The subscription field "${fieldName}" is not defined.`,
        fieldNodes,
      );
    }

    const path = addPath(undefined, responseName, rootType.name);
    const info = this.buildResolveInfo(
      exeContext,
      fieldDef,
      fieldNodes,
      rootType,
      path,
    );

    try {
      const eventStream = await exeContext.resolveField(
        exeContext,
        fieldDef,
        rootValue,
        info,
        fieldNodes,
      );

      if (eventStream instanceof Error) {
        throw eventStream;
      }

      return eventStream;
    } catch (error) {
      throw locatedError(toError(error), fieldNodes, pathToArray(path));
    }
  }

  executeSubscriptionEvent(
    exeContext: ExecutionContext,
  ): PromiseOrValue<
    ExecutionResult | AsyncGenerator<AsyncExecutionResult, void, void>
  > {
    return this.executeQueryAlgorithm(exeContext);
  }

  addPatches(
    exeContext: ExecutionContext,
    patches: Array<PatchFields>,
    parentType: GraphQLObjectType,
    source: unknown,
    path: Path | undefined,
    parentPayloadContext: PayloadContext,
  ): void {
    for (const patch of patches) {
      exeContext.pendingPushes++;
      const { label, fields: patchFields } = patch;
      const payloadContext: PayloadContext = {
        errors: [],
        label,
      };
      Promise.resolve(source)
        .then(() =>
          this.executeFields(
            exeContext,
            parentType,
            source,
            path,
            patchFields,
            payloadContext,
          ),
        )
        .then(
          (data) =>
            this.queue(
              exeContext,
              payloadContext,
              parentPayloadContext,
              data,
              path,
            ),
          (error) => {
            this.handleFieldError(error, parentType, payloadContext.errors);
            this.queue(
              exeContext,
              payloadContext,
              parentPayloadContext,
              null,
              path,
            );
          },
        );
    }
  }

  addIteratorValue(
    initialIndex: number,
    iterator: Iterator<unknown>,
    exeContext: ExecutionContext,
    fieldNodes: ReadonlyArray<FieldNode>,
    info: GraphQLResolveInfo,
    itemType: GraphQLOutputType,
    path: Path,
    label: string | undefined,
    parentPayloadContext: PayloadContext,
  ): void {
    let index = initialIndex;
    let prevPayloadContext = parentPayloadContext;
    let iteration = iterator.next();

    while (!iteration.done) {
      const _prevPayloadContext = prevPayloadContext;
      const payloadContext: PayloadContext = {
        errors: [],
        label,
      }; // avoid unsafe reference of variable from functions inside a loop
      // see https://eslint.org/docs/rules/no-loop-func

      exeContext.pendingPushes++;
      const itemPath = addPath(path, index, undefined);
      Promise.resolve(iteration.value)
        .then((resolved) =>
          this.completeValue(
            exeContext,
            itemType,
            fieldNodes,
            info,
            itemPath,
            resolved,
            payloadContext,
          ),
        )
        .then((data) =>
          this.queue(
            exeContext,
            payloadContext,
            _prevPayloadContext,
            data,
            itemPath,
          ),
        )
        .then(undefined, (rawError) => {
          const error = locatedError(
            toError(rawError),
            fieldNodes,
            pathToArray(itemPath),
          );
          payloadContext.errors.push(error);
          this.queue(
            exeContext,
            payloadContext,
            _prevPayloadContext,
            null,
            itemPath,
          );
        });
      index++;
      prevPayloadContext = payloadContext;
      iteration = iterator.next();
    }
  }

  async addAsyncIteratorValue(
    initialIndex: number,
    iterator: AsyncIterator<unknown>,
    exeContext: ExecutionContext,
    fieldNodes: ReadonlyArray<FieldNode>,
    info: GraphQLResolveInfo,
    itemType: GraphQLOutputType,
    path: Path,
    label: string | undefined,
    parentPayloadContext: PayloadContext,
  ): Promise<void> {
    const { iterators } = exeContext;
    iterators.add(iterator);
    let index = initialIndex;
    let prevPayloadContext = parentPayloadContext;
    let currentPayloadContext: PayloadContext = {
      errors: [],
      label,
    };
    let iteration = await this.advanceAsyncIterator(
      index,
      iterator,
      exeContext,
      fieldNodes,
      itemType,
      path,
      currentPayloadContext,
      parentPayloadContext,
    );

    while (iteration && !iteration.done) {
      // avoid unsafe reference of variable from functions inside a loop
      // see https://eslint.org/docs/rules/no-loop-func
      const _prevPayloadContext = prevPayloadContext;
      const _currentPayloadContext = currentPayloadContext;
      exeContext.pendingPushes++;
      const itemPath = addPath(path, index, undefined);
      Promise.resolve(iteration.value)
        .then((resolved) =>
          this.completeValue(
            exeContext,
            itemType,
            fieldNodes,
            info,
            itemPath,
            resolved,
            _currentPayloadContext,
          ),
        )
        .then((data) =>
          this.queue(
            exeContext,
            _currentPayloadContext,
            _prevPayloadContext,
            data,
            itemPath,
          ),
        )
        .then(undefined, (rawError) => {
          const error = locatedError(
            toError(rawError),
            fieldNodes,
            pathToArray(itemPath),
          );

          _currentPayloadContext.errors.push(error);

          this.queue(
            exeContext,
            _currentPayloadContext,
            _prevPayloadContext,
            null,
            itemPath,
          );
        });
      index++;
      prevPayloadContext = currentPayloadContext;
      currentPayloadContext = {
        errors: [],
        label,
      }; // eslint-disable-next-line no-await-in-loop

      iteration = await this.advanceAsyncIterator(
        index,
        iterator,
        exeContext,
        fieldNodes,
        itemType,
        path,
        currentPayloadContext,
        prevPayloadContext,
      );
    }

    this.closeAsyncIterator(exeContext, iterator);
  }

  async advanceAsyncIterator(
    index: number,
    iterator: AsyncIterator<unknown>,
    exeContext: ExecutionContext,
    fieldNodes: ReadonlyArray<FieldNode>,
    itemType: GraphQLOutputType,
    path: Path,
    payloadContext: PayloadContext,
    prevPayloadContext: PayloadContext,
  ): Promise<IteratorResult<unknown> | undefined> {
    try {
      return await iterator.next();
    } catch (rawError) {
      exeContext.pendingPushes++;
      const itemPath = addPath(path, index, undefined);
      const error = locatedError(
        toError(rawError),
        fieldNodes,
        pathToArray(itemPath),
      );
      this.handleFieldError(error, itemType, payloadContext.errors);
      this.queue(
        exeContext,
        payloadContext,
        prevPayloadContext,
        null,
        itemPath,
      );
    }
  }

  closeAsyncIterator(
    exeContext: ExecutionContext,
    iterator: AsyncIterator<unknown>,
  ): void {
    const { iterators, publisher } = exeContext;
    iterators.delete(iterator);

    if (!this.hasNext(exeContext) && publisher) {
      const { push, stop } = publisher; // eslint-disable-next-line @typescript-eslint/no-floating-promises

      push({
        hasNext: false,
      });
      stop();
    }
  }

  hasNext(exeContext: ExecutionContext): boolean {
    return exeContext.pendingPushes > 0 || exeContext.iterators.size > 0;
  }

  queue(
    exeContext: ExecutionContext,
    payloadContext: PayloadContext,
    parentPayloadContext: PayloadContext,
    data: ObjMap<unknown> | unknown | null,
    path: Path | undefined,
  ): void {
    const { pushedPayloads } = exeContext;

    if (pushedPayloads.get(parentPayloadContext)) {
      // Repeater executors are executed lazily, only after the first payload
      // is requested, and so we cannot add the push and stop methods to
      // the execution context during construction.
      // The publisher will always available before we need it, as we only use
      // the push and stop methods after the first payload has been requested
      // and sent.
      // TODO: create a method that returns an eager (or primed) repeater, as
      // well as its push and stop methods.
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const publisher = exeContext.publisher!;
      const { push, stop } = publisher;
      this.pushResult(exeContext, push, stop, payloadContext, data, path);
      return;
    }

    const { pendingPayloads } = exeContext;
    const parentPendingPayloads =
      exeContext.pendingPayloads.get(parentPayloadContext);

    if (parentPendingPayloads) {
      parentPendingPayloads.push({
        payloadContext,
        data,
        path,
      });
      return;
    }

    pendingPayloads.set(parentPayloadContext, [
      {
        payloadContext,
        data,
        path,
      },
    ]);
  }

  pushResult(
    exeContext: ExecutionContext,
    push: Push<ExecutionPatchResult>,
    stop: Stop,
    payloadContext: PayloadContext,
    data: ObjMap<unknown> | unknown | null,
    path: Path | undefined,
  ): void {
    exeContext.pendingPushes--;
    exeContext.pushedPayloads.set(payloadContext, true);
    const { errors, label } = payloadContext; // eslint-disable-next-line @typescript-eslint/no-floating-promises

    push(this.createPatchResult(exeContext, data, errors, path, label)).then(
      () => {
        if (!this.hasNext(exeContext)) {
          stop();
        }
      },
    );
    const { pendingPayloads } = exeContext;
    const parentPendingPayloads = pendingPayloads.get(payloadContext);

    if (parentPendingPayloads) {
      this.pushResults(exeContext, push, stop, parentPendingPayloads);
    }

    pendingPayloads.delete(payloadContext);
  }

  pushResults(
    exeContext: ExecutionContext,
    push: Push<ExecutionPatchResult>,
    stop: Stop,
    results: Array<IncrementalResult>,
  ): void {
    const promises: Array<unknown> = [];
    const { pendingPayloads } = exeContext;

    for (const result of results) {
      exeContext.pendingPushes--;
      const { payloadContext, data, path } = result;
      exeContext.pushedPayloads.set(payloadContext, true);
      const { errors, label } = payloadContext;
      promises.push(
        push(this.createPatchResult(exeContext, data, errors, path, label)),
      );
      const parentPendingPayloads = pendingPayloads.get(payloadContext);

      if (parentPendingPayloads) {
        this.pushResults(exeContext, push, stop, parentPendingPayloads);
      }

      pendingPayloads.delete(payloadContext);
    } // eslint-disable-next-line @typescript-eslint/no-floating-promises

    Promise.all(promises).then(() => {
      if (!this.hasNext(exeContext)) {
        stop();
      }
    });
  }

  createPatchResult(
    exeContext: ExecutionContext,
    data: ObjMap<unknown> | unknown | null,
    errors: ReadonlyArray<GraphQLError>,
    path: Path | undefined,
    label?: string,
  ): ExecutionPatchResult {
    const value: ExecutionPatchResult = {
      data,
      path: path ? pathToArray(path) : [],
      hasNext: this.hasNext(exeContext),
    };

    if (label != null) {
      value.label = label;
    }

    if (errors.length > 0) {
      value.errors = errors;
    }

    return value;
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
    } // Otherwise, test each possible type.

    const possibleTypes = getPossibleTypes(info.schema, abstractType);
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
