/**
 * Given an AsyncIterable that could potentially yield other async iterators,
 * flatten all yielded results into a single AsyncIterable
 */
export declare function flattenAsyncIterator<T, AT>(
  iterable: AsyncIterable<T | AsyncIterable<AT>>,
): AsyncGenerator<T | AT, void, void>;
