import { expect } from 'chai';
import { describe, it } from 'mocha';

import type { GraphQLSchemaConfig } from 'graphql';
import {
  GraphQLObjectType,
  GraphQLSchema,
  GraphQLString,
  parse,
} from 'graphql';

import { expectJSON } from '../../__testUtils__/expectJSON';

import { execute, executeSync } from '../execute';

describe('Execute: synchronously when possible', () => {
  const schema = new GraphQLSchema({
    query: new GraphQLObjectType({
      name: 'Query',
      fields: {
        syncField: {
          type: GraphQLString,
          resolve(rootValue) {
            return rootValue;
          },
        },
        asyncField: {
          type: GraphQLString,
          resolve(rootValue) {
            return Promise.resolve(rootValue);
          },
        },
      },
    }),
    mutation: new GraphQLObjectType({
      name: 'Mutation',
      fields: {
        syncMutationField: {
          type: GraphQLString,
          resolve(rootValue) {
            return rootValue;
          },
        },
      },
    }),
  });

  it('does not return a Promise for initial errors', () => {
    const doc = 'fragment Example on Query { syncField }';
    const result = execute({
      schema,
      document: parse(doc),
      rootValue: 'rootValue',
    });
    expectJSON(result).toDeepEqual({
      errors: [{ message: 'Must provide an operation.' }],
    });
  });

  it('does not return a Promise if fields are all synchronous', () => {
    const doc = 'query Example { syncField }';
    const result = execute({
      schema,
      document: parse(doc),
      rootValue: 'rootValue',
    });
    expect(result).to.deep.equal({ data: { syncField: 'rootValue' } });
  });

  it('does not return a Promise if mutation fields are all synchronous', () => {
    const doc = 'mutation Example { syncMutationField }';
    const result = execute({
      schema,
      document: parse(doc),
      rootValue: 'rootValue',
    });
    expect(result).to.deep.equal({ data: { syncMutationField: 'rootValue' } });
  });

  it('returns a Promise if any field is asynchronous', async () => {
    const doc = 'query Example { syncField, asyncField }';
    const result = execute({
      schema,
      document: parse(doc),
      rootValue: 'rootValue',
    });
    expect(result).to.be.instanceOf(Promise);
    expect(await result).to.deep.equal({
      data: { syncField: 'rootValue', asyncField: 'rootValue' },
    });
  });

  describe('executeSync', () => {
    it('does not return a Promise for sync execution', () => {
      const doc = 'query Example { syncField }';
      const result = executeSync({
        schema,
        document: parse(doc),
        rootValue: 'rootValue',
      });
      expect(result).to.deep.equal({ data: { syncField: 'rootValue' } });
    });

    it('throws if encountering async execution', () => {
      const doc = 'query Example { syncField, asyncField }';
      expect(() => {
        executeSync({
          schema,
          document: parse(doc),
          rootValue: 'rootValue',
        });
      }).to.throw('GraphQL execution failed to complete synchronously.');
    });

    it('throws if encountering async iterable execution', () => {
      const doc = `
        query Example {
          ...deferFrag @defer(label: "deferLabel")
        }
        fragment deferFrag on Query {
          syncField
        }
      `;
      expect(() => {
        executeSync({
          schema,
          document: parse(doc),
          rootValue: 'rootValue',
        });
      }).to.throw('GraphQL execution failed to complete synchronously.');
    });
  });

  describe('executeSync', () => {
    it('report errors raised during schema validation', () => {
      const badSchema = new GraphQLSchema({} as GraphQLSchemaConfig); // cast necessary pre v15
      const document = parse('{ __typename }');
      const result = executeSync({
        schema: badSchema,
        document,
      });
      expectJSON(result).toDeepEqual({
        data: null,
        errors: [
          {
            message: 'Schema is not configured to execute query operation.',
            locations: [{ line: 1, column: 1 }],
          },
        ],
      });
    });

    it('does not return a Promise for validation errors', () => {
      const document = parse('fragment Example on Query { unknownField }');
      const result = executeSync({
        schema,
        document,
      });
      expectJSON(result).toDeepEqual({
        errors: [
          {
            message: 'Must provide an operation.',
          },
        ],
      });
    });

    it('does not return a Promise for sync execution', () => {
      const document = parse('query Example { syncField }');
      const result = executeSync({
        schema,
        document,
        rootValue: 'rootValue',
      });
      expect(result).to.deep.equal({ data: { syncField: 'rootValue' } });
    });

    it('throws if encountering async execution', () => {
      const document = parse('query Example { syncField, asyncField }');
      expect(() => {
        executeSync({
          schema,
          document,
          rootValue: 'rootValue',
        });
      }).to.throw('GraphQL execution failed to complete synchronously.');
    });
  });
});
