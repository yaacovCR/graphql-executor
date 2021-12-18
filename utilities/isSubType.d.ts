import type {
  GraphQLAbstractType,
  GraphQLInterfaceType,
  GraphQLObjectType,
  GraphQLSchema,
} from 'graphql';
export declare const isSubType: (
  a1: GraphQLSchema,
  a2: GraphQLAbstractType,
  a3: GraphQLObjectType<any, any> | GraphQLInterfaceType,
) => boolean;
