'use strict';

Object.defineProperty(exports, '__esModule', {
  value: true,
});
exports.memoize2 = memoize2;

/**
 * Memoizes the provided two-argument function.
 */
function memoize2(fn) {
  let cache0;
  return function memoized(a1, a2) {
    if (cache0 === undefined) {
      cache0 = new WeakMap();
    }

    let cache1 = cache0.get(a1);

    if (cache1 === undefined) {
      cache1 = new WeakMap();
      cache0.set(a1, cache1);
    }

    let fnResult = cache1.get(a2);

    if (fnResult === undefined) {
      fnResult = fn(a1, a2);
      cache1.set(a2, fnResult);
    }

    return fnResult;
  };
}