export declare function resolveAfterAll<
  T extends Readonly<unknown> | ReadonlyArray<unknown>,
>(result: T, promises: ReadonlyArray<Promise<void>>): Promise<T>;
