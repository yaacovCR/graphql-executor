import { inspect } from '../jsutils/inspect.js';
import { invariant } from '../jsutils/invariant.js';
import { isAsyncIterable } from '../jsutils/isAsyncIterable.js';
import { isIterableObject } from '../jsutils/isIterableObject.js';
import { isObjectLike } from '../jsutils/isObjectLike.js';
import { isPromise } from '../jsutils/isPromise.js';
import type { Maybe } from '../jsutils/Maybe.js';
import { memoize3 } from '../jsutils/memoize3.js';
import type { ObjMap } from '../jsutils/ObjMap.js';
import type { Path } from '../jsutils/Path.js';
import { addPath, pathToArray } from '../jsutils/Path.js';
import { promiseForObject } from '../jsutils/promiseForObject.js';
import type { PromiseOrValue } from '../jsutils/PromiseOrValue.js';
import { promiseReduce } from '../jsutils/promiseReduce.js';
import { Publisher } from '../jsutils/Publisher.js';

import type { GraphQLFormattedError } from '../error/GraphQLError.js';
import { GraphQLError } from '../error/GraphQLError.js';
import { locatedError } from '../error/locatedError.js';

import type {
  DocumentNode,
  FieldNode,
  FragmentDefinitionNode,
  OperationDefinitionNode,
} from '../language/ast.js';
import { OperationTypeNode } from '../language/ast.js';
import { Kind } from '../language/kinds.js';

import type {
  GraphQLAbstractType,
  GraphQLField,
  GraphQLFieldResolver,
  GraphQLLeafType,
  GraphQLList,
  GraphQLObjectType,
  GraphQLOutputType,
  GraphQLResolveInfo,
  GraphQLTypeResolver,
} from '../type/definition.js';
import {
  isAbstractType,
  isLeafType,
  isListType,
  isNonNullType,
  isObjectType,
} from '../type/definition.js';
import { GraphQLStreamDirective } from '../type/directives.js';
import type { GraphQLSchema } from '../type/schema.js';
import { assertValidSchema } from '../type/validate.js';

import type {
  DeferUsage,
  DeferUsageSet,
  FieldGroup,
  GroupedFieldSet,
  GroupedFieldSetDetails,
} from './collectFields.js';
import {
  collectFields,
  collectSubfields as _collectSubfields,
  NON_DEFERRED_TARGET_SET,
} from './collectFields.js';
import { mapAsyncIterable } from './mapAsyncIterable.js';
import {
  getArgumentValues,
  getDirectiveValues,
  getVariableValues,
} from './values.js';

/* eslint-disable max-params */
// This file contains a lot of such errors but we plan to refactor it anyway
// so just disable it for entire file.

/**
 * A memoized collection of relevant subfields with regard to the return
 * type. Memoizing ensures the subfields are not repeatedly calculated, which
 * saves overhead when resolving lists of values.
 */
const collectSubfields = memoize3(
  (
    exeContext: ExecutionContext,
    returnType: GraphQLObjectType,
    fieldGroup: FieldGroup,
  ) =>
    _collectSubfields(
      exeContext.schema,
      exeContext.fragments,
      exeContext.variableValues,
      exeContext.operation,
      returnType,
      fieldGroup,
    ),
);

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

type IncrementalPublisher = Publisher<
  SubsequentResultRecord,
  SubsequentIncrementalExecutionResult
>;

/**
 * Data that must be available at all points during query execution.
 *
 * Namely, schema of the type system that is currently executing,
 * and the fragments defined in the query document
 */
export interface ExecutionContext {
  schema: GraphQLSchema;
  fragments: ObjMap<FragmentDefinitionNode>;
  rootValue: unknown;
  contextValue: unknown;
  operation: OperationDefinitionNode;
  variableValues: { [variable: string]: unknown };
  fieldResolver: GraphQLFieldResolver<any, any>;
  typeResolver: GraphQLTypeResolver<any, any>;
  subscribeFieldResolver: GraphQLFieldResolver<any, any>;
  errors: Array<GraphQLError>;
  publisher: IncrementalPublisher;
}

/**
 * The result of GraphQL execution.
 *
 *   - `errors` is included when any errors occurred as a non-empty array.
 *   - `data` is the result of a successful execution of the query.
 *   - `hasNext` is true if a future payload is expected.
 *   - `extensions` is reserved for adding non-standard properties.
 *   - `incremental` is a list of the results from defer/stream directives.
 */
export interface ExecutionResult<
  TData = ObjMap<unknown>,
  TExtensions = ObjMap<unknown>,
> {
  errors?: ReadonlyArray<GraphQLError>;
  data?: TData | null;
  extensions?: TExtensions;
}

export interface FormattedExecutionResult<
  TData = ObjMap<unknown>,
  TExtensions = ObjMap<unknown>,
> {
  errors?: ReadonlyArray<GraphQLFormattedError>;
  data?: TData | null;
  extensions?: TExtensions;
}

export interface ExperimentalIncrementalExecutionResults<
  TData = unknown,
  TExtensions = ObjMap<unknown>,
> {
  initialResult: InitialIncrementalExecutionResult<TData, TExtensions>;
  subsequentResults: AsyncGenerator<
    SubsequentIncrementalExecutionResult<TData, TExtensions>,
    void,
    void
  >;
}

export interface InitialIncrementalExecutionResult<
  TData = ObjMap<unknown>,
  TExtensions = ObjMap<unknown>,
> extends ExecutionResult<TData, TExtensions> {
  data: TData;
  hasNext: true;
  extensions?: TExtensions;
}

export interface FormattedInitialIncrementalExecutionResult<
  TData = ObjMap<unknown>,
  TExtensions = ObjMap<unknown>,
> extends FormattedExecutionResult<TData, TExtensions> {
  data: TData;
  hasNext: boolean;
  extensions?: TExtensions;
}

interface IncrementalUpdate<TData = unknown, TExtensions = ObjMap<unknown>> {
  incremental: ReadonlyArray<IncrementalResult<TData, TExtensions>>;
  completed: ReadonlyArray<CompletedResult>;
}

export interface SubsequentIncrementalExecutionResult<
  TData = unknown,
  TExtensions = ObjMap<unknown>,
> extends Partial<IncrementalUpdate<TData, TExtensions>> {
  hasNext: boolean;
  extensions?: TExtensions;
}

export interface FormattedSubsequentIncrementalExecutionResult<
  TData = unknown,
  TExtensions = ObjMap<unknown>,
> {
  hasNext: boolean;
  incremental?: ReadonlyArray<FormattedIncrementalResult<TData, TExtensions>>;
  completed?: ReadonlyArray<FormattedCompletedResult>;
  extensions?: TExtensions;
}

export interface IncrementalDeferResult<
  TData = ObjMap<unknown>,
  TExtensions = ObjMap<unknown>,
> extends ExecutionResult<TData, TExtensions> {
  data: TData;
  path?: ReadonlyArray<string | number>;
}

export interface FormattedIncrementalDeferResult<
  TData = ObjMap<unknown>,
  TExtensions = ObjMap<unknown>,
> extends FormattedExecutionResult<TData, TExtensions> {
  data: TData;
  path?: ReadonlyArray<string | number>;
}

export interface IncrementalStreamResult<
  TData = Array<unknown>,
  TExtensions = ObjMap<unknown>,
> {
  errors?: ReadonlyArray<GraphQLError>;
  items: TData;
  path?: ReadonlyArray<string | number>;
  extensions?: TExtensions;
}

export interface FormattedIncrementalStreamResult<
  TData = Array<unknown>,
  TExtensions = ObjMap<unknown>,
> {
  errors?: ReadonlyArray<GraphQLFormattedError>;
  items: TData;
  path?: ReadonlyArray<string | number>;
  extensions?: TExtensions;
}

export type IncrementalResult<TData = unknown, TExtensions = ObjMap<unknown>> =
  | IncrementalDeferResult<TData, TExtensions>
  | IncrementalStreamResult<TData, TExtensions>;

export type FormattedIncrementalResult<
  TData = unknown,
  TExtensions = ObjMap<unknown>,
> =
  | FormattedIncrementalDeferResult<TData, TExtensions>
  | FormattedIncrementalStreamResult<TData, TExtensions>;

export interface CompletedResult {
  path: ReadonlyArray<string | number>;
  label?: string;
  errors?: ReadonlyArray<GraphQLError>;
}

export interface FormattedCompletedResult {
  path: ReadonlyArray<string | number>;
  label?: string;
  errors?: ReadonlyArray<GraphQLError>;
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
}

export interface StreamUsage {
  label: string | undefined;
  initialCount: number;
  fieldGroup: FieldGroup;
}

const UNEXPECTED_EXPERIMENTAL_DIRECTIVES =
  'The provided schema unexpectedly contains experimental directives (@defer or @stream). These directives may only be utilized if experimental execution features are explicitly enabled.';

const UNEXPECTED_MULTIPLE_PAYLOADS =
  'Executing this GraphQL operation would unexpectedly produce multiple payloads (due to @defer or @stream directive)';

/**
 * Implements the "Executing requests" section of the GraphQL specification.
 *
 * Returns either a synchronous ExecutionResult (if all encountered resolvers
 * are synchronous), or a Promise of an ExecutionResult that will eventually be
 * resolved and never rejected.
 *
 * If the arguments to this function do not result in a legal execution context,
 * a GraphQLError will be thrown immediately explaining the invalid input.
 *
 * This function does not support incremental delivery (`@defer` and `@stream`).
 * If an operation which would defer or stream data is executed with this
 * function, it will throw or return a rejected promise.
 * Use `experimentalExecuteIncrementally` if you want to support incremental
 * delivery.
 */
export function execute(args: ExecutionArgs): PromiseOrValue<ExecutionResult> {
  if (args.schema.getDirective('defer') || args.schema.getDirective('stream')) {
    throw new Error(UNEXPECTED_EXPERIMENTAL_DIRECTIVES);
  }

  const result = experimentalExecuteIncrementally(args);
  if (!isPromise(result)) {
    if ('initialResult' in result) {
      // This can happen if the operation contains @defer or @stream directives
      // and is not validated prior to execution
      throw new Error(UNEXPECTED_MULTIPLE_PAYLOADS);
    }
    return result;
  }

  return result.then((incrementalResult) => {
    if ('initialResult' in incrementalResult) {
      // This can happen if the operation contains @defer or @stream directives
      // and is not validated prior to execution
      throw new Error(UNEXPECTED_MULTIPLE_PAYLOADS);
    }
    return incrementalResult;
  });
}

/**
 * Implements the "Executing requests" section of the GraphQL specification,
 * including `@defer` and `@stream` as proposed in
 * https://github.com/graphql/graphql-spec/pull/742
 *
 * This function returns a Promise of an ExperimentalIncrementalExecutionResults
 * object. This object either consists of a single ExecutionResult, or an
 * object containing an `initialResult` and a stream of `subsequentResults`.
 *
 * If the arguments to this function do not result in a legal execution context,
 * a GraphQLError will be thrown immediately explaining the invalid input.
 */
export function experimentalExecuteIncrementally(
  args: ExecutionArgs,
): PromiseOrValue<ExecutionResult | ExperimentalIncrementalExecutionResults> {
  // If a valid execution context cannot be created due to incorrect arguments,
  // a "Response" with only errors is returned.
  const exeContext = buildExecutionContext(args);

  // Return early errors if execution context failed.
  if (!('schema' in exeContext)) {
    return { errors: exeContext };
  }

  return executeImpl(exeContext);
}

function executeImpl(
  exeContext: ExecutionContext,
): PromiseOrValue<ExecutionResult | ExperimentalIncrementalExecutionResults> {
  // Return a Promise that will eventually resolve to the data described by
  // The "Response" section of the GraphQL specification.
  //
  // If errors are encountered while executing a GraphQL field, only that
  // field and its descendants will be omitted, and sibling fields will still
  // be executed. An execution which encounters errors will still result in a
  // resolved Promise.
  //
  // Errors from sub-fields of a NonNull type may propagate to the top level,
  // at which point we still log the error and null the parent field, which
  // in this case is the entire response.
  const { publisher, errors } = exeContext;
  try {
    const result = executeOperation(exeContext);
    if (isPromise(result)) {
      return result.then(
        (data) => {
          if (publisher.hasNext()) {
            // TODO: consider removing this check
            // data cannot be null if filtering worked successfully
            invariant(data != null);
            return buildIncrementalResponse(
              data,
              errors,
              publisher.subscribe(),
            );
          }
          return buildResponse(data, errors);
        },
        (error) => {
          errors.push(error);
          return buildResponse(null, errors);
        },
      );
    }
    if (publisher.hasNext()) {
      // TODO: consider removing this check
      // data cannot be null if filtering worked successfully
      invariant(result != null);
      return buildIncrementalResponse(result, errors, publisher.subscribe());
    }
    return buildResponse(result, errors);
  } catch (error) {
    errors.push(error);
    return buildResponse(null, errors);
  }
}

/**
 * Also implements the "Executing requests" section of the GraphQL specification.
 * However, it guarantees to complete synchronously (or throw an error) assuming
 * that all field resolvers are also synchronous.
 */
export function executeSync(args: ExecutionArgs): ExecutionResult {
  const result = experimentalExecuteIncrementally(args);

  // Assert that the execution was synchronous.
  if (isPromise(result) || 'initialResult' in result) {
    throw new Error('GraphQL execution failed to complete synchronously.');
  }

  return result;
}

/**
 * Given a completed execution context and data, build the `{ errors, data }`
 * response defined by the "Response" section of the GraphQL specification.
 */
function buildResponse(
  data: ObjMap<unknown> | null,
  errors: ReadonlyArray<GraphQLError>,
): ExecutionResult {
  return errors.length === 0 ? { data } : { errors, data };
}

function buildIncrementalResponse(
  data: ObjMap<unknown>,
  errors: ReadonlyArray<GraphQLError>,
  subsequentResults: AsyncGenerator<SubsequentIncrementalExecutionResult>,
): ExperimentalIncrementalExecutionResults {
  const initialResult: InitialIncrementalExecutionResult = {
    data,
    hasNext: true,
  };

  if (errors.length > 0) {
    initialResult.errors = errors;
  }

  return {
    initialResult,
    subsequentResults,
  };
}

/**
 * Constructs a ExecutionContext object from the arguments passed to
 * execute, which we will pass throughout the other execution methods.
 *
 * Throws a GraphQLError if a valid execution context cannot be created.
 *
 * TODO: consider no longer exporting this function
 * @internal
 */
export function buildExecutionContext(
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
  } = args;

  // If the schema used for execution is invalid, throw an error.
  assertValidSchema(schema);

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
      default:
      // ignore non-executable definitions
    }
  }

  if (!operation) {
    if (operationName != null) {
      return [new GraphQLError(`Unknown operation named "${operationName}".`)];
    }
    return [new GraphQLError('Must provide an operation.')];
  }

  // FIXME: https://github.com/graphql/graphql-js/issues/2203
  /* c8 ignore next */
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

  return {
    schema,
    fragments,
    rootValue,
    contextValue,
    operation,
    variableValues: coercedVariableValues.coerced,
    fieldResolver: fieldResolver ?? defaultFieldResolver,
    typeResolver: typeResolver ?? defaultTypeResolver,
    subscribeFieldResolver: subscribeFieldResolver ?? defaultFieldResolver,
    publisher: new Publisher(getIncrementalResult, returnStreamIterators),
    errors: [],
  };
}

function buildPerEventExecutionContext(
  exeContext: ExecutionContext,
  payload: unknown,
): ExecutionContext {
  return {
    ...exeContext,
    rootValue: payload,
    // no need to update publisher, incremental delivery is not supported for subscriptions
    errors: [],
  };
}

/**
 * Implements the "Executing operations" section of the spec.
 */
function executeOperation(
  exeContext: ExecutionContext,
): PromiseOrValue<ObjMap<unknown>> {
  const { operation, schema, fragments, variableValues, rootValue } =
    exeContext;
  const rootType = schema.getRootType(operation.operation);
  if (rootType == null) {
    throw new GraphQLError(
      `Schema is not configured to execute ${operation.operation} operation.`,
      { nodes: operation },
    );
  }

  const { groupedFieldSet, newGroupedFieldSetDetails, newDeferUsages } =
    collectFields(schema, fragments, variableValues, rootType, operation);
  const path = undefined;
  let result;

  const {
    newDeferredFragmentRecords,
    newDeferMap,
    newDeferredGroupedFieldSetRecords,
  } = prepareNewDeferRecords(
    exeContext,
    newGroupedFieldSetDetails,
    newDeferUsages,
  );

  switch (operation.operation) {
    case OperationTypeNode.QUERY:
      result = executeFields(
        exeContext,
        rootType,
        rootValue,
        path,
        groupedFieldSet,
        newDeferMap,
      );
      break;
    case OperationTypeNode.MUTATION:
      result = executeFieldsSerially(
        exeContext,
        rootType,
        rootValue,
        path,
        groupedFieldSet,
        newDeferMap,
      );
      break;
    case OperationTypeNode.SUBSCRIPTION:
      // TODO: deprecate `subscribe` and move all logic here
      // Temporary solution until we finish merging execute and subscribe together
      result = executeFields(
        exeContext,
        rootType,
        rootValue,
        path,
        groupedFieldSet,
        newDeferMap,
      );
  }

  executeDeferredGroupedFieldSets(
    exeContext,
    rootType,
    rootValue,
    path,
    newDeferredGroupedFieldSetRecords,
    newDeferredFragmentRecords,
    newDeferMap,
  );

  return result;
}

/**
 * Implements the "Executing selection sets" section of the spec
 * for fields that must be executed serially.
 */
function executeFieldsSerially(
  exeContext: ExecutionContext,
  parentType: GraphQLObjectType,
  sourceValue: unknown,
  path: Path | undefined,
  groupedFieldSet: GroupedFieldSet,
  deferMap: ReadonlyMap<DeferUsage, DeferredFragmentRecord>,
): PromiseOrValue<ObjMap<unknown>> {
  return promiseReduce(
    groupedFieldSet,
    (results, [responseName, fieldGroup]) => {
      const fieldPath = addPath(path, responseName, parentType.name);
      const result = executeField(
        exeContext,
        parentType,
        sourceValue,
        fieldGroup,
        fieldPath,
        deferMap,
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
function executeFields(
  exeContext: ExecutionContext,
  parentType: GraphQLObjectType,
  sourceValue: unknown,
  path: Path | undefined,
  groupedFieldSet: GroupedFieldSet,
  deferMap: ReadonlyMap<DeferUsage, DeferredFragmentRecord>,
  incrementalDataRecord?: IncrementalDataRecord | undefined,
): PromiseOrValue<ObjMap<unknown>> {
  const results = Object.create(null);
  let containsPromise = false;

  try {
    for (const [responseName, fieldGroup] of groupedFieldSet) {
      const fieldPath = addPath(path, responseName, parentType.name);
      const result = executeField(
        exeContext,
        parentType,
        sourceValue,
        fieldGroup,
        fieldPath,
        deferMap,
        incrementalDataRecord,
      );

      if (result !== undefined) {
        results[responseName] = result;
        if (isPromise(result)) {
          containsPromise = true;
        }
      }
    }
  } catch (error) {
    if (containsPromise) {
      // Ensure that any promises returned by other fields are handled, as they may also reject.
      return promiseForObject(results).finally(() => {
        throw error;
      });
    }
    throw error;
  }

  // If there are no promises, we can just return the object
  if (!containsPromise) {
    return results;
  }

  // Otherwise, results is a map from field name to the result of resolving that
  // field, which is possibly a promise. Return a promise that will return this
  // same map, but with any promises replaced with the values they resolved to.
  return promiseForObject(results);
}

function toNodes(fieldGroup: FieldGroup): ReadonlyArray<FieldNode> {
  return fieldGroup.fields.map((fieldDetails) => fieldDetails.node);
}

/**
 * Implements the "Executing fields" section of the spec
 * In particular, this function figures out the value that the field returns by
 * calling its resolve function, then calls completeValue to complete promises,
 * serialize scalars, or execute the sub-selection-set for objects.
 */
function executeField(
  exeContext: ExecutionContext,
  parentType: GraphQLObjectType,
  source: unknown,
  fieldGroup: FieldGroup,
  path: Path,
  deferMap: ReadonlyMap<DeferUsage, DeferredFragmentRecord>,
  incrementalDataRecord?: IncrementalDataRecord | undefined,
): PromiseOrValue<unknown> {
  const fieldName = fieldGroup.fields[0].node.name.value;
  const fieldDef = exeContext.schema.getField(parentType, fieldName);
  if (!fieldDef) {
    return;
  }

  const returnType = fieldDef.type;
  const resolveFn = fieldDef.resolve ?? exeContext.fieldResolver;

  const info = buildResolveInfo(
    exeContext,
    fieldDef,
    fieldGroup,
    parentType,
    path,
  );

  // Get the resolve function, regardless of if its result is normal or abrupt (error).
  try {
    // Build a JS object of arguments from the field.arguments AST, using the
    // variables scope to fulfill any variable references.
    // TODO: find a way to memoize, in case this field is within a List type.
    const args = getArgumentValues(
      fieldDef,
      fieldGroup.fields[0].node,
      exeContext.variableValues,
    );

    // The resolve function's optional third argument is a context value that
    // is provided to every resolve function within an execution. It is commonly
    // used to represent an authenticated user, or request-specific caches.
    const contextValue = exeContext.contextValue;

    const result = resolveFn(source, args, contextValue, info);

    if (isPromise(result)) {
      return completePromisedValue(
        exeContext,
        returnType,
        fieldGroup,
        info,
        path,
        result,
        deferMap,
        incrementalDataRecord,
      );
    }

    const completed = completeValue(
      exeContext,
      returnType,
      fieldGroup,
      info,
      path,
      result,
      deferMap,
      incrementalDataRecord,
    );

    if (isPromise(completed)) {
      // Note: we don't rely on a `catch` method, but we do expect "thenable"
      // to take a second callback for the error case.
      return completed.then(undefined, (rawError) => {
        handleFieldError(
          rawError,
          exeContext,
          returnType,
          fieldGroup,
          path,
          incrementalDataRecord,
        );
        filterSubsequentPayloads(exeContext, path, incrementalDataRecord);
        return null;
      });
    }
    return completed;
  } catch (rawError) {
    handleFieldError(
      rawError,
      exeContext,
      returnType,
      fieldGroup,
      path,
      incrementalDataRecord,
    );
    filterSubsequentPayloads(exeContext, path, incrementalDataRecord);
    return null;
  }
}

/**
 * TODO: consider no longer exporting this function
 * @internal
 */
export function buildResolveInfo(
  exeContext: ExecutionContext,
  fieldDef: GraphQLField<unknown, unknown>,
  fieldGroup: FieldGroup,
  parentType: GraphQLObjectType,
  path: Path,
): GraphQLResolveInfo {
  // The resolve function's optional fourth argument is a collection of
  // information about the current execution state.
  return {
    fieldName: fieldDef.name,
    fieldNodes: toNodes(fieldGroup),
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

function handleFieldError(
  rawError: unknown,
  exeContext: ExecutionContext,
  returnType: GraphQLOutputType,
  fieldGroup: FieldGroup,
  path: Path,
  incrementalDataRecord: IncrementalDataRecord | undefined,
): void {
  const error = locatedError(rawError, toNodes(fieldGroup), pathToArray(path));

  // If the field type is non-nullable, then it is resolved without any
  // protection from errors, however it still properly locates the error.
  if (isNonNullType(returnType)) {
    throw error;
  }

  const errors = incrementalDataRecord?.errors ?? exeContext.errors;

  // Otherwise, error protection is applied, logging the error and resolving
  // a null value for this field if one is encountered.
  errors.push(error);
}

/**
 * Implements the instructions for completeValue as defined in the
 * "Value Completion" section of the spec.
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
function completeValue(
  exeContext: ExecutionContext,
  returnType: GraphQLOutputType,
  fieldGroup: FieldGroup,
  info: GraphQLResolveInfo,
  path: Path,
  result: unknown,
  deferMap: ReadonlyMap<DeferUsage, DeferredFragmentRecord>,
  incrementalDataRecord: IncrementalDataRecord | undefined,
): PromiseOrValue<unknown> {
  // If result is an Error, throw a located error.
  if (result instanceof Error) {
    throw result;
  }

  // If field type is NonNull, complete for inner type, and throw field error
  // if result is null.
  if (isNonNullType(returnType)) {
    const completed = completeValue(
      exeContext,
      returnType.ofType,
      fieldGroup,
      info,
      path,
      result,
      deferMap,
      incrementalDataRecord,
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
    return completeListValue(
      exeContext,
      returnType,
      fieldGroup,
      info,
      path,
      result,
      deferMap,
      incrementalDataRecord,
    );
  }

  // If field type is a leaf type, Scalar or Enum, serialize to a valid value,
  // returning null if serialization is not possible.
  if (isLeafType(returnType)) {
    return completeLeafValue(returnType, result);
  }

  // If field type is an abstract type, Interface or Union, determine the
  // runtime Object type and complete for that type.
  if (isAbstractType(returnType)) {
    return completeAbstractValue(
      exeContext,
      returnType,
      fieldGroup,
      info,
      path,
      result,
      deferMap,
      incrementalDataRecord,
    );
  }

  // If field type is Object, execute and complete all sub-selections.
  if (isObjectType(returnType)) {
    return completeObjectValue(
      exeContext,
      returnType,
      fieldGroup,
      info,
      path,
      result,
      deferMap,
      incrementalDataRecord,
    );
  }
  /* c8 ignore next 6 */
  // Not reachable, all possible output types have been considered.
  invariant(
    false,
    'Cannot complete value of unexpected output type: ' + inspect(returnType),
  );
}

async function completePromisedValue(
  exeContext: ExecutionContext,
  returnType: GraphQLOutputType,
  fieldGroup: FieldGroup,
  info: GraphQLResolveInfo,
  path: Path,
  result: Promise<unknown>,
  deferMap: ReadonlyMap<DeferUsage, DeferredFragmentRecord>,
  incrementalDataRecord: IncrementalDataRecord | undefined,
): Promise<unknown> {
  try {
    const resolved = await result;
    let completed = completeValue(
      exeContext,
      returnType,
      fieldGroup,
      info,
      path,
      resolved,
      deferMap,
      incrementalDataRecord,
    );
    if (isPromise(completed)) {
      completed = await completed;
    }
    return completed;
  } catch (rawError) {
    handleFieldError(
      rawError,
      exeContext,
      returnType,
      fieldGroup,
      path,
      incrementalDataRecord,
    );
    filterSubsequentPayloads(exeContext, path, incrementalDataRecord);
    return null;
  }
}

/**
 * Returns an object containing info for streaming if a field should be
 * streamed based on the experimental flag, stream directive present and
 * not disabled by the "if" argument.
 */
function getStreamUsage(
  exeContext: ExecutionContext,
  fieldGroup: FieldGroup,
  path: Path,
): StreamUsage | undefined {
  // do not stream inner lists of multi-dimensional lists
  if (typeof path.key === 'number') {
    return;
  }

  // TODO: add test for this case (a streamed list nested under a list).
  /* c8 ignore next 7 */
  if (
    (fieldGroup as unknown as { _streamUsage: StreamUsage })._streamUsage !==
    undefined
  ) {
    return (fieldGroup as unknown as { _streamUsage: StreamUsage })
      ._streamUsage;
  }

  // validation only allows equivalent streams on multiple fields, so it is
  // safe to only check the first fieldNode for the stream directive
  const stream = getDirectiveValues(
    GraphQLStreamDirective,
    fieldGroup.fields[0].node,
    exeContext.variableValues,
  );

  if (!stream) {
    return;
  }

  if (stream.if === false) {
    return;
  }

  invariant(
    typeof stream.initialCount === 'number',
    'initialCount must be a number',
  );

  invariant(
    stream.initialCount >= 0,
    'initialCount must be a positive integer',
  );

  invariant(
    exeContext.operation.operation !== OperationTypeNode.SUBSCRIPTION,
    '`@stream` directive not supported on subscription operations. Disable `@stream` by setting the `if` argument to `false`.',
  );

  const streamedFieldGroup: FieldGroup = {
    fields: fieldGroup.fields.map((fieldDetails) => ({
      node: fieldDetails.node,
      target: undefined,
    })),
    targets: NON_DEFERRED_TARGET_SET,
  };

  const streamUsage = {
    initialCount: stream.initialCount,
    label: typeof stream.label === 'string' ? stream.label : undefined,
    fieldGroup: streamedFieldGroup,
  };

  (fieldGroup as unknown as { _streamUsage: StreamUsage })._streamUsage =
    streamUsage;

  return streamUsage;
}
/**
 * Complete a async iterator value by completing the result and calling
 * recursively until all the results are completed.
 */
async function completeAsyncIteratorValue(
  exeContext: ExecutionContext,
  itemType: GraphQLOutputType,
  fieldGroup: FieldGroup,
  info: GraphQLResolveInfo,
  path: Path,
  asyncIterator: AsyncIterator<unknown>,
  deferMap: ReadonlyMap<DeferUsage, DeferredFragmentRecord>,
  incrementalDataRecord: IncrementalDataRecord | undefined,
): Promise<ReadonlyArray<unknown>> {
  const streamUsage = getStreamUsage(exeContext, fieldGroup, path);
  let containsPromise = false;
  const completedResults: Array<unknown> = [];
  let index = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    if (streamUsage && index >= streamUsage.initialCount) {
      const streamRecord = new StreamRecord({
        label: streamUsage.label,
        path,
        asyncIterator,
      });
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      executeStreamAsyncIterator(
        index,
        asyncIterator,
        exeContext,
        streamUsage.fieldGroup,
        info,
        itemType,
        path,
        streamRecord,
        deferMap,
        incrementalDataRecord,
      );
      break;
    }

    const itemPath = addPath(path, index, undefined);
    let iteration;
    try {
      // eslint-disable-next-line no-await-in-loop
      iteration = await asyncIterator.next();
      if (iteration.done) {
        break;
      }
    } catch (rawError) {
      handleFieldError(
        rawError,
        exeContext,
        itemType,
        fieldGroup,
        itemPath,
        incrementalDataRecord,
      );
      completedResults.push(null);
      break;
    }

    if (
      completeListItemValue(
        iteration.value,
        completedResults,
        exeContext,
        itemType,
        fieldGroup,
        info,
        itemPath,
        deferMap,
        incrementalDataRecord,
      )
    ) {
      containsPromise = true;
    }
    index += 1;
  }
  return containsPromise ? Promise.all(completedResults) : completedResults;
}

/**
 * Complete a list value by completing each item in the list with the
 * inner type
 */
function completeListValue(
  exeContext: ExecutionContext,
  returnType: GraphQLList<GraphQLOutputType>,
  fieldGroup: FieldGroup,
  info: GraphQLResolveInfo,
  path: Path,
  result: unknown,
  deferMap: ReadonlyMap<DeferUsage, DeferredFragmentRecord>,
  incrementalDataRecord: IncrementalDataRecord | undefined,
): PromiseOrValue<ReadonlyArray<unknown>> {
  const itemType = returnType.ofType;

  if (isAsyncIterable(result)) {
    const asyncIterator = result[Symbol.asyncIterator]();

    return completeAsyncIteratorValue(
      exeContext,
      itemType,
      fieldGroup,
      info,
      path,
      asyncIterator,
      deferMap,
      incrementalDataRecord,
    );
  }

  if (!isIterableObject(result)) {
    throw new GraphQLError(
      `Expected Iterable, but did not find one for field "${info.parentType.name}.${info.fieldName}".`,
    );
  }

  const streamUsage = getStreamUsage(exeContext, fieldGroup, path);

  // This is specified as a simple map, however we're optimizing the path
  // where the list contains no Promises by avoiding creating another Promise.
  let containsPromise = false;
  let currentParents = incrementalDataRecord;
  const completedResults: Array<unknown> = [];
  let index = 0;
  let streamRecord: StreamRecord | undefined;
  for (const item of result) {
    // No need to modify the info object containing the path,
    // since from here on it is not ever accessed by resolver functions.
    const itemPath = addPath(path, index, undefined);

    if (streamUsage && index >= streamUsage.initialCount) {
      if (streamRecord === undefined) {
        streamRecord = new StreamRecord({ label: streamUsage.label, path });
      }
      currentParents = executeStreamField(
        path,
        itemPath,
        item,
        exeContext,
        streamUsage.fieldGroup,
        info,
        itemType,
        streamRecord,
        deferMap,
        currentParents,
      );
      index++;
      continue;
    }

    if (
      completeListItemValue(
        item,
        completedResults,
        exeContext,
        itemType,
        fieldGroup,
        info,
        itemPath,
        deferMap,
        incrementalDataRecord,
      )
    ) {
      containsPromise = true;
    }

    index++;
  }

  if (streamRecord !== undefined) {
    (currentParents as StreamItemsRecord).setIsFinalRecord();
  }

  return containsPromise ? Promise.all(completedResults) : completedResults;
}

/**
 * Complete a list item value by adding it to the completed results.
 *
 * Returns true if the value is a Promise.
 */
function completeListItemValue(
  item: unknown,
  completedResults: Array<unknown>,
  exeContext: ExecutionContext,
  itemType: GraphQLOutputType,
  fieldGroup: FieldGroup,
  info: GraphQLResolveInfo,
  itemPath: Path,
  deferMap: ReadonlyMap<DeferUsage, DeferredFragmentRecord>,
  incrementalDataRecord: IncrementalDataRecord | undefined,
): boolean {
  if (isPromise(item)) {
    completedResults.push(
      completePromisedValue(
        exeContext,
        itemType,
        fieldGroup,
        info,
        itemPath,
        item,
        deferMap,
        incrementalDataRecord,
      ),
    );

    return true;
  }

  try {
    const completedItem = completeValue(
      exeContext,
      itemType,
      fieldGroup,
      info,
      itemPath,
      item,
      deferMap,
      incrementalDataRecord,
    );

    if (isPromise(completedItem)) {
      // Note: we don't rely on a `catch` method, but we do expect "thenable"
      // to take a second callback for the error case.
      completedResults.push(
        completedItem.then(undefined, (rawError) => {
          handleFieldError(
            rawError,
            exeContext,
            itemType,
            fieldGroup,
            itemPath,
            incrementalDataRecord,
          );
          filterSubsequentPayloads(exeContext, itemPath, incrementalDataRecord);
          return null;
        }),
      );

      return true;
    }

    completedResults.push(completedItem);
  } catch (rawError) {
    handleFieldError(
      rawError,
      exeContext,
      itemType,
      fieldGroup,
      itemPath,
      incrementalDataRecord,
    );
    filterSubsequentPayloads(exeContext, itemPath, incrementalDataRecord);
    completedResults.push(null);
  }

  return false;
}

/**
 * Complete a Scalar or Enum by serializing to a valid value, returning
 * null if serialization is not possible.
 */
function completeLeafValue(
  returnType: GraphQLLeafType,
  result: unknown,
): unknown {
  const serializedResult = returnType.serialize(result);
  if (serializedResult == null) {
    throw new Error(
      `Expected \`${inspect(returnType)}.serialize(${inspect(result)})\` to ` +
        `return non-nullable value, returned: ${inspect(serializedResult)}`,
    );
  }
  return serializedResult;
}

/**
 * Complete a value of an abstract type by determining the runtime object type
 * of that value, then complete the value for that type.
 */
function completeAbstractValue(
  exeContext: ExecutionContext,
  returnType: GraphQLAbstractType,
  fieldGroup: FieldGroup,
  info: GraphQLResolveInfo,
  path: Path,
  result: unknown,
  deferMap: ReadonlyMap<DeferUsage, DeferredFragmentRecord>,
  incrementalDataRecord: IncrementalDataRecord | undefined,
): PromiseOrValue<ObjMap<unknown>> {
  const resolveTypeFn = returnType.resolveType ?? exeContext.typeResolver;
  const contextValue = exeContext.contextValue;
  const runtimeType = resolveTypeFn(result, contextValue, info, returnType);

  if (isPromise(runtimeType)) {
    return runtimeType.then((resolvedRuntimeType) =>
      completeObjectValue(
        exeContext,
        ensureValidRuntimeType(
          resolvedRuntimeType,
          exeContext,
          returnType,
          fieldGroup,
          info,
          result,
        ),
        fieldGroup,
        info,
        path,
        result,
        deferMap,
        incrementalDataRecord,
      ),
    );
  }

  return completeObjectValue(
    exeContext,
    ensureValidRuntimeType(
      runtimeType,
      exeContext,
      returnType,
      fieldGroup,
      info,
      result,
    ),
    fieldGroup,
    info,
    path,
    result,
    deferMap,
    incrementalDataRecord,
  );
}

function ensureValidRuntimeType(
  runtimeTypeName: unknown,
  exeContext: ExecutionContext,
  returnType: GraphQLAbstractType,
  fieldGroup: FieldGroup,
  info: GraphQLResolveInfo,
  result: unknown,
): GraphQLObjectType {
  if (runtimeTypeName == null) {
    throw new GraphQLError(
      `Abstract type "${returnType.name}" must resolve to an Object type at runtime for field "${info.parentType.name}.${info.fieldName}". Either the "${returnType.name}" type should provide a "resolveType" function or each possible type should provide an "isTypeOf" function.`,
      { nodes: toNodes(fieldGroup) },
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
      { nodes: toNodes(fieldGroup) },
    );
  }

  if (!isObjectType(runtimeType)) {
    throw new GraphQLError(
      `Abstract type "${returnType.name}" was resolved to a non-object type "${runtimeTypeName}".`,
      { nodes: toNodes(fieldGroup) },
    );
  }

  if (!exeContext.schema.isSubType(returnType, runtimeType)) {
    throw new GraphQLError(
      `Runtime Object type "${runtimeType.name}" is not a possible type for "${returnType.name}".`,
      { nodes: toNodes(fieldGroup) },
    );
  }

  return runtimeType;
}

/**
 * Complete an Object value by executing all sub-selections.
 */
function completeObjectValue(
  exeContext: ExecutionContext,
  returnType: GraphQLObjectType,
  fieldGroup: FieldGroup,
  info: GraphQLResolveInfo,
  path: Path,
  result: unknown,
  deferMap: ReadonlyMap<DeferUsage, DeferredFragmentRecord>,
  incrementalDataRecord: IncrementalDataRecord | undefined,
): PromiseOrValue<ObjMap<unknown>> {
  // If there is an isTypeOf predicate function, call it with the
  // current result. If isTypeOf returns false, then raise an error rather
  // than continuing execution.
  if (returnType.isTypeOf) {
    const isTypeOf = returnType.isTypeOf(result, exeContext.contextValue, info);

    if (isPromise(isTypeOf)) {
      return isTypeOf.then((resolvedIsTypeOf) => {
        if (!resolvedIsTypeOf) {
          throw invalidReturnTypeError(returnType, result, fieldGroup);
        }
        return collectAndExecuteSubfields(
          exeContext,
          returnType,
          fieldGroup,
          path,
          result,
          deferMap,
          incrementalDataRecord,
        );
      });
    }

    if (!isTypeOf) {
      throw invalidReturnTypeError(returnType, result, fieldGroup);
    }
  }

  return collectAndExecuteSubfields(
    exeContext,
    returnType,
    fieldGroup,
    path,
    result,
    deferMap,
    incrementalDataRecord,
  );
}

function invalidReturnTypeError(
  returnType: GraphQLObjectType,
  result: unknown,
  fieldGroup: FieldGroup,
): GraphQLError {
  return new GraphQLError(
    `Expected value of type "${returnType.name}" but got: ${inspect(result)}.`,
    { nodes: toNodes(fieldGroup) },
  );
}

function collectAndExecuteSubfields(
  exeContext: ExecutionContext,
  returnType: GraphQLObjectType,
  fieldGroup: FieldGroup,
  path: Path,
  result: unknown,
  deferMap: ReadonlyMap<DeferUsage, DeferredFragmentRecord>,
  incrementalDataRecord: IncrementalDataRecord | undefined,
): PromiseOrValue<ObjMap<unknown>> {
  // Collect sub-fields to execute to complete this value.
  const { groupedFieldSet, newGroupedFieldSetDetails, newDeferUsages } =
    collectSubfields(exeContext, returnType, fieldGroup);

  const {
    newDeferredFragmentRecords,
    newDeferMap,
    newDeferredGroupedFieldSetRecords,
  } = prepareNewDeferRecords(
    exeContext,
    newGroupedFieldSetDetails,
    newDeferUsages,
    path,
    deferMap,
    incrementalDataRecord,
  );

  const subFields = executeFields(
    exeContext,
    returnType,
    result,
    path,
    groupedFieldSet,
    newDeferMap,
    incrementalDataRecord,
  );

  executeDeferredGroupedFieldSets(
    exeContext,
    returnType,
    result,
    path,
    newDeferredGroupedFieldSetRecords,
    newDeferredFragmentRecords,
    newDeferMap,
  );

  return subFields;
}

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
 * Implements the "Subscribe" algorithm described in the GraphQL specification.
 *
 * Returns a Promise which resolves to either an AsyncIterator (if successful)
 * or an ExecutionResult (error). The promise will be rejected if the schema or
 * other arguments to this function are invalid, or if the resolved event stream
 * is not an async iterable.
 *
 * If the client-provided arguments to this function do not result in a
 * compliant subscription, a GraphQL Response (ExecutionResult) with descriptive
 * errors and no data will be returned.
 *
 * If the source stream could not be created due to faulty subscription resolver
 * logic or underlying systems, the promise will resolve to a single
 * ExecutionResult containing `errors` and no `data`.
 *
 * If the operation succeeded, the promise resolves to an AsyncIterator, which
 * yields a stream of ExecutionResults representing the response stream.
 *
 * This function does not support incremental delivery (`@defer` and `@stream`).
 * If an operation which would defer or stream data is executed with this
 * function, a field error will be raised at the location of the `@defer` or
 * `@stream` directive.
 *
 * Accepts an object with named arguments.
 */
export function subscribe(
  args: ExecutionArgs,
): PromiseOrValue<
  AsyncGenerator<ExecutionResult, void, void> | ExecutionResult
> {
  // If a valid execution context cannot be created due to incorrect arguments,
  // a "Response" with only errors is returned.
  const exeContext = buildExecutionContext(args);

  // Return early errors if execution context failed.
  if (!('schema' in exeContext)) {
    return { errors: exeContext };
  }

  const resultOrStream = createSourceEventStreamImpl(exeContext);

  if (isPromise(resultOrStream)) {
    return resultOrStream.then((resolvedResultOrStream) =>
      mapSourceToResponse(exeContext, resolvedResultOrStream),
    );
  }

  return mapSourceToResponse(exeContext, resultOrStream);
}

function mapSourceToResponse(
  exeContext: ExecutionContext,
  resultOrStream: ExecutionResult | AsyncIterable<unknown>,
): AsyncGenerator<ExecutionResult, void, void> | ExecutionResult {
  if (!isAsyncIterable(resultOrStream)) {
    return resultOrStream;
  }

  // For each payload yielded from a subscription, map it over the normal
  // GraphQL `execute` function, with `payload` as the rootValue.
  // This implements the "MapSourceToResponseEvent" algorithm described in
  // the GraphQL specification. The `execute` function provides the
  // "ExecuteSubscriptionEvent" algorithm, as it is nearly identical to the
  // "ExecuteQuery" algorithm, for which `execute` is also used.
  return mapAsyncIterable(
    resultOrStream,
    (payload: unknown) =>
      executeImpl(
        buildPerEventExecutionContext(exeContext, payload),
        // typecast to ExecutionResult, not possible to return
        // ExperimentalIncrementalExecutionResults when
        // exeContext.operation is 'subscription'.
      ) as ExecutionResult,
  );
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
export function createSourceEventStream(
  args: ExecutionArgs,
): PromiseOrValue<AsyncIterable<unknown> | ExecutionResult> {
  // If a valid execution context cannot be created due to incorrect arguments,
  // a "Response" with only errors is returned.
  const exeContext = buildExecutionContext(args);

  // Return early errors if execution context failed.
  if (!('schema' in exeContext)) {
    return { errors: exeContext };
  }

  return createSourceEventStreamImpl(exeContext);
}

function createSourceEventStreamImpl(
  exeContext: ExecutionContext,
): PromiseOrValue<AsyncIterable<unknown> | ExecutionResult> {
  try {
    const eventStream = executeSubscription(exeContext);
    if (isPromise(eventStream)) {
      return eventStream.then(undefined, (error) => ({ errors: [error] }));
    }

    return eventStream;
  } catch (error) {
    return { errors: [error] };
  }
}

function executeSubscription(
  exeContext: ExecutionContext,
): PromiseOrValue<AsyncIterable<unknown>> {
  const { schema, fragments, operation, variableValues, rootValue } =
    exeContext;

  const rootType = schema.getSubscriptionType();
  if (rootType == null) {
    throw new GraphQLError(
      'Schema is not configured to execute subscription operation.',
      { nodes: operation },
    );
  }

  const { groupedFieldSet } = collectFields(
    schema,
    fragments,
    variableValues,
    rootType,
    operation,
  );

  const firstRootField = groupedFieldSet.entries().next().value as [
    string,
    FieldGroup,
  ];
  const [responseName, fieldGroup] = firstRootField;
  const fieldName = fieldGroup.fields[0].node.name.value;
  const fieldDef = schema.getField(rootType, fieldName);

  if (!fieldDef) {
    throw new GraphQLError(
      `The subscription field "${fieldName}" is not defined.`,
      { nodes: toNodes(fieldGroup) },
    );
  }

  const path = addPath(undefined, responseName, rootType.name);
  const info = buildResolveInfo(
    exeContext,
    fieldDef,
    fieldGroup,
    rootType,
    path,
  );

  try {
    // Implements the "ResolveFieldEventStream" algorithm from GraphQL specification.
    // It differs from "ResolveFieldValue" due to providing a different `resolveFn`.

    // Build a JS object of arguments from the field.arguments AST, using the
    // variables scope to fulfill any variable references.
    const args = getArgumentValues(
      fieldDef,
      fieldGroup.fields[0].node,
      variableValues,
    );

    // The resolve function's optional third argument is a context value that
    // is provided to every resolve function within an execution. It is commonly
    // used to represent an authenticated user, or request-specific caches.
    const contextValue = exeContext.contextValue;

    // Call the `subscribe()` resolver or the default resolver to produce an
    // AsyncIterable yielding raw payloads.
    const resolveFn = fieldDef.subscribe ?? exeContext.subscribeFieldResolver;
    const result = resolveFn(rootValue, args, contextValue, info);

    if (isPromise(result)) {
      return result.then(assertEventStream).then(undefined, (error) => {
        throw locatedError(error, toNodes(fieldGroup), pathToArray(path));
      });
    }

    return assertEventStream(result);
  } catch (error) {
    throw locatedError(error, toNodes(fieldGroup), pathToArray(path));
  }
}

function assertEventStream(result: unknown): AsyncIterable<unknown> {
  if (result instanceof Error) {
    throw result;
  }

  // Assert field returned an event stream, otherwise yield an error.
  if (!isAsyncIterable(result)) {
    throw new GraphQLError(
      'Subscription field must return Async Iterable. ' +
        `Received: ${inspect(result)}.`,
    );
  }

  return result;
}

function prepareNewDeferRecords(
  exeContext: ExecutionContext,
  newGroupedFieldSetDetails: Map<DeferUsageSet, GroupedFieldSetDetails>,
  newDeferUsages: ReadonlyArray<DeferUsage>,
  path?: Path | undefined,
  deferMap?: ReadonlyMap<DeferUsage, DeferredFragmentRecord>,
  incrementalDataRecord?: IncrementalDataRecord | undefined,
): {
  newDeferredFragmentRecords: ReadonlyArray<DeferredFragmentRecord>;
  newDeferMap: ReadonlyMap<DeferUsage, DeferredFragmentRecord>;
  newDeferredGroupedFieldSetRecords: ReadonlyArray<DeferredGroupedFieldSetRecord>;
} {
  const newDeferredFragmentRecords: Array<DeferredFragmentRecord> = [];

  let newDeferMap;
  if (newDeferUsages.length === 0) {
    newDeferMap = deferMap ?? new Map<DeferUsage, DeferredFragmentRecord>();
  } else {
    newDeferMap =
      deferMap === undefined
        ? new Map<DeferUsage, DeferredFragmentRecord>()
        : new Map<DeferUsage, DeferredFragmentRecord>(deferMap);
    for (const deferUsage of newDeferUsages) {
      let parent;
      if (isStreamItemsRecord(incrementalDataRecord)) {
        parent = incrementalDataRecord;
      } else {
        const parentDeferUsage = deferUsage.ancestors[0];

        if (parentDeferUsage === undefined) {
          parent = undefined;
        } else {
          parent = deferredFragmentRecordFromDeferUsage(
            parentDeferUsage,
            newDeferMap,
          );
        }
      }

      const deferredFragmentRecord = new DeferredFragmentRecord({
        deferUsage,
        path,
        label: deferUsage.label,
        parent,
        publisher: exeContext.publisher,
      });
      newDeferredFragmentRecords.push(deferredFragmentRecord);
      newDeferMap.set(deferUsage, deferredFragmentRecord);
    }
  }

  const newDeferredGroupedFieldSetRecords: Array<DeferredGroupedFieldSetRecord> =
    [];

  for (const [
    newGroupedFieldSetDeferUsages,
    { groupedFieldSet, shouldInitiateDefer },
  ] of newGroupedFieldSetDetails) {
    const deferredFragmentRecords = getDeferredFragmentRecords(
      newGroupedFieldSetDeferUsages,
      newDeferMap,
    );
    const deferredGroupedFieldSetRecord = new DeferredGroupedFieldSetRecord({
      path,
      deferredFragmentRecords,
      groupedFieldSet,
      shouldInitiateDefer,
      exeContext,
    });
    for (const deferredFragmentRecord of deferredFragmentRecords) {
      deferredFragmentRecord.addPendingDeferredGroupedFieldSet(
        deferredGroupedFieldSetRecord,
      );
    }
    newDeferredGroupedFieldSetRecords.push(deferredGroupedFieldSetRecord);
  }

  return {
    newDeferredFragmentRecords,
    newDeferMap,
    newDeferredGroupedFieldSetRecords,
  };
}

function getDeferredFragmentRecords(
  deferUsages: DeferUsageSet,
  deferMap: ReadonlyMap<DeferUsage, DeferredFragmentRecord>,
): Array<DeferredFragmentRecord> {
  return Array.from(deferUsages).map((deferUsage) =>
    deferredFragmentRecordFromDeferUsage(deferUsage, deferMap),
  );
}

function deferredFragmentRecordFromDeferUsage(
  deferUsage: DeferUsage,
  deferMap: ReadonlyMap<DeferUsage, DeferredFragmentRecord>,
): DeferredFragmentRecord {
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  return deferMap.get(deferUsage)!;
}

function executeDeferredGroupedFieldSets(
  exeContext: ExecutionContext,
  parentType: GraphQLObjectType,
  sourceValue: unknown,
  path: Path | undefined,
  deferredGroupedFieldSetRecords: ReadonlyArray<DeferredGroupedFieldSetRecord>,
  deferredFragmentRecords: ReadonlyArray<DeferredFragmentRecord>,
  deferMap: ReadonlyMap<DeferUsage, DeferredFragmentRecord>,
): void {
  for (const deferredGroupedFieldSetRecord of deferredGroupedFieldSetRecords) {
    executeDeferredGroupedFieldSet(
      exeContext,
      parentType,
      sourceValue,
      path,
      deferredGroupedFieldSetRecord,
      deferMap,
    );
  }

  for (const deferredFragmentRecord of deferredFragmentRecords) {
    deferredFragmentRecord.completeIfReady();
  }
}

function executeDeferredGroupedFieldSet(
  exeContext: ExecutionContext,
  parentType: GraphQLObjectType,
  sourceValue: unknown,
  path: Path | undefined,
  deferredGroupedFieldSetRecord: DeferredGroupedFieldSetRecord,
  deferMap: ReadonlyMap<DeferUsage, DeferredFragmentRecord>,
): void {
  if (deferredGroupedFieldSetRecord.shouldInitiateDefer) {
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    executeDeferredGroupedFieldSetWithDeferral(
      exeContext,
      parentType,
      sourceValue,
      path,
      deferredGroupedFieldSetRecord,
      deferMap,
    );
    return;
  }

  try {
    const incrementalResult = executeFields(
      exeContext,
      parentType,
      sourceValue,
      path,
      deferredGroupedFieldSetRecord.groupedFieldSet,
      deferMap,
      deferredGroupedFieldSetRecord,
    );

    if (isPromise(incrementalResult)) {
      incrementalResult.then(
        (resolved) => deferredGroupedFieldSetRecord.complete(resolved),
        (error) => deferredGroupedFieldSetRecord.markErrored(error),
      );
      return;
    }

    deferredGroupedFieldSetRecord.complete(incrementalResult);
  } catch (error) {
    deferredGroupedFieldSetRecord.markErrored(error);
  }
}

async function executeDeferredGroupedFieldSetWithDeferral(
  exeContext: ExecutionContext,
  parentType: GraphQLObjectType,
  sourceValue: unknown,
  path: Path | undefined,
  deferredGroupedFieldSetRecord: DeferredGroupedFieldSetRecord,
  deferMap: ReadonlyMap<DeferUsage, DeferredFragmentRecord>,
): Promise<void> {
  try {
    let result = executeFields(
      exeContext,
      parentType,
      sourceValue,
      path,
      deferredGroupedFieldSetRecord.groupedFieldSet,
      deferMap,
      deferredGroupedFieldSetRecord,
    );
    if (isPromise(result)) {
      result = await result;
    }
    deferredGroupedFieldSetRecord.complete(result);
  } catch (error) {
    deferredGroupedFieldSetRecord.markErrored(error);
  }
}

function executeStreamField(
  path: Path,
  itemPath: Path,
  item: PromiseOrValue<unknown>,
  exeContext: ExecutionContext,
  fieldGroup: FieldGroup,
  info: GraphQLResolveInfo,
  itemType: GraphQLOutputType,
  streamRecord: StreamRecord,
  deferMap: ReadonlyMap<DeferUsage, DeferredFragmentRecord>,
  incrementalDataRecord: IncrementalDataRecord | undefined,
): StreamItemsRecord {
  const streamItemsRecord = new StreamItemsRecord({
    streamRecord,
    path: itemPath,
    parents: getSubsequentResultRecords(incrementalDataRecord),
    publisher: exeContext.publisher,
  });
  if (isPromise(item)) {
    completePromisedValue(
      exeContext,
      itemType,
      fieldGroup,
      info,
      itemPath,
      item,
      deferMap,
      streamItemsRecord,
    ).then(
      (value) => streamItemsRecord.complete([value]),
      (error) => {
        filterSubsequentPayloads(exeContext, path, streamItemsRecord);
        streamItemsRecord.markErrored(error);
      },
    );

    return streamItemsRecord;
  }

  let completedItem: PromiseOrValue<unknown>;
  try {
    try {
      completedItem = completeValue(
        exeContext,
        itemType,
        fieldGroup,
        info,
        itemPath,
        item,
        deferMap,
        streamItemsRecord,
      );
    } catch (rawError) {
      handleFieldError(
        rawError,
        exeContext,
        itemType,
        fieldGroup,
        itemPath,
        streamItemsRecord,
      );
      completedItem = null;
      filterSubsequentPayloads(exeContext, itemPath, streamItemsRecord);
    }
  } catch (error) {
    filterSubsequentPayloads(exeContext, path, streamItemsRecord);
    streamItemsRecord.markErrored(error);
    return streamItemsRecord;
  }

  if (isPromise(completedItem)) {
    completedItem
      .then(undefined, (rawError) => {
        handleFieldError(
          rawError,
          exeContext,
          itemType,
          fieldGroup,
          itemPath,
          streamItemsRecord,
        );
        filterSubsequentPayloads(exeContext, itemPath, streamItemsRecord);
        return null;
      })
      .then(
        (value) => streamItemsRecord.complete([value]),
        (error) => {
          filterSubsequentPayloads(exeContext, path, streamItemsRecord);
          streamItemsRecord.markErrored(error);
        },
      );

    return streamItemsRecord;
  }

  streamItemsRecord.complete([completedItem]);
  return streamItemsRecord;
}

async function executeStreamAsyncIteratorItem(
  asyncIterator: AsyncIterator<unknown>,
  exeContext: ExecutionContext,
  fieldGroup: FieldGroup,
  info: GraphQLResolveInfo,
  itemType: GraphQLOutputType,
  streamItemsRecord: StreamItemsRecord,
  itemPath: Path,
  deferMap: ReadonlyMap<DeferUsage, DeferredFragmentRecord>,
): Promise<IteratorResult<unknown>> {
  let item;
  try {
    const iteration = await asyncIterator.next();
    if (streamItemsRecord.streamRecord.filtered || iteration.done) {
      streamItemsRecord.setIsCompletedAsyncIterator();
      return { done: true, value: undefined };
    }
    item = iteration.value;
  } catch (rawError) {
    streamItemsRecord.setIsFinalRecord();
    handleFieldError(
      rawError,
      exeContext,
      itemType,
      fieldGroup,
      itemPath,
      streamItemsRecord,
    );
    // don't continue if async iterator throws
    return { done: true, value: null };
  }
  let completedItem;
  try {
    completedItem = completeValue(
      exeContext,
      itemType,
      fieldGroup,
      info,
      itemPath,
      item,
      deferMap,
      streamItemsRecord,
    );

    if (isPromise(completedItem)) {
      completedItem = completedItem.then(undefined, (rawError) => {
        handleFieldError(
          rawError,
          exeContext,
          itemType,
          fieldGroup,
          itemPath,
          streamItemsRecord,
        );
        filterSubsequentPayloads(exeContext, itemPath, streamItemsRecord);
        return null;
      });
    }
    return { done: false, value: completedItem };
  } catch (rawError) {
    handleFieldError(
      rawError,
      exeContext,
      itemType,
      fieldGroup,
      itemPath,
      streamItemsRecord,
    );
    filterSubsequentPayloads(exeContext, itemPath, streamItemsRecord);
    return { done: false, value: null };
  }
}

async function executeStreamAsyncIterator(
  initialIndex: number,
  asyncIterator: AsyncIterator<unknown>,
  exeContext: ExecutionContext,
  fieldGroup: FieldGroup,
  info: GraphQLResolveInfo,
  itemType: GraphQLOutputType,
  path: Path,
  streamRecord: StreamRecord,
  deferMap: ReadonlyMap<DeferUsage, DeferredFragmentRecord>,
  incrementalDataRecord: IncrementalDataRecord | undefined,
): Promise<void> {
  let index = initialIndex;
  let currentIncrementalDataRecord = incrementalDataRecord;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const itemPath = addPath(path, index, undefined);
    const streamItemsRecord = new StreamItemsRecord({
      streamRecord,
      path: itemPath,
      parents: getSubsequentResultRecords(currentIncrementalDataRecord),
      publisher: exeContext.publisher,
    });

    let iteration;
    try {
      // eslint-disable-next-line no-await-in-loop
      iteration = await executeStreamAsyncIteratorItem(
        asyncIterator,
        exeContext,
        fieldGroup,
        info,
        itemType,
        streamItemsRecord,
        itemPath,
        deferMap,
      );
    } catch (error) {
      filterSubsequentPayloads(exeContext, path, streamItemsRecord);
      streamItemsRecord.markErrored(error);
      // entire stream has errored and bubbled upwards
      if (asyncIterator?.return) {
        asyncIterator.return().catch(() => {
          // ignore errors
        });
      }
      return;
    }

    const { done, value: completedItem } = iteration;

    if (isPromise(completedItem)) {
      completedItem.then(
        (value) => streamItemsRecord.complete([value]),
        (error) => {
          filterSubsequentPayloads(exeContext, path, streamItemsRecord);
          streamItemsRecord.markErrored(error);
        },
      );
    } else {
      streamItemsRecord.complete([completedItem]);
    }

    if (done) {
      break;
    }
    currentIncrementalDataRecord = streamItemsRecord;
    index++;
  }
}

function filterSubsequentPayloads(
  exeContext: ExecutionContext,
  nullPath: Path | undefined,
  erroringIncrementalDataRecord: IncrementalDataRecord | undefined,
): void {
  const nullPathArray = pathToArray(nullPath);

  const streams = new Set<StreamRecord>();

  const children = getChildren(exeContext, erroringIncrementalDataRecord);
  const descendants = getDescendants(children);

  for (const child of descendants) {
    if (!nullsChildSubsequentResultRecord(child, nullPathArray)) {
      continue;
    }

    exeContext.publisher.delete(child);

    if (isStreamItemsRecord(child)) {
      if (child.parents !== undefined) {
        for (const parent of child.parents) {
          parent.children.delete(child);
        }
      }
      streams.add(child.streamRecord);
    } else if (child.parent !== undefined) {
      child.parent.children.delete(child);
    }
  }

  streams.forEach((stream) => {
    returnStreamIteratorIgnoringError(stream);
    stream.markFiltered();
  });
}

function getChildren(
  exeContext: ExecutionContext,
  erroringIncrementalDataRecord: IncrementalDataRecord | undefined,
): ReadonlySet<SubsequentResultRecord> {
  const erroringSubsequentResultRecords = getSubsequentResultRecords(
    erroringIncrementalDataRecord,
  );

  if (erroringSubsequentResultRecords === undefined) {
    return exeContext.publisher.getPending();
  }

  const children = new Set<SubsequentResultRecord>();
  for (const erroringSubsequentResultRecord of erroringSubsequentResultRecords) {
    for (const child of erroringSubsequentResultRecord.children) {
      children.add(child);
    }
  }
  return children;
}

function getDescendants(
  children: ReadonlySet<SubsequentResultRecord>,
  descendants = new Set<SubsequentResultRecord>(),
): ReadonlySet<SubsequentResultRecord> {
  for (const child of children) {
    descendants.add(child);
    getDescendants(child.children, descendants);
  }
  return descendants;
}

function nullsChildSubsequentResultRecord(
  subsequentResultRecord: SubsequentResultRecord,
  nullPath: Array<string | number>,
): boolean {
  const incrementalDataRecords = isStreamItemsRecord(subsequentResultRecord)
    ? [subsequentResultRecord]
    : subsequentResultRecord.deferredGroupedFieldSetRecords;

  for (const incrementalDataRecord of incrementalDataRecords) {
    if (matchesPath(incrementalDataRecord.path, nullPath)) {
      return true;
    }
  }

  return false;
}

function matchesPath(
  testPath: Array<string | number>,
  basePath: Array<string | number>,
): boolean {
  for (let i = 0; i < basePath.length; i++) {
    if (basePath[i] !== testPath[i]) {
      // testPath points to a path unaffected at basePath
      return false;
    }
  }
  return true;
}

function returnStreamIteratorIgnoringError(streamRecord: StreamRecord): void {
  streamRecord.asyncIterator?.return?.().catch(() => {
    // ignore error
  });
}

function getIncrementalResult(
  completedRecords: ReadonlySet<SubsequentResultRecord>,
  publisher: IncrementalPublisher,
): SubsequentIncrementalExecutionResult | undefined {
  const { incremental, completed } = processPending(completedRecords);

  const hasNext = publisher.hasNext();
  if (incremental.length === 0 && completed.length === 0 && hasNext) {
    return undefined;
  }

  const result: SubsequentIncrementalExecutionResult = { hasNext };
  if (incremental.length) {
    result.incremental = incremental;
  }
  if (completed.length) {
    result.completed = completed;
  }

  return result;
}

function processPending(
  completedRecords: ReadonlySet<SubsequentResultRecord>,
): IncrementalUpdate {
  const incrementalResults: Array<IncrementalResult> = [];
  const completedResults: Array<CompletedResult> = [];
  for (const subsequentResultRecord of completedRecords) {
    for (const child of subsequentResultRecord.children) {
      child.publish();
    }
    if (isStreamItemsRecord(subsequentResultRecord)) {
      if (subsequentResultRecord.isFinalRecord) {
        completedResults.push(
          completedRecordToResult(subsequentResultRecord.streamRecord),
        );
      }
      if (subsequentResultRecord.isCompletedAsyncIterator) {
        // async iterable resolver just finished but there may be pending payloads
        continue;
      }
      if (subsequentResultRecord.items === null) {
        continue;
      }
      const incrementalResult: IncrementalStreamResult = {
        items: subsequentResultRecord.items,
        path: subsequentResultRecord.path,
      };
      if (subsequentResultRecord.errors.length > 0) {
        incrementalResult.errors = subsequentResultRecord.errors;
      }
      incrementalResults.push(incrementalResult);
    } else {
      completedResults.push(completedRecordToResult(subsequentResultRecord));
      if (subsequentResultRecord.errors.length > 0) {
        continue;
      }
      for (const deferredGroupedFieldSetRecord of subsequentResultRecord.deferredGroupedFieldSetRecords) {
        if (!deferredGroupedFieldSetRecord.sent) {
          deferredGroupedFieldSetRecord.markSent();
          const incrementalResult: IncrementalDeferResult = {
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            data: deferredGroupedFieldSetRecord.data!,
            path: deferredGroupedFieldSetRecord.path,
          };
          if (deferredGroupedFieldSetRecord.errors.length > 0) {
            incrementalResult.errors = deferredGroupedFieldSetRecord.errors;
          }
          incrementalResults.push(incrementalResult);
        }
      }
    }
  }

  return {
    incremental: incrementalResults,
    completed: completedResults,
  };
}

function completedRecordToResult(
  completedRecord: DeferredFragmentRecord | StreamRecord,
): CompletedResult {
  const result: CompletedResult = {
    path: completedRecord.path,
  };
  if (completedRecord.label !== undefined) {
    result.label = completedRecord.label;
  }
  if (completedRecord.errors.length > 0) {
    result.errors = completedRecord.errors;
  }
  return result;
}

async function returnStreamIterators(
  pending: ReadonlySet<SubsequentResultRecord>,
): Promise<void> {
  const streams = new Set<StreamRecord>();
  for (const subsequentResultRecord of pending) {
    if (isStreamItemsRecord(subsequentResultRecord)) {
      streams.add(subsequentResultRecord.streamRecord);
    }
  }
  const promises: Array<Promise<IteratorResult<unknown>>> = [];
  streams.forEach((streamRecord) => {
    if (streamRecord.asyncIterator?.return) {
      promises.push(streamRecord.asyncIterator.return());
    }
  });
  await Promise.all(promises);
}

class DeferredGroupedFieldSetRecord {
  path: Array<string | number>;
  deferredFragmentRecords: Array<DeferredFragmentRecord>;
  groupedFieldSet: GroupedFieldSet;
  shouldInitiateDefer: boolean;
  _exeContext: ExecutionContext;
  errors: Array<GraphQLError>;
  data: ObjMap<unknown> | undefined;
  sent: boolean;

  constructor(opts: {
    path: Path | undefined;
    deferredFragmentRecords: Array<DeferredFragmentRecord>;
    groupedFieldSet: GroupedFieldSet;
    shouldInitiateDefer: boolean;
    parent?: IncrementalDataRecord | undefined;
    exeContext: ExecutionContext;
  }) {
    this.path = pathToArray(opts.path);
    this.deferredFragmentRecords = opts.deferredFragmentRecords;
    this.groupedFieldSet = opts.groupedFieldSet;
    this.shouldInitiateDefer = opts.shouldInitiateDefer;
    this._exeContext = opts.exeContext;
    this.errors = [];
    this.sent = false;
  }

  complete(data: ObjMap<unknown>): void {
    this.data = data;
    for (const deferredFragmentRecord of this.deferredFragmentRecords) {
      deferredFragmentRecord.removePendingDeferredGroupedFieldSet(this);
    }
  }

  markErrored(error: GraphQLError): void {
    for (const deferredFragmentRecord of this.deferredFragmentRecords) {
      deferredFragmentRecord.markErrored(error);
    }
  }

  markSent(): void {
    this.sent = true;
  }
}

class DeferredFragmentRecord {
  deferUsage: DeferUsage;
  path: Array<string | number>;
  label: string | undefined;
  parent: SubsequentResultRecord | undefined;
  children: Set<SubsequentResultRecord>;
  deferredGroupedFieldSetRecords: Set<DeferredGroupedFieldSetRecord>;
  errors: Array<GraphQLError>;
  isCompleted: boolean;
  _publisher: IncrementalPublisher;
  _pending: Set<DeferredGroupedFieldSetRecord>;

  constructor(opts: {
    deferUsage: DeferUsage;
    path: Path | undefined;
    label: string | undefined;
    parent: SubsequentResultRecord | undefined;
    publisher: IncrementalPublisher;
  }) {
    this.deferUsage = opts.deferUsage;
    this.path = pathToArray(opts.path);
    this.label = opts.label;
    this.parent = opts.parent;
    this.children = new Set();
    this.isCompleted = false;
    this.deferredGroupedFieldSetRecords = new Set();
    this.errors = [];
    this._publisher = opts.publisher;
    if (this.parent === undefined) {
      this._publisher.introduce(this);
    } else {
      this.parent.children.add(this);
    }
    this._pending = new Set();
  }

  addPendingDeferredGroupedFieldSet(
    deferredGroupedFieldSetRecord: DeferredGroupedFieldSetRecord,
  ) {
    this._pending.add(deferredGroupedFieldSetRecord);
    this.deferredGroupedFieldSetRecords.add(deferredGroupedFieldSetRecord);
  }

  removePendingDeferredGroupedFieldSet(
    deferredGroupedFieldSetRecord: DeferredGroupedFieldSetRecord,
  ) {
    this._pending.delete(deferredGroupedFieldSetRecord);
    this.completeIfReady();
  }

  completeIfReady() {
    if (this._pending.size === 0) {
      this.complete();
    }
  }

  complete(): void {
    this.isCompleted = true;
    this._publisher.release(this);
  }

  publish() {
    if (this.isCompleted) {
      this._publisher.push(this);
    } else {
      this._publisher.introduce(this);
    }
  }

  markErrored(error: GraphQLError): void {
    this.errors.push(error);
    this.complete();
  }
}

class StreamRecord {
  label: string | undefined;
  path: Array<string | number>;
  errors: Array<GraphQLError>;
  asyncIterator?: AsyncIterator<unknown> | undefined;
  filtered?: boolean;
  constructor(opts: {
    label: string | undefined;
    path: Path;
    asyncIterator?: AsyncIterator<unknown> | undefined;
  }) {
    this.label = opts.label;
    this.path = pathToArray(opts.path);
    this.errors = [];
    this.asyncIterator = opts.asyncIterator;
  }

  markFiltered() {
    this.filtered = true;
  }
}

class StreamItemsRecord {
  errors: Array<GraphQLError>;
  streamRecord: StreamRecord;
  path: Array<string | number>;
  items: Array<unknown> | null;
  parents: Array<SubsequentResultRecord> | undefined;
  children: Set<SubsequentResultRecord>;
  isFinalRecord?: boolean;
  isCompletedAsyncIterator?: boolean;
  isCompleted: boolean;
  published?: boolean;
  _publisher: IncrementalPublisher;

  constructor(opts: {
    streamRecord: StreamRecord;
    path: Path | undefined;
    parents: Array<SubsequentResultRecord> | undefined;
    publisher: IncrementalPublisher;
    isFinalRecord?: boolean;
  }) {
    this.streamRecord = opts.streamRecord;
    this.path = pathToArray(opts.path);
    this.parents = opts.parents;
    this.children = new Set();
    this.errors = [];
    this._publisher = opts.publisher;
    if (this.parents === undefined) {
      this._publisher.introduce(this);
    } else {
      for (const parent of this.parents) {
        parent.children.add(this);
      }
    }
    this.isCompleted = false;
    this.items = [];
  }

  complete(items: Array<unknown> | null) {
    this.items = items;
    this.isCompleted = true;
    this._publisher.release(this);
  }

  markErrored(error: GraphQLError) {
    this.streamRecord.errors.push(error);
    this.setIsFinalRecord();
    this.complete(null);
  }

  setIsFinalRecord() {
    this.isFinalRecord = true;
  }

  setIsCompletedAsyncIterator() {
    this.isCompletedAsyncIterator = true;
    this.setIsFinalRecord();
  }

  publish() {
    if (this.isCompleted) {
      this._publisher.push(this);
    } else {
      this._publisher.introduce(this);
    }
  }
}

type IncrementalDataRecord = DeferredGroupedFieldSetRecord | StreamItemsRecord;

type SubsequentResultRecord = DeferredFragmentRecord | StreamItemsRecord;

function getSubsequentResultRecords(
  incrementalDataRecord: IncrementalDataRecord | undefined,
): Array<SubsequentResultRecord> | undefined {
  if (incrementalDataRecord === undefined) {
    return undefined;
  }

  if (isStreamItemsRecord(incrementalDataRecord)) {
    return [incrementalDataRecord];
  }

  return incrementalDataRecord.deferredFragmentRecords.map((record) => record);
}

function isStreamItemsRecord(
  subsequentResultRecord: unknown,
): subsequentResultRecord is StreamItemsRecord {
  return subsequentResultRecord instanceof StreamItemsRecord;
}
