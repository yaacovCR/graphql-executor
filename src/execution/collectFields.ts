import { AccumulatorMap } from '../jsutils/AccumulatorMap.js';
import { invariant } from '../jsutils/invariant.js';
import type { ObjMap } from '../jsutils/ObjMap.js';
import type { ReadonlyOrderedSet } from '../jsutils/OrderedSet.js';
import { OrderedSet } from '../jsutils/OrderedSet.js';

import type {
  FieldNode,
  FragmentDefinitionNode,
  FragmentSpreadNode,
  InlineFragmentNode,
  OperationDefinitionNode,
  SelectionSetNode,
} from '../language/ast.js';
import { OperationTypeNode } from '../language/ast.js';
import { Kind } from '../language/kinds.js';

import type { GraphQLObjectType } from '../type/definition.js';
import { isAbstractType } from '../type/definition.js';
import {
  GraphQLDeferDirective,
  GraphQLIncludeDirective,
  GraphQLSkipDirective,
} from '../type/directives.js';
import type { GraphQLSchema } from '../type/schema.js';

import { typeFromAST } from '../utilities/typeFromAST.js';

import { getDirectiveValues } from './values.js';

export interface DeferUsage {
  label: string | undefined;
  ancestors: ReadonlyArray<Target>;
}

export const NON_DEFERRED_TARGET_SET = new OrderedSet<Target>([
  undefined,
]).freeze();

export type Target = DeferUsage | undefined;
export type TargetSet = ReadonlyOrderedSet<Target>;
export type DeferUsageSet = ReadonlyOrderedSet<DeferUsage>;

export interface FieldDetails {
  node: FieldNode;
  target: Target;
}

export interface FieldGroup {
  fields: ReadonlyArray<FieldDetails>;
  targets: TargetSet;
}

export type GroupedFieldSet = Map<string, FieldGroup>;

export interface GroupedFieldSetDetails {
  groupedFieldSet: GroupedFieldSet;
  shouldInitiateDefer: boolean;
}

export interface CollectFieldsResult {
  groupedFieldSet: GroupedFieldSet;
  newGroupedFieldSetDetails: Map<DeferUsageSet, GroupedFieldSetDetails>;
  newDeferUsages: ReadonlyArray<DeferUsage>;
}

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
  schema: GraphQLSchema,
  fragments: ObjMap<FragmentDefinitionNode>,
  variableValues: { [variable: string]: unknown },
  runtimeType: GraphQLObjectType,
  operation: OperationDefinitionNode,
): CollectFieldsResult {
  const fields = new Map<Target, AccumulatorMap<string, FieldNode>>();
  const newDeferUsages: Array<DeferUsage> = [];

  collectFieldsImpl(
    schema,
    fragments,
    variableValues,
    operation,
    runtimeType,
    operation.selectionSet,
    fields,
    newDeferUsages,
    new Set(),
  );

  return {
    ...buildGroupedFieldSets(fields),
    newDeferUsages,
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
// eslint-disable-next-line max-params
export function collectSubfields(
  schema: GraphQLSchema,
  fragments: ObjMap<FragmentDefinitionNode>,
  variableValues: { [variable: string]: unknown },
  operation: OperationDefinitionNode,
  returnType: GraphQLObjectType,
  fieldGroup: FieldGroup,
): CollectFieldsResult {
  const fields = new Map<Target, AccumulatorMap<string, FieldNode>>();
  const newDeferUsages: Array<DeferUsage> = [];
  const visitedFragmentNames = new Set<string>();

  for (const fieldDetails of fieldGroup.fields) {
    const node = fieldDetails.node;
    if (node.selectionSet) {
      collectFieldsImpl(
        schema,
        fragments,
        variableValues,
        operation,
        returnType,
        node.selectionSet,
        fields,
        newDeferUsages,
        visitedFragmentNames,
        fieldDetails.target,
      );
    }
  }

  return {
    ...buildGroupedFieldSets(fields, fieldGroup.targets),
    newDeferUsages,
  };
}

function buildGroupedFieldSets(
  fields: Map<Target, Map<string, ReadonlyArray<FieldNode>>>,
  parentTargets = NON_DEFERRED_TARGET_SET,
): {
  groupedFieldSet: GroupedFieldSet;
  newGroupedFieldSetDetails: Map<DeferUsageSet, GroupedFieldSetDetails>;
} {
  const targetMap = new Map<string, Set<Target>>();
  const responseKeys = new Set<string>();
  for (const [target, targetFields] of fields) {
    for (const [responseKey] of targetFields) {
      responseKeys.add(responseKey);
      const targets = targetMap.get(responseKey);
      if (targets === undefined) {
        targetMap.set(responseKey, new Set([target]));
      } else {
        targets.add(target);
      }
    }
  }

  const parentTargetKeys = new Set<string>();
  const targetSetDetailsMap = new Map<
    TargetSet,
    { keys: Set<string>; shouldInitiateDefer: boolean }
  >();
  for (const responseKey of responseKeys) {
    const targets = targetMap.get(responseKey) as Set<Target>;
    const nonMaskedTargetList: Array<Target> = [];
    for (const target of targets) {
      if (
        target === undefined ||
        target.ancestors.every((ancestor) => !targets.has(ancestor))
      ) {
        nonMaskedTargetList.push(target);
      }
    }

    const nonMaskedTargets = new OrderedSet(nonMaskedTargetList).freeze();
    if (nonMaskedTargets === parentTargets) {
      parentTargetKeys.add(responseKey);
      continue;
    }

    const newTargetSet = new OrderedSet(targets).freeze();
    let targetSetDetails = targetSetDetailsMap.get(newTargetSet);
    if (targetSetDetails === undefined) {
      const shouldInitiateDefer = nonMaskedTargetList.some(
        (deferUsage) => !parentTargets.has(deferUsage),
      );
      targetSetDetails = { keys: new Set(), shouldInitiateDefer };
      targetSetDetailsMap.set(newTargetSet, targetSetDetails);
    }
    targetSetDetails.keys.add(responseKey);
  }

  const groupedFieldSet = new Map<
    string,
    { fields: Array<FieldDetails>; targets: TargetSet }
  >();
  if (parentTargetKeys.size > 0) {
    addFieldDetails(
      groupedFieldSet,
      parentTargets,
      targetMap,
      fields,
      parentTargetKeys,
    );
  }

  const newGroupedFieldSetDetails = new Map<
    DeferUsageSet,
    {
      groupedFieldSet: Map<
        string,
        { fields: Array<FieldDetails>; targets: TargetSet }
      >;
      shouldInitiateDefer: boolean;
    }
  >();
  for (const [targets, { keys, shouldInitiateDefer }] of targetSetDetailsMap) {
    const newGroupedFieldSet = new Map();
    newGroupedFieldSetDetails.set(targets as DeferUsageSet, {
      groupedFieldSet: newGroupedFieldSet,
      shouldInitiateDefer,
    });
    addFieldDetails(newGroupedFieldSet, targets, targetMap, fields, keys);
  }

  return {
    groupedFieldSet,
    newGroupedFieldSetDetails,
  };
}

function addFieldDetails(
  groupedFieldSet: Map<
    string,
    { fields: Array<FieldDetails>; targets: TargetSet }
  >,
  targets: TargetSet,
  targetMap: Map<string, Set<Target>>,
  fields: Map<Target, Map<string, ReadonlyArray<FieldNode>>>,
  keys: Set<string>,
): void {
  const firstTarget = targets.values().next().value as Target;
  const firstFields = fields.get(firstTarget) as Map<
    string,
    ReadonlyArray<FieldNode>
  >;
  for (const [key] of firstFields) {
    if (keys.has(key)) {
      let fieldGroup = groupedFieldSet.get(key);
      if (fieldGroup === undefined) {
        fieldGroup = { fields: [], targets };
        groupedFieldSet.set(key, fieldGroup);
      }
      for (const target of targetMap.get(key) as Set<Target>) {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const nodes = fields.get(target)!.get(key)!;
        fieldGroup.fields.push(...nodes.map((node) => ({ node, target })));
      }
    }
  }
}

// eslint-disable-next-line max-params
function collectFieldsImpl(
  schema: GraphQLSchema,
  fragments: ObjMap<FragmentDefinitionNode>,
  variableValues: { [variable: string]: unknown },
  operation: OperationDefinitionNode,
  runtimeType: GraphQLObjectType,
  selectionSet: SelectionSetNode,
  fields: Map<Target, AccumulatorMap<string, FieldNode>>,
  newDeferUsages: Array<DeferUsage>,
  visitedFragmentNames: Set<string>,
  parentTarget?: Target,
  newTarget?: Target,
): void {
  for (const selection of selectionSet.selections) {
    switch (selection.kind) {
      case Kind.FIELD: {
        if (!shouldIncludeNode(variableValues, selection)) {
          continue;
        }
        const key = getFieldEntryKey(selection);
        const target = newTarget ?? parentTarget;
        let targetFields = fields.get(target);
        if (targetFields === undefined) {
          targetFields = new AccumulatorMap();
          fields.set(target, targetFields);
        }
        targetFields.add(key, selection);
        break;
      }
      case Kind.INLINE_FRAGMENT: {
        if (
          !shouldIncludeNode(variableValues, selection) ||
          !doesFragmentConditionMatch(schema, selection, runtimeType)
        ) {
          continue;
        }

        const defer = getDeferValues(operation, variableValues, selection);

        let target: Target;
        if (!defer) {
          target = newTarget;
        } else {
          const ancestors =
            parentTarget === undefined
              ? [parentTarget]
              : [parentTarget, ...parentTarget.ancestors];
          target = { ...defer, ancestors };
          newDeferUsages.push(target);
        }

        collectFieldsImpl(
          schema,
          fragments,
          variableValues,
          operation,
          runtimeType,
          selection.selectionSet,
          fields,
          newDeferUsages,
          visitedFragmentNames,
          parentTarget,
          target,
        );

        break;
      }
      case Kind.FRAGMENT_SPREAD: {
        const fragName = selection.name.value;

        if (!shouldIncludeNode(variableValues, selection)) {
          continue;
        }

        const defer = getDeferValues(operation, variableValues, selection);
        if (visitedFragmentNames.has(fragName) && !defer) {
          continue;
        }

        const fragment = fragments[fragName];
        if (
          fragment == null ||
          !doesFragmentConditionMatch(schema, fragment, runtimeType)
        ) {
          continue;
        }

        let target: Target;
        if (!defer) {
          visitedFragmentNames.add(fragName);
          target = newTarget;
        } else {
          const ancestors =
            parentTarget === undefined
              ? [parentTarget]
              : [parentTarget, ...parentTarget.ancestors];
          target = { ...defer, ancestors };
          newDeferUsages.push(target);
        }

        collectFieldsImpl(
          schema,
          fragments,
          variableValues,
          operation,
          runtimeType,
          fragment.selectionSet,
          fields,
          newDeferUsages,
          visitedFragmentNames,
          parentTarget,
          target,
        );
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
function getDeferValues(
  operation: OperationDefinitionNode,
  variableValues: { [variable: string]: unknown },
  node: FragmentSpreadNode | InlineFragmentNode,
): undefined | { label: string | undefined } {
  const defer = getDirectiveValues(GraphQLDeferDirective, node, variableValues);

  if (!defer) {
    return;
  }

  if (defer.if === false) {
    return;
  }

  invariant(
    operation.operation !== OperationTypeNode.SUBSCRIPTION,
    '`@defer` directive not supported on subscription operations. Disable `@defer` by setting the `if` argument to `false`.',
  );

  return {
    label: typeof defer.label === 'string' ? defer.label : undefined,
  };
}

/**
 * Determines if a field should be included based on the `@include` and `@skip`
 * directives, where `@skip` has higher precedence than `@include`.
 */
function shouldIncludeNode(
  variableValues: { [variable: string]: unknown },
  node: FragmentSpreadNode | FieldNode | InlineFragmentNode,
): boolean {
  const skip = getDirectiveValues(GraphQLSkipDirective, node, variableValues);
  if (skip?.if === true) {
    return false;
  }

  const include = getDirectiveValues(
    GraphQLIncludeDirective,
    node,
    variableValues,
  );
  if (include?.if === false) {
    return false;
  }
  return true;
}

/**
 * Determines if a fragment is applicable to the given type.
 */
function doesFragmentConditionMatch(
  schema: GraphQLSchema,
  fragment: FragmentDefinitionNode | InlineFragmentNode,
  type: GraphQLObjectType,
): boolean {
  const typeConditionNode = fragment.typeCondition;
  if (!typeConditionNode) {
    return true;
  }
  const conditionalType = typeFromAST(schema, typeConditionNode);
  if (conditionalType === type) {
    return true;
  }
  if (isAbstractType(conditionalType)) {
    return schema.isSubType(conditionalType, type);
  }
  return false;
}

/**
 * Implements the logic to compute the key of a given field's entry
 */
function getFieldEntryKey(node: FieldNode): string {
  return node.alias ? node.alias.value : node.name.value;
}
