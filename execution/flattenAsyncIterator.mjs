import { isAsyncIterable } from '../jsutils/isAsyncIterable.mjs';

/**
 * Given an AsyncIterable that could potentially yield other async iterators,
 * flatten all yielded results into a single AsyncIterable
 */
export function flattenAsyncIterator(iterable) {
  const iteratorMethod = iterable[Symbol.asyncIterator];
  const iterator = iteratorMethod.call(iterable);
  let iteratorStack = [iterator];

  async function next() {
    const currentIterator = iteratorStack[0];

    if (!currentIterator) {
      return {
        value: undefined,
        done: true,
      };
    }

    const result = await currentIterator.next();

    if (result.done) {
      iteratorStack.shift();
      return next();
    } else if (isAsyncIterable(result.value)) {
      const childIterator = result.value[Symbol.asyncIterator]();
      iteratorStack.unshift(childIterator);
      return next();
    }

    return result;
  }

  return {
    next,

    return() {
      iteratorStack = [];
      return iterator.return();
    },

    throw(error) {
      iteratorStack = [];
      return iterator.throw(error);
    },

    [Symbol.asyncIterator]() {
      return this;
    },
  };
}
