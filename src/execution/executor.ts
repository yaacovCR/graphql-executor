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
  assertValidSchema,
  getOperationRootType,
  isObjectType,
  isAbstractType,
  isLeafType,
  isListType,
  isNonNullType,
  locatedError,
} from 'graphql';

import { GraphQLStreamDirective } from '../type/directives';

import type { Path } from '../jsutils/Path';
import type { ObjMap } from '../jsutils/ObjMap';
import type { PromiseOrValue } from '../jsutils/PromiseOrValue';
import type { Maybe } from '../jsutils/Maybe';
import type { Push, Stop } from '../jsutils/repeater';
import { inspect } from '../jsutils/inspect';
import { memoize3 } from '../jsutils/memoize3';
import { invariant } from '../jsutils/invariant';
import { devAssert } from '../jsutils/devAssert';
import { isPromise } from '../jsutils/isPromise';
import { isObjectLike } from '../jsutils/isObjectLike';
import { promiseReduce } from '../jsutils/promiseReduce';
import { addPath, pathToArray } from '../jsutils/Path';
import { isAsyncIterable } from '../jsutils/isAsyncIterable';
import { isIterableObject } from '../jsutils/isIterableObject';
import { resolveAfterAll } from '../jsutils/resolveAfterAll';
import { Repeater } from '../jsutils/repeater';

import {
  getVariableValues,
  getArgumentValues,
  getDirectiveValues,
} from './values';
import type { FieldsAndPatches, PatchFields } from './collectFields';
import {
  collectFields,
  collectSubfields as _collectSubfields,
} from './collectFields';
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
  variableValues: { [variable: string]: unknown };
  fieldResolver: GraphQLFieldResolver<any, any>;
  typeResolver: GraphQLTypeResolver<any, any>;
  forceQueryAlgorithm: boolean;
  disableIncremental: boolean;
  resolveField: FieldResolver;
  errors: Array<GraphQLError>;
  patchInstructionSets: Array<PatchInstructionSet>;
  iteratorInstructions: Array<IteratorInstruction>;
  asyncIteratorInstructions: Array<AsyncIteratorInstruction>;
  pendingPushes: number;
  closed: boolean;
  unfinishedIterators: Set<AsyncIterator<unknown>>;
}

interface PatchInstructionSet {
  patches: Array<PatchFields>;
  parentType: GraphQLObjectType;
  source: unknown;
  path: Path | undefined;
}

interface IteratorInstruction {
  iterator: Iterator<unknown>;
  itemType: GraphQLOutputType;
  fieldNodes: ReadonlyArray<FieldNode>;
  info: GraphQLResolveInfo;
  initialIndex: number;
  path: Path;
  label?: string;
}

interface AsyncIteratorInstruction {
  asyncIterator: AsyncIterator<unknown>;
  itemType: GraphQLOutputType;
  fieldNodes: ReadonlyArray<FieldNode>;
  info: GraphQLResolveInfo;
  initialIndex: number;
  path: Path;
  label?: string;
}

export interface ExecutionArgs {
  schema: GraphQLSchema;
  document: DocumentNode;
  rootValue?: unknown;
  contextValue?: unknown;
  variableValues?: Maybe<{ readonly [variable: string]: unknown }>;
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
  errors: Array<GraphQLError>,
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
   * Implements the "Executing requests" section of the spec.
   */
  execute(
    args: ExecutionArgs,
  ): PromiseOrValue<
    ExecutionResult | AsyncGenerator<AsyncExecutionResult, void, void>
  > {
    const exeContext = this.buildExecutionContext(args);

    // If a valid execution context cannot be created due to incorrect arguments,
    // a "Response" with only errors is returned.
    if (!('schema' in exeContext)) {
      return { errors: exeContext };
    }

    return this.executeImpl(exeContext);
  }

  async createSourceEventStream(
    args: ExecutionArgs,
  ): Promise<AsyncIterable<unknown> | ExecutionResult> {
    const exeContext = this.buildExecutionContext(args);

    // If a valid execution context cannot be created due to incorrect arguments,
    // a "Response" with only errors is returned.
    if (!('schema' in exeContext)) {
      return { errors: exeContext };
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
      exeContext.errors.push(error);
      return this.buildResponse(exeContext, null);
    }

    if (isPromise(data)) {
      return data.then(
        (resolvedData) => this.buildResponse(exeContext, resolvedData),
        (error) => {
          exeContext.errors.push(error);
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
    const initialResult =
      exeContext.errors.length === 0
        ? { data }
        : { errors: exeContext.errors, data };

    if (this.hasPendingInstructions(exeContext)) {
      return new Repeater((push, stop) => {
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        push({
          ...initialResult,
          hasNext: true,
        });
        this.processInstructions(exeContext, push, stop);
      });
    }

    return initialResult;
  }

  processInstructions(
    exeContext: ExecutionContext,
    push: Push<AsyncExecutionResult>,
    stop: Stop,
  ): void {
    while (this.hasPendingInstructions(exeContext)) {
      const {
        patchInstructionSets,
        iteratorInstructions,
        asyncIteratorInstructions,
      } = exeContext;
      exeContext.patchInstructionSets = [];
      exeContext.iteratorInstructions = [];
      exeContext.asyncIteratorInstructions = [];
      this.pushPatchInstructionSets(
        exeContext,
        patchInstructionSets,
        push,
        stop,
      );
      this.pushIteratorInstructions(
        exeContext,
        iteratorInstructions,
        push,
        stop,
      );
      this.pushAsyncIteratorInstructions(
        exeContext,
        asyncIteratorInstructions,
        push,
        stop,
      );
    }
  }

  pushPatchInstructionSets(
    exeContext: ExecutionContext,
    patchInstructionSets: Array<PatchInstructionSet>,
    push: Push<AsyncExecutionResult>,
    stop: Stop,
  ): void {
    for (const patchInstructionSet of patchInstructionSets) {
      const { patches, parentType, source, path } = patchInstructionSet;
      for (const { fields, label } of patches) {
        const errors: Array<GraphQLError> = [];
        exeContext.pendingPushes++;
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        Promise.resolve(
          this.executeFields(
            exeContext,
            parentType,
            source,
            path,
            fields,
            errors,
          ),
        ).then((deferredData) => {
          exeContext.pendingPushes--;
          this.pushResult(
            exeContext,
            push,
            stop,
            deferredData,
            label,
            path,
            errors,
          );
        });
      }
    }
  }

  pushIteratorInstructions(
    exeContext: ExecutionContext,
    iteratorInstructions: Array<IteratorInstruction>,
    push: Push<AsyncExecutionResult>,
    stop: Stop,
  ): void {
    for (const iteratorInstruction of iteratorInstructions) {
      const {
        iterator,
        itemType,
        fieldNodes,
        info,
        initialIndex,
        path,
        label,
      } = iteratorInstruction;
      let index = initialIndex;
      let iteration = iterator.next();
      while (!iteration.done) {
        const itemPath = addPath(path, index, undefined);

        const errors: Array<GraphQLError> = [];
        exeContext.pendingPushes++;
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        Promise.resolve(iteration.value)
          .then((resolved) =>
            this.completeValue(
              exeContext,
              itemType,
              fieldNodes,
              info,
              itemPath,
              resolved,
              errors,
            ),
          )
          // Note: we don't rely on a `catch` method, but we do expect "thenable"
          // to take a second callback for the error case.
          .then(undefined, (rawError) => {
            const error = locatedError(
              rawError,
              fieldNodes,
              pathToArray(itemPath),
            );
            return this.handleFieldError(error, itemType, errors);
          })
          .then((completed) => {
            exeContext.pendingPushes--;
            this.pushResult(
              exeContext,
              push,
              stop,
              completed,
              label,
              itemPath,
              errors,
            );
          });

        index++;
        iteration = iterator.next();
      }
    }
  }

  pushAsyncIteratorInstructions(
    exeContext: ExecutionContext,
    asyncIteratorInstructions: Array<AsyncIteratorInstruction>,
    push: Push<AsyncExecutionResult>,
    stop: Stop,
  ): void {
    const { unfinishedIterators } = exeContext;
    for (const asyncIteratorInstruction of asyncIteratorInstructions) {
      const {
        asyncIterator,
        itemType,
        fieldNodes,
        info,
        initialIndex,
        path,
        label,
      } = asyncIteratorInstruction;
      unfinishedIterators.add(asyncIterator);
      const next = (index: number) => {
        const itemPath = addPath(path, index, undefined);
        const errors: Array<GraphQLError> = [];
        asyncIterator.next().then(
          ({ value, done }) => {
            if (done) {
              unfinishedIterators.delete(asyncIterator);
              if (!this.hasNext(exeContext)) {
                // eslint-disable-next-line @typescript-eslint/no-floating-promises
                push({
                  hasNext: false,
                });
                stop();
              }
              return;
            }

            exeContext.pendingPushes++;
            // eslint-disable-next-line node/callback-return
            next(index + 1);

            let completedItem;
            try {
              completedItem = this.completeValue(
                exeContext,
                itemType,
                fieldNodes,
                info,
                itemPath,
                value,
                errors,
              );
            } catch (rawError) {
              const error = locatedError(
                rawError,
                fieldNodes,
                pathToArray(itemPath),
              );
              this.handleFieldError(error, itemType, errors);
              exeContext.pendingPushes--;
              this.pushResult(
                exeContext,
                push,
                stop,
                null,
                label,
                itemPath,
                errors,
              );
              return;
            }

            if (isPromise(completedItem)) {
              completedItem.then(
                (resolved) => {
                  exeContext.pendingPushes--;
                  this.pushResult(
                    exeContext,
                    push,
                    stop,
                    resolved,
                    label,
                    itemPath,
                    errors,
                  );
                },
                (rawError) => {
                  const error = locatedError(
                    rawError,
                    fieldNodes,
                    pathToArray(itemPath),
                  );
                  this.handleFieldError(error, itemType, errors);
                  exeContext.pendingPushes--;
                  this.pushResult(
                    exeContext,
                    push,
                    stop,
                    null,
                    label,
                    itemPath,
                    errors,
                  );
                },
              );
              return;
            }

            exeContext.pendingPushes--;
            this.pushResult(
              exeContext,
              push,
              stop,
              completedItem,
              label,
              itemPath,
              errors,
            );
          },
          (rawError) => {
            unfinishedIterators.delete(asyncIterator);
            const error = locatedError(
              rawError,
              fieldNodes,
              pathToArray(itemPath),
            );
            this.handleFieldError(error, itemType, errors);
            exeContext.pendingPushes--;
            this.pushResult(
              exeContext,
              push,
              stop,
              null,
              label,
              itemPath,
              errors,
            );
          },
        );
      };
      // eslint-disable-next-line node/callback-return
      next(initialIndex);
    }
  }

  /**
   * Essential assertions before executing to provide developer feedback for
   * improper use of the GraphQL library.
   */
  assertValidExecutionArguments(
    schema: GraphQLSchema,
    document: DocumentNode,
    rawVariableValues: Maybe<{ readonly [variable: string]: unknown }>,
  ): void {
    devAssert(document, 'Must provide document.');

    // If the schema used for execution is invalid, throw an error.
    assertValidSchema(schema);

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
      fieldDef: GraphQLField<unknown, unknown>,
      source: unknown,
      info: GraphQLResolveInfo,
      fieldNodes: ReadonlyArray<FieldNode>,
    ) => {
      const resolveFn = fieldDef[resolverKey] ?? defaultResolver;

      // Build a JS object of arguments from the field.arguments AST, using the
      // variables scope to fulfill any variable references.
      // TODO: find a way to memoize, in case this field is within a List type.
      const args = getArgumentValues(
        fieldDef,
        fieldNodes[0],
        exeContext.variableValues,
      );

      // The resolve function's optional third argument is a context value that
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
    } = args;

    // If arguments are missing or incorrectly typed, this is an internal
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

    // istanbul ignore next (See: 'https://github.com/graphql/graphql-js/issues/2203')
    const variableDefinitions = operation.variableDefinitions ?? [];

    const coercedVariableValues = getVariableValues(
      schema,
      variableDefinitions,
      rawVariableValues ?? {},
      { maxErrors: 50 },
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
      errors: [],
      patchInstructionSets: [],
      iteratorInstructions: [],
      asyncIteratorInstructions: [],
      pendingPushes: 0,
      closed: false,
      unfinishedIterators: new Set(),
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
      errors: [],
      patchInstructionSets: [],
      iteratorInstructions: [],
      asyncIteratorInstructions: [],
      pendingPushes: 0,
      closed: false,
      unfinishedIterators: new Set(),
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
      errors,
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
      errors,
    );

    if (patches.length) {
      exeContext.patchInstructionSets.push({
        patches,
        parentType: rootType,
        source: rootValue,
        path,
      });
    }

    return result;
  }

  parseOperationRoot(
    schema: GraphQLSchema,
    fragments: ObjMap<FragmentDefinitionNode>,
    variableValues: { [variable: string]: unknown },
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
          exeContext.errors,
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
    errors: Array<GraphQLError>,
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
        errors,
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
    errors: Array<GraphQLError>,
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
    );

    // Get the resolved field value, regardless of if its result is normal or abrupt (error).
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
            errors,
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
          errors,
        );
      }

      if (isPromise(completed)) {
        // Note: we don't rely on a `catch` method, but we do expect "thenable"
        // to take a second callback for the error case.
        return completed.then(undefined, (rawError) => {
          const error = locatedError(rawError, fieldNodes, pathToArray(path));
          return this.handleFieldError(error, returnType, errors);
        });
      }
      return completed;
    } catch (rawError) {
      const error = locatedError(rawError, fieldNodes, pathToArray(path));
      return this.handleFieldError(error, returnType, errors);
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
    }

    // Otherwise, error protection is applied, logging the error and resolving
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
    errors: Array<GraphQLError>,
  ): PromiseOrValue<unknown> {
    // If result is an Error, throw a located error.
    if (result instanceof Error) {
      throw result;
    }

    // If field type is NonNull, complete for inner type, and throw field error
    // if result is null.
    if (isNonNullType(returnType)) {
      const completed = this.completeValue(
        exeContext,
        returnType.ofType,
        fieldNodes,
        info,
        path,
        result,
        errors,
      );
      if (completed === null) {
        throw new Error(
          `Cannot return null for non-nullable field ${info.parentType.name}.${info.fieldName}.`,
        );
      }
      return completed;
    }

    // If result value is null or undefined then return null.
    if (result == null) {
      return null;
    }

    // If field type is List, complete each item in the list with the inner type
    if (isListType(returnType)) {
      return this.completeListValue(
        exeContext,
        returnType,
        fieldNodes,
        info,
        path,
        result,
        errors,
      );
    }

    // If field type is a leaf type, Scalar or Enum, serialize to a valid value,
    // returning null if serialization is not possible.
    if (isLeafType(returnType)) {
      return this.completeLeafValue(returnType, result);
    }

    // If field type is an abstract type, Interface or Union, determine the
    // runtime Object type and complete for that type.
    if (isAbstractType(returnType)) {
      return this.completeAbstractValue(
        exeContext,
        returnType,
        fieldNodes,
        info,
        path,
        result,
        errors,
      );
    }

    // If field type is Object, execute and complete all sub-selections.
    // istanbul ignore else (See: 'https://github.com/graphql/graphql-js/issues/2618')
    if (isObjectType(returnType)) {
      return this.completeObjectValue(
        exeContext,
        returnType,
        fieldNodes,
        info,
        path,
        result,
        errors,
      );
    }

    // istanbul ignore next (Not reachable. All possible output types have been considered)
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
    fieldNodes: ReadonlyArray<FieldNode>,
    info: GraphQLResolveInfo,
    path: Path,
    result: unknown,
    errors: Array<GraphQLError>,
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
        errors,
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
      errors,
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
    }

    // validation only allows equivalent streams on multiple fields, so it is
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

    return {
      initialCount:
        // istanbul ignore next (initialCount is required number argument)
        typeof stream.initialCount === 'number'
          ? stream.initialCount
          : undefined,
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
    errors: Array<GraphQLError>,
  ): PromiseOrValue<ReadonlyArray<unknown>> {
    const stream = this.getStreamValues(exeContext, fieldNodes);

    // This is specified as a simple map, however we're optimizing the path
    // where the list contains no Promises by avoiding creating another Promise.
    const promises: Array<Promise<void>> = [];
    const completedResults: Array<unknown> = [];
    let index = 0;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      if (
        stream &&
        typeof stream.initialCount === 'number' &&
        index >= stream.initialCount
      ) {
        exeContext.iteratorInstructions.push({
          iterator,
          itemType,
          fieldNodes,
          info,
          initialIndex: index,
          path,
          label: stream.label,
        });
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
        errors,
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
    errors: Array<GraphQLError>,
  ): Promise<ReadonlyArray<unknown>> {
    const stream = this.getStreamValues(exeContext, fieldNodes);

    const completedResults: Array<unknown> = [];
    const promises: Array<Promise<void>> = [];
    return new Promise<void>((resolve) => {
      const next = (index: number) => {
        if (
          stream &&
          typeof stream.initialCount === 'number' &&
          index >= stream.initialCount
        ) {
          exeContext.asyncIteratorInstructions.push({
            asyncIterator: iterator,
            itemType,
            fieldNodes,
            info,
            initialIndex: index,
            path,
            label: stream.label,
          });
          resolve();
          return;
        }

        const itemPath = addPath(path, index, undefined);
        iterator.next().then(
          ({ value, done }) => {
            if (done) {
              resolve();
              return;
            }

            this.completeListItemValue(
              completedResults,
              index,
              promises,
              value,
              exeContext,
              itemType,
              fieldNodes,
              info,
              itemPath,
              errors,
            );

            next(index + 1);
          },
          (rawError) => {
            completedResults.push(null);
            const error = locatedError(
              rawError,
              fieldNodes,
              pathToArray(itemPath),
            );
            this.handleFieldError(error, itemType, errors);
            resolve();
          },
        );
      };
      next(0);
    }).then(() =>
      promises.length
        ? resolveAfterAll(completedResults, promises)
        : completedResults,
    );
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
    errors: Array<GraphQLError>,
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
            errors,
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
          errors,
        );
      }

      completedResults[index] = completedItem;

      if (!isPromise(completedItem)) {
        return;
      }

      // Note: we don't rely on a `catch` method, but we do expect "thenable"
      // to take a second callback for the error case.
      const promise = completedItem
        .then(undefined, (rawError) => {
          const error = locatedError(
            rawError,
            fieldNodes,
            pathToArray(itemPath),
          );
          return this.handleFieldError(error, itemType, errors);
        })
        .then((resolved) => {
          completedResults[index] = resolved;
        });

      promises.push(promise);
    } catch (rawError) {
      const error = locatedError(rawError, fieldNodes, pathToArray(itemPath));
      completedResults[index] = this.handleFieldError(error, itemType, errors);
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
    errors: Array<GraphQLError>,
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
          errors,
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
      errors,
    );
  }

  ensureValidRuntimeType(
    runtimeTypeName: unknown,
    exeContext: ExecutionContext,
    returnType: GraphQLAbstractType,
    fieldNodes: ReadonlyArray<FieldNode>,
    info: GraphQLResolveInfo,
    result: unknown,
  ): GraphQLObjectType {
    if (runtimeTypeName == null) {
      throw new GraphQLError(
        `Abstract type "${returnType.name}" must resolve to an Object type at runtime for field "${info.parentType.name}.${info.fieldName}". Either the "${returnType.name}" type should provide a "resolveType" function or each possible type should provide an "isTypeOf" function.`,
        fieldNodes,
      );
    }

    // releases before 16.0.0 supported returning `GraphQLObjectType` from `resolveType`
    // TODO: remove in 17.0.0 release
    if (isObjectType(runtimeTypeName)) {
      throw new GraphQLError(
        'Support for returning GraphQLObjectType from resolveType was removed in graphql-js@16.0.0 please return type name instead.',
      );
    }

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

    if (!exeContext.schema.isSubType(returnType, runtimeType)) {
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
    errors: Array<GraphQLError>,
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
            errors,
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
      errors,
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
    errors: Array<GraphQLError>,
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
      errors,
    );

    if (subPatches.length) {
      exeContext.patchInstructionSets.push({
        patches: subPatches,
        parentType: returnType,
        source: result,
        path,
      });
    }

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
      return this.executeSubscriptionEvent(perPayloadExecutionContext);
    };

    // Map every source value to a ExecutionResult value as described above.
    return flattenAsyncIterable<ExecutionResult, AsyncExecutionResult>(
      mapAsyncIterable(resultOrStream, mapSourceToResponse),
    );
  }

  async createSourceEventStreamImpl(
    exeContext: ExecutionContext,
  ): Promise<AsyncIterable<unknown> | ExecutionResult> {
    try {
      const eventStream = await this.executeSubscriptionRootField(exeContext);

      // Assert field returned an event stream, otherwise yield an error.
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
      if (error instanceof GraphQLError) {
        return { errors: [error] };
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
      throw locatedError(error, fieldNodes, pathToArray(path));
    }
  }

  executeSubscriptionEvent(
    exeContext: ExecutionContext,
  ): PromiseOrValue<
    ExecutionResult | AsyncGenerator<AsyncExecutionResult, void, void>
  > {
    return this.executeQueryAlgorithm(exeContext);
  }

  hasPendingInstructions(exeContext: ExecutionContext): boolean {
    const {
      patchInstructionSets,
      iteratorInstructions,
      asyncIteratorInstructions,
    } = exeContext;
    return (
      patchInstructionSets.length !== 0 ||
      iteratorInstructions.length !== 0 ||
      asyncIteratorInstructions.length !== 0
    );
  }

  hasPendingValues(exeContext: ExecutionContext): boolean {
    const {
      patchInstructionSets,
      iteratorInstructions,
      asyncIteratorInstructions,
      unfinishedIterators,
    } = exeContext;
    return (
      patchInstructionSets.length !== 0 ||
      iteratorInstructions.length !== 0 ||
      asyncIteratorInstructions.length !== 0 ||
      unfinishedIterators.size !== 0
    );
  }

  hasNext(exeContext: ExecutionContext): boolean {
    return (
      this.hasPendingValues(exeContext) ||
      exeContext.pendingPushes > 0 ||
      exeContext.unfinishedIterators.size > 0
    );
  }

  pushResult(
    exeContext: ExecutionContext,
    push: Push<ExecutionResult | AsyncExecutionResult>,
    stop: Stop,
    data: ObjMap<unknown> | unknown | null,
    label?: string,
    path?: Path,
    errors?: ReadonlyArray<GraphQLError>,
  ): void {
    const hasNext = this.hasNext(exeContext);

    if (!hasNext) {
      exeContext.closed = true;
    }

    const result: ExecutionPatchResult = {
      data,
      path: path ? pathToArray(path) : [],
      hasNext: this.hasNext(exeContext),
    };

    if (label != null) {
      result.label = label;
    }

    if (errors && errors.length > 0) {
      result.errors = errors;
    }

    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    push(result).then(() => {
      if (!this.hasNext(exeContext)) {
        if (!exeContext.closed) {
          // eslint-disable-next-line @typescript-eslint/no-floating-promises
          push({
            hasNext: false,
          });
        }
        stop();
        return;
      }

      this.processInstructions(exeContext, push, stop);
    });
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
    const possibleTypes = info.schema.getPossibleTypes(abstractType);
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
