import type {
  GraphQLNonNull,
  GraphQLList,
  GraphQLNamedType,
  GraphQLSchema,
  ListTypeNode,
  NamedTypeNode,
  NonNullTypeNode,
  TypeNode,
  GraphQLType,
  GraphQLOutputType,
  GraphQLInputType,
  GraphQLEnumType,
  GraphQLInputObjectType,
  GraphQLScalarType,
  GraphQLObjectType,
  GraphQLUnionType,
} from 'graphql';

import type { Maybe } from './jsutils/Maybe';

// fix pre v16 types
declare module 'graphql' {
  export interface GraphQLInterfaceType {
    getInterfaces: () => ReadonlyArray<GraphQLInterfaceType>;
  }

  export function typeFromAST(
    schema: GraphQLSchema,
    typeNode: NamedTypeNode,
  ): GraphQLNamedType | undefined;
  export function typeFromAST(
    schema: GraphQLSchema,
    typeNode: ListTypeNode,
  ): GraphQLList<any> | undefined;
  export function typeFromAST(
    schema: GraphQLSchema,
    typeNode: NonNullTypeNode,
  ): GraphQLNonNull<any> | undefined;
  export function typeFromAST(
    schema: GraphQLSchema,
    typeNode: TypeNode,
  ): GraphQLType | undefined;

  export function getNamedType(type: undefined | null): void;
  export function getNamedType(
    type: GraphQLInputType,
  ): GraphQLScalarType | GraphQLEnumType | GraphQLInputObjectType;
  export function getNamedType(
    type: GraphQLOutputType,
  ):
    | GraphQLScalarType
    | GraphQLObjectType
    | GraphQLInterfaceType
    | GraphQLUnionType
    | GraphQLEnumType;
  export function getNamedType(type: GraphQLType): GraphQLNamedType;
  export function getNamedType(
    type: Maybe<GraphQLType>,
  ): GraphQLNamedType | undefined;
}
