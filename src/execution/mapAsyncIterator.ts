import { isPromise } from '../jsutils/isPromise';
import type { PromiseOrValue } from '../jsutils/PromiseOrValue';
import { Repeater } from '../jsutils/repeater';

/**
 * Given an AsyncIterable and a callback function, return an AsyncIterator
 * which produces values mapped via calling the callback function.
 */
export function mapAsyncIterator<T, U>(
  iterable: AsyncGenerator<T> | AsyncIterable<T>,
  fn: (value: T) => PromiseOrValue<U>,
): AsyncGenerator<U> {
  return new Repeater(async (push, stop) => {
    const iter = iterable[Symbol.asyncIterator]();
    let finalIteration: PromiseOrValue<IteratorResult<T>> | undefined;
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    stop.then(() => {
      finalIteration =
        typeof iter.return === 'function'
          ? iter.return()
          : { value: undefined, done: true };
    });

    // eslint-disable-next-line no-unmodified-loop-condition
    while (!finalIteration) {
      // eslint-disable-next-line no-await-in-loop
      const iteration = await iter.next();
      if (iteration.done) {
        stop();
        return iteration.value;
      }
      // eslint-disable-next-line no-await-in-loop
      await push(fn(iteration.value));
    }

    if (isPromise(finalIteration)) {
      await finalIteration;
    }
  });
}
