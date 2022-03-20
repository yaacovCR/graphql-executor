import { expect } from 'chai';
import { describe, it } from 'mocha';

import { Bundler } from '../bundler';

function createHarness() {
  const dataContext: { results: Array<unknown>; atIndices: Array<number> } = {
    results: [],
    atIndices: [],
  };
  const errorContext: { results: Array<unknown>; atIndices: Array<number> } = {
    results: [],
    atIndices: [],
  };

  const bundler = new Bundler<
    unknown,
    unknown,
    { atIndices: Array<number>; results: Array<unknown> },
    { atIndices: Array<number>; results: Array<unknown> }
  >({
    initialIndex: 0,
    maxBundleSize: 2,
    maxInterval: 50,
    createDataBundleContext: (index, result) => ({
      atIndices: [index],
      results: [result],
    }),
    createErrorBundleContext: (index, result) => ({
      atIndices: [index],
      results: [result],
    }),
    onSubsequentData: (index, result, context) => {
      context.atIndices.push(index);
      context.results.push(result);
    },
    onSubsequentError: (index, result, context) => {
      context.atIndices.push(index);
      context.results.push(result);
    },
    onDataBundle: (context) => {
      dataContext.results = context.results;
      dataContext.atIndices = context.atIndices;
    },
    onErrorBundle: (context) => {
      errorContext.results = context.results;
      errorContext.atIndices = context.atIndices;
    },
  });

  return {
    dataContext,
    errorContext,
    bundler,
  };
}

describe('Bundler', () => {
  it('bundles data and errors separately', () => {
    const { dataContext, errorContext, bundler } = createHarness();

    bundler.queueData(0, 0);
    expect(dataContext.results).to.deep.equal([]);

    bundler.queueData(1, 1);
    expect(dataContext.results).to.deep.equal([0, 1]);
    expect(dataContext.atIndices).to.deep.equal([0, 1]);

    bundler.queueError(2, 2);
    expect(errorContext.results).to.deep.equal([]);

    bundler.queueError(3, 3);
    expect(errorContext.results).to.deep.equal([2, 3]);
    expect(errorContext.atIndices).to.deep.equal([2, 3]);
  });

  it('bundles data correctly when out of order', () => {
    const { dataContext, errorContext, bundler } = createHarness();

    bundler.queueData(1, 1);
    bundler.queueData(0, 0);
    bundler.queueError(2, 2);
    bundler.queueError(3, 3);
    expect(dataContext.results).to.deep.equal([1, 0]);
    expect(dataContext.atIndices).to.deep.equal([1, 0]);
    expect(errorContext.results).to.deep.equal([2, 3]);
    expect(errorContext.atIndices).to.deep.equal([2, 3]);
  });

  it('bundles errors correctly when out of order', () => {
    const { dataContext, errorContext, bundler } = createHarness();

    bundler.queueData(0, 0);
    bundler.queueData(1, 1);
    bundler.queueError(3, 3);
    bundler.queueError(2, 2);
    expect(dataContext.results).to.deep.equal([0, 1]);
    expect(dataContext.atIndices).to.deep.equal([0, 1]);
    expect(errorContext.results).to.deep.equal([3, 2]);
    expect(errorContext.atIndices).to.deep.equal([3, 2]);
  });

  it('bundles correctly when completely out of order, data first', () => {
    const { dataContext, errorContext, bundler } = createHarness();

    bundler.queueError(3, 3);
    bundler.queueError(2, 2);
    bundler.queueData(1, 1);
    bundler.queueData(0, 0);
    expect(dataContext.results).to.deep.equal([1, 0]);
    expect(dataContext.atIndices).to.deep.equal([1, 0]);
    expect(errorContext.results).to.deep.equal([3, 2]);
    expect(errorContext.atIndices).to.deep.equal([3, 2]);
  });

  it('bundles correctly when out of order, errors first', () => {
    const { dataContext, errorContext, bundler } = createHarness();

    bundler.queueData(3, 3);
    bundler.queueData(2, 2);
    bundler.queueError(1, 1);
    bundler.queueError(0, 0);
    expect(dataContext.results).to.deep.equal([3, 2]);
    expect(dataContext.atIndices).to.deep.equal([3, 2]);
    expect(errorContext.results).to.deep.equal([1, 0]);
    expect(errorContext.atIndices).to.deep.equal([1, 0]);
  });

  it('shortens bundles when interval exceeded', async () => {
    const { dataContext, errorContext, bundler } = createHarness();

    bundler.queueData(0, 0);
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(dataContext.results).to.deep.equal([0]);
    expect(errorContext.results).to.deep.equal([]);

    bundler.queueError(1, 1);
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(dataContext.results).to.deep.equal([0]);
    expect(errorContext.results).to.deep.equal([1]);
  });

  it('shortens bundles when interval already exceeded', async () => {
    const { dataContext, errorContext, bundler } = createHarness();

    await new Promise((resolve) => setTimeout(resolve, 100));
    bundler.queueData(0, 0);
    expect(dataContext.results).to.deep.equal([0]);
    expect(errorContext.results).to.deep.equal([]);

    await new Promise((resolve) => setTimeout(resolve, 100));
    bundler.queueError(1, 1);
    expect(dataContext.results).to.deep.equal([0]);
    expect(errorContext.results).to.deep.equal([1]);
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

  it('shortens error bundle when a length is set', () => {
    const { dataContext, errorContext, bundler } = createHarness();

    bundler.setTotal(2);
    bundler.queueData(0, 0);
    bundler.queueError(1, 1);
    expect(dataContext.results).to.deep.equal([0]);
    expect(errorContext.results).to.deep.equal([1]);
  });

  it('shortens data bundle when a length is set', () => {
    const { dataContext, errorContext, bundler } = createHarness();

    bundler.setTotal(2);
    bundler.queueError(0, 0);
    bundler.queueData(1, 1);
    expect(errorContext.results).to.deep.equal([0]);
    expect(dataContext.results).to.deep.equal([1]);
  });

  it('shortens error bundle when a length is set after completion', () => {
    const { dataContext, errorContext, bundler } = createHarness();

    bundler.queueData(0, 0);
    bundler.queueError(1, 1);
    bundler.setTotal(2);
    expect(dataContext.results).to.deep.equal([0]);
    expect(errorContext.results).to.deep.equal([1]);
  });

  it('shortens data bundle when a length is set after completion', () => {
    const { dataContext, errorContext, bundler } = createHarness();

    bundler.queueError(0, 0);
    bundler.queueData(1, 1);
    bundler.setTotal(2);
    expect(errorContext.results).to.deep.equal([0]);
    expect(dataContext.results).to.deep.equal([1]);
  });
});
