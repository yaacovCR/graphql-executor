import type { GraphQLError } from 'graphql';
export function isGraphQLError(error: Error): error is GraphQLError {
  return error.name === 'GraphQLError';
}
