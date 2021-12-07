'use strict';

Object.defineProperty(exports, '__esModule', {
  value: true,
});
exports.StreamDirectiveOnListFieldRule = StreamDirectiveOnListFieldRule;

var _graphql = require('graphql');

var _directives = require('../../type/directives.js');

/**
 * Stream directive on list field
 *
 * A GraphQL document is only valid if stream directives are used on list fields.
 */
function StreamDirectiveOnListFieldRule(context) {
  return {
    Directive(node) {
      const fieldDef = context.getFieldDef();
      const parentType = context.getParentType();

      if (
        fieldDef &&
        parentType &&
        node.name.value === _directives.GraphQLStreamDirective.name &&
        !(
          (0, _graphql.isListType)(fieldDef.type) ||
          ((0, _graphql.isWrappingType)(fieldDef.type) &&
            (0, _graphql.isListType)(fieldDef.type.ofType))
        )
      ) {
        context.reportError(
          new _graphql.GraphQLError(
            `Stream directive cannot be used on non-list field "${fieldDef.name}" on type "${parentType.name}".`,
            node,
          ),
        );
      }
    },
  };
}
