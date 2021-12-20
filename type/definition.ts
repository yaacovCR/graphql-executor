import type {
  GraphQLAbstractType,
  GraphQLEnumType,
  GraphQLInputObjectType,
  GraphQLInputType,
  GraphQLInterfaceType,
  GraphQLLeafType,
  GraphQLList,
  GraphQLNamedType,
  GraphQLNonNull,
  GraphQLNullableType,
  GraphQLObjectType,
  GraphQLOutputType,
  GraphQLScalarType,
  GraphQLType,
  GraphQLUnionType,
  GraphQLWrappingType,
} from 'graphql';
import { memoize1 } from '../jsutils/memoize1.ts';
/**
 * There are predicates for each kind of GraphQL type.
 */

function _isScalarType(type: unknown) {
  return Object.prototype.toString.call(type) === '[object GraphQLScalarType]';
}

export const isScalarType = memoize1(_isScalarType) as (type: {
  [key: string]: any;
}) => type is GraphQLScalarType;

function _isObjectType(type: unknown) {
  return Object.prototype.toString.call(type) === '[object GraphQLObjectType]';
}

export const isObjectType = memoize1(_isObjectType) as (type: {
  [key: string]: any;
}) => type is GraphQLObjectType;

function _isInterfaceType(type: unknown) {
  return (
    Object.prototype.toString.call(type) === '[object GraphQLInterfaceType]'
  );
}

export const isInterfaceType = memoize1(_isInterfaceType) as (type: {
  [key: string]: any;
}) => type is GraphQLInterfaceType;

function _isUnionType(type: unknown) {
  return Object.prototype.toString.call(type) === '[object GraphQLUnionType]';
}

export const isUnionType = memoize1(_isUnionType) as (type: {
  [key: string]: any;
}) => type is GraphQLUnionType;

function _isEnumType(type: unknown) {
  return Object.prototype.toString.call(type) === '[object GraphQLEnumType]';
}

export const isEnumType = memoize1(_isEnumType) as (type: {
  [key: string]: any;
}) => type is GraphQLEnumType;

function _isInputObjectType(type: unknown): type is GraphQLInputObjectType {
  return (
    Object.prototype.toString.call(type) === '[object GraphQLInputObjectType]'
  );
}

export const isInputObjectType = memoize1(_isInputObjectType) as (type: {
  [key: string]: any;
}) => type is GraphQLInputObjectType;
function _isListType(
  type: GraphQLInputType,
): type is GraphQLList<GraphQLInputType>;
function _isListType(
  type: GraphQLOutputType,
): type is GraphQLList<GraphQLOutputType>;
function _isListType(type: {
  [key: string]: any;
}): type is GraphQLList<GraphQLType>;

function _isListType(type: { [key: string]: any }) {
  return Object.prototype.toString.call(type) === '[object GraphQLList]';
}

export const isListType = memoize1(_isListType) as (type: {
  [key: string]: any;
}) => type is GraphQLList<any>;
export type GraphQLNullableInputType =
  | GraphQLScalarType
  | GraphQLEnumType
  | GraphQLInputObjectType
  | GraphQLList<GraphQLInputType>;
export type GraphQLNullableOutputType =
  | GraphQLScalarType
  | GraphQLObjectType
  | GraphQLInterfaceType
  | GraphQLUnionType
  | GraphQLEnumType
  | GraphQLList<GraphQLOutputType>;
function _isNonNullType(
  type: GraphQLInputType,
): type is GraphQLNonNull<GraphQLNullableInputType>;
function _isNonNullType(
  type: GraphQLOutputType,
): type is GraphQLNonNull<GraphQLNullableOutputType>;
function _isNonNullType(type: {
  [key: string]: any;
}): type is GraphQLNonNull<GraphQLNullableType>;

function _isNonNullType(type: { [key: string]: any }) {
  return Object.prototype.toString.call(type) === '[object GraphQLNonNull]';
}

export const isNonNullType = memoize1(_isNonNullType) as (type: {
  [key: string]: any;
}) => type is GraphQLNonNull<any>;

function _isInputType(type: { [key: string]: any }) {
  return (
    isScalarType(type) ||
    isEnumType(type) ||
    isInputObjectType(type) ||
    (isWrappingType(type) && isInputType(type.ofType))
  );
}

export const isInputType = memoize1(_isInputType) as (type: {
  [key: string]: any;
}) => type is GraphQLInputType;

function _isLeafType(type: { [key: string]: any }) {
  return isScalarType(type) || isEnumType(type);
}

export const isLeafType = memoize1(_isLeafType) as (type: {
  [key: string]: any;
}) => type is GraphQLLeafType;

function _isAbstractType(type: { [key: string]: any }) {
  return isInterfaceType(type) || isUnionType(type);
}

export const isAbstractType = memoize1(_isAbstractType) as (type: {
  [key: string]: any;
}) => type is GraphQLAbstractType;

function _isWrappingType(type: { [key: string]: any }) {
  return isListType(type) || isNonNullType(type);
}

export const isWrappingType = memoize1(_isWrappingType) as (type: {
  [key: string]: any;
}) => type is GraphQLWrappingType;

function _isNamedType(type: { [key: string]: any }) {
  return (
    isScalarType(type) ||
    isObjectType(type) ||
    isInterfaceType(type) ||
    isUnionType(type) ||
    isEnumType(type) ||
    isInputObjectType(type)
  );
}

export const isNamedType = memoize1(_isNamedType) as (type: {
  [key: string]: any;
}) => type is GraphQLNamedType;
