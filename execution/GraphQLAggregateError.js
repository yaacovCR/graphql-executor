'use strict';

Object.defineProperty(exports, '__esModule', {
  value: true,
});
exports.isAggregateOfGraphQLErrors = isAggregateOfGraphQLErrors;
exports.GraphQLAggregateError = void 0;

var _graphql = require('graphql');

/**
 * A GraphQLAggregateError is a container for multiple errors.
 *
 * This helper can be used to report multiple distinct errors simultaneously.
 * Note that error handlers must be aware aggregated errors may be reported so as to
 * properly handle the contained errors.
 *
 * See also:
 * https://tc39.es/ecma262/multipage/fundamental-objects.html#sec-aggregate-error-objects
 * https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/AggregateError
 * https://github.com/zloirock/core-js/blob/master/packages/core-js/modules/es.aggregate-error.js
 * https://github.com/sindresorhus/aggregate-error
 *
 */
class GraphQLAggregateError extends Error {
  constructor(errors, message) {
    super(message);
    Object.defineProperties(this, {
      name: {
        value: 'GraphQLAggregateError',
      },
      message: {
        value: message,
        writable: true,
      },
      errors: {
        value: errors,
      },
    });
  }

  get [Symbol.toStringTag]() {
    return 'GraphQLAggregateError';
  }
}

exports.GraphQLAggregateError = GraphQLAggregateError;

function isAggregateOfGraphQLErrors(error) {
  return (
    error instanceof GraphQLAggregateError &&
    error.errors.every((subError) => subError instanceof _graphql.GraphQLError)
  );
}
