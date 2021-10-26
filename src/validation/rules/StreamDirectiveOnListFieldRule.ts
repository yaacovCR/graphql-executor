import type { ASTVisitor, DirectiveNode, ValidationContext } from 'graphql';
import { GraphQLError, isListType } from 'graphql';

import { GraphQLStreamDirective } from '../../type/directives';

/**
 * Stream directive on list field
 *
 * A GraphQL document is only valid if stream directives are used on list fields.
 */
export function StreamDirectiveOnListFieldRule(
  context: ValidationContext,
): ASTVisitor {
  return {
    Directive(node: DirectiveNode) {
      const fieldDef = context.getFieldDef();
      const parentType = context.getParentType();
      if (
        fieldDef &&
        parentType &&
        node.name.value === GraphQLStreamDirective.name &&
        !isListType(fieldDef.type)
      ) {
        context.reportError(
          new GraphQLError(
            `Stream directive cannot be used on non-list field "${fieldDef.name}" on type "${parentType.name}".`,
            node,
          ),
        );
      }
    },
  };
}
