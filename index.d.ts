/** Operate on GraphQL type definitions and schema. */
export {
  /** Directives for defer/stream support */
  GraphQLDeferDirective,
  GraphQLStreamDirective,
} from './type/index';
/** Execute GraphQL queries. */
export type {
  ExecutionArgs,
  ExecutorArgs,
  ExecutorExecutionArgs,
  ExecutorSchema,
  GraphQLNullableInputType,
  GraphQLNullableOutputType,
} from './execution/index';
export {
  Executor,
  defaultFieldResolver,
  defaultTypeResolver,
  execute,
  executeSync,
  toExecutorSchema,
} from './execution/index';
/** Operate on GraphQL errors. */
export { isGraphQLError } from './error/index';
