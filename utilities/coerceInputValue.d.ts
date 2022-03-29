import { GraphQLError } from 'graphql';
import type { GraphQLInputType } from 'graphql';
import type { ExecutorSchema } from '../executorSchema/executorSchema';
declare type OnErrorCB = (
  path: ReadonlyArray<string | number>,
  invalidValue: unknown,
  error: GraphQLError,
) => void;
/**
 * Coerces a JavaScript value given a GraphQL Input Type.
 */
export declare function coerceInputValue(
  executorSchema: ExecutorSchema,
  inputValue: unknown,
  type: GraphQLInputType,
  onError?: OnErrorCB,
): unknown;
export {};
