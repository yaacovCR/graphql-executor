import { expect } from 'chai';
import { describe, it } from 'mocha';

import type { DocumentNode } from 'graphql';
import {
  GraphQLID,
  GraphQLList,
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
          id
        }
      }
    `);
    const result = await complete(document);

    expect(result).to.deep.equal([
      {
        data: {},
        hasNext: true,
      },
      {
        data: {
          hero: {
            id: '1',
          },
        },
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
          ...FriendIDFragment @defer(label: "DeferFriendID")
          ...FriendNameFragment @defer(label: "DeferFriendName")
        }
      }
      fragment FriendIDFragment on Friend {
        id
      }
      fragment FriendNameFragment on Friend {
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
          id: '2',
        },
        path: ['hero', 'friends', 0],
        label: 'DeferFriendID',
        hasNext: true,
      },
      {
        data: {
          name: 'Han',
        },
        path: ['hero', 'friends', 0],
        label: 'DeferFriendName',
        hasNext: true,
      },
      {
        data: {
          id: '3',
        },
        path: ['hero', 'friends', 1],
        label: 'DeferFriendID',
        hasNext: true,
      },
      {
        data: {
          name: 'Leia',
        },
        path: ['hero', 'friends', 1],
        label: 'DeferFriendName',
        hasNext: true,
      },
      {
        data: {
          id: '4',
        },
        path: ['hero', 'friends', 2],
        label: 'DeferFriendID',
        hasNext: true,
      },
      {
        data: {
          name: 'C-3PO',
        },
        path: ['hero', 'friends', 2],
        label: 'DeferFriendName',
        hasNext: false,
      },
    ]);
  });
});
