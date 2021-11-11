import type { PromiseOrValue } from '../jsutils/PromiseOrValue';
import { isPromise } from '../jsutils/isPromise';
import { isAsyncIterable } from '../jsutils/isAsyncIterable';

import type {
  ExecutionArgs,
  ExecutionResult,
  AsyncExecutionResult,
} from './executor';
import { Executor } from './executor';

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
export function execute(
  args: ExecutionArgs,
): PromiseOrValue<
  ExecutionResult | AsyncGenerator<AsyncExecutionResult, void, void>
> {
  const executor = new Executor();
  return executor.execute(args);
}

/**
 * Also implements the "Executing requests" section of the GraphQL specification.
 * However, it guarantees to complete synchronously (or throw an error) assuming
 * that all field resolvers are also synchronous.
 */
export function executeSync(args: ExecutionArgs): ExecutionResult {
  const result = execute(args);

  // Assert that the execution was synchronous.
  if (isPromise(result) || isAsyncIterable(result)) {
    throw new Error('GraphQL execution failed to complete synchronously.');
  }

  return result;
}
