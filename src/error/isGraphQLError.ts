export function isGraphQLError(error: Error) {
  return Object.prototype.toString.call(error) === '[object GraphQLError]';
}
