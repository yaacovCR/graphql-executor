import { GraphQLError } from 'graphql';
/**
 * A GraphQLAggregateError is a container for multiple errors.
 *
 * This helper can be used to report multiple distinct errors simultaneously.
 * Note that error handlers must be aware aggregated errors may be reported so as to
 * properly handle the contained errors.
 *
 * See also:
 * https://tc39.es/ecma262/multipage/fundamental-objects.html#sec-aggregate-error-objects
 * https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/AggregateError
 * https://github.com/zloirock/core-js/blob/master/packages/core-js/modules/es.aggregate-error.js
 * https://github.com/sindresorhus/aggregate-error
 *
 */
export declare class GraphQLAggregateError<T = Error> extends Error {
  readonly errors: ReadonlyArray<T>;
  constructor(errors: ReadonlyArray<T>, message?: string);
  get [Symbol.toStringTag](): string;
}
export declare function isAggregateOfGraphQLErrors(
  error: unknown,
): error is GraphQLAggregateError<GraphQLError>;
