'use strict';

Object.defineProperty(exports, '__esModule', {
  value: true,
});
exports.assertSchema = assertSchema;
exports.isSchema = void 0;

var _memoize = require('../jsutils/memoize1.js');

var _inspect = require('../jsutils/inspect.js');

/**
 * Test if the given value is a GraphQL schema.
 */
function _isSchema(schema) {
  return Object.prototype.toString.call(schema) === '[object GraphQLSchema]';
}

const isSchema = (0, _memoize.memoize1)(_isSchema);
exports.isSchema = isSchema;

function assertSchema(schema) {
  if (!schema || !isSchema(schema)) {
    throw new Error(
      `Expected ${(0, _inspect.inspect)(schema)} to be a GraphQL schema.`,
    );
  }

  return schema;
}
