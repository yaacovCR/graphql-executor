import { isAsyncIterable } from '../jsutils/isAsyncIterable.mjs';
import { Repeater } from '../jsutils/repeater.mjs';
import { isPromise } from '../jsutils/isPromise.mjs';
/**
 * Given an AsyncIterable that could potentially yield other async iterators,
 * flatten all yielded results into a single AsyncIterable
 */

export function flattenAsyncIterable(iterable) {
  return new Repeater(async (push, stop) => {
    const iter = iterable[Symbol.asyncIterator]();
    let childIterator;
    let finalIteration; // eslint-disable-next-line @typescript-eslint/no-floating-promises

    stop.then(() => {
      const childReturned =
        childIterator &&
        typeof childIterator.return === 'function' &&
        childIterator.return();
      const returned = typeof iter.return === 'function' && iter.return();

      if (isPromise(childReturned)) {
        finalIteration = isPromise(returned)
          ? Promise.all([childReturned, returned])
          : true;
      } else if (isPromise(returned)) {
        finalIteration = returned;
      } else {
        finalIteration = true;
      }
    }); // eslint-disable-next-line no-unmodified-loop-condition

    while (!finalIteration) {
      // eslint-disable-next-line no-await-in-loop
      const iteration = await iter.next();

      if (iteration.done) {
        stop();
        break;
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

    if (isPromise(finalIteration)) {
      await finalIteration;
    }
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
