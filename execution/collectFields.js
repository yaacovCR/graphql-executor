'use strict';

Object.defineProperty(exports, '__esModule', {
  value: true,
});
exports.collectFields = collectFields;
exports.collectSubfields = collectSubfields;

var _graphql = require('graphql');

var _memoize = require('../jsutils/memoize1.js');

var _memoize2 = require('../jsutils/memoize2.js');

var _definition = require('../type/definition.js');

var _directives = require('../type/directives.js');

var _isSubType = require('../utilities/isSubType.js');

var _values = require('./values.js');

/**
 * Given a selectionSet, collects all of the fields and returns them.
 *
 * CollectFields requires the "runtime type" of an object. For a field that
 * returns an Interface or Union type, the "runtime type" will be the actual
 * object type returned by that field.
 *
 * @internal
 */
function collectFields(
  schema,
  fragments,
  variableValues,
  runtimeType,
  selectionSet,
  ignoreDefer,
) {
  const fields = new Map();
  const patches = [];
  collectFieldsImpl(
    schema,
    fragments,
    variableValues,
    runtimeType,
    selectionSet,
    fields,
    patches,
    new Set(),
    ignoreDefer,
  );
  return {
    fields,
    patches,
  };
}
/**
 * Given an array of field nodes, collects all of the subfields of the passed
 * in fields, and returns them at the end.
 *
 * CollectSubFields requires the "return type" of an object. For a field that
 * returns an Interface or Union type, the "return type" will be the actual
 * object type returned by that field.
 *
 * @internal
 */

function collectSubfields(
  schema,
  fragments,
  variableValues,
  returnType,
  fieldNodes,
  ignoreDefer,
) {
  const subFieldNodes = new Map();
  const visitedFragmentNames = new Set();
  const subPatches = [];
  const subFieldsAndPatches = {
    fields: subFieldNodes,
    patches: subPatches,
  };

  for (const node of fieldNodes) {
    if (node.selectionSet) {
      collectFieldsImpl(
        schema,
        fragments,
        variableValues,
        returnType,
        node.selectionSet,
        subFieldNodes,
        subPatches,
        visitedFragmentNames,
        ignoreDefer,
      );
    }
  }

  return subFieldsAndPatches;
}

function collectFieldsImpl(
  schema,
  fragments,
  variableValues,
  runtimeType,
  selectionSet,
  fields,
  patches,
  visitedFragmentNames,
  ignoreDefer,
) {
  for (const selection of selectionSet.selections) {
    switch (selection.kind) {
      case _graphql.Kind.FIELD: {
        if (!shouldIncludeNode(variableValues, selection)) {
          continue;
        }

        const name = getFieldEntryKey(selection);
        const fieldList = fields.get(name);

        if (fieldList !== undefined) {
          fields.set(name, updateFieldList(fieldList, selection));
        } else {
          fields.set(name, createFieldList(selection));
        }

        break;
      }

      case _graphql.Kind.INLINE_FRAGMENT: {
        if (
          !shouldIncludeNode(variableValues, selection) ||
          !doesFragmentConditionMatch(schema, selection, runtimeType)
        ) {
          continue;
        }

        const defer = getDeferValues(variableValues, selection, ignoreDefer);

        if (defer) {
          const patchFields = new Map();
          collectFieldsImpl(
            schema,
            fragments,
            variableValues,
            runtimeType,
            selection.selectionSet,
            patchFields,
            patches,
            visitedFragmentNames,
            ignoreDefer,
          );
          patches.push({
            label: defer.label,
            fields: patchFields,
          });
        } else {
          collectFieldsImpl(
            schema,
            fragments,
            variableValues,
            runtimeType,
            selection.selectionSet,
            fields,
            patches,
            visitedFragmentNames,
            ignoreDefer,
          );
        }

        break;
      }

      case _graphql.Kind.FRAGMENT_SPREAD: {
        const fragName = selection.name.value;

        if (!shouldIncludeNode(variableValues, selection)) {
          continue;
        }

        const defer = getDeferValues(variableValues, selection, ignoreDefer);

        if (visitedFragmentNames.has(fragName) && !defer) {
          continue;
        }

        const fragment = fragments[fragName];

        if (
          !fragment ||
          !doesFragmentConditionMatch(schema, fragment, runtimeType)
        ) {
          continue;
        }

        visitedFragmentNames.add(fragName);

        if (defer) {
          const patchFields = new Map();
          collectFieldsImpl(
            schema,
            fragments,
            variableValues,
            runtimeType,
            fragment.selectionSet,
            patchFields,
            patches,
            visitedFragmentNames,
            ignoreDefer,
          );
          patches.push({
            label: defer.label,
            fields: patchFields,
          });
        } else {
          collectFieldsImpl(
            schema,
            fragments,
            variableValues,
            runtimeType,
            fragment.selectionSet,
            fields,
            patches,
            visitedFragmentNames,
            ignoreDefer,
          );
        }

        break;
      }
    }
  }
}
/**
 * Returns an object containing the `@defer` arguments if a field should be
 * deferred based on the experimental flag, defer directive present and
 * not disabled by the "if" argument.
 */

function getDeferValues(variableValues, node, ignoreDefer) {
  if (ignoreDefer) {
    return;
  }

  const defer = (0, _values.getDirectiveValues)(
    _directives.GraphQLDeferDirective,
    node,
    variableValues,
  );

  if (!defer) {
    return;
  }

  if (defer.if === false) {
    return;
  }

  return {
    label: typeof defer.label === 'string' ? defer.label : undefined,
  };
}
/**
 * Determines if a field should be included based on the `@include` and `@skip`
 * directives, where `@skip` has higher precedence than `@include`.
 */

function shouldIncludeNode(variableValues, node) {
  const skip = (0, _values.getDirectiveValues)(
    _graphql.GraphQLSkipDirective,
    node,
    variableValues,
  );

  if ((skip === null || skip === void 0 ? void 0 : skip.if) === true) {
    return false;
  }

  const include = (0, _values.getDirectiveValues)(
    _graphql.GraphQLIncludeDirective,
    node,
    variableValues,
  );

  if (
    (include === null || include === void 0 ? void 0 : include.if) === false
  ) {
    return false;
  }

  return true;
}
/**
 * Determines if a fragment is applicable to the given type.
 */

function doesFragmentConditionMatch(schema, fragment, type) {
  const typeConditionNode = fragment.typeCondition;

  if (!typeConditionNode) {
    return true;
  }

  const conditionalType = (0, _graphql.typeFromAST)(schema, typeConditionNode);

  if (conditionalType === type) {
    return true;
  }

  if (conditionalType && (0, _definition.isAbstractType)(conditionalType)) {
    return (0, _isSubType.isSubType)(schema, conditionalType, type);
  }

  return false;
}
/**
 * Implements the logic to compute the key of a given field's entry
 */

function getFieldEntryKey(node) {
  return node.alias ? node.alias.value : node.name.value;
}
/**
 * Creates a field list, memoizing so that functions operating on the
 * field list can be memoized.
 */

const createFieldList = (0, _memoize.memoize1)((node) => [node]);
/**
 * Appends to a field list, memoizing so that functions operating on the
 * field list can be memoized.
 */

const updateFieldList = (0, _memoize2.memoize2)((fieldList, node) => [
  ...fieldList,
  node,
]);
