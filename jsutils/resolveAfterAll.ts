export function resolveAfterAll<
  T extends Readonly<unknown> | ReadonlyArray<unknown>,
>(result: T, promises: ReadonlyArray<Promise<void>>): Promise<T> {
  return new Promise((resolve, reject) => {
    let rejected = false;
    let reason: unknown;
    let numPromises = promises.length;

    const onFulfilled = () => {
      numPromises--;

      if (!numPromises) {
        if (rejected) {
          reject(reason);
        }

        resolve(result);
      }
    };

    const onRejected = (_reason: unknown) => {
      if (!rejected) {
        rejected = true;
        reason = _reason;
      }

      numPromises--;

      if (!numPromises) {
        reject(reason);
      }
    };

    for (const promise of promises) {
      promise.then(onFulfilled, onRejected);
    }
  });
}
