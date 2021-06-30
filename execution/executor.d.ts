import type {
  ASTNode,
  DocumentNode,
  FieldNode,
  FragmentDefinitionNode,
  GraphQLAbstractType,
  GraphQLField,
  GraphQLFieldResolver,
  GraphQLLeafType,
  GraphQLList,
  GraphQLObjectType,
  GraphQLOutputType,
  GraphQLResolveInfo,
  GraphQLSchema,
  GraphQLTypeResolver,
  OperationDefinitionNode,
} from 'graphql';
import { GraphQLError } from 'graphql';
import type { Path } from '../jsutils/Path';
import type { ObjMap } from '../jsutils/ObjMap';
import type { PromiseOrValue } from '../jsutils/PromiseOrValue';
import type { Maybe } from '../jsutils/Maybe';
import type { ExecutionResult } from './execute';
import { GraphQLAggregateError } from './GraphQLAggregateError';
export interface ExecutorArgs {
  schema: GraphQLSchema;
  document: DocumentNode;
  rootValue?: unknown;
  contextValue?: unknown;
  variableValues?: Maybe<{
    readonly [variable: string]: unknown;
  }>;
  operationName?: Maybe<string>;
  fieldResolver?: Maybe<GraphQLFieldResolver<unknown, unknown>>;
  typeResolver?: Maybe<GraphQLTypeResolver<unknown, unknown>>;
  subscribeFieldResolver?: Maybe<GraphQLFieldResolver<unknown, unknown>>;
}
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
  variableValues: {
    [variable: string]: unknown;
  };
  fieldResolver: GraphQLFieldResolver<any, any>;
  typeResolver: GraphQLTypeResolver<any, any>;
  subscribeFieldResolver: Maybe<GraphQLFieldResolver<any, any>>;
  errors: Array<GraphQLError>;
}
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
    a1: GraphQLObjectType<any, any>,
    a2: readonly FieldNode[],
  ) => Map<string, readonly FieldNode[]>;
  protected _schema: GraphQLSchema;
  protected _fragments: ObjMap<FragmentDefinitionNode>;
  protected _rootValue: unknown;
  protected _contextValue: unknown;
  protected _operation: OperationDefinitionNode;
  protected _variableValues: {
    [variable: string]: unknown;
  };
  protected _fieldResolver: GraphQLFieldResolver<any, any>;
  protected _typeResolver: GraphQLTypeResolver<any, any>;
  protected _subscribeFieldResolver: Maybe<GraphQLFieldResolver<any, any>>;
  protected _errors: Array<GraphQLError>;
  constructor(argsOrExecutionContext: ExecutorArgs | ExecutionContext);
  /**
   * Implements the "Executing operations" section of the spec for queries and
   * mutations.
   */
  executeQueryOrMutation(): PromiseOrValue<ExecutionResult>;
  /**
   * Given a completed execution context and data, build the { errors, data }
   * response defined by the "Response" section of the GraphQL specification.
   */
  buildResponse(data: ObjMap<unknown> | null): ExecutionResult;
  /**
   * Essential assertions before executing to provide developer feedback for
   * improper use of the GraphQL library.
   *
   * @internal
   */
  assertValidArguments(
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
   * Throws a GraphQLError if a valid execution context cannot be created.
   *
   * @internal
   */
  buildExecutionContext(args: ExecutorArgs): ExecutionContext;
  /**
   * Return the data (or a Promise that will eventually resolve to the data)
   * described by the "Response" section of the GraphQL specification.
   *
   * If errors are encountered while executing a GraphQL field, only that
   * field and its descendants will be omitted, and sibling fields will still
   * be executed. An execution which encounters errors will still result in a
   * returned value or resolved Promise.
   * */
  executeQueryOrMutationRootFields(): PromiseOrValue<ObjMap<unknown> | null>;
  /**
   * Implements the "Executing selection sets" section of the spec
   * for fields that must be executed serially.
   */
  executeFieldsSerially(
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
    parentType: GraphQLObjectType,
    sourceValue: unknown,
    path: Path | undefined,
    fields: Map<string, ReadonlyArray<FieldNode>>,
  ): PromiseOrValue<ObjMap<unknown>>;
  /**
   * Implements the "Executing field" section of the spec
   * In particular, this function figures out the value that the field returns by
   * calling its resolve function, then calls completeValue to complete promises,
   * serialize scalars, or execute the sub-selection-set for objects.
   */
  executeField(
    parentType: GraphQLObjectType,
    source: unknown,
    fieldNodes: ReadonlyArray<FieldNode>,
    path: Path,
  ): PromiseOrValue<unknown>;
  /**
   * @internal
   */
  buildResolveInfo(
    fieldDef: GraphQLField<unknown, unknown>,
    fieldNodes: ReadonlyArray<FieldNode>,
    parentType: GraphQLObjectType,
    path: Path,
  ): GraphQLResolveInfo;
  handleRawError(
    returnType: GraphQLOutputType,
    rawError: unknown,
    fieldNodes: ReadonlyArray<ASTNode>,
    path?: Maybe<Readonly<Path>>,
  ): null;
  logError(error: GraphQLError | GraphQLAggregateError<GraphQLError>): void;
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
    returnType: GraphQLOutputType,
    fieldNodes: ReadonlyArray<FieldNode>,
    info: GraphQLResolveInfo,
    path: Path,
    result: unknown,
  ): PromiseOrValue<unknown>;
  /**
   * Complete a list value by completing each item in the list with the
   * inner type
   */
  completeListValue(
    returnType: GraphQLList<GraphQLOutputType>,
    fieldNodes: ReadonlyArray<FieldNode>,
    info: GraphQLResolveInfo,
    path: Path,
    result: unknown,
  ): PromiseOrValue<ReadonlyArray<unknown>>;
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
    returnType: GraphQLAbstractType,
    fieldNodes: ReadonlyArray<FieldNode>,
    info: GraphQLResolveInfo,
    path: Path,
    result: unknown,
  ): PromiseOrValue<ObjMap<unknown>>;
  ensureValidRuntimeType(
    runtimeTypeName: unknown,
    returnType: GraphQLAbstractType,
    fieldNodes: ReadonlyArray<FieldNode>,
    info: GraphQLResolveInfo,
    result: unknown,
  ): GraphQLObjectType;
  /**
   * Complete an Object value by executing all sub-selections.
   */
  completeObjectValue(
    returnType: GraphQLObjectType,
    fieldNodes: ReadonlyArray<FieldNode>,
    info: GraphQLResolveInfo,
    path: Path,
    result: unknown,
  ): PromiseOrValue<ObjMap<unknown>>;
  invalidReturnTypeError(
    returnType: GraphQLObjectType,
    result: unknown,
    fieldNodes: ReadonlyArray<FieldNode>,
  ): GraphQLError;
  /**
   * This method looks up the field on the given type definition.
   * It has special casing for the three introspection fields,
   * __schema, __type and __typename. __typename is special because
   * it can always be queried as a field, even in situations where no
   * other fields are allowed, like on a Union. __schema and __type
   * could get automatically added to the query type, but that would
   * require mutating type definitions, which would cause issues.
   *
   * @internal
   */
  getFieldDef(
    schema: GraphQLSchema,
    parentType: GraphQLObjectType,
    fieldNode: FieldNode,
  ): Maybe<GraphQLField<unknown, unknown>>;
  /**
   * Implements the "Executing operations" section of the spec for subscriptions
   */
  executeSubscription(): Promise<
    AsyncGenerator<ExecutionResult, void, void> | ExecutionResult
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
  createSourceEventStream(): Promise<AsyncIterable<unknown> | ExecutionResult>;
  executeSubscriptionRootField(): Promise<unknown>;
}
