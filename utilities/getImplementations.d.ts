import type {
  GraphQLInterfaceType,
  GraphQLObjectType,
  GraphQLSchema,
} from 'graphql';
export declare const getImplementations: (
  a1: GraphQLSchema,
  a2: GraphQLInterfaceType,
) => {
  objects: ReadonlyArray<GraphQLObjectType>;
  interfaces: ReadonlyArray<GraphQLInterfaceType>;
};
