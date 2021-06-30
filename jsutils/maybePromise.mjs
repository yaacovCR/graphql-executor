import { isPromise } from './isPromise.mjs';

const defaultOnRejectedFn = (reason) => {
  throw reason;
};

export class MaybePromise {
  constructor(executor) {
    let value;

    try {
      value = executor();
    } catch (reason) {
      this.state = {
        status: 'rejected',
        value: reason,
      };
      return;
    }

    if (isPromise(value)) {
      this.state = {
        status: 'pending',
        value,
      };
      return;
    }

    this.state = {
      status: 'fulfilled',
      value,
    };
  }

  static all(valueOrPromises) {
    const values = [];

    for (let i = 0; i < valueOrPromises.length; i++) {
      const valueOrPromise = valueOrPromises[i];
      const state = valueOrPromise.state;

      if (state.status === 'rejected') {
        return new MaybePromise(() => {
          throw state.value;
        });
      }

      if (state.status === 'pending') {
        return new MaybePromise(() =>
          Promise.all(valueOrPromises.slice(i)).then((resolvedPromises) =>
            values.concat(resolvedPromises),
          ),
        );
      }

      values.push(state.value);
    }

    return new MaybePromise(() => values);
  }

  then(onFulfilled, onRejected) {
    const state = this.state;

    if (state.status === 'pending') {
      return new MaybePromise(() => state.value.then(onFulfilled, onRejected));
    }

    const onRejectedFn =
      typeof onRejected === 'function' ? onRejected : defaultOnRejectedFn;

    if (state.status === 'rejected') {
      return new MaybePromise(() => onRejectedFn(state.value));
    }

    const onFulfilledFn =
      typeof onFulfilled === 'function' ? onFulfilled : undefined;
    return onFulfilledFn === undefined
      ? new MaybePromise(() => state.value)
      : new MaybePromise(() => onFulfilledFn(state.value));
  }

  catch(onRejected) {
    return this.then(undefined, onRejected);
  }

  resolve() {
    const state = this.state;

    if (state.status === 'pending') {
      return Promise.resolve(state.value);
    }

    if (state.status === 'rejected') {
      throw state.value;
    }

    return state.value;
  }

  get [Symbol.toStringTag]() {
    return 'MaybePromise';
  }
}
