'use strict';

Object.defineProperty(exports, '__esModule', {
  value: true,
});
exports.mapAsyncIterator = mapAsyncIterator;

var _isPromise = require('../jsutils/isPromise.js');

var _repeater = require('../jsutils/repeater.js');

/**
 * Given an AsyncIterable and a callback function, return an AsyncIterator
 * which produces values mapped via calling the callback function.
 */
function mapAsyncIterator(iterable, fn) {
  return new _repeater.Repeater(async (push, stop) => {
    const iter = iterable[Symbol.asyncIterator]();
    let finalIteration; // eslint-disable-next-line @typescript-eslint/no-floating-promises

    stop.then(() => {
      finalIteration =
        typeof iter.return === 'function'
          ? iter.return()
          : {
              value: undefined,
              done: true,
            };
    }); // eslint-disable-next-line no-unmodified-loop-condition

    while (!finalIteration) {
      // eslint-disable-next-line no-await-in-loop
      const iteration = await iter.next();

      if (iteration.done) {
        stop();
        return iteration.value;
      } // eslint-disable-next-line no-await-in-loop

      await push(fn(iteration.value));
    }

    if ((0, _isPromise.isPromise)(finalIteration)) {
      await finalIteration;
    }
  });
}
