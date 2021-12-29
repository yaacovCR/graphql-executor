import type {
  GraphQLNamedType,
  GraphQLType,
  GraphQLOutputType,
  GraphQLInputType,
  GraphQLEnumType,
  GraphQLInputObjectType,
  GraphQLScalarType,
  GraphQLObjectType,
  GraphQLInterfaceType,
  GraphQLUnionType,
} from 'graphql';

import type { Maybe } from './jsutils/Maybe';

import type { ExecutorSchema } from './execution/executorSchema';

declare module 'graphql' {
  // supplement GraphQLResolveInfo with executorSchema instance
  interface GraphQLResolveInfo {
    executorSchema: ExecutorSchema;
  }

  // fix pre v16 types
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
