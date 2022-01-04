/** Operate on GraphQL type definitions and schema. */
export {
  /** Directives for defer/stream support */
  GraphQLDeferDirective,
  GraphQLStreamDirective,
} from './type/index.mjs';
/** Execute GraphQL queries. */

export {
  Executor,
  defaultFieldResolver,
  defaultTypeResolver,
  execute,
  executeSync,
  toExecutorSchema,
} from './execution/index.mjs';
/** Operate on GraphQL errors. */

export { isGraphQLError } from './error/index.mjs';
