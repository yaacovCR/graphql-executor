export function resolveAfterAll(result, promises) {
  return new Promise((resolve, reject) => {
    let rejected = false;
    let reason;
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

    const onRejected = (_reason) => {
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
