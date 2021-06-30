import { MaybePromise } from './maybePromise';
import type { ObjMap } from './ObjMap';
/**
 * This function transforms a JS object `ObjMap<MaybePromise<T>>` into
 * a `MaybePromise<ObjMap<T>>`
 *
 * This is akin to bluebird's `Promise.props`.
 */
export declare function maybePromiseForObject<T>(
  object: ObjMap<MaybePromise<T>>,
): MaybePromise<ObjMap<T>>;
