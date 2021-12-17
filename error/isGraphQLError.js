'use strict';

Object.defineProperty(exports, '__esModule', {
  value: true,
});
exports.isGraphQLError = isGraphQLError;

function isGraphQLError(error) {
  return error.name === 'GraphQLError';
}
