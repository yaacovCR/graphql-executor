/** Execute GraphQL queries. */
export type { ExecutionArgs } from './execution/index.ts';
export {
  Executor,
  defaultFieldResolver,
  defaultTypeResolver,
  execute,
  executeSync,
  subscribe,
  createSourceEventStream,
} from './execution/index.ts';
/** Directives for defer/stream support */

export { GraphQLDeferDirective, GraphQLStreamDirective } from './type/index.ts';
