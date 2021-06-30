'use strict';

Object.defineProperty(exports, '__esModule', {
  value: true,
});
exports.execute = execute;
exports.executeSync = executeSync;

var _isPromise = require('../jsutils/isPromise.js');

var _executor = require('./executor.js');

var _GraphQLAggregateError = require('./GraphQLAggregateError.js');

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
function execute(args) {
  // If a valid execution context cannot be created due to incorrect arguments,
  // a "Response" with only errors is returned.
  let executor;

  try {
    executor = new _executor.Executor(args);
  } catch (error) {
    // Note: if the Executor constructor throws a GraphQLAggregateError, it will be
    // of type GraphQLAggregateError<GraphQLError>, but this is checked explicitly.
    if ((0, _GraphQLAggregateError.isAggregateOfGraphQLErrors)(error)) {
      return {
        errors: error.errors,
      };
    }

    throw error;
  }

  return executor.executeQueryOrMutation();
}
/**
 * Also implements the "Executing requests" section of the GraphQL specification.
 * However, it guarantees to complete synchronously (or throw an error) assuming
 * that all field resolvers are also synchronous.
 */

function executeSync(args) {
  const result = execute(args); // Assert that the execution was synchronous.

  if ((0, _isPromise.isPromise)(result)) {
    throw new Error('GraphQL execution failed to complete synchronously.');
  }

  return result;
}
