import type { GraphQLSchema } from 'graphql';
import { isSchema } from 'graphql';
import { inspect } from '../jsutils/inspect.ts';
export function assertSchema(schema: GraphQLSchema): GraphQLSchema {
  if (!isSchema(schema)) {
    throw new Error(`Expected ${inspect(schema)} to be a GraphQL schema.`);
  }

  return schema;
}
