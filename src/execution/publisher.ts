import type { PromiseOrValue } from 'graphql/jsutils/PromiseOrValue';

import { Repeater } from '../jsutils/repeater';

interface PublisherOptions<TSource, TPayload> {
  payloadFromSource?: (source: TSource, hasNext: boolean) => TPayload;
  onReady?: () => void;
  hasNext?: () => boolean;
  onStop?: () => PromiseOrValue<void>;
}

/**
 * @internal
 */
export class Publisher<TSource, TPayload = TSource> {
  private _payloadFromSource: (source: TSource, hasNext: boolean) => TPayload;
  private _onReady: (() => void) | undefined;
  private _hasNext: () => boolean;

  private _buffer: Array<TPayload>;
  private _stopped: boolean;
  // This is safe because a promise executor within the constructor will assign this.
  private _resolve!: () => void;
  private _trigger: Promise<void>;

  private _pushed: WeakMap<object, boolean>;
  private _pending: WeakMap<
    object,
    Array<{ keys: Array<object>; source: TSource }>
  >;

  private _repeater: Repeater<TPayload>;

  constructor({
    payloadFromSource = (source) => source as unknown as TPayload,
    onReady,
    hasNext = () => true,
    onStop,
  }: PublisherOptions<TSource, TPayload> = {}) {
    this._payloadFromSource = payloadFromSource;
    this._onReady = onReady;
    this._hasNext = hasNext;
    this._buffer = [];
    this._stopped = false;
    this._trigger = new Promise((resolve) => {
      this._resolve = resolve;
    });
    this._pushed = new WeakMap();
    this._pending = new WeakMap();
    this._repeater = new Repeater(async (push, stop) => {
      if (onStop) {
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        stop.then(onStop);
      }

      while (true) {
        // eslint-disable-next-line no-await-in-loop
        await this._trigger;

        while (this._buffer.length) {
          // this is safe because we have checked the length;
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          const payload = this._buffer.shift()!;
          // eslint-disable-next-line no-await-in-loop
          await push(payload);
        }

        if (this._stopped) {
          stop();
          break;
        }

        this._trigger = new Promise((resolve) => {
          this._resolve = resolve;
        });
      }
    });
  }

  emit(keys: Array<object>, payload: TPayload): void {
    for (const key of keys) {
      this._pushed.set(key, true);
    }
    this._buffer.push(payload);

    for (const key of keys) {
      const dependents = this._pending.get(key);
      if (dependents) {
        this._pushMany(dependents);
      }
      this._pending.delete(key);
    }

    this._resolve();
  }

  stop(finalPayload?: TPayload): void {
    if (finalPayload !== undefined) {
      this._buffer.push(finalPayload);
    }
    this._stopped = true;
    this._resolve();
  }

  queue(keys: Array<object>, source: TSource, parentKey: object): void {
    if (this._pushed.get(parentKey)) {
      this._pushOne({ keys, source });
      return;
    }

    const dependents = this._pending.get(parentKey);
    if (dependents) {
      dependents.push({ keys, source });
      return;
    }

    this._pending.set(parentKey, [{ keys, source }]);
  }

  _pushOne(context: { keys: Array<object>; source: TSource }): void {
    const hasNext = this._pushOneImpl(context);

    if (!hasNext) {
      this.stop();
    }
  }

  _pushOneImpl({
    keys,
    source,
  }: {
    keys: Array<object>;
    source: TSource;
  }): boolean {
    this._onReady?.();
    const hasNext = this._hasNext();
    const payload = this._payloadFromSource(source, hasNext);
    this.emit(keys, payload);

    return hasNext;
  }

  _pushMany(contexts: Array<{ keys: Array<object>; source: TSource }>): void {
    let hasNext = false;
    for (const context of contexts) {
      hasNext = this._pushOneImpl(context);
    }

    if (!hasNext) {
      this.stop();
    }
  }

  subscribe(): AsyncGenerator<TPayload> {
    return this._repeater;
  }
}
