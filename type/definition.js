'use strict';

Object.defineProperty(exports, '__esModule', {
  value: true,
});
exports.isWrappingType =
  exports.isUnionType =
  exports.isScalarType =
  exports.isObjectType =
  exports.isNonNullType =
  exports.isListType =
  exports.isLeafType =
  exports.isInterfaceType =
  exports.isInputType =
  exports.isInputObjectType =
  exports.isEnumType =
  exports.isAbstractType =
    void 0;

var _memoize = require('../jsutils/memoize1.js');

/**
 * There are predicates for each kind of GraphQL type.
 */
function _isScalarType(type) {
  return Object.prototype.toString.call(type) === '[object GraphQLScalarType]';
}

const isScalarType = (0, _memoize.memoize1)(_isScalarType);
exports.isScalarType = isScalarType;

function _isObjectType(type) {
  return Object.prototype.toString.call(type) === '[object GraphQLObjectType]';
}

const isObjectType = (0, _memoize.memoize1)(_isObjectType);
exports.isObjectType = isObjectType;

function _isInterfaceType(type) {
  return (
    Object.prototype.toString.call(type) === '[object GraphQLInterfaceType]'
  );
}

const isInterfaceType = (0, _memoize.memoize1)(_isInterfaceType);
exports.isInterfaceType = isInterfaceType;

function _isUnionType(type) {
  return Object.prototype.toString.call(type) === '[object GraphQLUnionType]';
}

const isUnionType = (0, _memoize.memoize1)(_isUnionType);
exports.isUnionType = isUnionType;

function _isEnumType(type) {
  return Object.prototype.toString.call(type) === '[object GraphQLEnumType]';
}

const isEnumType = (0, _memoize.memoize1)(_isEnumType);
exports.isEnumType = isEnumType;

function _isInputObjectType(type) {
  return (
    Object.prototype.toString.call(type) === '[object GraphQLInputObjectType]'
  );
}

const isInputObjectType = (0, _memoize.memoize1)(_isInputObjectType);
exports.isInputObjectType = isInputObjectType;

function _isListType(type) {
  return Object.prototype.toString.call(type) === '[object GraphQLList]';
}

const isListType = (0, _memoize.memoize1)(_isListType);
exports.isListType = isListType;

function _isNonNullType(type) {
  return Object.prototype.toString.call(type) === '[object GraphQLNonNull]';
}

const isNonNullType = (0, _memoize.memoize1)(_isNonNullType);
exports.isNonNullType = isNonNullType;

function _isInputType(type) {
  return (
    isScalarType(type) ||
    isEnumType(type) ||
    isInputObjectType(type) ||
    (isWrappingType(type) && isInputType(type.ofType))
  );
}

const isInputType = (0, _memoize.memoize1)(_isInputType);
exports.isInputType = isInputType;

function _isLeafType(type) {
  return isScalarType(type) || isEnumType(type);
}

const isLeafType = (0, _memoize.memoize1)(_isLeafType);
exports.isLeafType = isLeafType;

function _isAbstractType(type) {
  return isInterfaceType(type) || isUnionType(type);
}

const isAbstractType = (0, _memoize.memoize1)(_isAbstractType);
exports.isAbstractType = isAbstractType;

function _isWrappingType(type) {
  return isListType(type) || isNonNullType(type);
}

const isWrappingType = (0, _memoize.memoize1)(_isWrappingType);
exports.isWrappingType = isWrappingType;
