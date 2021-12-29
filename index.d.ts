/** Operate on GraphQL type definitions and schema. */
export {
  /** Directives for defer/stream support */
  GraphQLDeferDirective,
  GraphQLStreamDirective,
} from './type/index';
/** Execute GraphQL queries. */
export type { ExecutionArgs } from './execution/index';
export {
  Executor,
  defaultFieldResolver,
  defaultTypeResolver,
  execute,
  executeSync,
  createSourceEventStream,
} from './execution/index';
/** Operate on GraphQL errors. */
export { isGraphQLError } from './error/index';
