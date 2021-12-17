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
  GraphQLNamedOutputType,
  GraphQLOutputType,
  GraphQLNamedInputType,
  GraphQLInputType,
} from 'graphql';

import type { Maybe } from 'graphql/jsutils/Maybe';

// fix pre v16 types
declare module 'graphql' {
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
  export function getNamedType(type: GraphQLInputType): GraphQLNamedInputType;
  export function getNamedType(type: GraphQLOutputType): GraphQLNamedOutputType;
  export function getNamedType(type: GraphQLType): GraphQLNamedType;
  export function getNamedType(
    type: Maybe<GraphQLType>,
  ): GraphQLNamedType | undefined;
}
