import { isAsyncIterable } from '../jsutils/isAsyncIterable.mjs';
import { Repeater } from '../jsutils/repeater.mjs';
/**
 * Given an AsyncIterable that could potentially yield other async iterators,
 * flatten all yielded results into a single AsyncIterable
 */

export function flattenAsyncIterator(iterable) {
  return new Repeater(async (push, stop) => {
    const iter = iterable[Symbol.asyncIterator]();
    let childIterator;
    let finalIteration; // eslint-disable-next-line @typescript-eslint/no-floating-promises

    stop.then(() => {
      const childReturned =
        childIterator && typeof childIterator.return === 'function'
          ? childIterator.return()
          : undefined;
      const returned =
        typeof iter.return === 'function' ? iter.return() : undefined;
      finalIteration = Promise.all([childReturned, returned]);
    }); // eslint-disable-next-line no-unmodified-loop-condition

    while (!finalIteration) {
      // eslint-disable-next-line no-await-in-loop
      const iteration = await iter.next();

      if (iteration.done) {
        stop();
        return;
      }

      const value = iteration.value;

      if (isAsyncIterable(value)) {
        childIterator = value[Symbol.asyncIterator](); // eslint-disable-next-line no-await-in-loop

        await pushChildIterations(childIterator, push, finalIteration); // eslint-disable-next-line require-atomic-updates

        childIterator = undefined;
        continue;
      } // eslint-disable-next-line no-await-in-loop

      await push(value);
    }

    await finalIteration;
  });
}

async function pushChildIterations(iter, push, finalIteration) {
  // eslint-disable-next-line no-unmodified-loop-condition
  while (!finalIteration) {
    // eslint-disable-next-line no-await-in-loop
    const iteration = await iter.next();

    if (iteration.done) {
      return;
    } // eslint-disable-next-line no-await-in-loop

    await push(iteration.value);
  }
}
