import type {
  GraphQLEnumType,
  GraphQLInterfaceType,
  GraphQLInputObjectType,
  GraphQLObjectType,
  GraphQLUnionType,
  GraphQLList,
  GraphQLNonNull,
  GraphQLNullableType,
  GraphQLScalarType,
} from 'graphql';

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

export function isScalarType(type: unknown): type is GraphQLScalarType {
  return is(type, 'GraphQLScalarType');
}

export function isObjectType(type: unknown): type is GraphQLObjectType {
  return is(type, 'GraphQLObjectType');
}

export function isInterfaceType(type: unknown): type is GraphQLInterfaceType {
  return is(type, 'GraphQLInterfaceType');
}

export function isUnionType(type: unknown): type is GraphQLUnionType {
  return is(type, 'GraphQLUnionType');
}

export function isEnumType(type: unknown): type is GraphQLEnumType {
  return is(type, 'GraphQLEnumType');
}

export function isInputObjectType(
  type: unknown,
): type is GraphQLInputObjectType {
  return is(type, 'GraphQLInputObjectType');
}

// type predicate uses GraphQLList<any> for compatibility with graphql-js v15 and earlier
export function isListType(type: unknown): type is GraphQLList<any> {
  return Object.prototype.toString.call(type) === '[object GraphQLList]';
}

export function isNonNullType(
  type: unknown,
): type is GraphQLNonNull<GraphQLNullableType> {
  return Object.prototype.toString.call(type) === '[object GraphQLNonNull]';
}
