import type {
  GraphQLAbstractType,
  GraphQLDirective,
  GraphQLEnumType,
  GraphQLInterfaceType,
  GraphQLInputObjectType,
  GraphQLObjectType,
  GraphQLSchema,
  GraphQLUnionType,
  GraphQLNamedType,
  GraphQLInputType,
  GraphQLLeafType,
  GraphQLList,
  GraphQLNonNull,
  GraphQLNullableType,
  GraphQLType,
  GraphQLOutputType,
  GraphQLScalarType,
  OperationTypeNode,
  TypeNode,
} from 'graphql';
import { TypeNameMetaFieldDef } from 'graphql';

import type { Maybe } from '../jsutils/Maybe';
import type { ObjMap } from '../jsutils/ObjMap';
import { inspect } from '../jsutils/inspect';
import { invariant } from '../jsutils/invariant';
import { memoize1 } from '../jsutils/memoize1';

import {
  SchemaMetaFieldDef,
  TypeMetaFieldDef,
  introspectionTypes,
} from '../type/introspection';

import {
  isListType as _isListType,
  isNonNullType as _isNonNullType,
  isScalarType as _isScalarType,
  isObjectType as _isObjectType,
  isInterfaceType as _isInterfaceType,
  isUnionType as _isUnionType,
  isEnumType as _isEnumType,
  isInputObjectType as _isInputObjectType,
} from './predicates';

import type {
  ExecutorSchema,
  GraphQLNullableInputType,
  GraphQLNullableOutputType,
} from './executorSchema';
import { getPossibleInputTypes } from './getPossibleInputTypes';
import { TypeTree } from './typeTree';

interface ToExecutorSchemaImplOptions {
  description: Maybe<string>;
  typeMap: ObjMap<GraphQLNamedType>;
  directiveMap: ObjMap<GraphQLDirective>;
  queryType: Maybe<GraphQLObjectType>;
  mutationType: Maybe<GraphQLObjectType>;
  subscriptionType: Maybe<GraphQLObjectType>;
}

export function toExecutorSchemaImpl(
  options: ToExecutorSchemaImplOptions,
): ExecutorSchema {
  const {
    description,
    typeMap,
    directiveMap,
    queryType,
    mutationType,
    subscriptionType,
  } = options;

  const listTypes: Set<GraphQLList<GraphQLType>> = new Set();
  const nonNullTypes: Set<GraphQLNonNull<GraphQLNullableType>> = new Set();
  const namedTypes: Map<string, GraphQLNamedType> = new Map();
  const inputTypes: Set<GraphQLInputType> = new Set();
  const leafTypes: Set<GraphQLLeafType> = new Set();
  const scalarTypes: Set<GraphQLScalarType> = new Set();
  const enumTypes: Set<GraphQLEnumType> = new Set();
  const abstractTypes: Set<GraphQLAbstractType> = new Set();
  const interfaceTypes: Set<GraphQLInterfaceType> = new Set();
  const unionTypes: Set<GraphQLUnionType> = new Set();
  const objectTypes: Set<GraphQLObjectType> = new Set();
  const inputObjectTypes: Set<GraphQLInputObjectType> = new Set();
  const typeTree = new TypeTree(_isListType, _isNonNullType);
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
    } else if (_isScalarType(type) && !namedTypes.get(type.name)) {
      namedTypes.set(type.name, type);
      leafTypes.add(type);
      scalarTypes.add(type);
    } else if (_isObjectType(type) && !namedTypes.get(type.name)) {
      namedTypes.set(type.name, type);
      objectTypes.add(type);
      addOutputType(type);
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
      for (const field of Object.values(type.getFields())) {
        processType(field.type);
        for (const arg of field.args) {
          addInputType(arg.type);
          processType(arg.type);
        }
      }
    } else if (_isInterfaceType(type) && !namedTypes.get(type.name)) {
      namedTypes.set(type.name, type);
      abstractTypes.add(type);
      interfaceTypes.add(type);
      addOutputType(type);
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
      for (const field of Object.values(type.getFields())) {
        processType(field.type);
        // TODO: add test
        /* c8 ignore next 4 */
        for (const arg of field.args) {
          addInputType(arg.type);
          processType(arg.type);
        }
      }
    } else if (_isUnionType(type) && !namedTypes.get(type.name)) {
      namedTypes.set(type.name, type);
      abstractTypes.add(type);
      unionTypes.add(type);
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
    } else if (_isEnumType(type) && !namedTypes.get(type.name)) {
      namedTypes.set(type.name, type);
      leafTypes.add(type);
      enumTypes.add(type);
    } else if (_isInputObjectType(type) && !namedTypes.get(type.name)) {
      namedTypes.set(type.name, type);
      inputObjectTypes.add(type);
      for (const field of Object.values(type.getFields())) {
        addInputType(field.type);
        processType(field.type);
      }
    }
  }

  for (const type of Object.values(typeMap)) {
    if (!type.name.startsWith('__')) {
      processType(type);
    }
  }

  for (const directive of Object.values(directiveMap)) {
    for (const arg of directive.args) {
      addInputType(arg.type);
      processType(arg.type);
    }
  }

  // add all possible input types to schema
  // as variables can add non-null wrappers to input types defined in schema
  for (const inputType of inputTypes.values()) {
    const possibleInputTypes = getPossibleInputTypes(
      _isListType,
      _isNonNullType,
      inputType,
    );
    for (const possibleInputType of possibleInputTypes) {
      const typeString = possibleInputType.toString();
      if (!typeTree.has(typeString)) {
        addInputType(possibleInputType);
        processType(possibleInputType);
      }
    }
  }

  for (const type of introspectionTypes) {
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
    return namedTypes.get((type as GraphQLNamedType).name) !== undefined;
  }

  function isInputType(type: unknown): type is GraphQLInputType {
    return inputTypes.has(type as GraphQLInputType);
  }

  function isLeafType(type: unknown): type is GraphQLLeafType {
    return leafTypes.has(type as GraphQLLeafType);
  }

  function isScalarType(type: unknown): type is GraphQLScalarType {
    return scalarTypes.has(type as GraphQLScalarType);
  }

  function isEnumType(type: unknown): type is GraphQLEnumType {
    return enumTypes.has(type as GraphQLEnumType);
  }

  function isAbstractType(type: unknown): type is GraphQLAbstractType {
    return abstractTypes.has(type as GraphQLAbstractType);
  }

  function isInterfaceType(type: unknown): type is GraphQLInterfaceType {
    return interfaceTypes.has(type as GraphQLInterfaceType);
  }

  function isUnionType(type: unknown): type is GraphQLUnionType {
    return unionTypes.has(type as GraphQLUnionType);
  }

  function isObjectType(type: unknown): type is GraphQLObjectType {
    return objectTypes.has(type as GraphQLObjectType);
  }

  function isInputObjectType(type: unknown): type is GraphQLInputObjectType {
    return inputObjectTypes.has(type as GraphQLInputObjectType);
  }

  function getDirectives(): ReadonlyArray<GraphQLDirective> {
    return Object.values(directiveMap);
  }

  function getDirective(directiveName: string): GraphQLDirective | undefined {
    return directiveMap[directiveName] ?? undefined;
  }

  function getNamedTypes(): ReadonlyArray<GraphQLNamedType> {
    return Array.from(namedTypes.values());
  }

  function getNamedType(typeName: string): GraphQLNamedType | undefined {
    return namedTypes.get(typeName);
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
    description,
    isListType,
    isNonNullType,
    isNamedType,
    isInputType,
    isLeafType,
    isScalarType,
    isEnumType,
    isAbstractType,
    isInterfaceType,
    isUnionType,
    isObjectType,
    isInputObjectType,
    getDirectives,
    getDirective,
    getNamedTypes,
    getNamedType,
    getType,
    getRootType,
    getPossibleTypes,
    isSubType,
  };
}

function _toExecutorSchema(schema: GraphQLSchema): ExecutorSchema {
  return toExecutorSchemaImpl({
    description: (schema as unknown as { description: string }).description,
    typeMap: schema.getTypeMap(),
    directiveMap: schema.getDirectives().reduce((map, directive) => {
      map[directive.name] = directive;
      return map;
    }, Object.create(null)),
    queryType: schema.getQueryType(),
    mutationType: schema.getMutationType(),
    subscriptionType: schema.getSubscriptionType(),
  });
}

export const toExecutorSchema = memoize1(_toExecutorSchema);
