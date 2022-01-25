import { expect } from 'chai';
import { describe, it } from 'mocha';

import type { OperationDefinitionNode } from 'graphql';
import {
  GraphQLID,
  GraphQLList,
  GraphQLObjectType,
  GraphQLSchema,
  GraphQLString,
  parse,
} from 'graphql';

import { toExecutorSchema } from '../toExecutorSchema';
import type { ExecutionContext } from '../executor';
import { Executor } from '../executor';

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
const executorSchema = toExecutorSchema(schema);
const executor = new Executor({ schema, executorSchema });

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

describe('collectFields', () => {
  it('memoizes', () => {
    const exeContext = executor.buildExecutionContext({
      document,
      variableValues: {
        skipFirst: false,
        skipSecond: false,
      },
    }) as ExecutionContext;
    const { fields: fields1 } = exeContext.fieldCollector(query, selectionSet);
    const { fields: fields2 } = exeContext.fieldCollector(query, selectionSet);

    const heroFieldNodes1 = fields1.get('hero');
    const heroFieldNodes2 = fields2.get('hero');

    expect(heroFieldNodes1).to.equal(heroFieldNodes2);
  });

  it('does not yet (?) memoize everything', () => {
    const skipFirstExeContext = executor.buildExecutionContext({
      document,
      variableValues: {
        skipFirst: true,
        skipSecond: false,
      },
    }) as ExecutionContext;
    const { fields: fields1 } = skipFirstExeContext.fieldCollector(
      query,
      selectionSet,
    );
    const skipSecondExeContext = executor.buildExecutionContext({
      document,
      variableValues: {
        skipFirst: false,
        skipSecond: true,
      },
    }) as ExecutionContext;
    const { fields: fields2 } = skipSecondExeContext.fieldCollector(
      query,
      selectionSet,
    );

    const heroFieldNodes1 = fields1.get('hero');
    const heroFieldNodes2 = fields2.get('hero');

    expect(heroFieldNodes1).to.not.equal(heroFieldNodes2);
  });
});
