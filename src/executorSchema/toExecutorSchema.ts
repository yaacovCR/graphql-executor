import type { GraphQLSchema, OperationTypeNode, TypeNode } from 'graphql';

import { inspect } from '../jsutils/inspect';
import { invariant } from '../jsutils/invariant';
import { memoize1 } from '../jsutils/memoize1';

import {
  SchemaMetaFieldDef,
  TypeMetaFieldDef,
  TypeNameMetaFieldDef,
  introspectionTypes,
} from '../type/introspection';

import type {
  ExecutorSchema,
  AbstractType,
  EnumType,
  InputObjectType,
  InputType,
  InterfaceType,
  LeafType,
  List,
  NamedType,
  NonNull,
  NullableInputType,
  NullableOutputType,
  NullableType,
  ObjectType,
  OutputType,
  ScalarType,
  Type,
  UnionType,
  Directive,
} from './executorSchema';
import { getPossibleInputTypes } from './getPossibleInputTypes';
import { TypeTree } from './typeTree';

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

function _isScalarType(type: unknown): type is ScalarType {
  return is(type, 'GraphQLScalarType');
}

function _isObjectType(type: unknown): type is ObjectType {
  return is(type, 'GraphQLObjectType');
}

function _isInterfaceType(type: unknown): type is InterfaceType {
  return is(type, 'GraphQLInterfaceType');
}

function _isUnionType(type: unknown): type is UnionType {
  return is(type, 'GraphQLUnionType');
}

function _isEnumType(type: unknown): type is EnumType {
  return is(type, 'GraphQLEnumType');
}

function _isInputObjectType(type: unknown): type is InputObjectType {
  return is(type, 'GraphQLInputObjectType');
}

// type predicate uses List<any> for compatibility with graphql-js v15 and earlier
function _isListType(type: unknown): type is List<any> {
  return Object.prototype.toString.call(type) === '[object GraphQLList]';
}

function _isNonNullType(type: unknown): type is NonNull<NullableType> {
  return Object.prototype.toString.call(type) === '[object GraphQLNonNull]';
}

function _toExecutorSchema(schema: GraphQLSchema): ExecutorSchema {
  const listTypes: Set<List<Type>> = new Set();
  const nonNullTypes: Set<NonNull<NullableType>> = new Set();
  const namedTypes: Map<string, NamedType> = new Map();
  const inputTypes: Set<InputType> = new Set();
  const leafTypes: Set<LeafType> = new Set();
  const scalarTypes: Set<ScalarType> = new Set();
  const enumTypes: Set<EnumType> = new Set();
  const abstractTypes: Set<AbstractType> = new Set();
  const interfaceTypes: Set<InterfaceType> = new Set();
  const unionTypes: Set<UnionType> = new Set();
  const objectTypes: Set<ObjectType> = new Set();
  const inputObjectTypes: Set<InputObjectType> = new Set();
  const typeTree = new TypeTree(_isListType, _isNonNullType);
  const subTypesMap: Map<
    AbstractType,
    Set<ObjectType | InterfaceType>
  > = new Map();
  const possibleTypesMap: Map<AbstractType, Array<ObjectType>> = new Map();

  function addOutputType(type: OutputType) {
    typeTree.add(type);
  }

  function addInputType(type: InputType) {
    inputTypes.add(type);
    typeTree.add(type);
  }

  function processType(type: Type) {
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
            type as { getInterfaces: () => ReadonlyArray<InterfaceType> }
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

  for (const type of Object.values(schema.getTypeMap())) {
    if (!type.name.startsWith('__')) {
      processType(type as NamedType);
    }
  }

  for (const directive of schema.getDirectives()) {
    for (const arg of directive.args) {
      addInputType(arg.type as InputType);
      processType(arg.type as InputType);
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

  const queryType = schema.getQueryType();
  const mutationType = schema.getMutationType();
  const subscriptionType = schema.getSubscriptionType();

  function isListType(type: InputType): type is List<InputType>;
  function isListType(type: OutputType): type is List<OutputType>;
  function isListType(type: { [key: string]: any }): type is List<Type>;
  function isListType(type: unknown): type is List<Type>;
  function isListType(type: unknown): type is List<Type> {
    return listTypes.has(type as List<Type>);
  }

  function isNonNullType(type: InputType): type is NonNull<NullableInputType>;
  function isNonNullType(type: OutputType): type is NonNull<NullableOutputType>;
  function isNonNullType(type: {
    [key: string]: any;
  }): type is NonNull<NullableType>;
  function isNonNullType(type: unknown): type is NonNull<NullableType>;
  function isNonNullType(type: unknown): type is NonNull<NullableType> {
    return nonNullTypes.has(type as NonNull<NullableType>);
  }

  function isNamedType(type: unknown): type is NamedType {
    return namedTypes.get((type as NamedType).name) !== undefined;
  }

  function isInputType(type: unknown): type is InputType {
    return inputTypes.has(type as InputType);
  }

  function isLeafType(type: unknown): type is LeafType {
    return leafTypes.has(type as LeafType);
  }

  function isScalarType(type: unknown): type is ScalarType {
    return scalarTypes.has(type as ScalarType);
  }

  function isEnumType(type: unknown): type is EnumType {
    return enumTypes.has(type as EnumType);
  }

  function isAbstractType(type: unknown): type is AbstractType {
    return abstractTypes.has(type as AbstractType);
  }

  function isInterfaceType(type: unknown): type is InterfaceType {
    return interfaceTypes.has(type as InterfaceType);
  }

  function isUnionType(type: unknown): type is UnionType {
    return unionTypes.has(type as UnionType);
  }

  function isObjectType(type: unknown): type is ObjectType {
    return objectTypes.has(type as ObjectType);
  }

  function isInputObjectType(type: unknown): type is InputObjectType {
    return inputObjectTypes.has(type as InputObjectType);
  }

  function getDirectives(): ReadonlyArray<Directive> {
    return schema.getDirectives() as unknown as ReadonlyArray<Directive>;
  }

  function getDirective(directiveName: string): Directive | undefined {
    // cast necessary pre v15 to convert null to undefined
    return (
      (schema.getDirective(directiveName) as unknown as Directive) ?? undefined
    );
  }

  function getNamedTypes(): ReadonlyArray<NamedType> {
    return Array.from(namedTypes.values());
  }

  function getNamedType(typeName: string): NamedType | undefined {
    return namedTypes.get(typeName);
  }

  function getType(typeNode: TypeNode): Type | undefined {
    return typeTree.get(typeNode);
  }

  function getRootType(operation: OperationTypeNode): ObjectType | undefined {
    if (operation === 'query') {
      return (queryType as unknown as ObjectType) ?? undefined;
    } else if (operation === 'mutation') {
      return (mutationType as unknown as ObjectType) ?? undefined;
    } else if (operation === 'subscription') {
      return (subscriptionType as unknown as ObjectType) ?? undefined;
    }
    /* c8 ignore next 3 */
    // Not reachable. All possible operation types have been considered.
    invariant(false, 'Unexpected operation type: ' + inspect(operation));
  }

  function getPossibleTypes(
    abstractType: AbstractType,
  ): ReadonlyArray<ObjectType> {
    // TODO: add test
    return possibleTypesMap.get(abstractType) /* c8 ignore next */ ?? [];
  }

  function isSubType(
    abstractType: AbstractType,
    maybeSubType: ObjectType | InterfaceType,
  ): boolean {
    return (
      subTypesMap.get(abstractType)?.has(maybeSubType) /* c8 ignore start */ ??
      // TODO: add test
      false
      /* c8 ignore stop */
    );
  }

  return {
    description: (schema as unknown as { description: string }).description,
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

export const toExecutorSchema = memoize1(_toExecutorSchema);
