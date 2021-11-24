/**
 * Memoizes the provided two-argument function.
 */
export declare function memoize2<A1 extends object, A2 extends object, R>(
  fn: (a1: A1, a2: A2) => R,
): (a1: A1, a2: A2) => R;
