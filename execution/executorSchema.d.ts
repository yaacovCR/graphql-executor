import type {
  GraphQLAbstractType,
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
  GraphQLList,
  GraphQLNonNull,
  OperationTypeNode,
  TypeNode,
} from 'graphql';
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
  isAbstractType: (type: unknown) => type is GraphQLAbstractType;
  isObjectType: (type: unknown) => type is GraphQLObjectType;
  isInputObjectType: (type: unknown) => type is GraphQLInputObjectType;
  getNamedType: (type: string) => GraphQLNamedType | undefined;
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
