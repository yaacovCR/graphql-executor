interface ContainsPromise {
  promise: Promise<void>;
}

/** @internal */
export class Publisher<I extends ContainsPromise, R> {
  _pending: Set<I>;
  _update: (completed: Set<I>, publisher: Publisher<I, R>) => R | undefined;
  _onAbruptClose: (pending: ReadonlySet<I>) => Promise<void>;

  // these are assigned within the Promise executor called synchronously within the constructor
  _signalled!: Promise<void>;
  _resolve!: () => void;

  constructor(
    update: (
      released: ReadonlySet<I>,
      publisher: Publisher<I, R>,
    ) => R | undefined,
    onAbruptClose: (pending: ReadonlySet<I>) => Promise<void>,
  ) {
    this._pending = new Set();
    this._update = update;
    this._onAbruptClose = onAbruptClose;
    this._reset();
  }

  _trigger() {
    this._resolve();
    this._reset();
  }

  _reset() {
    this._signalled = new Promise<void>((resolve) => (this._resolve = resolve));
  }

  getPending(): ReadonlySet<I> {
    return this._pending;
  }

  hasNext(): boolean {
    return this._pending.size > 0;
  }

  add(item: I) {
    this._pending.add(item);
  }

  delete(item: I) {
    this._pending.delete(item);
    this._trigger();
  }

  subscribe(): AsyncGenerator<R, void, void> {
    let isDone = false;

    const _next = async (): Promise<IteratorResult<R, void>> => {
      if (isDone) {
        return { value: undefined, done: true };
      }

      await Promise.race(Array.from(this._pending).map((item) => item.promise));

      if (isDone) {
        // a different call to next has exhausted all payloads
        return { value: undefined, done: true };
      }

      const result = this._update(this._pending, this);
      const hasNext = this._pending.size > 0;

      if (result === undefined && hasNext) {
        return _next();
      }

      if (!hasNext) {
        isDone = true;
      }

      return { value: result as R, done: false };
    };

    const _return = async (): Promise<IteratorResult<R, void>> => {
      isDone = true;
      await this._onAbruptClose(this._pending);
      return { value: undefined, done: true };
    };

    const _throw = async (
      error?: unknown,
    ): Promise<IteratorResult<R, void>> => {
      isDone = true;
      await this._onAbruptClose(this._pending);
      return Promise.reject(error);
    };

    return {
      [Symbol.asyncIterator]() {
        return this;
      },
      next: _next,
      return: _return,
      throw: _throw,
    };
  }
}
