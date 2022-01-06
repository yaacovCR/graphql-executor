import type {
  GraphQLAbstractType,
  GraphQLEnumType,
  GraphQLInterfaceType,
  GraphQLInputObjectType,
  GraphQLObjectType,
  GraphQLScalarType,
  GraphQLSchema,
  GraphQLUnionType,
  GraphQLNamedType,
  GraphQLInputType,
  GraphQLLeafType,
  GraphQLType,
  GraphQLNullableType,
  GraphQLOutputType,
  OperationTypeNode,
  TypeNode,
} from 'graphql';
import {
  GraphQLList,
  GraphQLNonNull,
  Kind,
  SchemaMetaFieldDef,
  TypeMetaFieldDef,
  TypeNameMetaFieldDef,
} from 'graphql';

import { inspect } from '../jsutils/inspect';
import { invariant } from '../jsutils/invariant';
import { memoize1 } from '../jsutils/memoize1';

import type {
  ExecutorSchema,
  GraphQLNullableInputType,
  GraphQLNullableOutputType,
} from './executorSchema';

function is(x: unknown, type: string): boolean {
  if (Object.prototype.toString.call(x) === `[object ${type}]`) {
    return true;
  }

  const prototype = Object.getPrototypeOf(x);
  if (prototype == null) {
    return false;
  }

  return is(prototype, type);
}

function _isScalarType(type: unknown): type is GraphQLScalarType {
  return is(type, 'GraphQLScalarType');
}

function _isObjectType(type: unknown): type is GraphQLObjectType {
  return is(type, 'GraphQLObjectType');
}

function _isInterfaceType(type: unknown): type is GraphQLInterfaceType {
  return is(type, 'GraphQLInterfaceType');
}

function _isUnionType(type: unknown): type is GraphQLUnionType {
  return is(type, 'GraphQLUnionType');
}

function _isEnumType(type: unknown): type is GraphQLEnumType {
  return is(type, 'GraphQLEnumType');
}

function _isInputObjectType(type: unknown): type is GraphQLInputObjectType {
  return is(type, 'GraphQLInputObjectType');
}

function _isListType(
  type: GraphQLInputType,
): type is GraphQLList<GraphQLInputType>;
function _isListType(
  type: GraphQLOutputType,
): type is GraphQLList<GraphQLOutputType>;
function _isListType(type: unknown): type is GraphQLList<GraphQLType>;
function _isListType(type: unknown): type is GraphQLList<GraphQLType> {
  return Object.prototype.toString.call(type) === '[object GraphQLList]';
}

function _isNonNullType(
  type: GraphQLInputType,
): type is GraphQLNonNull<GraphQLNullableInputType>;
function _isNonNullType(
  type: GraphQLOutputType,
): type is GraphQLNonNull<GraphQLNullableOutputType>;
function _isNonNullType(
  type: unknown,
): type is GraphQLNonNull<GraphQLNullableType>;
function _isNonNullType(
  type: unknown,
): type is GraphQLNonNull<GraphQLNullableType> {
  return Object.prototype.toString.call(type) === '[object GraphQLNonNull]';
}

interface TypeTreeNode {
  [Kind.LIST_TYPE]?: TypeTreeNode;
  [Kind.NON_NULL_TYPE]?: TypeTreeNode;
  [Kind.NAMED_TYPE]: Map<string, GraphQLType>;
}

class TypeTree {
  private _rootNode: TypeTreeNode;
  private typeStrings: Set<string>;

  constructor() {
    this._rootNode = {
      [Kind.NAMED_TYPE]: new Map(),
    };
    this.typeStrings = new Set();
  }

  add(type: GraphQLType): void {
    this._add(type, this._rootNode);
    this.typeStrings.add(type.toString());
  }

  get(typeNode: TypeNode): GraphQLType | undefined {
    return this._get(typeNode, this._rootNode);
  }

  has(typeString: string): boolean {
    return this.typeStrings.has(typeString);
  }

  private _get(
    typeNode: TypeNode,
    node: TypeTreeNode,
  ): GraphQLType | undefined {
    switch (typeNode.kind) {
      case Kind.LIST_TYPE: {
        const listNode = node[Kind.LIST_TYPE];
        // this never happens because the ExecutorSchema adds all possible types
        /* c8 ignore next 3 */
        if (!listNode) {
          return;
        }
        return this._get(typeNode.type, listNode);
      }
      case Kind.NON_NULL_TYPE: {
        const nonNullNode = node[Kind.NON_NULL_TYPE];
        // this never happens because the ExecutorSchema adds all possible types
        /* c8 ignore next 3 */
        if (!nonNullNode) {
          return;
        }
        return this._get(typeNode.type, nonNullNode);
      }
      case Kind.NAMED_TYPE:
        return node[Kind.NAMED_TYPE].get(typeNode.name.value);
    }
  }

  private _add(
    originalType: GraphQLType,
    node: TypeTreeNode,
    type = originalType,
  ): void {
    if (_isListType(type)) {
      let listTypeNode = node[Kind.LIST_TYPE];
      if (!listTypeNode) {
        listTypeNode = node[Kind.LIST_TYPE] = {
          [Kind.NAMED_TYPE]: new Map(),
        };
      }
      this._add(originalType, listTypeNode, type.ofType);
    } else if (_isNonNullType(type)) {
      let nonNullTypeNode = node[Kind.NON_NULL_TYPE];
      if (!nonNullTypeNode) {
        nonNullTypeNode = node[Kind.NON_NULL_TYPE] = {
          [Kind.NAMED_TYPE]: new Map(),
        };
      }
      this._add(originalType, nonNullTypeNode, type.ofType);
    } else {
      node[Kind.NAMED_TYPE].set((type as GraphQLNamedType).name, originalType);
    }
  }
}

function getPossibleInputTypes(
  type: GraphQLInputType,
): Array<GraphQLInputType> {
  if (_isListType(type)) {
    return [
      ...getPossibleInputTypes(type.ofType).map(
        (possibleType) => new GraphQLList(possibleType),
      ),
      ...getPossibleInputTypes(type.ofType).map(
        (possibleType) => new GraphQLNonNull(new GraphQLList(possibleType)),
      ),
    ];
  }

  if (_isNonNullType(type)) {
    return [...getPossibleInputTypes(type.ofType)];
  }

  return [new GraphQLNonNull(type), type];
}

function _toExecutorSchema(schema: GraphQLSchema): ExecutorSchema {
  const listTypes: Set<GraphQLList<GraphQLType>> = new Set();
  const nonNullTypes: Set<GraphQLNonNull<GraphQLNullableType>> = new Set();
  const namedTypes: Set<GraphQLNamedType> = new Set();
  const inputTypes: Set<GraphQLInputType> = new Set();
  const leafTypes: Set<GraphQLLeafType> = new Set();
  const abstractTypes: Set<GraphQLAbstractType> = new Set();
  const objectTypes: Set<GraphQLObjectType> = new Set();
  const inputObjectTypes: Set<GraphQLInputObjectType> = new Set();
  const typeTree = new TypeTree();
  const subTypesMap: Map<
    GraphQLAbstractType,
    Set<GraphQLObjectType | GraphQLInterfaceType>
  > = new Map();
  const possibleTypesMap: Map<
    GraphQLAbstractType,
    Array<GraphQLObjectType>
  > = new Map();

  function addOutputType(type: GraphQLOutputType) {
    typeTree.add(type);
  }

  function addInputType(type: GraphQLInputType) {
    inputTypes.add(type);
    typeTree.add(type);
  }

  function processType(type: GraphQLType) {
    if (_isListType(type) && !listTypes.has(type)) {
      listTypes.add(type);
      processType(type.ofType);
    } else if (_isNonNullType(type) && !nonNullTypes.has(type)) {
      nonNullTypes.add(type);
      processType(type.ofType);
    } else if (_isScalarType(type) && !namedTypes.has(type)) {
      namedTypes.add(type);
      leafTypes.add(type);
    } else if (_isObjectType(type) && !namedTypes.has(type)) {
      namedTypes.add(type);
      objectTypes.add(type);
      addOutputType(type);
      for (const field of Object.values(type.getFields())) {
        processType(field.type);
        for (const arg of field.args) {
          addInputType(arg.type);
          processType(arg.type);
        }
      }
      for (const iface of Object.values(type.getInterfaces())) {
        processType(iface);
        let subTypes = subTypesMap.get(iface);
        if (!subTypes) {
          subTypes = new Set();
          subTypesMap.set(iface, subTypes);
        }
        subTypes.add(type);
        let possibleTypes = possibleTypesMap.get(iface);
        if (!possibleTypes) {
          possibleTypes = [];
          possibleTypesMap.set(iface, possibleTypes);
        }
        possibleTypes.push(type);
      }
    } else if (_isInterfaceType(type) && !namedTypes.has(type)) {
      namedTypes.add(type);
      abstractTypes.add(type);
      addOutputType(type);
      for (const field of Object.values(type.getFields())) {
        processType(field.type);
        // TODO: add test
        /* c8 ignore next 4 */
        for (const arg of field.args) {
          addInputType(arg.type);
          processType(arg.type);
        }
      }
      // NOTE: pre-v15 compatibility
      if ('getInterfaces' in type) {
        for (const iface of Object.values(
          (
            type as { getInterfaces: () => ReadonlyArray<GraphQLInterfaceType> }
          ).getInterfaces(),
        )) {
          processType(iface);
          let subTypes = subTypesMap.get(iface);
          if (!subTypes) {
            subTypes = new Set();
            subTypesMap.set(iface, subTypes);
          }
          subTypes.add(type);
        }
      }
    } else if (_isUnionType(type) && !namedTypes.has(type)) {
      namedTypes.add(type);
      abstractTypes.add(type);
      addOutputType(type);
      let subTypes = subTypesMap.get(type);
      if (!subTypes) {
        subTypes = new Set();
        subTypesMap.set(type, subTypes);
      }
      let possibleTypes = possibleTypesMap.get(type);
      if (!possibleTypes) {
        possibleTypes = [];
        possibleTypesMap.set(type, possibleTypes);
      }
      for (const possibleType of type.getTypes()) {
        processType(possibleType);
        subTypes.add(possibleType);
        possibleTypes.push(possibleType);
      }
    } else if (_isEnumType(type) && !namedTypes.has(type)) {
      namedTypes.add(type);
      leafTypes.add(type);
    } else if (_isInputObjectType(type) && !namedTypes.has(type)) {
      namedTypes.add(type);
      inputObjectTypes.add(type);
      for (const field of Object.values(type.getFields())) {
        addInputType(field.type);
        processType(field.type);
      }
    }
  }

  const queryType = schema.getQueryType();
  const mutationType = schema.getMutationType();
  const subscriptionType = schema.getSubscriptionType();

  for (const type of Object.values(schema.getTypeMap())) {
    processType(type);
  }

  for (const fieldDef of [
    SchemaMetaFieldDef,
    TypeMetaFieldDef,
    TypeNameMetaFieldDef,
  ]) {
    processType(fieldDef.type);
    for (const arg of fieldDef.args) {
      addInputType(arg.type);
      processType(arg.type);
    }
  }

  for (const directive of [...schema.getDirectives()]) {
    for (const arg of directive.args) {
      addInputType(arg.type);
      processType(arg.type);
    }
  }

  // add all possible input types to schema
  // as variables can add non-null wrappers to input types defined in schema
  for (const inputType of inputTypes.values()) {
    const possibleInputTypes = getPossibleInputTypes(inputType);
    for (const possibleInputType of possibleInputTypes) {
      const typeString = possibleInputType.toString();
      if (!typeTree.has(typeString)) {
        addInputType(possibleInputType);
        processType(possibleInputType);
      }
    }
  }

  function isListType(
    type: GraphQLInputType,
  ): type is GraphQLList<GraphQLInputType>;
  function isListType(
    type: GraphQLOutputType,
  ): type is GraphQLList<GraphQLOutputType>;
  function isListType(type: {
    [key: string]: any;
  }): type is GraphQLList<GraphQLType>;
  function isListType(type: unknown): type is GraphQLList<GraphQLType>;
  function isListType(type: unknown): type is GraphQLList<GraphQLType> {
    return listTypes.has(type as GraphQLList<GraphQLType>);
  }

  function isNonNullType(
    type: GraphQLInputType,
  ): type is GraphQLNonNull<GraphQLNullableInputType>;
  function isNonNullType(
    type: GraphQLOutputType,
  ): type is GraphQLNonNull<GraphQLNullableOutputType>;
  function isNonNullType(type: {
    [key: string]: any;
  }): type is GraphQLNonNull<GraphQLNullableType>;
  function isNonNullType(
    type: unknown,
  ): type is GraphQLNonNull<GraphQLNullableType>;
  function isNonNullType(
    type: unknown,
  ): type is GraphQLNonNull<GraphQLNullableType> {
    return nonNullTypes.has(type as GraphQLNonNull<GraphQLNullableType>);
  }

  function isNamedType(type: unknown): type is GraphQLNamedType {
    return namedTypes.has(type as GraphQLNamedType);
  }

  function isInputType(type: unknown): type is GraphQLInputType {
    return inputTypes.has(type as GraphQLInputType);
  }

  function isLeafType(type: unknown): type is GraphQLLeafType {
    return leafTypes.has(type as GraphQLLeafType);
  }

  function isAbstractType(type: unknown): type is GraphQLAbstractType {
    return abstractTypes.has(type as GraphQLAbstractType);
  }

  function isObjectType(type: unknown): type is GraphQLObjectType {
    return objectTypes.has(type as GraphQLObjectType);
  }

  function isInputObjectType(type: unknown): type is GraphQLInputObjectType {
    return inputObjectTypes.has(type as GraphQLInputObjectType);
  }

  function getNamedType(typeName: string): GraphQLNamedType | undefined {
    // cast necessary pre v15 to convert null to undefined
    return schema.getType(typeName) ?? undefined;
  }

  function getType(typeNode: TypeNode): GraphQLType | undefined {
    return typeTree.get(typeNode);
  }

  function getRootType(
    operation: OperationTypeNode,
  ): GraphQLObjectType | undefined {
    if (operation === 'query') {
      return queryType ?? undefined;
    } else if (operation === 'mutation') {
      return mutationType ?? undefined;
    } else if (operation === 'subscription') {
      return subscriptionType ?? undefined;
    }
    /* c8 ignore next 3 */
    // Not reachable. All possible operation types have been considered.
    invariant(false, 'Unexpected operation type: ' + inspect(operation));
  }

  function getPossibleTypes(
    abstractType: GraphQLAbstractType,
  ): ReadonlyArray<GraphQLObjectType> {
    // TODO: add test
    return possibleTypesMap.get(abstractType) /* c8 ignore next */ ?? [];
  }

  function isSubType(
    abstractType: GraphQLAbstractType,
    maybeSubType: GraphQLObjectType | GraphQLInterfaceType,
  ): boolean {
    return (
      subTypesMap.get(abstractType)?.has(maybeSubType) /* c8 ignore start */ ??
      // TODO: add test
      false
      /* c8 ignore stop */
    );
  }

  return {
    isListType,
    isNonNullType,
    isNamedType,
    isInputType,
    isLeafType,
    isAbstractType,
    isObjectType,
    isInputObjectType,
    getNamedType,
    getType,
    getRootType,
    getPossibleTypes,
    isSubType,
  };
}

export const toExecutorSchema = memoize1(_toExecutorSchema);
