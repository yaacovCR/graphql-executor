import type { PromiseOrValue } from '../jsutils/PromiseOrValue';
import type {
  ExecutorArgs,
  ExecutorExecutionArgs,
  ExecutionResult,
  AsyncExecutionResult,
} from './executor';
export interface ExecutionArgs extends ExecutorArgs, ExecutorExecutionArgs {}
/**
 * Implements the "Executing requests" section of the GraphQL specification.
 *
 * Returns either a synchronous ExecutionResult (if all encountered resolvers
 * are synchronous), or a Promise of an ExecutionResult that will eventually be
 * resolved and never rejected.
 *
 * If the arguments to this function do not result in a legal execution context,
 * a GraphQLError will be thrown immediately explaining the invalid input.
 */
export declare function execute(
  args: ExecutionArgs,
): PromiseOrValue<
  ExecutionResult | AsyncGenerator<AsyncExecutionResult, void, void>
>;
/**
 * Also implements the "Executing requests" section of the GraphQL specification.
 * However, it guarantees to complete synchronously (or throw an error) assuming
 * that all field resolvers are also synchronous.
 */
export declare function executeSync(args: ExecutionArgs): ExecutionResult;
