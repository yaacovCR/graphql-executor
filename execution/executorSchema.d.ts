import type {
  GraphQLAbstractType,
  GraphQLDirective,
  GraphQLEnumType,
  GraphQLInterfaceType,
  GraphQLInputObjectType,
  GraphQLObjectType,
  GraphQLUnionType,
  GraphQLNamedType,
  GraphQLInputType,
  GraphQLLeafType,
  GraphQLType,
  GraphQLNullableType,
  GraphQLOutputType,
  GraphQLScalarType,
  GraphQLList,
  GraphQLNonNull,
  OperationTypeNode,
  TypeNode,
} from 'graphql';
import type { Maybe } from '../jsutils/Maybe';
export declare type GraphQLNullableInputType =
  | GraphQLLeafType
  | GraphQLInputObjectType
  | GraphQLList<GraphQLInputType>;
export declare type GraphQLNullableOutputType =
  | GraphQLLeafType
  | GraphQLObjectType
  | GraphQLInterfaceType
  | GraphQLUnionType
  | GraphQLList<GraphQLOutputType>;
export interface ExecutorSchema {
  description: Maybe<string>;
  isListType: ((
    type: GraphQLInputType,
  ) => type is GraphQLList<GraphQLInputType>) &
    ((type: GraphQLOutputType) => type is GraphQLList<GraphQLOutputType>) &
    ((type: unknown) => type is GraphQLList<GraphQLType>);
  isNonNullType: ((
    type: GraphQLInputType,
  ) => type is GraphQLNonNull<GraphQLNullableInputType>) &
    ((
      type: GraphQLOutputType,
    ) => type is GraphQLNonNull<GraphQLNullableOutputType>) &
    ((type: unknown) => type is GraphQLNonNull<GraphQLNullableType>);
  isNamedType: (type: unknown) => type is GraphQLNamedType;
  isInputType: (type: unknown) => type is GraphQLInputType;
  isLeafType: (type: unknown) => type is GraphQLLeafType;
  isScalarType: (type: unknown) => type is GraphQLScalarType;
  isEnumType: (type: unknown) => type is GraphQLEnumType;
  isAbstractType: (type: unknown) => type is GraphQLAbstractType;
  isInterfaceType: (type: unknown) => type is GraphQLInterfaceType;
  isUnionType: (type: unknown) => type is GraphQLUnionType;
  isObjectType: (type: unknown) => type is GraphQLObjectType;
  isInputObjectType: (type: unknown) => type is GraphQLInputObjectType;
  getDirectives: () => ReadonlyArray<GraphQLDirective>;
  getDirective: (directiveName: string) => GraphQLDirective | undefined;
  getNamedTypes: () => ReadonlyArray<GraphQLNamedType>;
  getNamedType: (typeName: string) => GraphQLNamedType | undefined;
  getType: (typeNode: TypeNode) => GraphQLType | undefined;
  getRootType: (operation: OperationTypeNode) => GraphQLObjectType | undefined;
  getPossibleTypes: (
    abstractType: GraphQLAbstractType,
  ) => ReadonlyArray<GraphQLObjectType>;
  isSubType: (
    abstractType: GraphQLAbstractType,
    maybeSubType: GraphQLObjectType | GraphQLInterfaceType,
  ) => boolean;
}
