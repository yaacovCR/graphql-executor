import { Executor } from './executor.mjs';
import { isAggregateOfGraphQLErrors } from './GraphQLAggregateError.mjs';

/**
 * Implements the "Subscribe" algorithm described in the GraphQL specification.
 *
 * Returns a Promise which resolves to either an AsyncIterator (if successful)
 * or an ExecutionResult (error). The promise will be rejected if the schema or
 * other arguments to this function are invalid, or if the resolved event stream
 * is not an async iterable.
 *
 * If the client-provided arguments to this function do not result in a
 * compliant subscription, a GraphQL Response (ExecutionResult) with
 * descriptive errors and no data will be returned.
 *
 * If the source stream could not be created due to faulty subscription
 * resolver logic or underlying systems, the promise will resolve to a single
 * ExecutionResult containing `errors` and no `data`.
 *
 * If the operation succeeded, the promise resolves to an AsyncIterator, which
 * yields a stream of ExecutionResults representing the response stream.
 *
 * Accepts either an object with named arguments, or individual arguments.
 */
export async function subscribe(args) {
  // If a valid execution context cannot be created due to incorrect arguments,
  // a "Response" with only errors is returned.
  let executor;

  try {
    executor = new Executor(args);
  } catch (error) {
    // Note: if the Executor constructor throws a GraphQLAggregateError, it will be
    // of type GraphQLAggregateError<GraphQLError>, but this is checked explicitly.
    if (isAggregateOfGraphQLErrors(error)) {
      return {
        errors: error.errors,
      };
    }

    throw error;
  }

  return executor.executeSubscription();
}
