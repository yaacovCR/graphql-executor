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
import { GraphQLError } from 'graphql';
import type { Path } from '../jsutils/Path';
import type { ObjMap } from '../jsutils/ObjMap';
import type { PromiseOrValue } from '../jsutils/PromiseOrValue';
import type { Maybe } from '../jsutils/Maybe';
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
  subscribeFieldResolver: GraphQLFieldResolver<any, any>;
  disableIncremental: boolean;
  errors: Array<GraphQLError>;
  subsequentPayloads: Array<Promise<IteratorResult<DispatcherResult, void>>>;
  initialResult?: ExecutionResult;
  iterators: Array<AsyncIterator<unknown>>;
  isDone: boolean;
  hasReturnedInitialResult: boolean;
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
/**
 * Same as ExecutionPatchResult, but without hasNext
 */
interface DispatcherResult {
  errors?: ReadonlyArray<GraphQLError>;
  data?: ObjMap<unknown> | unknown | null;
  path: ReadonlyArray<string | number>;
  label?: string;
  extensions?: ObjMap<unknown>;
}
export declare type AsyncExecutionResult =
  | ExecutionResult
  | ExecutionPatchResult;
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
export declare class Executor {
  /**
   * A memoized collection of relevant subfields with regard to the return
   * type. Memoizing ensures the subfields are not repeatedly calculated, which
   * saves overhead when resolving lists of values.
   */
  collectSubfields: (
    a1: ExecutionContext,
    a2: GraphQLObjectType<any, any>,
    a3: readonly FieldNode[],
  ) => import('./collectFields').FieldsAndPatches;
  /**
   * Implements the "Executing requests" section of the spec for queries and mutations.
   */
  executeQueryOrMutation(
    args: ExecutionArgs,
  ): PromiseOrValue<
    | ExecutionResult
    | AsyncGenerator<ExecutionResult | AsyncExecutionResult, void, void>
  >;
  executeSubscription(
    args: ExecutionArgs,
  ): Promise<
    | AsyncGenerator<ExecutionResult | AsyncExecutionResult, void, void>
    | ExecutionResult
  >;
  createSourceEventStream(
    args: ExecutionArgs,
  ): Promise<AsyncIterable<unknown> | ExecutionResult>;
  executeQueryOrMutationImpl(
    exeContext: ExecutionContext,
  ): PromiseOrValue<
    | ExecutionResult
    | AsyncGenerator<ExecutionResult | AsyncExecutionResult, void, void>
  >;
  /**
   * Given a completed execution context and data, build the `{ errors, data }`
   * response defined by the "Response" section of the GraphQL specification.
   */
  buildResponse(
    exeContext: ExecutionContext,
    data: ObjMap<unknown> | null,
  ): PromiseOrValue<
    | ExecutionResult
    | AsyncGenerator<ExecutionResult | AsyncExecutionResult, void, void>
  >;
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
  ): void;
  /**
   * Constructs a ExecutionContext object from the arguments passed to
   * execute, which we will pass throughout the other execution methods.
   *
   * Returns an array of GraphQLErrors if a valid execution context
   * cannot be created.
   */
  buildExecutionContext(
    args: ExecutionArgs,
  ): ReadonlyArray<GraphQLError> | ExecutionContext;
  /**
   * Constructs a perPayload ExecutionContext object from an initial
   * ExecutionObject and the payload value.
   */
  buildPerPayloadExecutionContext(
    exeContext: ExecutionContext,
    payload: unknown,
  ): ExecutionContext;
  /**
   * Executes the root fields specified by query or mutation operation.
   */
  executeQueryOrMutationRootFields(
    exeContext: ExecutionContext,
  ): PromiseOrValue<ObjMap<unknown> | null>;
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
  ): PromiseOrValue<ObjMap<unknown>>;
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
  ): PromiseOrValue<ObjMap<unknown>>;
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
  ): PromiseOrValue<unknown>;
  buildResolveInfo(
    exeContext: ExecutionContext,
    fieldDef: GraphQLField<unknown, unknown>,
    fieldNodes: ReadonlyArray<FieldNode>,
    parentType: GraphQLObjectType,
    path: Path,
  ): GraphQLResolveInfo;
  handleFieldError(
    error: GraphQLError,
    returnType: GraphQLOutputType,
    errors: Array<GraphQLError>,
  ): null;
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
  ): PromiseOrValue<unknown>;
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
  ): PromiseOrValue<ReadonlyArray<unknown>>;
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
      };
  /**
   * Complete a async iterator value by completing the result and calling
   * recursively until all the results are completed.
   */
  completeAsyncIteratorValue(
    exeContext: ExecutionContext,
    itemType: GraphQLOutputType,
    fieldNodes: ReadonlyArray<FieldNode>,
    info: GraphQLResolveInfo,
    path: Path,
    iterator: AsyncIterator<unknown>,
    errors: Array<GraphQLError>,
  ): Promise<ReadonlyArray<unknown>>;
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
  ): void;
  /**
   * Complete a Scalar or Enum by serializing to a valid value, returning
   * null if serialization is not possible.
   */
  completeLeafValue(returnType: GraphQLLeafType, result: unknown): unknown;
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
  ): PromiseOrValue<ObjMap<unknown>>;
  ensureValidRuntimeType(
    runtimeTypeName: unknown,
    exeContext: ExecutionContext,
    returnType: GraphQLAbstractType,
    fieldNodes: ReadonlyArray<FieldNode>,
    info: GraphQLResolveInfo,
    result: unknown,
  ): GraphQLObjectType;
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
  ): PromiseOrValue<ObjMap<unknown>>;
  invalidReturnTypeError(
    returnType: GraphQLObjectType,
    result: unknown,
    fieldNodes: ReadonlyArray<FieldNode>,
  ): GraphQLError;
  collectAndExecuteSubfields(
    exeContext: ExecutionContext,
    returnType: GraphQLObjectType,
    fieldNodes: ReadonlyArray<FieldNode>,
    path: Path,
    result: unknown,
    errors: Array<GraphQLError>,
  ): PromiseOrValue<ObjMap<unknown>>;
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
  ): Maybe<GraphQLField<unknown, unknown>>;
  executeSubscriptionImpl(
    exeContext: ExecutionContext,
  ): Promise<
    | AsyncGenerator<ExecutionResult | AsyncExecutionResult, void, void>
    | ExecutionResult
  >;
  createSourceEventStreamImpl(
    exeContext: ExecutionContext,
  ): Promise<AsyncIterable<unknown> | ExecutionResult>;
  executeSubscriptionRootField(exeContext: ExecutionContext): Promise<unknown>;
  hasSubsequentPayloads(exeContext: ExecutionContext): boolean;
  addFields(
    exeContext: ExecutionContext,
    promiseOrData: PromiseOrValue<ObjMap<unknown>>,
    errors: Array<GraphQLError>,
    label?: string,
    path?: Path,
  ): void;
  addValue(
    path: Path,
    promiseOrData: PromiseOrValue<unknown>,
    exeContext: ExecutionContext,
    fieldNodes: ReadonlyArray<FieldNode>,
    info: GraphQLResolveInfo,
    itemType: GraphQLOutputType,
    label?: string,
  ): void;
  addAsyncIteratorValue(
    initialIndex: number,
    iterator: AsyncIterator<unknown>,
    exeContext: ExecutionContext,
    fieldNodes: ReadonlyArray<FieldNode>,
    info: GraphQLResolveInfo,
    itemType: GraphQLOutputType,
    path?: Path,
    label?: string,
  ): void;
  _race(
    exeContext: ExecutionContext,
  ): Promise<IteratorResult<ExecutionPatchResult, void>>;
  _next(
    exeContext: ExecutionContext,
  ): Promise<IteratorResult<AsyncExecutionResult, void>>;
  _return(
    exeContext: ExecutionContext,
  ): Promise<IteratorResult<AsyncExecutionResult, void>>;
  _throw(
    exeContext: ExecutionContext,
    error?: unknown,
  ): Promise<IteratorResult<AsyncExecutionResult, void>>;
  get(
    exeContext: ExecutionContext,
    initialResult: ExecutionResult,
  ): AsyncGenerator<AsyncExecutionResult>;
  createPatchResult(
    data: ObjMap<unknown> | unknown | null,
    label?: string,
    path?: Path,
    errors?: ReadonlyArray<GraphQLError>,
  ): DispatcherResult;
}
/**
 * If a resolve function is not given, then a default resolve behavior is used
 * which takes the property of the source object of the same name as the field
 * and returns it as the result, or if it's a function, returns the result
 * of calling that function while passing along args and context value.
 */
export declare const defaultFieldResolver: GraphQLFieldResolver<
  unknown,
  unknown
>;
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
export declare const defaultTypeResolver: GraphQLTypeResolver<unknown, unknown>;
export {};
