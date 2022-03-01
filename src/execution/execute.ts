import type { PromiseOrValue } from '../jsutils/PromiseOrValue';
import { isPromise } from '../jsutils/isPromise';
import { isAsyncIterable } from '../jsutils/isAsyncIterable';
import { devAssert } from '../jsutils/devAssert';

import type {
  ExecutorArgs,
  ExecutorExecutionArgs,
  ExecutionResult,
  AsyncExecutionResult,
} from './executor';
import { Executor } from './executor';

export interface ExecutionArgs extends ExecutorArgs, ExecutorExecutionArgs {}

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
  | ExecutionResult
  | AsyncGenerator<ReadonlyArray<AsyncExecutionResult>, void, void>
> {
  // Temporary for v15 to v16 migration. Remove in v17
  devAssert(
    arguments.length < 2,
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
export function executeSync(args: ExecutionArgs): ExecutionResult {
  const result = execute(args);

  // Assert that the execution was synchronous.
  if (isPromise(result) || isAsyncIterable(result)) {
    throw new Error('GraphQL execution failed to complete synchronously.');
  }

  return result;
}
