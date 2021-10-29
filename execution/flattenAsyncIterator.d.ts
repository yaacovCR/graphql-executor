declare type AsyncIterableOrGenerator<T> =
  | AsyncGenerator<T, void, void>
  | AsyncIterable<T>;
/**
 * Given an AsyncIterable that could potentially yield other async iterators,
 * flatten all yielded results into a single AsyncIterable
 */
export declare function flattenAsyncIterator<T, AT>(
  iterable: AsyncIterableOrGenerator<T | AsyncIterableOrGenerator<AT>>,
): AsyncGenerator<T | AT, void, void>;
export {};
