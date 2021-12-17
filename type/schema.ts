import type { GraphQLSchema } from 'graphql';
import { memoize1 } from '../jsutils/memoize1.ts';
import { inspect } from '../jsutils/inspect.ts';
/**
 * Test if the given value is a GraphQL schema.
 */

function _isSchema(schema: unknown) {
  return Object.prototype.toString.call(schema) === '[object GraphQLSchema]';
}

export const isSchema = memoize1(_isSchema) as (type: {
  [key: string]: any;
}) => type is GraphQLSchema;
export function assertSchema(schema: { [key: string]: any }): GraphQLSchema {
  if (!schema || !isSchema(schema)) {
    throw new Error(`Expected ${inspect(schema)} to be a GraphQL schema.`);
  }

  return schema;
}
