'use strict';

Object.defineProperty(exports, '__esModule', {
  value: true,
});
exports.memoize1 = memoize1;

/**
 * Memoizes the provided one-argument function.
 */
function memoize1(fn) {
  let cache0;
  return function memoized(a1) {
    if (cache0 === undefined) {
      cache0 = new WeakMap();
    }

    let fnResult = cache0.get(a1);

    if (fnResult === undefined) {
      fnResult = fn(a1);
      cache0.set(a1, fnResult);
    }

    return fnResult;
  };
}
