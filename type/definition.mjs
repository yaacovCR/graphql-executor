import { memoize1 } from '../jsutils/memoize1.mjs';
/**
 * There are predicates for each kind of GraphQL type.
 */

function _isScalarType(type) {
  return Object.prototype.toString.call(type) === '[object GraphQLScalarType]';
}

export const isScalarType = memoize1(_isScalarType);

function _isObjectType(type) {
  return Object.prototype.toString.call(type) === '[object GraphQLObjectType]';
}

export const isObjectType = memoize1(_isObjectType);

function _isInterfaceType(type) {
  return (
    Object.prototype.toString.call(type) === '[object GraphQLInterfaceType]'
  );
}

export const isInterfaceType = memoize1(_isInterfaceType);

function _isUnionType(type) {
  return Object.prototype.toString.call(type) === '[object GraphQLUnionType]';
}

export const isUnionType = memoize1(_isUnionType);

function _isEnumType(type) {
  return Object.prototype.toString.call(type) === '[object GraphQLEnumType]';
}

export const isEnumType = memoize1(_isEnumType);

function _isInputObjectType(type) {
  return (
    Object.prototype.toString.call(type) === '[object GraphQLInputObjectType]'
  );
}

export const isInputObjectType = memoize1(_isInputObjectType);

function _isListType(type) {
  return Object.prototype.toString.call(type) === '[object GraphQLList]';
}

export const isListType = memoize1(_isListType);

function _isNonNullType(type) {
  return Object.prototype.toString.call(type) === '[object GraphQLNonNull]';
}

export const isNonNullType = memoize1(_isNonNullType);

function _isInputType(type) {
  return (
    isScalarType(type) ||
    isEnumType(type) ||
    isInputObjectType(type) ||
    (isWrappingType(type) && isInputType(type.ofType))
  );
}

export const isInputType = memoize1(_isInputType);

function _isLeafType(type) {
  return isScalarType(type) || isEnumType(type);
}

export const isLeafType = memoize1(_isLeafType);

function _isAbstractType(type) {
  return isInterfaceType(type) || isUnionType(type);
}

export const isAbstractType = memoize1(_isAbstractType);

function _isWrappingType(type) {
  return isListType(type) || isNonNullType(type);
}

export const isWrappingType = memoize1(_isWrappingType);

function _isNamedType(type) {
  return (
    isScalarType(type) ||
    isObjectType(type) ||
    isInterfaceType(type) ||
    isUnionType(type) ||
    isEnumType(type) ||
    isInputObjectType(type)
  );
}

export const isNamedType = memoize1(_isNamedType);
