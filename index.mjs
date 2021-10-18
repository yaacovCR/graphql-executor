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
