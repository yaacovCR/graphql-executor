import { isPromise } from '../jsutils/isPromise.ts';
import type { PromiseOrValue } from '../jsutils/PromiseOrValue.ts';
import { Repeater } from '../jsutils/repeater.ts';
/**
 * Given an AsyncIterable and a callback function, return an AsyncGenerator
 * which produces values mapped via calling the callback function.
 */

export function mapAsyncIterable<T, U>(
  iterable: AsyncIterable<T>,
  fn: (value: T) => PromiseOrValue<U>,
): AsyncGenerator<U, void, void> {
  return new Repeater(async (push, stop) => {
    const iter = iterable[Symbol.asyncIterator]();
    let finalIteration: PromiseOrValue<unknown> | undefined; // eslint-disable-next-line @typescript-eslint/no-floating-promises

    stop.then(() => {
      finalIteration = typeof iter.return === 'function' ? iter.return() : true;
    }); // eslint-disable-next-line no-unmodified-loop-condition

    while (!finalIteration) {
      // eslint-disable-next-line no-await-in-loop
      const iteration = await iter.next();

      if (iteration.done) {
        stop();
        break;
      } // eslint-disable-next-line no-await-in-loop

      await push(fn(iteration.value));
    }

    if (isPromise(finalIteration)) {
      await finalIteration;
    }
  });
}
