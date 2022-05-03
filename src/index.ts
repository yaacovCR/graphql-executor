/** Operate on GraphQL type definitions and schema. */
export {
  /** Directives for defer/stream support */
  GraphQLDeferDirective,
  GraphQLStreamDirective,
} from './type/index';

/** Compose subschemas  */

export { compose } from './composition/index';

/** Optimized schema for execution  */

export type {
  ExecutorSchema,
  GraphQLNullableInputType,
  GraphQLNullableOutputType,
} from './executorSchema/index';

export {
  /* Cross-platform predicates */
  isEnumType,
  isInputObjectType,
  isInterfaceType,
  isListType,
  isNonNullType,
  isObjectType,
  isScalarType,
  isUnionType,
  /* Convert GraphQLSchema to ExecutorSchema */
  toExecutorSchema,
} from './executorSchema/index';

/** Execute GraphQL queries. */

export type {
  ExecutionArgs,
  ExecutorArgs,
  ExecutorExecutionArgs,
} from './execution/index';

export {
  Executor,
  defaultFieldResolver,
  defaultTypeResolver,
  execute,
  executeSync,
} from './execution/index';

/** Operate on GraphQL errors. */
export { isGraphQLError } from './error/index';
