import { expect } from 'chai';
import { describe, it } from 'mocha';

import type { DocumentNode } from 'graphql';
import {
  GraphQLID,
  GraphQLList,
  GraphQLNonNull,
  GraphQLObjectType,
  GraphQLSchema,
  GraphQLString,
  parse,
} from 'graphql';

import { invariant } from '../../jsutils/invariant';
import { isAsyncIterable } from '../../jsutils/isAsyncIterable';

import { execute } from '../execute';
import { expectJSON } from '../../__testUtils__/expectJSON';

const friendType = new GraphQLObjectType({
  fields: {
    id: { type: new GraphQLNonNull(GraphQLID) },
    name: { type: GraphQLString },
    asyncName: {
      type: GraphQLString,
      resolve(rootValue) {
        return Promise.resolve(rootValue.name);
      },
    },
  },
  name: 'Friend',
});

const friends = [
  { name: 'Luke', id: 1 },
  { name: 'Han', id: 2 },
  { name: 'Leia', id: 3 },
];

const query = new GraphQLObjectType({
  fields: {
    scalarList: {
      type: new GraphQLList(GraphQLString),
      resolve: () => ['apple', 'banana', 'coconut'],
    },
    asyncList: {
      type: new GraphQLList(friendType),
      resolve: () => friends.map((f) => Promise.resolve(f)),
    },
    asyncListError: {
      type: new GraphQLList(friendType),
      resolve: () =>
        friends.map((f, i) => {
          if (i === 1) {
            return Promise.reject(new Error('bad'));
          }
          return Promise.resolve(f);
        }),
    },
    asyncIterableList: {
      type: new GraphQLList(friendType),
      async *resolve() {
        yield await Promise.resolve(friends[0]);
        yield await Promise.resolve(friends[1]);
        yield await Promise.resolve(friends[2]);
      },
    },
    asyncIterableError: {
      type: new GraphQLList(friendType),
      async *resolve() {
        yield await Promise.resolve(friends[0]);
        throw new Error('bad');
      },
    },
    asyncIterableInvalid: {
      type: new GraphQLList(GraphQLString),
      async *resolve() {
        yield await Promise.resolve(friends[0].name);
        yield await Promise.resolve({});
      },
    },
    asyncIterableListNestedError: {
      type: new GraphQLList(friendType),
      async *resolve() {
        yield await Promise.resolve(friends[0]);
        yield await Promise.resolve({ id: Promise.reject(new Error('bad')) });
        yield await Promise.resolve(friends[2]);
      },
    },
    asyncIterableListDelayed: {
      type: new GraphQLList(friendType),
      async *resolve() {
        for (const friend of friends) {
          // pause an additional ms before yielding to allow time
          // for tests to return or throw before next value is processed.
          // eslint-disable-next-line no-await-in-loop
          await new Promise((r) => setTimeout(r, 1));
          yield friend;
        }
      },
    },
    asyncIterableListNoReturn: {
      type: new GraphQLList(friendType),
      resolve() {
        let i = 0;
        return {
          [Symbol.asyncIterator]: () => ({
            async next() {
              const friend = friends[i++];
              if (friend) {
                await new Promise((r) => setTimeout(r, 1));
                return { value: friend, done: false };
              }
              return { value: undefined, done: true };
            },
          }),
        };
      },
    },
    asyncIterableListDelayedClose: {
      type: new GraphQLList(friendType),
      async *resolve() {
        for (const friend of friends) {
          yield friend;
        }
        await new Promise((r) => setTimeout(r, 1));
      },
    },
  },
  name: 'Query',
});

async function complete(document: DocumentNode, disableIncremental = false) {
  const schema = new GraphQLSchema({ query });

  const result = await execute({
    schema,
    document,
    rootValue: {},
    disableIncremental,
  });

  if (isAsyncIterable(result)) {
    const results = [];
    for await (const patch of result) {
      results.push(patch);
    }
    return results;
  }
  return result;
}

async function completeAsync(document: DocumentNode, numCalls: number) {
  const schema = new GraphQLSchema({ query });

  const result = await execute({ schema, document, rootValue: {} });

  invariant(isAsyncIterable(result));

  const iterator = result[Symbol.asyncIterator]();

  const promises = [];
  for (let i = 0; i < numCalls; i++) {
    promises.push(iterator.next());
  }
  return Promise.all(promises);
}

describe('Execute: stream directive', () => {
  it('Can stream a list field', async () => {
    const document = parse('{ scalarList @stream(initialCount: 1) }');
    const result = await complete(document);

    expect(result).to.deep.equal([
      {
        data: {
          scalarList: ['apple'],
        },
        hasNext: true,
      },
      {
        data: 'banana',
        path: ['scalarList', 1],
        hasNext: true,
      },
      {
        data: 'coconut',
        path: ['scalarList', 2],
        hasNext: false,
      },
    ]);
  });
  it('Can use default value of initialCount', async () => {
    const document = parse('{ scalarList @stream }');
    const result = await complete(document);

    expect(result).to.deep.equal([
      {
        data: {
          scalarList: [],
        },
        hasNext: true,
      },
      {
        data: 'apple',
        path: ['scalarList', 0],
        hasNext: true,
      },
      {
        data: 'banana',
        path: ['scalarList', 1],
        hasNext: true,
      },
      {
        data: 'coconut',
        path: ['scalarList', 2],
        hasNext: false,
      },
    ]);
  });
  it('Returns label from stream directive', async () => {
    const document = parse(
      '{ scalarList @stream(initialCount: 1, label: "scalar-stream") }',
    );
    const result = await complete(document);

    expect(result).to.deep.equal([
      {
        data: {
          scalarList: ['apple'],
        },
        hasNext: true,
      },
      {
        data: 'banana',
        path: ['scalarList', 1],
        label: 'scalar-stream',
        hasNext: true,
      },
      {
        data: 'coconut',
        path: ['scalarList', 2],
        label: 'scalar-stream',
        hasNext: false,
      },
    ]);
  });
  it('Can disable @stream using disableIncremental argument', async () => {
    const document = parse('{ scalarList @stream(initialCount: 0) }');
    const result = await complete(document, true);

    expect(result).to.deep.equal({
      data: { scalarList: ['apple', 'banana', 'coconut'] },
    });
  });
  it('Can disable @stream using if argument', async () => {
    const document = parse(
      '{ scalarList @stream(initialCount: 0, if: false) }',
    );
    const result = await complete(document);

    expect(result).to.deep.equal({
      data: { scalarList: ['apple', 'banana', 'coconut'] },
    });
  });
  it('Can stream a field that returns a list of promises', async () => {
    const document = parse(`
      query { 
        asyncList @stream(initialCount: 2) {
          name
          id
        }
      }
    `);
    const result = await complete(document);
    expect(result).to.deep.equal([
      {
        data: {
          asyncList: [
            {
              name: 'Luke',
              id: '1',
            },
            {
              name: 'Han',
              id: '2',
            },
          ],
        },
        hasNext: true,
      },
      {
        data: {
          name: 'Leia',
          id: '3',
        },
        path: ['asyncList', 2],
        hasNext: false,
      },
    ]);
  });
  it('Handles rejections in a field that returns a list of promises before initialCount is reached', async () => {
    const document = parse(`
      query { 
        asyncListError @stream(initialCount: 2) {
          name
          id
        }
      }
    `);
    const result = await complete(document);
    expectJSON(result).toDeepEqual([
      {
        errors: [
          {
            message: 'bad',
            locations: [
              {
                line: 3,
                column: 9,
              },
            ],
            path: ['asyncListError', 1],
          },
        ],
        data: {
          asyncListError: [
            {
              name: 'Luke',
              id: '1',
            },
            null,
          ],
        },
        hasNext: true,
      },
      {
        data: {
          name: 'Leia',
          id: '3',
        },
        path: ['asyncListError', 2],
        hasNext: false,
      },
    ]);
  });
  it('Handles rejections in a field that returns a list of promises after initialCount is reached', async () => {
    const document = parse(`
      query { 
        asyncListError @stream(initialCount: 1) {
          name
          id
        }
      }
    `);
    const result = await complete(document);
    expectJSON(result).toDeepEqual([
      {
        data: {
          asyncListError: [
            {
              name: 'Luke',
              id: '1',
            },
          ],
        },
        hasNext: true,
      },
      {
        data: null,
        path: ['asyncListError', 1],
        errors: [
          {
            message: 'bad',
            locations: [
              {
                line: 3,
                column: 9,
              },
            ],
            path: ['asyncListError', 1],
          },
        ],
        hasNext: true,
      },
      {
        data: {
          name: 'Leia',
          id: '3',
        },
        path: ['asyncListError', 2],
        hasNext: false,
      },
    ]);
  });
  it('Can stream a field that returns an async iterable', async () => {
    const document = parse(`
      query { 
        asyncIterableList @stream {
          name
          id
        }
      }
    `);
    const result = await complete(document);
    expect(result).to.deep.equal([
      {
        data: {
          asyncIterableList: [],
        },
        hasNext: true,
      },
      {
        data: {
          name: 'Luke',
          id: '1',
        },
        path: ['asyncIterableList', 0],
        hasNext: true,
      },
      {
        data: {
          name: 'Han',
          id: '2',
        },
        path: ['asyncIterableList', 1],
        hasNext: true,
      },
      {
        data: {
          name: 'Leia',
          id: '3',
        },
        path: ['asyncIterableList', 2],
        hasNext: false,
      },
    ]);
  });
  it('Can stream a field that returns an async iterable, using a non-zero initialCount', async () => {
    const document = parse(`
      query { 
        asyncIterableList @stream(initialCount: 2) {
          name
          id
        }
      }
    `);
    const result = await complete(document);
    expect(result).to.deep.equal([
      {
        data: {
          asyncIterableList: [
            {
              name: 'Luke',
              id: '1',
            },
            {
              name: 'Han',
              id: '2',
            },
          ],
        },
        hasNext: true,
      },
      {
        data: {
          name: 'Leia',
          id: '3',
        },
        path: ['asyncIterableList', 2],
        hasNext: false,
      },
    ]);
  });
  it('Can stream a field that returns an async iterable', async () => {
    const document = parse(`
      query { 
        asyncIterableList @stream(initialCount: 2) {
          name
          id
        }
      }
    `);
    const result = await completeAsync(document, 4);
    expect(result).to.deep.equal([
      {
        done: false,
        value: {
          data: {
            asyncIterableList: [
              {
                name: 'Luke',
                id: '1',
              },
              {
                name: 'Han',
                id: '2',
              },
            ],
          },
          hasNext: true,
        },
      },
      {
        done: false,
        value: {
          data: {
            name: 'Leia',
            id: '3',
          },
          path: ['asyncIterableList', 2],
          hasNext: false,
        },
      },
      {
        done: true,
        value: undefined,
      },
      {
        done: true,
        value: undefined,
      },
    ]);
  });
  it('Handles error thrown in async iterable before initialCount is reached', async () => {
    const document = parse(`
      query { 
        asyncIterableError @stream(initialCount: 2) {
          name
          id
        }
      }
    `);
    const result = await complete(document);
    expectJSON(result).toDeepEqual({
      errors: [
        {
          message: 'bad',
          locations: [
            {
              line: 3,
              column: 9,
            },
          ],
          path: ['asyncIterableError', 1],
        },
      ],
      data: {
        asyncIterableError: [
          {
            name: 'Luke',
            id: '1',
          },
          null,
        ],
      },
    });
  });
  it('Handles error thrown in async iterable after initialCount is reached', async () => {
    const document = parse(`
      query { 
        asyncIterableError @stream(initialCount: 1) {
          name
          id
        }
      }
    `);
    const result = await complete(document);
    expectJSON(result).toDeepEqual([
      {
        data: {
          asyncIterableError: [
            {
              name: 'Luke',
              id: '1',
            },
          ],
        },
        hasNext: true,
      },
      {
        data: null,
        path: ['asyncIterableError', 1],
        errors: [
          {
            message: 'bad',
            locations: [
              {
                line: 3,
                column: 9,
              },
            ],
            path: ['asyncIterableError', 1],
          },
        ],
        hasNext: false,
      },
    ]);
  });
  it('Handles errors thrown by completeValue after initialCount is reached', async () => {
    const document = parse(`
      query { 
        asyncIterableInvalid @stream(initialCount: 1)
      }
    `);
    const result = await complete(document);
    expectJSON(result).toDeepEqual([
      {
        data: {
          asyncIterableInvalid: ['Luke'],
        },
        hasNext: true,
      },
      {
        data: null,
        path: ['asyncIterableInvalid', 1],
        errors: [
          {
            message: 'String cannot represent value: {}',
            locations: [
              {
                line: 3,
                column: 9,
              },
            ],
            path: ['asyncIterableInvalid', 1],
          },
        ],
        hasNext: false,
      },
    ]);
  });

  it('Handles promises returned by completeValue after initialCount is reached', async () => {
    const document = parse(`
      query { 
        asyncIterableList @stream(initialCount: 1) {
          name
          asyncName
        }
      }
    `);
    const result = await complete(document);
    expect(result).to.deep.equal([
      {
        data: {
          asyncIterableList: [
            {
              name: 'Luke',
              asyncName: 'Luke',
            },
          ],
        },
        hasNext: true,
      },
      {
        data: {
          name: 'Han',
          asyncName: 'Han',
        },
        path: ['asyncIterableList', 1],
        hasNext: true,
      },
      {
        data: {
          name: 'Leia',
          asyncName: 'Leia',
        },
        path: ['asyncIterableList', 2],
        hasNext: false,
      },
    ]);
  });

  it('Handles rejected promises returned by completeValue after initialCount is reached', async () => {
    const document = parse(`
      query { 
        asyncIterableListNestedError @stream(initialCount: 1) {
          id
          name
        }
      }
    `);
    const result = await complete(document);
    expectJSON(result).toDeepEqual([
      {
        data: {
          asyncIterableListNestedError: [
            {
              id: '1',
              name: 'Luke',
            },
          ],
        },
        hasNext: true,
      },
      {
        data: {
          id: '3',
          name: 'Leia',
        },
        path: ['asyncIterableListNestedError', 2],
        hasNext: true,
      },
      {
        errors: [
          {
            message: 'bad',
            locations: [
              {
                line: 4,
                column: 11,
              },
            ],
            path: ['asyncIterableListNestedError', 1, 'id'],
          },
        ],
        data: null,
        path: ['asyncIterableListNestedError', 1],
        hasNext: false,
      },
    ]);
  });

  it('Can @defer fields that are resolved after async iterable is complete', async () => {
    const document = parse(`
    query { 
      asyncIterableList @stream(initialCount: 1, label:"stream-label") {
        ...NameFragment @defer(label: "DeferName") @defer(label: "DeferName")
        id
      }
    }
    fragment NameFragment on Friend {
      name
    }
  `);
    const result = await complete(document);
    expect(result).to.deep.equal([
      {
        data: {
          asyncIterableList: [
            {
              id: '1',
            },
          ],
        },
        hasNext: true,
      },
      {
        data: {
          name: 'Luke',
        },
        path: ['asyncIterableList', 0],
        label: 'DeferName',
        hasNext: true,
      },
      {
        data: {
          name: 'Han',
        },
        path: ['asyncIterableList', 1],
        label: 'DeferName',
        hasNext: true,
      },
      {
        data: {
          id: '2',
        },
        path: ['asyncIterableList', 1],
        label: 'stream-label',
        hasNext: true,
      },
      {
        data: {
          name: 'Leia',
        },
        path: ['asyncIterableList', 2],
        label: 'DeferName',
        hasNext: true,
      },
      {
        data: {
          id: '3',
        },
        path: ['asyncIterableList', 2],
        label: 'stream-label',
        hasNext: false,
      },
    ]);
  });
  it('Can @defer fields that are resolved before async iterable is complete', async () => {
    const document = parse(`
    query { 
      asyncIterableListDelayedClose @stream(initialCount: 1, label:"stream-label") {
        ...NameFragment @defer(label: "DeferName") @defer(label: "DeferName")
        id
      }
    }
    fragment NameFragment on Friend {
      name
    }
  `);
    const result = await complete(document);
    expect(result).to.deep.equal([
      {
        data: {
          asyncIterableListDelayedClose: [
            {
              id: '1',
            },
          ],
        },
        hasNext: true,
      },
      {
        data: {
          name: 'Luke',
        },
        path: ['asyncIterableListDelayedClose', 0],
        label: 'DeferName',
        hasNext: true,
      },
      {
        data: {
          name: 'Han',
        },
        path: ['asyncIterableListDelayedClose', 1],
        label: 'DeferName',
        hasNext: true,
      },
      {
        data: {
          id: '2',
        },
        path: ['asyncIterableListDelayedClose', 1],
        label: 'stream-label',
        hasNext: true,
      },
      {
        data: {
          name: 'Leia',
        },
        path: ['asyncIterableListDelayedClose', 2],
        label: 'DeferName',
        hasNext: true,
      },
      {
        data: {
          id: '3',
        },
        path: ['asyncIterableListDelayedClose', 2],
        label: 'stream-label',
        hasNext: true,
      },
      {
        hasNext: false,
      },
    ]);
  });
  it('Returns underlying async iterables when dispatcher is returned', async () => {
    const document = parse(`
      query { 
        asyncIterableListDelayed @stream(initialCount: 1) {
          name
          id
        }
      }
    `);
    const schema = new GraphQLSchema({ query });

    const executeResult = await execute({ schema, document, rootValue: {} });
    invariant(isAsyncIterable(executeResult));
    const iterator = executeResult[Symbol.asyncIterator]();

    const result1 = await iterator.next();
    expect(result1).to.deep.equal({
      done: false,
      value: {
        data: {
          asyncIterableListDelayed: [
            {
              id: '1',
              name: 'Luke',
            },
          ],
        },
        hasNext: true,
      },
    });

    iterator.return?.();

    // all calls to return and next settle in call order
    const result2 = await iterator.next();
    expect(result2).to.deep.equal({
      done: true,
      value: undefined,
    });
  });
  it('Can return async iterable when underlying iterable does not have a return method', async () => {
    const document = parse(`
      query { 
        asyncIterableListNoReturn @stream(initialCount: 1) {
          name
          id
        }
      }
    `);
    const schema = new GraphQLSchema({ query });

    const executeResult = await execute({ schema, document, rootValue: {} });
    invariant(isAsyncIterable(executeResult));
    const iterator = executeResult[Symbol.asyncIterator]();

    const result1 = await iterator.next();
    expect(result1).to.deep.equal({
      done: false,
      value: {
        data: {
          asyncIterableListNoReturn: [
            {
              id: '1',
              name: 'Luke',
            },
          ],
        },
        hasNext: true,
      },
    });

    iterator.return?.();

    // all calls to return and next settle in call order
    const result2 = await iterator.next();
    expect(result2).to.deep.equal({
      done: true,
      value: undefined,
    });
  });
  it('Returns underlying async iterables when dispatcher is thrown', async () => {
    const document = parse(`
      query { 
        asyncIterableListDelayed @stream(initialCount: 1) {
          name
          id
        }
      }
    `);
    const schema = new GraphQLSchema({ query });

    const executeResult = await execute({ schema, document, rootValue: {} });
    invariant(isAsyncIterable(executeResult));
    const iterator = executeResult[Symbol.asyncIterator]();

    const result1 = await iterator.next();
    expect(result1).to.deep.equal({
      done: false,
      value: {
        data: {
          asyncIterableListDelayed: [
            {
              id: '1',
              name: 'Luke',
            },
          ],
        },
        hasNext: true,
      },
    });

    iterator.throw?.(new Error('bad'));

    // all calls to throw and next settle in call order
    const result2 = await iterator.next();
    expect(result2).to.deep.equal({
      done: true,
      value: undefined,
    });
  });
});
