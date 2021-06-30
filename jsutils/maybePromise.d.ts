export declare class MaybePromise<T> {
  private readonly state;
  constructor(executor: () => T | Promise<T>);
  static all<T1, T2, T3, T4, T5, T6, T7, T8, T9, T10>(
    valueOrPromises: readonly [
      MaybePromise<T1>,
      MaybePromise<T2>,
      MaybePromise<T3>,
      MaybePromise<T4>,
      MaybePromise<T5>,
      MaybePromise<T6>,
      MaybePromise<T7>,
      MaybePromise<T8>,
      MaybePromise<T9>,
      MaybePromise<T10>,
    ],
  ): MaybePromise<[T1, T2, T3, T4, T5, T6, T7, T8, T9, T10]>;
  static all<T1, T2, T3, T4, T5, T6, T7, T8, T9>(
    valueOrPromises: readonly [
      MaybePromise<T1>,
      MaybePromise<T2>,
      MaybePromise<T3>,
      MaybePromise<T4>,
      MaybePromise<T5>,
      MaybePromise<T6>,
      MaybePromise<T7>,
      MaybePromise<T8>,
      MaybePromise<T9>,
    ],
  ): MaybePromise<[T1, T2, T3, T4, T5, T6, T7, T8, T9]>;
  static all<T1, T2, T3, T4, T5, T6, T7, T8>(
    valueOrPromises: readonly [
      MaybePromise<T1>,
      MaybePromise<T2>,
      MaybePromise<T3>,
      MaybePromise<T4>,
      MaybePromise<T5>,
      MaybePromise<T6>,
      MaybePromise<T7>,
      MaybePromise<T8>,
    ],
  ): MaybePromise<[T1, T2, T3, T4, T5, T6, T7, T8]>;
  static all<T1, T2, T3, T4, T5, T6, T7>(
    valueOrPromises: readonly [
      MaybePromise<T1>,
      MaybePromise<T2>,
      MaybePromise<T3>,
      MaybePromise<T4>,
      MaybePromise<T5>,
      MaybePromise<T6>,
      MaybePromise<T7>,
    ],
  ): MaybePromise<[T1, T2, T3, T4, T5, T6, T7]>;
  static all<T1, T2, T3, T4, T5, T6>(
    valueOrPromises: readonly [
      MaybePromise<T1>,
      MaybePromise<T2>,
      MaybePromise<T3>,
      MaybePromise<T4>,
      MaybePromise<T5>,
      MaybePromise<T6>,
    ],
  ): MaybePromise<[T1, T2, T3, T4, T5, T6]>;
  static all<T1, T2, T3, T4, T5>(
    valueOrPromises: readonly [
      MaybePromise<T1>,
      MaybePromise<T2>,
      MaybePromise<T3>,
      MaybePromise<T4>,
      MaybePromise<T5>,
    ],
  ): MaybePromise<[T1, T2, T3, T4, T5]>;
  static all<T1, T2, T3, T4>(
    valueOrPromises: readonly [
      MaybePromise<T1>,
      MaybePromise<T2>,
      MaybePromise<T3>,
      MaybePromise<T4>,
    ],
  ): MaybePromise<[T1, T2, T3, T4]>;
  static all<T1, T2, T3>(
    valueOrPromises: readonly [
      MaybePromise<T1>,
      MaybePromise<T2>,
      MaybePromise<T3>,
    ],
  ): MaybePromise<[T1, T2, T3]>;
  static all<T1, T2>(
    valueOrPromises: readonly [MaybePromise<T1>, MaybePromise<T2>],
  ): MaybePromise<[T1, T2]>;
  static all<T>(
    valueOrPromises: ReadonlyArray<MaybePromise<T>>,
  ): MaybePromise<Array<T>>;
  then<TResult1 = T, TResult2 = never>(
    onFulfilled?:
      | ((value: T) => TResult1 | Promise<TResult1>)
      | undefined
      | null,
    onRejected?:
      | ((reason: unknown) => TResult2 | Promise<TResult2>)
      | undefined
      | null,
  ): MaybePromise<TResult1 | TResult2>;
  catch<TResult = never>(
    onRejected:
      | ((reason: unknown) => TResult | Promise<TResult>)
      | undefined
      | null,
  ): MaybePromise<TResult>;
  resolve(): T | Promise<T>;
  get [Symbol.toStringTag](): string;
}
