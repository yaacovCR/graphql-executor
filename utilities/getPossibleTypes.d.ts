import type {
  GraphQLAbstractType,
  GraphQLObjectType,
  GraphQLSchema,
} from 'graphql';
export declare const getPossibleTypes: (
  a1: GraphQLSchema,
  a2: GraphQLAbstractType,
) => readonly GraphQLObjectType<any, any>[];
