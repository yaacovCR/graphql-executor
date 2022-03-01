import { expect } from 'chai';
import { describe, it } from 'mocha';

import { expectPromise } from '../../__testUtils__/expectPromise';

import { flattenAsyncIterable } from '../flattenAsyncIterable';

describe('flattenAsyncIterable', () => {
  it('does not modify an already flat async generator', async () => {
    async function* source() {
      yield await Promise.resolve(1);
      yield await Promise.resolve(2);
      yield await Promise.resolve(3);
    }

    const result = flattenAsyncIterable(source(), (item) => item);

    expect(await result.next()).to.deep.equal({ value: 1, done: false });
    expect(await result.next()).to.deep.equal({ value: 2, done: false });
    expect(await result.next()).to.deep.equal({ value: 3, done: false });
    expect(await result.next()).to.deep.equal({
      value: undefined,
      done: true,
    });
  });

  it('does not modify an already flat async iterator', async () => {
    const items = [1, 2, 3];

    const iterator: any = {
      [Symbol.asyncIterator]() {
        return this;
      },
      next() {
        return Promise.resolve({
          done: items.length === 0,
          value: items.shift(),
        });
      },
    };

    const result = flattenAsyncIterable(iterator, (item) => item);

    expect(await result.next()).to.deep.equal({ value: 1, done: false });
    expect(await result.next()).to.deep.equal({ value: 2, done: false });
    expect(await result.next()).to.deep.equal({ value: 3, done: false });
    expect(await result.next()).to.deep.equal({
      value: undefined,
      done: true,
    });
  });

  it('flatten nested async generators', async () => {
    async function* source() {
      yield await Promise.resolve(1);
      yield await Promise.resolve(2);
      yield await Promise.resolve(nested());
      yield await Promise.resolve(3);
    }

    async function* nested(): AsyncGenerator<number, void, void> {
      yield await Promise.resolve(2.1);
      yield await Promise.resolve(2.2);
    }

    const doubles = flattenAsyncIterable(source(), (item) => item);

    const result = [];
    for await (const x of doubles) {
      result.push(x);
    }
    expect(result).to.deep.equal([1, 2, 2.1, 2.2, 3]);
  });

  it('allows returning early from a nested async generator inside an iterator', async () => {
    let items = [1, 2, nested()];

    async function* nested(): AsyncGenerator<number, void, void> {
      yield await Promise.resolve(2.1); /* c8 ignore start */
      yield await Promise.resolve(2.2);
    } /* c8 ignore stop */

    const iterator: any = {
      [Symbol.asyncIterator]() {
        return this;
      },
      return() {
        items = [];
        return { done: true, value: undefined };
      },
      next() {
        return Promise.resolve({
          done: items.length === 0,
          value: items.shift(),
        });
      },
    };

    const result = flattenAsyncIterable(iterator, (item) => item);

    expect(await result.next()).to.deep.equal({ value: 1, done: false });
    expect(await result.next()).to.deep.equal({ value: 2, done: false });
    expect(await result.next()).to.deep.equal({ value: 2.1, done: false });

    // Early return
    expect(await result.return()).to.deep.equal({
      value: undefined,
      done: true,
    });

    // Subsequent next calls
    expect(await result.next()).to.deep.equal({
      value: undefined,
      done: true,
    });
    expect(await result.next()).to.deep.equal({
      value: undefined,
      done: true,
    });
  });

  it('allows returning early from a nested async generator', async () => {
    let didVisitFinally = false;

    async function* source() {
      try {
        yield await Promise.resolve(1);
        yield await Promise.resolve(2);
        yield await Promise.resolve(nested()); /* c8 ignore start */
        yield await Promise.resolve(3); /* c8 ignore stop */
      } finally {
        didVisitFinally = true;
        yield await Promise.resolve(4); /* c8 ignore start */
      } /* c8 ignore stop */
    }

    let didVisitNestedFinally = true;
    async function* nested(): AsyncGenerator<number, void, void> {
      try {
        yield await Promise.resolve(2.1); /* c8 ignore start */
        yield await Promise.resolve(2.2); /* c8 ignore stop */
      } finally {
        didVisitNestedFinally = true;
        yield await Promise.resolve(2.3); /* c8 ignore next */
      }
    }

    const doubles = flattenAsyncIterable(source(), (item) => item);

    expect(await doubles.next()).to.deep.equal({ value: 1, done: false });
    expect(await doubles.next()).to.deep.equal({ value: 2, done: false });
    expect(await doubles.next()).to.deep.equal({ value: 2.1, done: false });

    // Early return
    expect(await doubles.return()).to.deep.equal({
      value: undefined,
      done: true,
    });

    // Subsequent next calls
    expect(await doubles.next()).to.deep.equal({
      value: undefined,
      done: true,
    });
    expect(await doubles.next()).to.deep.equal({
      value: undefined,
      done: true,
    });

    expect(didVisitFinally).to.equal(true);
    expect(didVisitNestedFinally).to.equal(true);
  });

  it('allows throwing errors from a nested async generator', async () => {
    async function* source() {
      yield await Promise.resolve(1);
      yield await Promise.resolve(2);
      yield await Promise.resolve(nested()); /* c8 ignore start */
      yield await Promise.resolve(3);
    } /* c8 ignore stop */

    async function* nested(): AsyncGenerator<number, void, void> {
      yield await Promise.resolve(2.1); /* c8 ignore start */
      yield await Promise.resolve(2.2);
    } /* c8 ignore stop */
    const doubles = flattenAsyncIterable(source(), (item) => item);

    expect(await doubles.next()).to.deep.equal({ value: 1, done: false });
    expect(await doubles.next()).to.deep.equal({ value: 2, done: false });
    expect(await doubles.next()).to.deep.equal({ value: 2.1, done: false });

    // Throw error
    const error = new Error(
      'allows throwing errors from a nested async generator',
    );
    await expectPromise(doubles.throw(error)).toRejectWith(error);
  });
});
