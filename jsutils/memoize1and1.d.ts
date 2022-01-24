/**
 * Memoizes the provided two-argument function.
 */
export declare function memoize1and1<A1 extends object, A2, R>(
  fn: (a1: A1, a2: A2) => R,
): (a1: A1, a2: A2) => R;
