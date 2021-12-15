import { isSchema } from 'graphql';
import { inspect } from '../jsutils/inspect.mjs';
export function assertSchema(schema) {
  if (!isSchema(schema)) {
    throw new Error(`Expected ${inspect(schema)} to be a GraphQL schema.`);
  }

  return schema;
}
