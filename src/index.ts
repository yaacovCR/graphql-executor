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

/** Directives for defer/stream support */
export { GraphQLDeferDirective, GraphQLStreamDirective } from './type/index';
