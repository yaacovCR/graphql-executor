import { Repeater } from './repeater.mjs';

/**
 * @internal
 */
export class Publisher {
  // This is safe because a promise executor within the constructor will assign this.
  constructor({
    payloadFromSource = (source) => source,
    onReady,
    hasNext = () => true,
    onStop,
  } = {}) {
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
          // This is safe because _buffer has a non-zero length
          const payload = this._buffer.shift(); // eslint-disable-next-line no-await-in-loop

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

  emit(key, payload) {
    this._pushed.set(key, true);

    this._buffer.push(payload);

    const dependents = this._pending.get(key);

    if (dependents) {
      this._pushMany(dependents);
    }

    this._pending.delete(key);

    this._resolve();
  }

  stop(finalPayload) {
    if (finalPayload !== undefined) {
      this._buffer.push(finalPayload);
    }

    this._stopped = true;

    this._resolve();
  }

  queue(key, source, parentKey) {
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

  _pushOne(keySource) {
    const hasNext = this._pushOneImpl(keySource);

    if (!hasNext) {
      this.stop();
    }
  }

  _pushOneImpl({ key, source }) {
    var _this$_onReady;

    (_this$_onReady = this._onReady) === null || _this$_onReady === void 0
      ? void 0
      : _this$_onReady.call(this);

    const hasNext = this._hasNext();

    const payload = this._payloadFromSource(source, hasNext);

    this.emit(key, payload);
    return hasNext;
  }

  _pushMany(keySources) {
    let hasNext = false;

    for (const keySource of keySources) {
      hasNext = this._pushOneImpl(keySource);
    }

    if (!hasNext) {
      this.stop();
    }
  }

  subscribe() {
    return this._repeater;
  }
}
