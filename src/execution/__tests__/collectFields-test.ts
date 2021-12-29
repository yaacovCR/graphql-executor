import { expect } from 'chai';
import { describe, it } from 'mocha';

import type { FragmentDefinitionNode, OperationDefinitionNode } from 'graphql';
import {
  GraphQLID,
  GraphQLList,
  GraphQLObjectType,
  GraphQLSchema,
  GraphQLString,
  parse,
} from 'graphql';

import { collectFields } from '../collectFields';

const friendType = new GraphQLObjectType({
  fields: {
    id: { type: GraphQLID },
    name: { type: GraphQLString },
  },
  name: 'Friend',
});

const heroType = new GraphQLObjectType({
  fields: {
    id: { type: GraphQLID },
    name: { type: GraphQLString },
    friends: {
      type: new GraphQLList(friendType),
    },
  },
  name: 'Hero',
});

const query = new GraphQLObjectType({
  fields: {
    hero: {
      type: heroType,
    },
  },
  name: 'Query',
});

const schema = new GraphQLSchema({ query });

const document = parse(`
query HeroQuery($skipFirst: Boolean, $skipSecond: Boolean) {
  hero {
    name
  }
  ...HeroFragment1 @skip(if: $skipFirst)
  ...HeroFragment2 @skip(if: $skipSecond)
}
fragment HeroFragment1 on Query {
  hero {
    name
  }
}
fragment HeroFragment2 on Query {
  hero {
    name
  }
}
`);

const selectionSet = (document.definitions[0] as OperationDefinitionNode)
  .selectionSet;
const fragments = {
  HeroFragment1: document.definitions[1] as FragmentDefinitionNode,
  HeroFragment2: document.definitions[2] as FragmentDefinitionNode,
};

describe('collectFields', () => {
  it('memoizes', () => {
    const { fields: fields1 } = collectFields(
      schema,
      fragments,
      {
        skipFirst: false,
        skipSecond: false,
      },
      query,
      selectionSet,
    );
    const { fields: fields2 } = collectFields(
      schema,
      fragments,
      {
        skipFirst: false,
        skipSecond: false,
      },
      query,
      selectionSet,
    );

    const heroFieldNodes1 = fields1.get('hero');
    const heroFieldNodes2 = fields2.get('hero');

    expect(heroFieldNodes1).to.equal(heroFieldNodes2);
  });

  it('does not yet (?) memoize everything', () => {
    const { fields: fields1 } = collectFields(
      schema,
      fragments,
      {
        skipFirst: true,
        skipSecond: false,
      },
      query,
      selectionSet,
    );
    const { fields: fields2 } = collectFields(
      schema,
      fragments,
      {
        skipFirst: false,
        skipSecond: true,
      },
      query,
      selectionSet,
    );

    const heroFieldNodes1 = fields1.get('hero');
    const heroFieldNodes2 = fields2.get('hero');

    expect(heroFieldNodes1).to.not.equal(heroFieldNodes2);
  });
});