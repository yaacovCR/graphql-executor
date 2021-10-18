/** Execute GraphQL queries. */
export type { ExecutionArgs } from './execution/index';
export {
  Executor,
  defaultFieldResolver,
  defaultTypeResolver,
  execute,
  executeSync,
  subscribe,
  createSourceEventStream,
} from './execution/index';
