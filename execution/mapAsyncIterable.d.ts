import type { PromiseOrValue } from '../jsutils/PromiseOrValue';
/**
 * Given an AsyncIterable and a callback function, return an AsyncGenerator
 * which produces values mapped via calling the callback function.
 */
export declare function mapAsyncIterable<T, U>(
  iterable: AsyncIterable<T>,
  fn: (value: T) => PromiseOrValue<U>,
): AsyncGenerator<U, void, void>;
