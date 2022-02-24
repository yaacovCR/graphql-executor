import { Repeater } from './repeater.ts';
interface PublisherOptions<TSource, TPayload> {
  payloadFromSource?: (source: TSource, hasNext: boolean) => TPayload;
  onReady?: () => void;
  hasNext?: () => boolean;
  onStop?: () => void;
}
/**
 * @internal
 */

export class Publisher<TSource, TPayload = TSource> {
  private _payloadFromSource: (source: TSource, hasNext: boolean) => TPayload;
  private _onReady: (() => void) | undefined;
  private _hasNext: () => boolean;
  private _buffer: Array<TPayload>;
  private _stopped: boolean; // This is safe because a promise executor within the constructor will assign this.

  private _resolve!: () => void;
  private _trigger: Promise<void>;
  private _pushed: WeakMap<object, boolean>;
  private _pending: WeakMap<
    object,
    Array<{
      key: object;
      source: TSource;
    }>
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
      } // eslint-disable-next-line no-constant-condition

      while (true) {
        // eslint-disable-next-line no-await-in-loop
        await this._trigger;

        while (this._buffer.length) {
          // This is safe because _buffer has a non-zero length
          const payload = this._buffer.shift() as TPayload; // eslint-disable-next-line no-await-in-loop

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

  emit(key: object, payload: TPayload): void {
    this._pushed.set(key, true);

    this._buffer.push(payload);

    const dependents = this._pending.get(key);

    if (dependents) {
      this._pushMany(dependents);
    }

    this._pending.delete(key);

    this._resolve();
  }

  stop(finalPayload?: TPayload): void {
    if (finalPayload !== undefined) {
      this._buffer.push(finalPayload);
    }

    this._stopped = true;

    this._resolve();
  }

  queue(key: object, source: TSource, parentKey: object): void {
    if (this._pushed.get(parentKey)) {
      this._pushOne({
        key,
        source,
      });

      return;
    }

    const dependents = this._pending.get(parentKey);

    if (dependents) {
      dependents.push({
        key,
        source,
      });
      return;
    }

    this._pending.set(parentKey, [
      {
        key,
        source,
      },
    ]);
  }

  _pushOne(keySource: { key: object; source: TSource }): void {
    const hasNext = this._pushOneImpl(keySource);

    if (!hasNext) {
      this.stop();
    }
  }

  _pushOneImpl({ key, source }: { key: object; source: TSource }): boolean {
    this._onReady?.();

    const hasNext = this._hasNext();

    const payload = this._payloadFromSource(source, hasNext);

    this.emit(key, payload);
    return hasNext;
  }

  _pushMany(
    keySources: Array<{
      key: object;
      source: TSource;
    }>,
  ): void {
    let hasNext = false;

    for (const keySource of keySources) {
      hasNext = this._pushOneImpl(keySource);
    }

    if (!hasNext) {
      this.stop();
    }
  }

  subscribe(): AsyncGenerator<TPayload> {
    return this._repeater;
  }
}
