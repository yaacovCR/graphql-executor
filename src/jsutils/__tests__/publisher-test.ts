import { expect } from 'chai';
import { describe, it } from 'mocha';

import { Publisher } from '../publisher';

describe('publisher', () => {
  it('works for initial payload pushed prior to subscribe', async () => {
    const publisher = new Publisher();
    publisher.emit({}, 1);
    const iterator = publisher.subscribe();
    expect(await iterator.next()).to.deep.equal({
      done: false,
      value: 1,
    });
  });

  it('works for subsequent payloads', async () => {
    const publisher = new Publisher();
    publisher.emit({}, 1);
    publisher.emit({}, 2);
    const iterator = publisher.subscribe();
    expect(await iterator.next()).to.deep.equal({
      done: false,
      value: 1,
    });
    expect(await iterator.next()).to.deep.equal({
      done: false,
      value: 2,
    });
  });

  it('works for subsequent payloads dependent on root payload', async () => {
    const rootKey = {};
    const publisher = new Publisher();
    publisher.emit(rootKey, 1);
    publisher.queue({}, 2, rootKey);

    const iterator = publisher.subscribe();
    expect(await iterator.next()).to.deep.equal({
      done: false,
      value: 1,
    });
    expect(await iterator.next()).to.deep.equal({
      done: false,
      value: 2,
    });
  });

  it('works for subsequent payloads dependent on non-root parent payload', async () => {
    const rootKey = {};
    const publisher = new Publisher();
    publisher.emit(rootKey, 1);
    const childKey = {};
    publisher.queue({}, 3, childKey);
    publisher.queue({}, 4, childKey);
    publisher.queue(childKey, 2, rootKey);

    const iterator = publisher.subscribe();
    expect(await iterator.next()).to.deep.equal({
      done: false,
      value: 1,
    });
    expect(await iterator.next()).to.deep.equal({
      done: false,
      value: 2,
    });
    expect(await iterator.next()).to.deep.equal({
      done: false,
      value: 3,
    });
    expect(await iterator.next()).to.deep.equal({
      done: false,
      value: 4,
    });
  });

  it('works for multiple payloads with onReady, hasNext and onStop parameters', async () => {
    let count = 0;
    const onReady = () => count++;
    const hasNext = () => count < 3;
    let stopped = false;
    const onStop = () => {
      stopped = true;
    };
    const rootKey = {};
    const publisher = new Publisher({
      payloadFromSource: (source, _hasNext) => (_hasNext ? source : undefined),
      onReady,
      hasNext,
      onStop,
    });
    publisher.emit(rootKey, 1);
    const childKey = {};
    publisher.queue({}, 3, childKey);
    publisher.queue({}, 4, childKey);
    publisher.queue(childKey, 2, rootKey);

    const iterator = publisher.subscribe();
    expect(await iterator.next()).to.deep.equal({
      done: false,
      value: 1,
    });
    expect(await iterator.next()).to.deep.equal({
      done: false,
      value: 2,
    });
    expect(await iterator.next()).to.deep.equal({
      done: false,
      value: 3,
    });
    expect(await iterator.next()).to.deep.equal({
      done: false,
      value: undefined,
    });
    expect(await iterator.next()).to.deep.equal({
      done: true,
      value: undefined,
    });
    expect(stopped).to.equal(true);
  });
});
