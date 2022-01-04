import { GraphQLIncludeDirective, GraphQLSkipDirective, Kind } from 'graphql';
import { memoize1 } from '../jsutils/memoize1.mjs';
import { memoize2 } from '../jsutils/memoize2.mjs';
import { GraphQLDeferDirective } from '../type/directives.mjs';
import { getDirectiveValues } from './values.mjs';

/**
 * Given a selectionSet, collects all of the fields and returns them.
 *
 * CollectFields requires the "runtime type" of an object. For a field that
 * returns an Interface or Union type, the "runtime type" will be the actual
 * object type returned by that field.
 *
 * @internal
 */
export function collectFields(
  executorSchema,
  fragments,
  variableValues,
  runtimeType,
  selectionSet,
  ignoreDefer,
) {
  const fields = new Map();
  const patches = [];
  collectFieldsImpl(
    executorSchema,
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

export function collectSubfields(
  executorSchema,
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
        executorSchema,
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
  executorSchema,
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
      case Kind.FIELD: {
        if (!shouldIncludeNode(executorSchema, variableValues, selection)) {
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

      case Kind.INLINE_FRAGMENT: {
        if (
          !shouldIncludeNode(executorSchema, variableValues, selection) ||
          !doesFragmentConditionMatch(executorSchema, selection, runtimeType)
        ) {
          continue;
        }

        const defer = getDeferValues(
          executorSchema,
          variableValues,
          selection,
          ignoreDefer,
        );

        if (defer) {
          const patchFields = new Map();
          collectFieldsImpl(
            executorSchema,
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
            executorSchema,
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

      case Kind.FRAGMENT_SPREAD: {
        const fragName = selection.name.value;

        if (!shouldIncludeNode(executorSchema, variableValues, selection)) {
          continue;
        }

        const defer = getDeferValues(
          executorSchema,
          variableValues,
          selection,
          ignoreDefer,
        );

        if (visitedFragmentNames.has(fragName) && !defer) {
          continue;
        }

        const fragment = fragments[fragName];

        if (
          !fragment ||
          !doesFragmentConditionMatch(executorSchema, fragment, runtimeType)
        ) {
          continue;
        }

        visitedFragmentNames.add(fragName);

        if (defer) {
          const patchFields = new Map();
          collectFieldsImpl(
            executorSchema,
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
            executorSchema,
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

function getDeferValues(executorSchema, variableValues, node, ignoreDefer) {
  if (ignoreDefer) {
    return;
  }

  const defer = getDirectiveValues(
    executorSchema,
    GraphQLDeferDirective,
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

function shouldIncludeNode(executorSchema, variableValues, node) {
  const skip = getDirectiveValues(
    executorSchema,
    GraphQLSkipDirective,
    node,
    variableValues,
  );

  if ((skip === null || skip === void 0 ? void 0 : skip.if) === true) {
    return false;
  }

  const include = getDirectiveValues(
    executorSchema,
    GraphQLIncludeDirective,
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

function doesFragmentConditionMatch(executorSchema, fragment, type) {
  const typeConditionNode = fragment.typeCondition;

  if (!typeConditionNode) {
    return true;
  }

  const conditionalType = executorSchema.getType(typeConditionNode);

  if (conditionalType === type) {
    return true;
  }

  if (conditionalType && executorSchema.isAbstractType(conditionalType)) {
    return executorSchema.isSubType(conditionalType, type);
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

const createFieldList = memoize1((node) => [node]);
/**
 * Appends to a field list, memoizing so that functions operating on the
 * field list can be memoized.
 */

const updateFieldList = memoize2((fieldList, node) => [...fieldList, node]);
