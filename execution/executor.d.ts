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
  SelectionSetNode,
  FragmentSpreadNode,
  InlineFragmentNode,
} from 'graphql';
import { GraphQLError } from 'graphql';
import type { Path } from '../jsutils/Path';
import type { ObjMap } from '../jsutils/ObjMap';
import type { PromiseOrValue } from '../jsutils/PromiseOrValue';
import type { Maybe } from '../jsutils/Maybe';
import type { Push, Stop } from '../jsutils/repeater';
import type { ExecutorSchema } from './executorSchema';
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
  variableValues: {
    [variable: string]: unknown;
  };
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
  rootPayloadContext: PayloadContext;
  iterators: Set<AsyncIterator<unknown>>;
  publisher: Publisher | undefined;
  pendingPushes: number;
  pushedPayloads: WeakMap<PayloadContext, boolean>;
  pendingPayloads: WeakMap<PayloadContext, Array<IncrementalResult>>;
}
interface FieldContext {
  fieldDef: GraphQLField<unknown, unknown>;
  initialFieldNode: FieldNode;
  fieldName: string;
  fieldNodes: ReadonlyArray<FieldNode>;
  returnType: GraphQLOutputType;
  parentType: GraphQLObjectType;
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
  variableValues?: Maybe<{
    readonly [variable: string]: unknown;
  }>;
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
  label?: string;
  hasNext: boolean;
  extensions?: TExtensions;
}
export declare type AsyncExecutionResult =
  | ExecutionResult
  | ExecutionPatchResult;
export declare type FieldsExecutor<TReturnType> = (
  exeContext: ExecutionContext,
  parentType: GraphQLObjectType,
  sourceValue: unknown,
  path: Path | undefined,
  fields: Map<string, ReadonlyArray<FieldNode>>,
  payloadContext: PayloadContext,
) => PromiseOrValue<TReturnType>;
export declare type ResponseBuilder<
  TRootFieldsExecutorReturnType,
  TReturnType,
> = (
  exeContext: ExecutionContext,
  data: TRootFieldsExecutorReturnType | null,
) => TReturnType;
export declare type FieldResolver = (
  exeContext: ExecutionContext,
  fieldContext: FieldContext,
  source: unknown,
  info: GraphQLResolveInfo,
) => unknown;
export declare type ValueCompleter = (
  exeContext: ExecutionContext,
  fieldContext: FieldContext,
  info: GraphQLResolveInfo,
  path: Path,
  result: unknown,
  payloadContext: PayloadContext,
) => PromiseOrValue<unknown>;
export declare type ArgumentValuesGetter = (
  def: GraphQLField<unknown, unknown>,
  node: FieldNode,
  variableValues: ObjMap<unknown>,
) => {
  [argument: string]: unknown;
};
export declare type DeferValuesGetter = (
  variableValues: {
    [variable: string]: unknown;
  },
  node: FragmentSpreadNode | InlineFragmentNode,
) =>
  | undefined
  | {
      label?: string;
    };
export declare type StreamValuesGetter = (
  variableValues: {
    [variable: string]: unknown;
  },
  fieldContext: FieldContext,
) =>
  | undefined
  | {
      initialCount?: number;
      label?: string;
    };
export declare type RootFieldCollector = (
  runtimeType: GraphQLObjectType,
  operation: OperationDefinitionNode,
) => FieldsAndPatches;
export declare type SubFieldCollector = (
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
export declare class Executor {
  splitDefinitions: (a1: DocumentNode) => {
    operations: ReadonlyArray<OperationDefinitionNode>;
    fragments: ObjMap<FragmentDefinitionNode>;
  };
  selectOperation: (
    a1: readonly OperationDefinitionNode[],
    a2: Maybe<string>,
  ) => OperationDefinitionNode | readonly GraphQLError[];
  /**
   * A memoized method that looks up the field context given a parent type
   * and an array of field nodes.
   */
  getFieldContext: (
    a1: GraphQLObjectType<any, any>,
    a2: readonly FieldNode[],
  ) => Maybe<FieldContext>;
  /**
   * A memoized method that retrieves a value completer given a return type.
   */
  getValueCompleter: (a1: GraphQLOutputType) => ValueCompleter;
  /**
   * Creates a field list, memoizing so that functions operating on the
   * field list can be memoized.
   */
  createFieldList: (a1: FieldNode) => FieldNode[];
  /**
   * Appends to a field list, memoizing so that functions operating on the
   * field list can be memoized.
   */
  updateFieldList: (a1: FieldNode[], a2: FieldNode) => FieldNode[];
  private _schema;
  private _executorSchema;
  constructor(executorArgs: ExecutorArgs);
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
  >;
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
  createSourceEventStream(
    args: ExecutorExecutionArgs,
  ): Promise<AsyncIterable<unknown> | ExecutionResult>;
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
  >;
  /**
   * Implements the ExecuteMutation algorithm described in the Graphql
   * specification.
   */
  executeMutationImpl(
    exeContext: ExecutionContext,
  ): PromiseOrValue<
    ExecutionResult | AsyncGenerator<AsyncExecutionResult, void, void>
  >;
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
  ): PromiseOrValue<TReturnType>;
  /**
   * Given a completed execution context and data, build the `{ errors, data }`
   * response defined by the "Response" section of the GraphQL specification.
   */
  buildResponse(
    exeContext: ExecutionContext,
    data: ObjMap<unknown> | null,
  ): ExecutionResult | AsyncGenerator<AsyncExecutionResult, void, void>;
  /**
   * Essential assertions before executing to provide developer feedback for
   * improper use of the GraphQL library.
   */
  assertValidExecutionArguments(
    document: DocumentNode,
    rawVariableValues: Maybe<{
      readonly [variable: string]: unknown;
    }>,
  ): void;
  buildFieldResolver: (
    resolverKey: 'resolve' | 'subscribe',
    defaultResolver: GraphQLFieldResolver<unknown, unknown>,
  ) => (
    exeContext: ExecutionContext,
    fieldContext: FieldContext,
    source: unknown,
    info: GraphQLResolveInfo,
  ) => unknown;
  _splitDefinitions(document: DocumentNode): {
    operations: ReadonlyArray<OperationDefinitionNode>;
    fragments: ObjMap<FragmentDefinitionNode>;
  };
  _selectOperation(
    operations: ReadonlyArray<OperationDefinitionNode>,
    operationName: Maybe<string>,
  ): ReadonlyArray<GraphQLError> | OperationDefinitionNode;
  /**
   * Constructs a ExecutionContext object from the arguments passed to
   * execute, which we will pass throughout the other execution methods.
   *
   * Returns an array of GraphQLErrors if a valid execution context
   * cannot be created.
   */
  buildExecutionContext(
    args: ExecutorExecutionArgs,
  ): ReadonlyArray<GraphQLError> | ExecutionContext;
  /**
   * Constructs a perPayload ExecutionContext object from an initial
   * ExecutionObject and the payload value.
   */
  buildPerPayloadExecutionContext(
    exeContext: ExecutionContext,
    payload: unknown,
  ): ExecutionContext;
  getRootContext(exeContext: ExecutionContext): {
    rootType: GraphQLObjectType;
    fieldsAndPatches: FieldsAndPatches;
  };
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
    payloadContext: PayloadContext,
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
    payloadContext: PayloadContext,
  ): PromiseOrValue<unknown>;
  buildResolveInfo(
    exeContext: ExecutionContext,
    fieldContext: FieldContext,
    path: Path,
  ): GraphQLResolveInfo;
  toLocatedError(
    rawError: unknown,
    fieldNodes: ReadonlyArray<FieldNode>,
    path: Path,
  ): GraphQLError;
  handleRawError(
    rawError: unknown,
    fieldNodes: ReadonlyArray<FieldNode>,
    path: Path,
    returnType: GraphQLOutputType,
    errors: Array<GraphQLError>,
  ): null;
  buildNullableValueCompleter(valueCompleter: ValueCompleter): ValueCompleter;
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
  _getValueCompleter(returnType: GraphQLOutputType): ValueCompleter;
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
    payloadContext: PayloadContext,
  ): PromiseOrValue<ReadonlyArray<unknown>>;
  /**
   * Returns an object containing the `@stream` arguments if a field should be
   * streamed based on the experimental flag, stream directive present and
   * not disabled by the "if" argument.
   */
  getStreamValues(
    variableValues: {
      [variable: string]: unknown;
    },
    fieldContext: FieldContext,
  ):
    | undefined
    | {
        initialCount?: number;
        label?: string;
      };
  /**
   * Complete an iterator value by completing each result.
   */
  completeIteratorValue(
    exeContext: ExecutionContext,
    itemType: GraphQLOutputType,
    fieldContext: FieldContext,
    info: GraphQLResolveInfo,
    path: Path,
    iterator: Iterator<unknown>,
    payloadContext: PayloadContext,
  ): PromiseOrValue<ReadonlyArray<unknown>>;
  /**
   * Complete an async iterator value by completing each result.
   */
  completeAsyncIteratorValue(
    exeContext: ExecutionContext,
    itemType: GraphQLOutputType,
    fieldContext: FieldContext,
    info: GraphQLResolveInfo,
    path: Path,
    iterator: AsyncIterator<unknown>,
    payloadContext: PayloadContext,
  ): Promise<ReadonlyArray<unknown>>;
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
    payloadContext: PayloadContext,
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
    fieldContext: FieldContext,
    info: GraphQLResolveInfo,
    path: Path,
    result: unknown,
    payloadContext: PayloadContext,
  ): PromiseOrValue<ObjMap<unknown>>;
  ensureValidRuntimeType(
    runtimeTypeOrName: unknown,
    returnType: GraphQLAbstractType,
    fieldContext: FieldContext,
    result: unknown,
  ): GraphQLObjectType;
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
    payloadContext: PayloadContext,
  ): PromiseOrValue<ObjMap<unknown>>;
  invalidReturnTypeError(
    returnType: GraphQLObjectType,
    result: unknown,
    fieldNodes: ReadonlyArray<FieldNode>,
  ): GraphQLError;
  collectAndExecuteSubfields(
    exeContext: ExecutionContext,
    returnType: GraphQLObjectType,
    fieldContext: FieldContext,
    path: Path,
    result: unknown,
    payloadContext: PayloadContext,
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
   * Returns: the field definition and a class for constructing the info
   * argument for field resolvers.
   */
  _getFieldContext(
    parentType: GraphQLObjectType,
    fieldNodes: ReadonlyArray<FieldNode>,
  ): Maybe<FieldContext>;
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
  executeSubscriptionImpl(
    exeContext: ExecutionContext,
  ): Promise<
    AsyncGenerator<AsyncExecutionResult, void, void> | ExecutionResult
  >;
  /**
   * Implements the "Executing selection sets" section of the spec
   * for root subscription fields.
   */
  executeRootSubscriptionFields(
    exeContext: ExecutionContext,
    parentType: GraphQLObjectType,
    sourceValue: unknown,
    path: Path | undefined,
    fields: Map<string, ReadonlyArray<FieldNode>>,
    payloadContext: PayloadContext,
  ): Promise<unknown>;
  buildCreateSourceEventStreamResponse(
    exeContext: ExecutionContext,
    eventStream: unknown,
  ): AsyncIterable<unknown> | ExecutionResult;
  buildSubscribeResponse(
    exeContext: ExecutionContext,
    _eventStream: unknown,
  ): AsyncGenerator<AsyncExecutionResult, void, void> | ExecutionResult;
  createSourceEventStreamImpl(
    exeContext: ExecutionContext,
  ): Promise<AsyncIterable<unknown> | ExecutionResult>;
  executeRootSubscriptionField(
    exeContext: ExecutionContext,
    parentType: GraphQLObjectType,
    sourceValue: unknown,
    fieldNodes: ReadonlyArray<FieldNode>,
    fieldPath: Path,
    payloadContext: PayloadContext,
  ): Promise<unknown>;
  addPatches(
    exeContext: ExecutionContext,
    patches: Array<PatchFields>,
    parentType: GraphQLObjectType,
    source: unknown,
    path: Path | undefined,
    parentPayloadContext: PayloadContext,
  ): void;
  addIteratorValue(
    initialIndex: number,
    iterator: Iterator<unknown>,
    exeContext: ExecutionContext,
    fieldContext: FieldContext,
    info: GraphQLResolveInfo,
    valueCompleter: ValueCompleter,
    path: Path,
    label: string | undefined,
    parentPayloadContext: PayloadContext,
  ): void;
  addAsyncIteratorValue(
    initialIndex: number,
    iterator: AsyncIterator<unknown>,
    exeContext: ExecutionContext,
    fieldContext: FieldContext,
    info: GraphQLResolveInfo,
    valueCompleter: ValueCompleter,
    path: Path,
    label: string | undefined,
    parentPayloadContext: PayloadContext,
  ): Promise<void>;
  advanceAsyncIterator(
    index: number,
    iterator: AsyncIterator<unknown>,
    exeContext: ExecutionContext,
    fieldContext: FieldContext,
    path: Path,
    payloadContext: PayloadContext,
    prevPayloadContext: PayloadContext,
  ): Promise<IteratorResult<unknown> | undefined>;
  closeAsyncIterator(
    exeContext: ExecutionContext,
    iterator: AsyncIterator<unknown>,
  ): void;
  hasNext(exeContext: ExecutionContext): boolean;
  queue(
    exeContext: ExecutionContext,
    payloadContext: PayloadContext,
    parentPayloadContext: PayloadContext,
    data: ObjMap<unknown> | unknown | null,
    path: Path | undefined,
  ): void;
  pushResult(
    exeContext: ExecutionContext,
    push: Push<ExecutionPatchResult>,
    stop: Stop,
    payloadContext: PayloadContext,
    data: ObjMap<unknown> | unknown | null,
    path: Path | undefined,
  ): void;
  pushResults(
    exeContext: ExecutionContext,
    push: Push<ExecutionPatchResult>,
    stop: Stop,
    results: Array<IncrementalResult>,
  ): void;
  createPatchResult(
    exeContext: ExecutionContext,
    data: ObjMap<unknown> | unknown | null,
    errors: ReadonlyArray<GraphQLError>,
    path: Path | undefined,
    label?: string,
  ): ExecutionPatchResult;
  /**
   * Given an operation, collects all of the root fields and returns them.
   *
   * CollectFields requires the "runtime type" of an object. For a field that
   * returns an Interface or Union type, the "runtime type" will be the actual
   * object type returned by that field.
   */
  buildRootFieldCollector: (
    fragments: ObjMap<FragmentDefinitionNode>,
    variableValues: {
      [variable: string]: unknown;
    },
    getDeferValues: DeferValuesGetter,
  ) => (
    runtimeType: GraphQLObjectType,
    operation: OperationDefinitionNode,
  ) => FieldsAndPatches;
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
  buildSubFieldCollector: (
    fragments: ObjMap<FragmentDefinitionNode>,
    variableValues: {
      [variable: string]: unknown;
    },
    getDeferValues: DeferValuesGetter,
  ) => (
    a1: GraphQLObjectType<any, any>,
    a2: readonly FieldNode[],
  ) => FieldsAndPatches;
  collectFieldsImpl(
    fragments: ObjMap<FragmentDefinitionNode>,
    variableValues: {
      [variable: string]: unknown;
    },
    getDeferValues: DeferValuesGetter,
    runtimeType: GraphQLObjectType,
    selectionSet: SelectionSetNode,
    fields: Map<string, Array<FieldNode>>,
    patches: Array<PatchFields>,
    visitedFragmentNames: Set<string>,
  ): void;
  /**
   * Returns an object containing the `@defer` arguments if a field should be
   * deferred based on the experimental flag, defer directive present and
   * not disabled by the "if" argument.
   */
  getDeferValues(
    variableValues: {
      [variable: string]: unknown;
    },
    node: FragmentSpreadNode | InlineFragmentNode,
  ):
    | undefined
    | {
        label?: string;
      };
  /**
   * Determines if a field should be included based on the `@include` and `@skip`
   * directives, where `@skip` has higher precedence than `@include`.
   */
  shouldIncludeNode(
    variableValues: {
      [variable: string]: unknown;
    },
    node: FragmentSpreadNode | FieldNode | InlineFragmentNode,
  ): boolean;
  /**
   * Determines if a fragment is applicable to the given type.
   */
  doesFragmentConditionMatch(
    fragment: FragmentDefinitionNode | InlineFragmentNode,
    type: GraphQLObjectType,
  ): boolean;
  /**
   * Implements the logic to compute the key of a given field's entry
   */
  getFieldEntryKey(node: FieldNode): string;
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
