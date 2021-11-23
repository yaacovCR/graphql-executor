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

import { isAsyncIterable } from '../../jsutils/isAsyncIterable';

import { execute } from '../execute';
import { expectJSON } from '../../__testUtils__/expectJSON';

const friendType = new GraphQLObjectType({
  fields: {
    id: { type: GraphQLID },
    name: { type: GraphQLString },
  },
  name: 'Friend',
});

const friends = [
  { name: 'Han', id: 2 },
  { name: 'Leia', id: 3 },
  { name: 'C-3PO', id: 4 },
];

const heroType = new GraphQLObjectType({
  fields: {
    id: { type: GraphQLID },
    name: { type: GraphQLString },
    delayedName: {
      type: GraphQLString,
      async resolve(rootValue) {
        await new Promise((r) => setTimeout(r, 1));
        return rootValue.name;
      },
    },
    errorField: {
      type: GraphQLString,
      resolve: () => {
        throw new Error('bad');
      },
    },
    nonNullErrorField: {
      type: new GraphQLNonNull(GraphQLString),
      resolve: () => null,
    },
    promiseNonNullErrorField: {
      type: new GraphQLNonNull(GraphQLString),
      resolve: () => Promise.resolve(null),
    },
    friends: {
      type: new GraphQLList(friendType),
      resolve: () => friends,
    },
  },
  name: 'Hero',
});

const hero = { name: 'Luke', id: 1 };

const query = new GraphQLObjectType({
  fields: {
    hero: {
      type: heroType,
      resolve: () => hero,
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

describe('Execute: defer directive', () => {
  it('Can defer fragments containing scalar types', async () => {
    const document = parse(`
      query HeroNameQuery {
        hero {
          id
          ...NameFragment @defer
        }
      }
      fragment NameFragment on Hero {
        id
        name
      }
    `);
    const result = await complete(document);

    expect(result).to.deep.equal([
      {
        data: {
          hero: {
            id: '1',
          },
        },
        hasNext: true,
      },
      {
        data: {
          id: '1',
          name: 'Luke',
        },
        path: ['hero'],
        hasNext: false,
      },
    ]);
  });
  it('Can disable defer using disableIncremental argument', async () => {
    const document = parse(`
      query HeroNameQuery {
        hero {
          id
          ...NameFragment @defer
        }
      }
      fragment NameFragment on Hero {
        name
      }
    `);
    const result = await complete(document, true);

    expect(result).to.deep.equal({
      data: {
        hero: {
          id: '1',
          name: 'Luke',
        },
      },
    });
  });
  it('Can disable defer using if argument', async () => {
    const document = parse(`
      query HeroNameQuery {
        hero {
          id
          ...NameFragment @defer(if: false)
        }
      }
      fragment NameFragment on Hero {
        name
      }
    `);
    const result = await complete(document);

    expect(result).to.deep.equal({
      data: {
        hero: {
          id: '1',
          name: 'Luke',
        },
      },
    });
  });
  it('Can defer fragments containing on the top level Query field', async () => {
    const document = parse(`
      query HeroNameQuery {
        ...QueryFragment @defer(label: "DeferQuery")
      }
      fragment QueryFragment on Query {
        hero {
          errorField
        }
      }
    `);
    const result = await complete(document);

    expectJSON(result).toDeepEqual([
      {
        data: {},
        hasNext: true,
      },
      {
        data: {
          hero: {
            errorField: null,
          },
        },
        errors: [
          {
            message: 'bad',
            locations: [{ line: 7, column: 11 }],
            path: ['hero', 'errorField'],
          },
        ],
        path: [],
        label: 'DeferQuery',
        hasNext: false,
      },
    ]);
  });
  it('Can defer a fragment within an already deferred fragment', async () => {
    const document = parse(`
      query HeroNameQuery {
        hero {
          id
          ...TopFragment @defer(label: "DeferTop")
        }
      }
      fragment TopFragment on Hero {
        name
        ...NestedFragment @defer(label: "DeferNested")
      }
      fragment NestedFragment on Hero {
        friends {
          name
        }
      }
    `);
    const result = await complete(document);

    expect(result).to.deep.equal([
      {
        data: {
          hero: {
            id: '1',
          },
        },
        hasNext: true,
      },
      {
        data: {
          friends: [{ name: 'Han' }, { name: 'Leia' }, { name: 'C-3PO' }],
        },
        path: ['hero'],
        label: 'DeferNested',
        hasNext: true,
      },
      {
        data: {
          name: 'Luke',
        },
        path: ['hero'],
        label: 'DeferTop',
        hasNext: false,
      },
    ]);
  });
  it('Can defer an inline fragment', async () => {
    const document = parse(`
      query HeroNameQuery {
        hero {
          id
          ... on Hero @defer(label: "InlineDeferred") {
            name
          }
        }
      }
    `);
    const result = await complete(document);

    expect(result).to.deep.equal([
      {
        data: { hero: { id: '1' } },
        hasNext: true,
      },
      {
        data: { name: 'Luke' },
        path: ['hero'],
        label: 'InlineDeferred',
        hasNext: false,
      },
    ]);
  });
  it('Handles errors thrown in deferred fragments', async () => {
    const document = parse(`
      query HeroNameQuery {
        hero {
          id
          ...NameFragment @defer
        }
      }
      fragment NameFragment on Hero {
        errorField
      }
    `);
    const result = await complete(document);

    expectJSON(result).toDeepEqual([
      {
        data: { hero: { id: '1' } },
        hasNext: true,
      },
      {
        data: { errorField: null },
        path: ['hero'],
        errors: [
          {
            message: 'bad',
            locations: [{ line: 9, column: 9 }],
            path: ['hero', 'errorField'],
          },
        ],
        hasNext: false,
      },
    ]);
  });
  it('Handles non-nullable errors thrown in deferred fragments', async () => {
    const document = parse(`
      query HeroNameQuery {
        hero {
          id
          ...NameFragment @defer
        }
      }
      fragment NameFragment on Hero {
        nonNullErrorField
      }
    `);
    const result = await complete(document);
    expectJSON(result).toDeepEqual([
      {
        data: { hero: { id: '1' } },
        hasNext: true,
      },
      {
        data: null,
        path: ['hero'],
        errors: [
          {
            message:
              'Cannot return null for non-nullable field Hero.nonNullErrorField.',
            locations: [{ line: 9, column: 9 }],
            path: ['hero', 'nonNullErrorField'],
          },
        ],
        hasNext: false,
      },
    ]);
  });
  it('Handles async non-nullable errors thrown in deferred fragments', async () => {
    const document = parse(`
      query HeroNameQuery {
        hero {
          id
          ...NameFragment @defer
        }
      }
      fragment NameFragment on Hero {
        promiseNonNullErrorField
      }
    `);
    const result = await complete(document);
    expectJSON(result).toDeepEqual([
      {
        data: { hero: { id: '1' } },
        hasNext: true,
      },
      {
        data: null,
        path: ['hero'],
        errors: [
          {
            message:
              'Cannot return null for non-nullable field Hero.promiseNonNullErrorField.',
            locations: [{ line: 9, column: 9 }],
            path: ['hero', 'promiseNonNullErrorField'],
          },
        ],
        hasNext: false,
      },
    ]);
  });
  it('Can defer fragments at multiple levels, returning fragments in path order', async () => {
    const document = parse(`
      query HeroNameQuery {
        hero {
          ...HeroFragment @defer(label: "DeferHero")
        }
      }
      fragment HeroFragment on Hero {
        delayedName
        friends {
          ...FriendFragment @defer(label: "DeferFriend")
        }
      }
      fragment FriendFragment on Friend {
        name
      }
    `);
    const result = await complete(document);

    expect(result).to.deep.equal([
      {
        data: {
          hero: {},
        },
        hasNext: true,
      },
      {
        data: {
          delayedName: 'Luke',
          friends: [{}, {}, {}],
        },
        path: ['hero'],
        label: 'DeferHero',
        hasNext: true,
      },
      {
        data: {
          name: 'Han',
        },
        path: ['hero', 'friends', 0],
        label: 'DeferFriend',
        hasNext: true,
      },
      {
        data: {
          name: 'Leia',
        },
        path: ['hero', 'friends', 1],
        label: 'DeferFriend',
        hasNext: true,
      },
      {
        data: {
          name: 'C-3PO',
        },
        path: ['hero', 'friends', 2],
        label: 'DeferFriend',
        hasNext: false,
      },
    ]);
  });
});
