import { memoize1 } from '../jsutils/memoize1.mjs';
import { inspect } from '../jsutils/inspect.mjs';
/**
 * Test if the given value is a GraphQL schema.
 */

function _isSchema(schema) {
  return Object.prototype.toString.call(schema) === '[object GraphQLSchema]';
}

export const isSchema = memoize1(_isSchema);
export function assertSchema(schema) {
  if (!schema || !isSchema(schema)) {
    throw new Error(`Expected ${inspect(schema)} to be a GraphQL schema.`);
  }

  return schema;
}
