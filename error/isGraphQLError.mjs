export function isGraphQLError(error) {
  return error.name === 'GraphQLError';
}
