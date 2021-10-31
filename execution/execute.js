'use strict';

Object.defineProperty(exports, '__esModule', {
  value: true,
});
exports.execute = execute;
exports.executeSync = executeSync;

var _isPromise = require('../jsutils/isPromise.js');

var _isAsyncIterable = require('../jsutils/isAsyncIterable.js');

var _executor = require('./executor.js');

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
  const executor = new _executor.Executor();
  return executor.execute(args);
}
/**
 * Also implements the "Executing requests" section of the GraphQL specification.
 * However, it guarantees to complete synchronously (or throw an error) assuming
 * that all field resolvers are also synchronous.
 */

function executeSync(args) {
  const result = execute(args); // Assert that the execution was synchronous.

  if (
    (0, _isPromise.isPromise)(result) ||
    (0, _isAsyncIterable.isAsyncIterable)(result)
  ) {
    throw new Error('GraphQL execution failed to complete synchronously.');
  }

  return result;
}
