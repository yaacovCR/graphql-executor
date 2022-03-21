'use strict';

Object.defineProperty(exports, '__esModule', {
  value: true,
});
exports.Publisher = void 0;

var _repeater = require('../jsutils/repeater.js');

/**
 * @internal
 */
class Publisher {
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
    this._repeater = new _repeater.Repeater(async (push, stop) => {
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

  emit(keys, payload) {
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

  stop(finalPayload) {
    if (finalPayload !== undefined) {
      this._buffer.push(finalPayload);
    }

    this._stopped = true;

    this._resolve();
  }

  queue(keys, source, parentKey) {
    if (this._pushed.get(parentKey)) {
      this._pushOne({
        keys,
        source,
      });

      return;
    }

    const dependents = this._pending.get(parentKey);

    if (dependents) {
      dependents.push({
        keys,
        source,
      });
      return;
    }

    this._pending.set(parentKey, [
      {
        keys,
        source,
      },
    ]);
  }

  _pushOne(context) {
    const hasNext = this._pushOneImpl(context);

    if (!hasNext) {
      this.stop();
    }
  }

  _pushOneImpl({ keys, source }) {
    var _this$_onReady;

    (_this$_onReady = this._onReady) === null || _this$_onReady === void 0
      ? void 0
      : _this$_onReady.call(this);

    const hasNext = this._hasNext();

    const payload = this._payloadFromSource(source, hasNext);

    this.emit(keys, payload);
    return hasNext;
  }

  _pushMany(contexts) {
    let hasNext = false;

    for (const context of contexts) {
      hasNext = this._pushOneImpl(context);
    }

    if (!hasNext) {
      this.stop();
    }
  }

  subscribe() {
    return this._repeater;
  }
}

exports.Publisher = Publisher;
