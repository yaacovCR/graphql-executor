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
