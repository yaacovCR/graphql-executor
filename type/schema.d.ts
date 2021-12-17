import type { GraphQLSchema } from 'graphql';
export declare const isSchema: (type: {
  [key: string]: any;
}) => type is GraphQLSchema;
export declare function assertSchema(schema: {
  [key: string]: any;
}): GraphQLSchema;
