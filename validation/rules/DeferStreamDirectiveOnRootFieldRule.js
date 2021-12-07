'use strict';

Object.defineProperty(exports, '__esModule', {
  value: true,
});
exports.DeferStreamDirectiveOnRootFieldRule =
  DeferStreamDirectiveOnRootFieldRule;

var _graphql = require('graphql');

var _directives = require('../../type/directives.js');

/**
 * Stream directive on list field
 *
 * A GraphQL document is only valid if defer directives are not used on root mutation or subscription types.
 */
function DeferStreamDirectiveOnRootFieldRule(context) {
  return {
    Directive(node) {
      const mutationType = context.getSchema().getMutationType();
      const subscriptionType = context.getSchema().getSubscriptionType();
      const parentType = context.getParentType();

      if (
        parentType &&
        node.name.value === _directives.GraphQLDeferDirective.name
      ) {
        if (mutationType && parentType === mutationType) {
          context.reportError(
            new _graphql.GraphQLError(
              `Defer directive cannot be used on root mutation type "${parentType.name}".`,
              node,
            ),
          );
        }

        if (subscriptionType && parentType === subscriptionType) {
          context.reportError(
            new _graphql.GraphQLError(
              `Defer directive cannot be used on root subscription type "${parentType.name}".`,
              node,
            ),
          );
        }
      }

      if (
        parentType &&
        node.name.value === _directives.GraphQLStreamDirective.name
      ) {
        if (mutationType && parentType === mutationType) {
          context.reportError(
            new _graphql.GraphQLError(
              `Stream directive cannot be used on root mutation type "${parentType.name}".`,
              node,
            ),
          );
        }

        if (subscriptionType && parentType === subscriptionType) {
          context.reportError(
            new _graphql.GraphQLError(
              `Stream directive cannot be used on root subscription type "${parentType.name}".`,
              node,
            ),
          );
        }
      }
    },
  };
}
