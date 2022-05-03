import type {
  GraphQLNamedType,
  GraphQLFieldConfigMap,
  GraphQLInterfaceTypeConfig,
  GraphQLObjectTypeConfig,
  GraphQLInputFieldConfigMap,
  GraphQLInputObjectTypeConfig,
  GraphQLEnumTypeConfig,
  GraphQLEnumValueConfigMap,
} from 'graphql';
import {
  GraphQLEnumType,
  GraphQLInterfaceType,
  GraphQLInputObjectType,
  GraphQLObjectType,
  GraphQLScalarType,
  GraphQLUnionType,
} from 'graphql';

import { inspect } from '../jsutils/inspect';
import { invariant } from '../jsutils/invariant';
import type { ObjMap } from '../jsutils/ObjMap';

import type { ExecutorSchema } from '../executorSchema/executorSchema';
import {
  isScalarType,
  isObjectType,
  isInterfaceType,
  isUnionType,
  isEnumType,
  isInputObjectType,
} from '../executorSchema/predicates';

export interface Subschema {
  index: number;
  schema: ExecutorSchema;
}

export interface TypeRef<T extends GraphQLNamedType> {
  subschema: Subschema;
  type: T;
}

export interface MergeInfo {
  types: ObjMap<MergedTypeInfo>;
}

export interface MergedTypeInfo {
  fields: ObjMap<MergedFieldInfo>;
}

export interface MergedFieldInfo {
  subschema: Subschema;
}

export type NamedTypeRef = TypeRef<GraphQLNamedType>;
export type ScalarTypeRef = TypeRef<GraphQLScalarType>;
export type ObjectTypeRef = TypeRef<GraphQLObjectType>;
export type InterfaceTypeRef = TypeRef<GraphQLInterfaceType>;
export type UnionTypeRef = TypeRef<GraphQLUnionType>;
export type EnumTypeRef = TypeRef<GraphQLEnumType>;
export type InputObjectTypeRef = TypeRef<GraphQLInputObjectType>;

export type MergeTypeRefsResult =
  | ScalarMergeTypeRefsResult
  | ObjectMergeTypeRefsResult
  | InterfaceMergeTypeRefsResult
  | UnionMergeTypeRefsResult
  | EnumMergeTypeRefsResult
  | InputObjectMergeTypeRefsResult;

export type NamedTypeKind =
  | 'SCALAR'
  | 'OBJECT'
  | 'INTERFACE'
  | 'UNION'
  | 'ENUM'
  | 'INPUT_OBJECT';

export interface ScalarMergeTypeRefsResult {
  kind: 'SCALAR';
  type: GraphQLScalarType;
}

export interface ObjectMergeTypeRefsResult {
  kind: 'OBJECT';
  type: GraphQLObjectType;
}

export interface InterfaceMergeTypeRefsResult {
  kind: 'INTERFACE';
  type: GraphQLInterfaceType;
}

export interface UnionMergeTypeRefsResult {
  kind: 'UNION';
  type: GraphQLUnionType;
}

export interface EnumMergeTypeRefsResult {
  kind: 'ENUM';
  type: GraphQLEnumType;
}

export interface InputObjectMergeTypeRefsResult {
  kind: 'INPUT_OBJECT';
  type: GraphQLInputObjectType;
}

export function mergeTypeRefs(
  typeRefs: ReadonlyArray<NamedTypeRef>,
): MergeTypeRefsResult {
  const initialTypeRef = typeRefs[0];
  const initialSchema = initialTypeRef.subschema.schema;

  assertIdenticalTypeKinds(typeRefs);

  if (initialSchema.isScalarType(initialTypeRef.type)) {
    return mergeScalarTypes(typeRefs as ReadonlyArray<ScalarTypeRef>);
  } else if (initialSchema.isObjectType(initialTypeRef.type)) {
    return mergeObjectTypes(typeRefs as ReadonlyArray<ObjectTypeRef>);
  } else if (initialSchema.isInterfaceType(initialTypeRef.type)) {
    return mergeInterfaceTypes(typeRefs as ReadonlyArray<InterfaceTypeRef>);
  } else if (initialSchema.isUnionType(initialTypeRef.type)) {
    return mergeUnionTypes(typeRefs as ReadonlyArray<UnionTypeRef>);
  } else if (initialSchema.isEnumType(initialTypeRef.type)) {
    return mergeEnumTypes(typeRefs as ReadonlyArray<EnumTypeRef>);
  } else if (initialSchema.isInputObjectType(initialTypeRef.type)) {
    return mergeInputObjectTypes(typeRefs as ReadonlyArray<InputObjectTypeRef>);
  }
  /* c8 ignore next 6 */
  // Not reachable. All possible output types have been considered
  invariant(
    false,
    'Cannot merge unexpected type: ' + inspect(initialTypeRef.type),
  );
}

function mergeScalarTypes(
  typeRefs: ReadonlyArray<ScalarTypeRef>,
): ScalarMergeTypeRefsResult {
  const types = typeRefs.map((typeRef) => typeRef.type);
  const description = mergeTypeDescriptions(types);
  const typeConfigs = types.map((type) => type.toConfig());
  return {
    kind: 'SCALAR',
    type: new GraphQLScalarType({
      ...typeConfigs[0],
      description,
    }),
  };
}

function mergeObjectTypes(
  typeRefs: ReadonlyArray<ObjectTypeRef>,
): ObjectMergeTypeRefsResult {
  const types = typeRefs.map((typeRef) => typeRef.type);
  const description = mergeTypeDescriptions(types);
  const typeConfigs = types.map((type) => type.toConfig());
  return {
    kind: 'OBJECT',
    type: new GraphQLObjectType({
      ...typeConfigs[0],
      description,
      fields: mergeFieldConfigs(typeConfigs),
      interfaces: mergeInterfaces(typeConfigs),
    }),
  };
}

function mergeInterfaceTypes(
  typeRefs: ReadonlyArray<InterfaceTypeRef>,
): InterfaceMergeTypeRefsResult {
  const types = typeRefs.map((typeRef) => typeRef.type);
  const description = mergeTypeDescriptions(types);
  const typeConfigs = types.map((type) => type.toConfig());
  const mergedConfig: any = {
    ...typeConfigs[0],
    description,
    fields: mergeFieldConfigs(typeConfigs),
  };
  if ('interfaces' in mergedConfig) {
    mergedConfig.interfaces = mergeInterfaces(
      typeConfigs as unknown as Array<
        ReturnType<GraphQLObjectType['toConfig']>
      >,
    );
  }
  return {
    kind: 'INTERFACE',
    type: new GraphQLInterfaceType(mergedConfig),
  };
}

function mergeUnionTypes(
  typeRefs: ReadonlyArray<UnionTypeRef>,
): UnionMergeTypeRefsResult {
  const types = typeRefs.map((typeRef) => typeRef.type);
  const description = mergeTypeDescriptions(types);
  const typeConfigs = types.map((type) => type.toConfig());
  return {
    kind: 'UNION',
    type: new GraphQLUnionType({
      ...typeConfigs[0],
      description,
      types: mergeUnionMembers(typeConfigs),
    }),
  };
}

function mergeEnumTypes(
  typeRefs: ReadonlyArray<EnumTypeRef>,
): EnumMergeTypeRefsResult {
  const types = typeRefs.map((typeRef) => typeRef.type);
  const description = mergeTypeDescriptions(types);
  const typeConfigs = types.map((type) => type.toConfig());
  return {
    kind: 'ENUM',
    type: new GraphQLEnumType({
      ...typeConfigs[0],
      description,
      values: mergeEnumValues(typeConfigs),
    }),
  };
}

function mergeInputObjectTypes(
  typeRefs: ReadonlyArray<InputObjectTypeRef>,
): InputObjectMergeTypeRefsResult {
  const types = typeRefs.map((typeRef) => typeRef.type);
  const description = mergeTypeDescriptions(types);
  const typeConfigs = types.map((type) => type.toConfig());
  return {
    kind: 'INPUT_OBJECT',
    type: new GraphQLInputObjectType({
      ...typeConfigs[0],
      description,
      fields: mergeInputFieldConfigs(typeConfigs),
    }),
  };
}

function mergeTypeDescriptions(
  types: ReadonlyArray<GraphQLNamedType>,
): string | undefined {
  for (const type of types) {
    const description = type.description;
    if (description != null) {
      return description;
    }
  }
}

function mergeFieldConfigs(
  typeConfigs: ReadonlyArray<
    | GraphQLObjectTypeConfig<unknown, unknown>
    | GraphQLInterfaceTypeConfig<unknown, unknown>
  >,
): GraphQLFieldConfigMap<unknown, unknown> {
  const mergedFields: GraphQLFieldConfigMap<unknown, unknown> =
    Object.create(null);
  for (const typeConfig of typeConfigs) {
    for (const [fieldName, fieldConfig] of Object.entries(typeConfig.fields)) {
      mergedFields[fieldName] = fieldConfig;
    }
  }
  return mergedFields;
}

function mergeInterfaces(
  configs: Array<ReturnType<GraphQLObjectType['toConfig']>>,
): Array<GraphQLInterfaceType> {
  const interfaceMap: ObjMap<GraphQLInterfaceType> = Object.create(null);
  for (const config of configs) {
    for (const iface of config.interfaces) {
      interfaceMap[iface.name] = iface;
    }
  }
  return Object.values(interfaceMap);
}

function mergeUnionMembers(
  configs: Array<ReturnType<GraphQLUnionType['toConfig']>>,
): Array<GraphQLObjectType> {
  const typeMap: ObjMap<GraphQLObjectType<unknown, unknown>> =
    Object.create(null);
  for (const config of configs) {
    for (const type of config.types) {
      typeMap[type.name] = type;
    }
  }
  return Object.values(typeMap);
}

function mergeEnumValues(
  typeConfigs: ReadonlyArray<GraphQLEnumTypeConfig>,
): GraphQLEnumValueConfigMap {
  const mergedValues: GraphQLEnumValueConfigMap = Object.create(null);
  for (const typeConfig of typeConfigs) {
    for (const [valueName, value] of Object.entries(typeConfig.values)) {
      mergedValues[valueName] = value;
    }
  }
  return mergedValues;
}

function mergeInputFieldConfigs(
  typeConfigs: ReadonlyArray<GraphQLInputObjectTypeConfig>,
): GraphQLInputFieldConfigMap {
  const mergedFields: GraphQLInputFieldConfigMap = Object.create(null);
  for (const typeConfig of typeConfigs) {
    for (const [fieldName, fieldConfig] of Object.entries(typeConfig.fields)) {
      mergedFields[fieldName] = fieldConfig;
    }
  }
  return mergedFields;
}

function getNamedTypeKind(type: GraphQLNamedType): NamedTypeKind {
  if (isScalarType(type)) {
    return 'SCALAR';
  }
  if (isObjectType(type)) {
    return 'OBJECT';
  }
  if (isInterfaceType(type)) {
    return 'INTERFACE';
  }
  if (isUnionType(type)) {
    return 'UNION';
  }
  if (isEnumType(type)) {
    return 'ENUM';
  }
  if (isInputObjectType(type)) {
    return 'INPUT_OBJECT';
  }
  /* c8 ignore next 3 */
  // Not reachable. All possible type kinds have been considered.
  invariant(false, 'Unexpected type kind: ' + inspect(type));
}

function assertIdenticalTypeKinds(typeRefs: ReadonlyArray<NamedTypeRef>): void {
  const { subschema: initialSubchema, type: initialType } = typeRefs[0];
  const typeName = initialType.name;
  const initialKind = getNamedTypeKind(initialType);
  for (let i = 1; i < typeRefs.length; i++) {
    const { subschema, type } = typeRefs[i];
    const kind = getNamedTypeKind(type);
    if (kind !== initialKind) {
      throw new Error(
        `Subchema ${initialSubchema.index} includes a type with name "${typeName}" of kind "${initialKind}", but a type with name "${typeName}" in subschema ${subschema.index} is of kind "${kind}".`,
      );
    }
  }
}
