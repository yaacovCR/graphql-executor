import type {
  GraphQLAbstractType,
  GraphQLEnumType,
  GraphQLInputObjectType,
  GraphQLInputType,
  GraphQLInterfaceType,
  GraphQLLeafType,
  GraphQLList,
  GraphQLNonNull,
  GraphQLObjectType,
  GraphQLOutputType,
  GraphQLScalarType,
  GraphQLUnionType,
  GraphQLWrappingType,
} from 'graphql';
export declare const isScalarType: (type: {
  [key: string]: any;
}) => type is GraphQLScalarType<unknown, unknown>;
export declare const isObjectType: (type: {
  [key: string]: any;
}) => type is GraphQLObjectType<any, any>;
export declare const isInterfaceType: (type: {
  [key: string]: any;
}) => type is GraphQLInterfaceType;
export declare const isUnionType: (type: {
  [key: string]: any;
}) => type is GraphQLUnionType;
export declare const isEnumType: (type: {
  [key: string]: any;
}) => type is GraphQLEnumType;
export declare const isInputObjectType: (type: {
  [key: string]: any;
}) => type is GraphQLInputObjectType;
export declare const isListType: (type: {
  [key: string]: any;
}) => type is GraphQLList<any>;
export declare type GraphQLNullableInputType =
  | GraphQLScalarType
  | GraphQLEnumType
  | GraphQLInputObjectType
  | GraphQLList<GraphQLInputType>;
export declare type GraphQLNullableOutputType =
  | GraphQLScalarType
  | GraphQLObjectType
  | GraphQLInterfaceType
  | GraphQLUnionType
  | GraphQLEnumType
  | GraphQLList<GraphQLOutputType>;
export declare const isNonNullType: (type: {
  [key: string]: any;
}) => type is GraphQLNonNull<any>;
export declare const isInputType: (type: {
  [key: string]: any;
}) => type is GraphQLInputType;
export declare const isLeafType: (type: {
  [key: string]: any;
}) => type is GraphQLLeafType;
export declare const isAbstractType: (type: {
  [key: string]: any;
}) => type is GraphQLAbstractType;
export declare const isWrappingType: (type: {
  [key: string]: any;
}) => type is GraphQLWrappingType;
