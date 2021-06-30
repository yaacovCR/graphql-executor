import { MaybePromise } from './maybePromise.mjs';

/**
 * This function transforms a JS object `ObjMap<MaybePromise<T>>` into
 * a `MaybePromise<ObjMap<T>>`
 *
 * This is akin to bluebird's `Promise.props`.
 */
export function maybePromiseForObject(object) {
  return MaybePromise.all(Object.values(object)).then((resolvedValues) => {
    const resolvedObject = Object.create(null);

    for (const [i, key] of Object.keys(object).entries()) {
      resolvedObject[key] = resolvedValues[i];
    }

    return resolvedObject;
  });
}
