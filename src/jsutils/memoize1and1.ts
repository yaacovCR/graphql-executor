/**
 * Memoizes the provided two-argument function.
 */
export function memoize1and1<A1 extends object, A2, R>(
  fn: (a1: A1, a2: A2) => R,
): (a1: A1, a2: A2) => R {
  let cache0: WeakMap<A1, Map<A2, R>>;

  return function memoized(a1, a2) {
    if (cache0 === undefined) {
      cache0 = new WeakMap();
    }

    let cache1 = cache0.get(a1);
    if (cache1 === undefined) {
      cache1 = new Map();
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
