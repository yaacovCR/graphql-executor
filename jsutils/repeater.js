'use strict';

Object.defineProperty(exports, '__esModule', {
  value: true,
});
exports.SlidingBuffer =
  exports.RepeaterOverflowError =
  exports.Repeater =
  exports.MAX_QUEUE_LENGTH =
  exports.FixedBuffer =
  exports.DroppingBuffer =
    void 0;

/**
 * Implementation from: https://github.com/repeaterjs/repeater
 */

/**
 * An error subclass which is thrown when there are too many pending push or next operations on a single repeater.
 *
 * @internal
 */
class RepeaterOverflowError extends Error {
  constructor(message) {
    super(message);
    Object.defineProperty(this, 'name', {
      value: 'RepeaterOverflowError',
      enumerable: false,
    });
    Object.setPrototypeOf(this, this.constructor.prototype);

    if (typeof Error.captureStackTrace === 'function') {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}
/** BUFFERS **/

/** A special queue interface which allow multiple values to be pushed onto a repeater without having pushes wait or throw overflow errors, passed as the second argument to the repeater constructor. */

exports.RepeaterOverflowError = RepeaterOverflowError;

/**
 * A buffer which allows you to push a set amount of values to the repeater without pushes waiting or throwing errors.
 *
 * @internal
 */
class FixedBuffer {
  // capacity
  // queue
  constructor(capacity) {
    if (capacity < 0) {
      throw new RangeError('Capacity may not be less than 0');
    }

    this._c = capacity;
    this._q = [];
  }

  get empty() {
    return this._q.length === 0;
  }

  get full() {
    return this._q.length >= this._c;
  }

  add(value) {
    if (this.full) {
      throw new Error('Buffer full');
    } else {
      this._q.push(value);
    }
  }

  remove() {
    if (this.empty) {
      throw new Error('Buffer empty');
    }

    return this._q.shift();
  }
} // TODO: Use a circular buffer here.

/**
 * Sliding buffers allow you to push a set amount of values to the repeater without pushes waiting or throwing errors. If the number of values exceeds the capacity set in the constructor, the buffer will discard the earliest values added.
 *
 * @internal
 * */

exports.FixedBuffer = FixedBuffer;

class SlidingBuffer {
  // capacity
  // queue
  constructor(capacity) {
    if (capacity < 1) {
      throw new RangeError('Capacity may not be less than 1');
    }

    this._c = capacity;
    this._q = [];
  }

  get empty() {
    return this._q.length === 0;
  }

  get full() {
    return false;
  }

  add(value) {
    while (this._q.length >= this._c) {
      this._q.shift();
    }

    this._q.push(value);
  }

  remove() {
    if (this.empty) {
      throw new Error('Buffer empty');
    }

    return this._q.shift();
  }
}
/**
 * Dropping buffers allow you to push a set amount of values to the repeater without the push function waiting or throwing errors. If the number of values exceeds the capacity set in the constructor, the buffer will discard the latest values added.
 *
 * @internal
 * */

exports.SlidingBuffer = SlidingBuffer;

class DroppingBuffer {
  // capacity
  // queue
  constructor(capacity) {
    if (capacity < 1) {
      throw new RangeError('Capacity may not be less than 1');
    }

    this._c = capacity;
    this._q = [];
  }

  get empty() {
    return this._q.length === 0;
  }

  get full() {
    return false;
  }

  add(value) {
    if (this._q.length < this._c) {
      this._q.push(value);
    }
  }

  remove() {
    if (this.empty) {
      throw new Error('Buffer empty');
    }

    return this._q.shift();
  }
}
/** Makes sure promise-likes don't cause unhandled rejections. */

exports.DroppingBuffer = DroppingBuffer;

function swallow(value) {
  if (value != null && typeof value.then === 'function') {
    value.then(NOOP, NOOP);
  }
}
/** TYPES **/

/** The type of the first argument passed to the executor callback. */

/** REPEATER STATES **/

/** The following is an enumeration of all possible repeater states. These states are ordered, and a repeater may only advance to higher states. */

/** The initial state of the repeater. */
const Initial = 0;
/** Repeaters advance to this state the first time the next method is called on the repeater. */

const Started = 1;
/** Repeaters advance to this state when the stop function is called. */

const Stopped = 2;
/** Repeaters advance to this state when there are no values left to be pulled from the repeater. */

const Done = 3;
/** Repeaters advance to this state if an error is thrown into the repeater. */

const Rejected = 4;
/** The maximum number of push or next operations which may exist on a single repeater. */

const MAX_QUEUE_LENGTH = 1024;
exports.MAX_QUEUE_LENGTH = MAX_QUEUE_LENGTH;

const NOOP = () => undefined;
/** An interface containing the private data of repeaters, only accessible through a private WeakMap. */

/** A helper function used to mimic the behavior of async generators where the final iteration is consumed. */
function consumeExecution(r) {
  const err = r.err;
  const execution = Promise.resolve(r.execution).then((value) => {
    if (err != null) {
      throw err;
    }

    return value;
  });
  r.err = undefined;
  r.execution = execution.then(
    () => undefined,
    () => undefined,
  );
  return r.pending === undefined ? execution : r.pending.then(() => execution);
}
/** A helper function for building iterations from values. Promises are unwrapped, so that iterations never have their value property set to a promise. */

function createIteration(r, value) {
  const done = r.state >= Done;
  return Promise.resolve(value).then((resolvedValue) => {
    if (!done && r.state >= Rejected) {
      return consumeExecution(r).then((finalValue) => ({
        value: finalValue,
        done: true,
      }));
    }

    return {
      value: resolvedValue,
      done,
    };
  });
}
/**
 * This function is bound and passed to the executor as the stop argument.
 *
 * Advances state to Stopped.
 */

function stop(r, err) {
  if (r.state >= Stopped) {
    return;
  }

  r.state = Stopped;
  r.onnext();
  r.onstop();

  if (r.err == null) {
    r.err = err;
  }

  if (
    r.pushes.length === 0 &&
    (typeof r.buffer === 'undefined' || r.buffer.empty)
  ) {
    finish(r);
  } else {
    for (const p of r.pushes) {
      p.resolve();
    }
  }
}
/**
 * The difference between stopping a repeater vs finishing a repeater is that stopping a repeater allows next to continue to drain values from the push queue and buffer, while finishing a repeater will clear all pending values and end iteration immediately. Once, a repeater is finished, all iterations will have the done property set to true.
 *
 * Advances state to Done.
 */

function finish(r) {
  if (r.state >= Done) {
    return;
  }

  if (r.state < Stopped) {
    stop(r);
  }

  r.state = Done;
  r.buffer = undefined;

  for (const next of r.nexts) {
    const execution =
      r.pending === undefined
        ? consumeExecution(r)
        : r.pending.then(() => consumeExecution(r));
    next.resolve(createIteration(r, execution));
  }

  r.pushes = [];
  r.nexts = [];
}
/**
 * Called when a promise passed to push rejects, or when a push call is unhandled.
 *
 * Advances state to Rejected.
 */

function reject(r) {
  if (r.state >= Rejected) {
    return;
  }

  if (r.state < Done) {
    finish(r);
  }

  r.state = Rejected;
}
/** This function is bound and passed to the executor as the push argument. */

function push(r, value) {
  swallow(value);

  if (r.pushes.length >= MAX_QUEUE_LENGTH) {
    throw new RepeaterOverflowError(
      `No more than ${MAX_QUEUE_LENGTH} pending calls to push are allowed on a single repeater.`,
    );
  } else if (r.state >= Stopped) {
    return Promise.resolve(undefined);
  }

  let valueP =
    r.pending === undefined
      ? Promise.resolve(value)
      : r.pending.then(() => value);
  valueP = valueP.catch((err) => {
    if (r.state < Stopped) {
      r.err = err;
    }

    reject(r);
    return undefined; // void :(
  });
  let nextP;

  if (r.nexts.length) {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const next = r.nexts.shift();
    next.resolve(createIteration(r, valueP));

    if (r.nexts.length) {
      nextP = Promise.resolve(r.nexts[0].value);
    } else {
      nextP = new Promise((resolve) => (r.onnext = resolve));
    }
  } else if (typeof r.buffer !== 'undefined' && !r.buffer.full) {
    r.buffer.add(valueP);
    nextP = Promise.resolve(undefined);
  } else {
    nextP = new Promise((resolve) =>
      r.pushes.push({
        resolve,
        value: valueP,
      }),
    );
  } // If an error is thrown into the repeater via the next or throw methods, we give the repeater a chance to handle this by rejecting the promise returned from push. If the push call is not immediately handled we throw the next iteration of the repeater.
  // To check that the promise returned from push is floating, we modify the then and catch methods of the returned promise so that they flip the floating flag. The push function actually does not return a promise, because modern engines do not call the then and catch methods on native promises. By making next a plain old javascript object, we ensure that the then and catch methods will be called.

  let floating = true;
  const next = {};
  const unhandled = nextP.catch((err) => {
    if (floating) {
      throw err;
    }

    return undefined; // void :(
  });

  next.then = (onfulfilled, onrejected) => {
    floating = false;
    return Promise.prototype.then.call(nextP, onfulfilled, onrejected);
  };

  next.catch = (onrejected) => {
    floating = false;
    return Promise.prototype.catch.call(nextP, onrejected);
  };

  next.finally = nextP.finally.bind(nextP);
  r.pending = valueP
    .then(() => unhandled)
    .catch((err) => {
      r.err = err;
      reject(r);
    });
  return next;
}
/**
 * Creates the stop callable promise which is passed to the executor
 */

function createStop(r) {
  const stop1 = stop.bind(null, r);
  const stopP = new Promise((resolve) => (r.onstop = resolve));
  stop1.then = stopP.then.bind(stopP);
  stop1.catch = stopP.catch.bind(stopP);
  stop1.finally = stopP.finally.bind(stopP);
  return stop1;
}
/**
 * Calls the executor passed into the constructor. This function is called the first time the next method is called on the repeater.
 *
 * Advances state to Started.
 */

function execute(r) {
  /*
  if (r.state >= Started) {
    return;
  }
  */
  r.state = Started;
  const push1 = push.bind(null, r);
  const stop1 = createStop(r);
  r.execution = new Promise((resolve) => resolve(r.executor(push1, stop1))); // TODO: We should consider stopping all repeaters when the executor settles.

  r.execution.catch(() => stop(r));
}

const records = new WeakMap();
/**
 * An error subclass which is thrown when there are too many pending push or next operations on a single repeater.
 * NOTE: While repeaters implement and are assignable to the AsyncGenerator interface, and you can use the types interchangeably, we don't use typescript's implements syntax here because this would make supporting earlier versions of typescript trickier. This is because TypeScript version 3.6 changed the iterator types by adding the TReturn and TNext type parameters.
 *
 * @internal
 */

class Repeater {
  constructor(executor, buffer) {
    records.set(this, {
      executor,
      buffer,
      err: undefined,
      state: Initial,
      pushes: [],
      nexts: [],
      pending: undefined,
      execution: undefined,
      onnext: NOOP,
      onstop: NOOP,
    });
  }

  next(value) {
    swallow(value); // eslint-disable-next-line @typescript-eslint/no-non-null-assertion

    const r = records.get(this);

    if (r === undefined) {
      throw new Error('WeakMap error');
    }

    if (r.nexts.length >= MAX_QUEUE_LENGTH) {
      throw new RepeaterOverflowError(
        `No more than ${MAX_QUEUE_LENGTH} pending calls to next are allowed on a single repeater.`,
      );
    }

    if (r.state <= Initial) {
      execute(r);
    }

    r.onnext(value);

    if (typeof r.buffer !== 'undefined' && !r.buffer.empty) {
      const result = createIteration(r, r.buffer.remove());

      if (r.pushes.length) {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const p = r.pushes.shift();
        r.buffer.add(p.value);
        r.onnext = p.resolve;
      }

      return result;
    } else if (r.pushes.length) {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const p = r.pushes.shift();
      r.onnext = p.resolve;
      return createIteration(r, p.value);
    } else if (r.state >= Stopped) {
      finish(r);
      return createIteration(r, consumeExecution(r));
    }

    return new Promise((resolve) =>
      r.nexts.push({
        resolve,
        value,
      }),
    );
  }

  return(value) {
    swallow(value); // eslint-disable-next-line @typescript-eslint/no-non-null-assertion

    const r = records.get(this);

    if (r === undefined) {
      throw new Error('WeakMap error');
    }

    finish(r); // We override the execution because return should always return the value passed in.

    r.execution = Promise.resolve(r.execution).then(() => value);
    return createIteration(r, consumeExecution(r));
  }

  throw(err) {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const r = records.get(this);

    if (r === undefined) {
      throw new Error('WeakMap error');
    }

    if (
      r.state <= Initial ||
      r.state >= Stopped ||
      (typeof r.buffer !== 'undefined' && !r.buffer.empty)
    ) {
      finish(r); // If r.err is already set, that mean the repeater has already produced an error, so we throw that error rather than the error passed in, because doing so might be more informative for the caller.

      if (r.err == null) {
        r.err = err;
      }

      return createIteration(r, consumeExecution(r));
    }

    return this.next(Promise.reject(err));
  }

  [Symbol.asyncIterator]() {
    return this;
  }
}

exports.Repeater = Repeater;
