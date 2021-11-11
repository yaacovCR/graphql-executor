'use strict';

Object.defineProperty(exports, '__esModule', {
  value: true,
});
exports.flattenAsyncIterable = flattenAsyncIterable;

var _isAsyncIterable = require('../jsutils/isAsyncIterable.js');

var _repeater = require('../jsutils/repeater.js');

var _isPromise = require('../jsutils/isPromise.js');

/**
 * Given an AsyncIterable that could potentially yield other async iterators,
 * flatten all yielded results into a single AsyncIterable
 */
function flattenAsyncIterable(iterable) {
  return new _repeater.Repeater(async (push, stop) => {
    const iter = iterable[Symbol.asyncIterator]();
    let childIterator;
    let finalIteration; // eslint-disable-next-line @typescript-eslint/no-floating-promises

    stop.then(() => {
      const childReturned =
        childIterator &&
        typeof childIterator.return === 'function' &&
        childIterator.return();
      const returned = typeof iter.return === 'function' && iter.return();

      if ((0, _isPromise.isPromise)(childReturned)) {
        finalIteration = (0, _isPromise.isPromise)(returned)
          ? Promise.all([childReturned, returned])
          : true;
      } else if ((0, _isPromise.isPromise)(returned)) {
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

      if ((0, _isAsyncIterable.isAsyncIterable)(value)) {
        childIterator = value[Symbol.asyncIterator](); // eslint-disable-next-line no-await-in-loop

        await pushChildIterations(childIterator, push, finalIteration); // eslint-disable-next-line require-atomic-updates

        childIterator = undefined;
        continue;
      } // eslint-disable-next-line no-await-in-loop

      await push(value);
    }

    if ((0, _isPromise.isPromise)(finalIteration)) {
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
