'use strict';

Object.defineProperty(exports, '__esModule', {
  value: true,
});
exports.assertSchema = assertSchema;

var _graphql = require('graphql');

var _inspect = require('../jsutils/inspect.js');

function assertSchema(schema) {
  if (!(0, _graphql.isSchema)(schema)) {
    throw new Error(
      `Expected ${(0, _inspect.inspect)(schema)} to be a GraphQL schema.`,
    );
  }

  return schema;
}
