/** @internal */
export class Publisher<I, R> {
  _released: Set<I>;
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
    this._released = new Set();
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

  introduce(item: I) {
    this._pending.add(item);
  }

  release(item: I): void {
    if (this._pending.has(item)) {
      this._released.add(item);
      this._trigger();
    }
  }

  push(item: I): void {
    this._released.add(item);
    this._pending.add(item);
    this._trigger();
  }

  delete(item: I) {
    this._released.delete(item);
    this._pending.delete(item);
    this._trigger();
  }

  subscribe(): AsyncGenerator<R, void, void> {
    let isDone = false;

    const _next = async (): Promise<IteratorResult<R, void>> => {
      // eslint-disable-next-line no-constant-condition
      while (true) {
        if (isDone) {
          return { value: undefined, done: true };
        }

        for (const item of this._released) {
          this._pending.delete(item);
        }
        const released = this._released;
        this._released = new Set();

        const result = this._update(released, this);

        if (!this.hasNext()) {
          isDone = true;
        }

        if (result !== undefined) {
          return { value: result, done: false };
        }

        // eslint-disable-next-line no-await-in-loop
        await this._signalled;
      }
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
