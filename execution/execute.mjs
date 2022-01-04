import { isPromise } from '../jsutils/isPromise.mjs';
import { isAsyncIterable } from '../jsutils/isAsyncIterable.mjs';
import { devAssert } from '../jsutils/devAssert.mjs';
import { Executor } from './executor.mjs';

/**
 * Implements the "Executing requests" section of the GraphQL specification.
 *
 * Returns either a synchronous ExecutionResult (if all encountered resolvers
 * are synchronous), or a Promise of an ExecutionResult that will eventually be
 * resolved and never rejected.
 *
 * If the arguments to this function do not result in a legal execution context,
 * a GraphQLError will be thrown immediately explaining the invalid input.
 */
export function execute(args) {
  // Temporary for v15 to v16 migration. Remove in v17
  arguments.length < 2 ||
    devAssert(
      false,
      'graphql@16 dropped long-deprecated support for positional arguments, please pass an object instead.',
    );
  const executor = new Executor(args);
  return executor.execute(args);
}
/**
 * Also implements the "Executing requests" section of the GraphQL specification.
 * However, it guarantees to complete synchronously (or throw an error) assuming
 * that all field resolvers are also synchronous.
 */

export function executeSync(args) {
  const result = execute(args); // Assert that the execution was synchronous.

  if (isPromise(result) || isAsyncIterable(result)) {
    throw new Error('GraphQL execution failed to complete synchronously.');
  }

  return result;
}
