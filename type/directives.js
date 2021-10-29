'use strict';

Object.defineProperty(exports, '__esModule', {
  value: true,
});
exports.GraphQLStreamDirective = exports.GraphQLDeferDirective = void 0;

var _graphql = require('graphql');

/**
 * Used to conditionally defer fragments.
 */
const GraphQLDeferDirective = new _graphql.GraphQLDirective({
  name: 'defer',
  description:
    'Directs the executor to defer this fragment when the `if` argument is true or undefined.',
  locations: [
    _graphql.DirectiveLocation.FRAGMENT_SPREAD,
    _graphql.DirectiveLocation.INLINE_FRAGMENT,
  ],
  args: {
    if: {
      type: _graphql.GraphQLBoolean,
      description: 'Deferred when true or undefined.',
    },
    label: {
      type: _graphql.GraphQLString,
      description: 'Unique name',
    },
  },
});
/**
 * Used to conditionally stream list fields.
 */

exports.GraphQLDeferDirective = GraphQLDeferDirective;
const GraphQLStreamDirective = new _graphql.GraphQLDirective({
  name: 'stream',
  description:
    'Directs the executor to stream plural fields when the `if` argument is true or undefined.',
  locations: [_graphql.DirectiveLocation.FIELD],
  args: {
    if: {
      type: _graphql.GraphQLBoolean,
      description: 'Stream when true or undefined.',
    },
    label: {
      type: _graphql.GraphQLString,
      description: 'Unique name',
    },
    initialCount: {
      defaultValue: 0,
      type: _graphql.GraphQLInt,
      description: 'Number of items to return immediately',
    },
  },
});
exports.GraphQLStreamDirective = GraphQLStreamDirective;
