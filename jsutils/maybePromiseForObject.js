'use strict';

Object.defineProperty(exports, '__esModule', {
  value: true,
});
exports.maybePromiseForObject = maybePromiseForObject;

var _maybePromise = require('./maybePromise.js');

/**
 * This function transforms a JS object `ObjMap<MaybePromise<T>>` into
 * a `MaybePromise<ObjMap<T>>`
 *
 * This is akin to bluebird's `Promise.props`.
 */
function maybePromiseForObject(object) {
  return _maybePromise.MaybePromise.all(Object.values(object)).then(
    (resolvedValues) => {
      const resolvedObject = Object.create(null);

      for (const [i, key] of Object.keys(object).entries()) {
        resolvedObject[key] = resolvedValues[i];
      }

      return resolvedObject;
    },
  );
}
