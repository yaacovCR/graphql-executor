import type { PromiseOrValue } from '../jsutils/PromiseOrValue';
/**
 * Given an AsyncIterable and a callback function, return an AsyncIterator
 * which produces values mapped via calling the callback function.
 */
export declare function mapAsyncIterator<T, U>(
  iterable: AsyncGenerator<T> | AsyncIterable<T>,
  fn: (value: T) => PromiseOrValue<U>,
): AsyncGenerator<U>;
