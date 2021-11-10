import { expect } from 'chai';
import { describe, it } from 'mocha';

import { expectPromise } from '../../__testUtils__/expectPromise';

import { SimplePubSub } from './simplePubSub';

describe('SimplePubSub', () => {
  it('subscribe async-iterator mock', async () => {
    const pubsub = new SimplePubSub();
    const iterator = pubsub.getSubscriber((x) => x);

    // Queue up publishes
    expect(pubsub.emit('Apple')).to.equal(true);
    expect(pubsub.emit('Banana')).to.equal(true);

    // Read payloads
    expect(await iterator.next()).to.deep.equal({
      done: false,
      value: 'Apple',
    });
    expect(await iterator.next()).to.deep.equal({
      done: false,
      value: 'Banana',
    });

    // Read ahead
    const i3 = iterator.next();
    const i4 = iterator.next();

    // Publish
    expect(pubsub.emit('Coconut')).to.equal(true);
    expect(pubsub.emit('Durian')).to.equal(true);

    // Await out of order to get correct results
    expect(await i4).to.deep.equal({ done: false, value: 'Durian' });
    expect(await i3).to.deep.equal({ done: false, value: 'Coconut' });

    // Read ahead
    const i5 = iterator.next();

    // Terminate queue
    await iterator.return();

    // Publish is not caught after terminate
    expect(pubsub.emit('Fig')).to.equal(false);

    // Find that cancelled read-ahead got a "done" result
    expect(await i5).to.deep.equal({ done: true, value: undefined });

    // And next returns empty completion value
    expect(await iterator.next()).to.deep.equal({
      done: true,
      value: undefined,
    });
  });

  it('allows returning early', async () => {
    const pubsub = new SimplePubSub();
    // istanbul ignore next (Shouldn't be reached)
    const iterator = pubsub.getSubscriber((x) => x);

    // Read ahead
    const payload = iterator.next();

    // Return early
    expect(await iterator.return()).to.deep.equal({
      value: undefined,
      done: true,
    });

    // Publish is not caught after terminate
    expect(pubsub.emit('Apple')).to.equal(false);

    // Find that cancelled read-ahead got a "done" result
    expect(await payload).to.deep.equal({ done: true, value: undefined });

    // And next returns empty completion value
    expect(await iterator.next()).to.deep.equal({
      done: true,
      value: undefined,
    });
  });

  it('allows throwing into the iterator', async () => {
    const pubsub = new SimplePubSub();
    // istanbul ignore next (Shouldn't be reached)
    const iterator = pubsub.getSubscriber((x) => x);

    // Read ahead
    const payload = iterator.next();

    // Throw error into iterator
    const error = new Error('allows throwing into the iterator');
    await expectPromise(iterator.throw(error)).toRejectWith(error);

    // Publish is not caught after terminate
    expect(pubsub.emit('Apple')).to.equal(false);

    // Find that cancelled read-ahead got a "done" result
    expect(await payload).to.deep.equal({ done: true, value: undefined });

    // And next returns empty completion value
    expect(await iterator.next()).to.deep.equal({
      done: true,
      value: undefined,
    });
  });
});
