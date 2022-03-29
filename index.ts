/** Operate on GraphQL type definitions and schema. */
export {
  /** Directives for defer/stream support */
  GraphQLDeferDirective,
  GraphQLStreamDirective,
} from './type/index.ts';
/** Optimized schema for execution  */

export type {
  ExecutorSchema,
  GraphQLNullableInputType,
  GraphQLNullableOutputType,
} from './executorSchema/index.ts';
export { toExecutorSchema } from './executorSchema/index.ts';
/** Execute GraphQL queries. */

export type {
  ExecutionArgs,
  ExecutorArgs,
  ExecutorExecutionArgs,
} from './execution/index.ts';
export {
  Executor,
  defaultFieldResolver,
  defaultTypeResolver,
  execute,
  executeSync,
} from './execution/index.ts';
/** Operate on GraphQL errors. */

export { isGraphQLError } from './error/index.ts';
