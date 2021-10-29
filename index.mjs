/** Execute GraphQL queries. */
export {
  Executor,
  defaultFieldResolver,
  defaultTypeResolver,
  execute,
  executeSync,
  subscribe,
  createSourceEventStream,
} from './execution/index.mjs';
/** Directives for defer/stream support */

export {
  GraphQLDeferDirective,
  GraphQLStreamDirective,
} from './type/index.mjs';
