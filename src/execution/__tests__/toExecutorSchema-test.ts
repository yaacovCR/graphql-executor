import { expect } from 'chai';
import { describe, it } from 'mocha';

import type {
  GraphQLNonNull,
  ListTypeNode,
  NamedTypeNode,
  NonNullTypeNode,
} from 'graphql';
import {
  GraphQLList,
  GraphQLInputObjectType,
  GraphQLObjectType,
  GraphQLSchema,
  GraphQLString,
  Kind,
} from 'graphql';

import { toExecutorSchema } from '..';

describe('ExecutorSchema:', () => {
  const input = new GraphQLInputObjectType({
    name: 'Input',
    fields: {
      inputField: {
        type: GraphQLString,
      },
    },
  });
  const query = new GraphQLObjectType({
    name: 'Query',
    fields: {
      fieldWithInputArg: {
        type: GraphQLString,
        args: {
          arg: {
            type: input,
          },
        },
      },
      fieldWithListInputArg: {
        type: GraphQLString,
        args: {
          arg: {
            type: new GraphQLList(input),
          },
        },
      },
    },
  });
  const schema = new GraphQLSchema({
    query,
  });

  it('does not throw', () => {
    expect(() => toExecutorSchema(schema)).not.to.throw();
  });

  it('allows retrieving output types', () => {
    const executorSchema = toExecutorSchema(schema);
    const namedTypeNode: NamedTypeNode = {
      kind: Kind.NAMED_TYPE,
      name: {
        kind: Kind.NAME,
        value: 'Query',
      },
    };
    const type = executorSchema.getType(namedTypeNode);
    expect(type).to.equal(query);
  });

  it('allows retrieving input types', () => {
    const executorSchema = toExecutorSchema(schema);
    const namedTypeNode: NamedTypeNode = {
      kind: Kind.NAMED_TYPE,
      name: {
        kind: Kind.NAME,
        value: 'Input',
      },
    };
    const type = executorSchema.getType(namedTypeNode);
    expect(type).to.equal(input);
    expect(executorSchema.isInputType(type)).to.equal(true);
  });

  it('allows retrieving input types defined in schema wrapped with non-null', () => {
    const executorSchema = toExecutorSchema(schema);
    const nonNullTypeNode: NonNullTypeNode = {
      kind: Kind.NON_NULL_TYPE,
      type: {
        kind: Kind.NAMED_TYPE,
        name: {
          kind: Kind.NAME,
          value: 'Input',
        },
      },
    };
    const type = executorSchema.getType(nonNullTypeNode);
    expect(type).to.not.equal(undefined);
    expect(executorSchema.isNonNullType(type)).to.equal(true);
    expect(executorSchema.isInputType(type)).to.equal(true);
    expect((type as GraphQLNonNull<any>).ofType).to.equal(input);
  });

  it('allows retrieving list input types defined in schema', () => {
    const executorSchema = toExecutorSchema(schema);
    const listTypeNode: ListTypeNode = {
      kind: Kind.LIST_TYPE,
      type: {
        kind: Kind.NAMED_TYPE,
        name: {
          kind: Kind.NAME,
          value: 'Input',
        },
      },
    };
    const type = executorSchema.getType(listTypeNode);
    expect(type).to.not.equal(undefined);
    expect(executorSchema.isListType(type)).to.equal(true);
    expect(executorSchema.isInputType(type)).to.equal(true);
    expect((type as GraphQLList<any>).ofType).to.equal(input);
  });
});
