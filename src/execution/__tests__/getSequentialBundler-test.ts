import { expect } from 'chai';
import { describe, it } from 'mocha';

import { Bundler } from '../bundler';
import { getSequentialBundler } from '../getSequentialBundler';

function createHarness() {
  const dataContext: { atIndex?: number; results: Array<unknown> } = {
    results: [],
  };
  const errorContext: { atIndex?: number; results: Array<unknown> } = {
    results: [],
  };

  const bundler = getSequentialBundler(
    0,
    new Bundler<
      unknown,
      unknown,
      { atIndex: number; results: Array<unknown> },
      { atIndex: number; results: Array<unknown> }
    >({
      initialIndex: 0,
      maxBundleSize: 2,
      maxInterval: null,
      createDataBundleContext: (index, result) => ({
        atIndex: index,
        results: [result],
      }),
      createErrorBundleContext: (index, result) => ({
        atIndex: index,
        results: [result],
      }),
      onSubsequentData: (_index, result, context) =>
        context.results.push(result),
      onSubsequentError: (_index, result, context) =>
        context.results.push(result),
      onDataBundle: (context) => {
        dataContext.atIndex = context.atIndex;
        dataContext.results = context.results;
      },
      onErrorBundle: (context) => {
        errorContext.atIndex = context.atIndex;
        errorContext.results = context.results;
      },
    }),
  );

  return {
    dataContext,
    errorContext,
    bundler,
  };
}

describe('getSequentialBundler', () => {
  it('bundles data and errors separately', () => {
    const { dataContext, errorContext, bundler } = createHarness();

    bundler.queueData(0, 0);
    expect(dataContext.atIndex).to.deep.equal(undefined);
    expect(dataContext.results).to.deep.equal([]);

    bundler.queueData(1, 1);
    expect(dataContext.atIndex).to.deep.equal(0);
    expect(dataContext.results).to.deep.equal([0, 1]);

    bundler.queueError(2, 2);
    expect(errorContext.atIndex).to.deep.equal(undefined);
    expect(errorContext.results).to.deep.equal([]);

    bundler.queueError(3, 3);
    expect(errorContext.atIndex).to.deep.equal(2);
    expect(errorContext.results).to.deep.equal([2, 3]);
  });

  it('bundles data correctly when out of order', () => {
    const { dataContext, errorContext, bundler } = createHarness();

    bundler.queueData(1, 1);
    bundler.queueData(0, 0);
    bundler.queueError(2, 2);
    bundler.queueError(3, 3);
    expect(dataContext.results).to.deep.equal([0, 1]);
    expect(errorContext.results).to.deep.equal([2, 3]);
  });

  it('bundles errors correctly when out of order', () => {
    const { dataContext, errorContext, bundler } = createHarness();

    bundler.queueData(0, 0);
    bundler.queueData(1, 1);
    bundler.queueError(3, 3);
    bundler.queueError(2, 2);
    expect(dataContext.results).to.deep.equal([0, 1]);
    expect(errorContext.results).to.deep.equal([2, 3]);
  });

  it('bundles correctly when completely out of order, data first', () => {
    const { dataContext, errorContext, bundler } = createHarness();

    bundler.queueError(3, 3);
    bundler.queueError(2, 2);
    bundler.queueData(1, 1);
    bundler.queueData(0, 0);
    expect(dataContext.results).to.deep.equal([0, 1]);
    expect(errorContext.results).to.deep.equal([2, 3]);
  });

  it('bundles correctly when out of order, errors first', () => {
    const { dataContext, errorContext, bundler } = createHarness();

    bundler.queueData(3, 3);
    bundler.queueData(2, 2);
    bundler.queueError(1, 1);
    bundler.queueError(0, 0);
    expect(dataContext.results).to.deep.equal([2, 3]);
    expect(errorContext.results).to.deep.equal([0, 1]);
  });

  it('shortens bundles when a bundle boundary is triggered', () => {
    const { dataContext, errorContext, bundler } = createHarness();

    bundler.queueData(0, 0);
    bundler.queueError(1, 1);
    expect(dataContext.results).to.deep.equal([0]);
    expect(errorContext.results).to.deep.equal([]);

    bundler.queueData(2, 2);
    expect(dataContext.results).to.deep.equal([0]);
    expect(errorContext.results).to.deep.equal([1]);

    bundler.queueError(3, 3);
    expect(dataContext.results).to.deep.equal([2]);
    expect(errorContext.results).to.deep.equal([1]);
  });

  it('shortens error bundle when a bundle boundary is triggered out of order', () => {
    const { dataContext, errorContext, bundler } = createHarness();

    bundler.queueData(2, 2);
    bundler.queueData(0, 0);
    expect(dataContext.results).to.deep.equal([]);
    expect(errorContext.results).to.deep.equal([]);

    bundler.queueError(1, 1);
    expect(dataContext.results).to.deep.equal([0]);
    expect(errorContext.results).to.deep.equal([1]);
  });

  it('shortens data bundle when a bundle boundary is triggered out of order', () => {
    const { dataContext, errorContext, bundler } = createHarness();

    bundler.queueError(2, 2);
    bundler.queueError(0, 0);
    expect(dataContext.results).to.deep.equal([]);
    expect(errorContext.results).to.deep.equal([]);

    bundler.queueData(1, 1);
    expect(dataContext.results).to.deep.equal([1]);
    expect(errorContext.results).to.deep.equal([0]);
  });

  it('shortens error bundle when a length is set', () => {
    const { dataContext, errorContext, bundler } = createHarness();

    bundler.setTotal(2);
    bundler.queueData(0, 0);
    bundler.queueError(1, 1);
    expect(dataContext.results).to.deep.equal([0]);
    expect(errorContext.results).to.deep.equal([1]);
  });

  it('shortens data bundle when a total is set', () => {
    const { dataContext, errorContext, bundler } = createHarness();

    bundler.setTotal(2);
    bundler.queueError(0, 0);
    bundler.queueData(1, 1);
    expect(errorContext.results).to.deep.equal([0]);
    expect(dataContext.results).to.deep.equal([1]);
  });

  it('shortens error bundle when a total is set after completion', () => {
    const { dataContext, errorContext, bundler } = createHarness();

    bundler.queueData(0, 0);
    bundler.queueError(1, 1);
    bundler.setTotal(2);
    expect(dataContext.results).to.deep.equal([0]);
    expect(errorContext.results).to.deep.equal([1]);
  });

  it('shortens data bundle when a total is set after completion', () => {
    const { dataContext, errorContext, bundler } = createHarness();

    bundler.queueError(0, 0);
    bundler.queueData(1, 1);
    bundler.setTotal(2);
    expect(errorContext.results).to.deep.equal([0]);
    expect(dataContext.results).to.deep.equal([1]);
  });
});
