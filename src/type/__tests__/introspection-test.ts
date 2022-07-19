import { expect } from 'chai';
import { describe, it } from 'mocha';

import type { GraphQLResolveInfo } from 'graphql';
import {
  buildSchema,
  getIntrospectionQuery,
  parse,
  versionInfo,
} from 'graphql';

import { expectJSON } from '../../__testUtils__/expectJSON';
import { handlePre15 } from '../../__testUtils__/handlePre15';
import { handlePre16 } from '../../__testUtils__/handlePre16';

// executeSync is necessary because the __directive introspection field used in testing does not currently pass validation
// TODO: add custom validation logic to fix this
import { executeSync } from '../../execution/execute';

describe('Introspection', () => {
  it('executes an introspection query', () => {
    const schema = buildSchema(`
      type SomeObject {
        someField: String
      }

      schema {
        query: SomeObject
      }
    `);

    const options = {
      descriptions: false,
      specifiedByUrl: true,
      directiveIsRepeatable: true,
    };

    const document = parse(getIntrospectionQuery(options));

    const types = [
      {
        kind: 'OBJECT',
        name: 'SomeObject',
        specifiedByURL: null,
        fields: [
          {
            name: 'someField',
            args: [],
            type: {
              kind: 'SCALAR',
              name: 'String',
              ofType: null,
            },
            isDeprecated: false,
            deprecationReason: null,
          },
        ],
        inputFields: null,
        interfaces: [],
        enumValues: null,
        possibleTypes: null,
      },
      {
        kind: 'SCALAR',
        name: 'String',
        specifiedByURL: null,
        fields: null,
        inputFields: null,
        interfaces: null,
        enumValues: null,
        possibleTypes: null,
      },
      {
        kind: 'SCALAR',
        name: 'Boolean',
        specifiedByURL: null,
        fields: null,
        inputFields: null,
        interfaces: null,
        enumValues: null,
        possibleTypes: null,
      },
      {
        kind: 'OBJECT',
        name: '__Schema',
        specifiedByURL: null,
        fields: [
          {
            name: 'description',
            args: [],
            type: {
              kind: 'SCALAR',
              name: 'String',
              ofType: null,
            },
            isDeprecated: false,
            deprecationReason: null,
          },
          {
            name: 'types',
            args: [],
            type: {
              kind: 'NON_NULL',
              name: null,
              ofType: {
                kind: 'LIST',
                name: null,
                ofType: {
                  kind: 'NON_NULL',
                  name: null,
                  ofType: {
                    kind: 'OBJECT',
                    name: '__Type',
                    ofType: null,
                  },
                },
              },
            },
            isDeprecated: false,
            deprecationReason: null,
          },
          {
            name: 'queryType',
            args: [],
            type: {
              kind: 'NON_NULL',
              name: null,
              ofType: {
                kind: 'OBJECT',
                name: '__Type',
                ofType: null,
              },
            },
            isDeprecated: false,
            deprecationReason: null,
          },
          {
            name: 'mutationType',
            args: [],
            type: {
              kind: 'OBJECT',
              name: '__Type',
              ofType: null,
            },
            isDeprecated: false,
            deprecationReason: null,
          },
          {
            name: 'subscriptionType',
            args: [],
            type: {
              kind: 'OBJECT',
              name: '__Type',
              ofType: null,
            },
            isDeprecated: false,
            deprecationReason: null,
          },
          {
            name: 'directives',
            args: [],
            type: {
              kind: 'NON_NULL',
              name: null,
              ofType: {
                kind: 'LIST',
                name: null,
                ofType: {
                  kind: 'NON_NULL',
                  name: null,
                  ofType: {
                    kind: 'OBJECT',
                    name: '__Directive',
                    ofType: null,
                  },
                },
              },
            },
            isDeprecated: false,
            deprecationReason: null,
          },
        ],
        inputFields: null,
        interfaces: [],
        enumValues: null,
        possibleTypes: null,
      },
      {
        kind: 'OBJECT',
        name: '__Type',
        specifiedByURL: null,
        fields: [
          {
            name: 'kind',
            args: [],
            type: {
              kind: 'NON_NULL',
              name: null,
              ofType: {
                kind: 'ENUM',
                name: '__TypeKind',
                ofType: null,
              },
            },
            isDeprecated: false,
            deprecationReason: null,
          },
          {
            name: 'name',
            args: [],
            type: {
              kind: 'SCALAR',
              name: 'String',
              ofType: null,
            },
            isDeprecated: false,
            deprecationReason: null,
          },
          {
            name: 'description',
            args: [],
            type: {
              kind: 'SCALAR',
              name: 'String',
              ofType: null,
            },
            isDeprecated: false,
            deprecationReason: null,
          },
          {
            name: 'specifiedByURL',
            args: [],
            type: {
              kind: 'SCALAR',
              name: 'String',
              ofType: null,
            },
            isDeprecated: false,
            deprecationReason: null,
          },
          {
            name: 'fields',
            args: [
              {
                name: 'includeDeprecated',
                type: {
                  kind: 'SCALAR',
                  name: 'Boolean',
                  ofType: null,
                },
                defaultValue: 'false',
              },
            ],
            type: {
              kind: 'LIST',
              name: null,
              ofType: {
                kind: 'NON_NULL',
                name: null,
                ofType: {
                  kind: 'OBJECT',
                  name: '__Field',
                  ofType: null,
                },
              },
            },
            isDeprecated: false,
            deprecationReason: null,
          },
          {
            name: 'interfaces',
            args: [],
            type: {
              kind: 'LIST',
              name: null,
              ofType: {
                kind: 'NON_NULL',
                name: null,
                ofType: {
                  kind: 'OBJECT',
                  name: '__Type',
                  ofType: null,
                },
              },
            },
            isDeprecated: false,
            deprecationReason: null,
          },
          {
            name: 'possibleTypes',
            args: [],
            type: {
              kind: 'LIST',
              name: null,
              ofType: {
                kind: 'NON_NULL',
                name: null,
                ofType: {
                  kind: 'OBJECT',
                  name: '__Type',
                  ofType: null,
                },
              },
            },
            isDeprecated: false,
            deprecationReason: null,
          },
          {
            name: 'enumValues',
            args: [
              {
                name: 'includeDeprecated',
                type: {
                  kind: 'SCALAR',
                  name: 'Boolean',
                  ofType: null,
                },
                defaultValue: 'false',
              },
            ],
            type: {
              kind: 'LIST',
              name: null,
              ofType: {
                kind: 'NON_NULL',
                name: null,
                ofType: {
                  kind: 'OBJECT',
                  name: '__EnumValue',
                  ofType: null,
                },
              },
            },
            isDeprecated: false,
            deprecationReason: null,
          },
          {
            name: 'inputFields',
            args: [
              {
                name: 'includeDeprecated',
                type: {
                  kind: 'SCALAR',
                  name: 'Boolean',
                  ofType: null,
                },
                defaultValue: 'false',
              },
            ],
            type: {
              kind: 'LIST',
              name: null,
              ofType: {
                kind: 'NON_NULL',
                name: null,
                ofType: {
                  kind: 'OBJECT',
                  name: '__InputValue',
                  ofType: null,
                },
              },
            },
            isDeprecated: false,
            deprecationReason: null,
          },
          {
            name: 'ofType',
            args: [],
            type: {
              kind: 'OBJECT',
              name: '__Type',
              ofType: null,
            },
            isDeprecated: false,
            deprecationReason: null,
          },
        ],
        inputFields: null,
        interfaces: [],
        enumValues: null,
        possibleTypes: null,
      },
      {
        kind: 'ENUM',
        name: '__TypeKind',
        specifiedByURL: null,
        fields: null,
        inputFields: null,
        interfaces: null,
        enumValues: [
          {
            name: 'SCALAR',
            isDeprecated: false,
            deprecationReason: null,
          },
          {
            name: 'OBJECT',
            isDeprecated: false,
            deprecationReason: null,
          },
          {
            name: 'INTERFACE',
            isDeprecated: false,
            deprecationReason: null,
          },
          {
            name: 'UNION',
            isDeprecated: false,
            deprecationReason: null,
          },
          {
            name: 'ENUM',
            isDeprecated: false,
            deprecationReason: null,
          },
          {
            name: 'INPUT_OBJECT',
            isDeprecated: false,
            deprecationReason: null,
          },
          {
            name: 'LIST',
            isDeprecated: false,
            deprecationReason: null,
          },
          {
            name: 'NON_NULL',
            isDeprecated: false,
            deprecationReason: null,
          },
        ],
        possibleTypes: null,
      },
      {
        kind: 'OBJECT',
        name: '__Field',
        specifiedByURL: null,
        fields: [
          {
            name: 'name',
            args: [],
            type: {
              kind: 'NON_NULL',
              name: null,
              ofType: {
                kind: 'SCALAR',
                name: 'String',
                ofType: null,
              },
            },
            isDeprecated: false,
            deprecationReason: null,
          },
          {
            name: 'description',
            args: [],
            type: {
              kind: 'SCALAR',
              name: 'String',
              ofType: null,
            },
            isDeprecated: false,
            deprecationReason: null,
          },
          {
            name: 'args',
            args: [
              {
                name: 'includeDeprecated',
                type: {
                  kind: 'SCALAR',
                  name: 'Boolean',
                  ofType: null,
                },
                defaultValue: 'false',
              },
            ],
            type: {
              kind: 'NON_NULL',
              name: null,
              ofType: {
                kind: 'LIST',
                name: null,
                ofType: {
                  kind: 'NON_NULL',
                  name: null,
                  ofType: {
                    kind: 'OBJECT',
                    name: '__InputValue',
                    ofType: null,
                  },
                },
              },
            },
            isDeprecated: false,
            deprecationReason: null,
          },
          {
            name: 'type',
            args: [],
            type: {
              kind: 'NON_NULL',
              name: null,
              ofType: {
                kind: 'OBJECT',
                name: '__Type',
                ofType: null,
              },
            },
            isDeprecated: false,
            deprecationReason: null,
          },
          {
            name: 'isDeprecated',
            args: [],
            type: {
              kind: 'NON_NULL',
              name: null,
              ofType: {
                kind: 'SCALAR',
                name: 'Boolean',
                ofType: null,
              },
            },
            isDeprecated: false,
            deprecationReason: null,
          },
          {
            name: 'deprecationReason',
            args: [],
            type: {
              kind: 'SCALAR',
              name: 'String',
              ofType: null,
            },
            isDeprecated: false,
            deprecationReason: null,
          },
        ],
        inputFields: null,
        interfaces: [],
        enumValues: null,
        possibleTypes: null,
      },
      {
        kind: 'OBJECT',
        name: '__InputValue',
        specifiedByURL: null,
        fields: [
          {
            name: 'name',
            args: [],
            type: {
              kind: 'NON_NULL',
              name: null,
              ofType: {
                kind: 'SCALAR',
                name: 'String',
                ofType: null,
              },
            },
            isDeprecated: false,
            deprecationReason: null,
          },
          {
            name: 'description',
            args: [],
            type: {
              kind: 'SCALAR',
              name: 'String',
              ofType: null,
            },
            isDeprecated: false,
            deprecationReason: null,
          },
          {
            name: 'type',
            args: [],
            type: {
              kind: 'NON_NULL',
              name: null,
              ofType: {
                kind: 'OBJECT',
                name: '__Type',
                ofType: null,
              },
            },
            isDeprecated: false,
            deprecationReason: null,
          },
          {
            name: 'defaultValue',
            args: [],
            type: {
              kind: 'SCALAR',
              name: 'String',
              ofType: null,
            },
            isDeprecated: false,
            deprecationReason: null,
          },
          {
            name: 'isDeprecated',
            args: [],
            type: {
              kind: 'NON_NULL',
              name: null,
              ofType: {
                kind: 'SCALAR',
                name: 'Boolean',
                ofType: null,
              },
            },
            isDeprecated: false,
            deprecationReason: null,
          },
          {
            name: 'deprecationReason',
            args: [],
            type: {
              kind: 'SCALAR',
              name: 'String',
              ofType: null,
            },
            isDeprecated: false,
            deprecationReason: null,
          },
        ],
        inputFields: null,
        interfaces: [],
        enumValues: null,
        possibleTypes: null,
      },
      {
        kind: 'OBJECT',
        name: '__EnumValue',
        specifiedByURL: null,
        fields: [
          {
            name: 'name',
            args: [],
            type: {
              kind: 'NON_NULL',
              name: null,
              ofType: {
                kind: 'SCALAR',
                name: 'String',
                ofType: null,
              },
            },
            isDeprecated: false,
            deprecationReason: null,
          },
          {
            name: 'description',
            args: [],
            type: {
              kind: 'SCALAR',
              name: 'String',
              ofType: null,
            },
            isDeprecated: false,
            deprecationReason: null,
          },
          {
            name: 'isDeprecated',
            args: [],
            type: {
              kind: 'NON_NULL',
              name: null,
              ofType: {
                kind: 'SCALAR',
                name: 'Boolean',
                ofType: null,
              },
            },
            isDeprecated: false,
            deprecationReason: null,
          },
          {
            name: 'deprecationReason',
            args: [],
            type: {
              kind: 'SCALAR',
              name: 'String',
              ofType: null,
            },
            isDeprecated: false,
            deprecationReason: null,
          },
        ],
        inputFields: null,
        interfaces: [],
        enumValues: null,
        possibleTypes: null,
      },
      {
        kind: 'OBJECT',
        name: '__Directive',
        specifiedByURL: null,
        fields: [
          {
            name: 'name',
            args: [],
            type: {
              kind: 'NON_NULL',
              name: null,
              ofType: {
                kind: 'SCALAR',
                name: 'String',
                ofType: null,
              },
            },
            isDeprecated: false,
            deprecationReason: null,
          },
          {
            name: 'description',
            args: [],
            type: {
              kind: 'SCALAR',
              name: 'String',
              ofType: null,
            },
            isDeprecated: false,
            deprecationReason: null,
          },
          {
            name: 'isRepeatable',
            args: [],
            type: {
              kind: 'NON_NULL',
              name: null,
              ofType: {
                kind: 'SCALAR',
                name: 'Boolean',
                ofType: null,
              },
            },
            isDeprecated: false,
            deprecationReason: null,
          },
          {
            name: 'locations',
            args: [],
            type: {
              kind: 'NON_NULL',
              name: null,
              ofType: {
                kind: 'LIST',
                name: null,
                ofType: {
                  kind: 'NON_NULL',
                  name: null,
                  ofType: {
                    kind: 'ENUM',
                    name: '__DirectiveLocation',
                    ofType: null,
                  },
                },
              },
            },
            isDeprecated: false,
            deprecationReason: null,
          },
          {
            name: 'args',
            args: [
              {
                name: 'includeDeprecated',
                type: {
                  kind: 'SCALAR',
                  name: 'Boolean',
                  ofType: null,
                },
                defaultValue: 'false',
              },
            ],
            type: {
              kind: 'NON_NULL',
              name: null,
              ofType: {
                kind: 'LIST',
                name: null,
                ofType: {
                  kind: 'NON_NULL',
                  name: null,
                  ofType: {
                    kind: 'OBJECT',
                    name: '__InputValue',
                    ofType: null,
                  },
                },
              },
            },
            isDeprecated: false,
            deprecationReason: null,
          },
        ],
        inputFields: null,
        interfaces: [],
        enumValues: null,
        possibleTypes: null,
      },
      {
        kind: 'ENUM',
        name: '__DirectiveLocation',
        specifiedByURL: null,
        fields: null,
        inputFields: null,
        interfaces: null,
        enumValues: [
          {
            name: 'QUERY',
            isDeprecated: false,
            deprecationReason: null,
          },
          {
            name: 'MUTATION',
            isDeprecated: false,
            deprecationReason: null,
          },
          {
            name: 'SUBSCRIPTION',
            isDeprecated: false,
            deprecationReason: null,
          },
          {
            name: 'FIELD',
            isDeprecated: false,
            deprecationReason: null,
          },
          {
            name: 'FRAGMENT_DEFINITION',
            isDeprecated: false,
            deprecationReason: null,
          },
          {
            name: 'FRAGMENT_SPREAD',
            isDeprecated: false,
            deprecationReason: null,
          },
          {
            name: 'INLINE_FRAGMENT',
            isDeprecated: false,
            deprecationReason: null,
          },
          {
            name: 'VARIABLE_DEFINITION',
            isDeprecated: false,
            deprecationReason: null,
          },
          {
            name: 'SCHEMA',
            isDeprecated: false,
            deprecationReason: null,
          },
          {
            name: 'SCALAR',
            isDeprecated: false,
            deprecationReason: null,
          },
          {
            name: 'OBJECT',
            isDeprecated: false,
            deprecationReason: null,
          },
          {
            name: 'FIELD_DEFINITION',
            isDeprecated: false,
            deprecationReason: null,
          },
          {
            name: 'ARGUMENT_DEFINITION',
            isDeprecated: false,
            deprecationReason: null,
          },
          {
            name: 'INTERFACE',
            isDeprecated: false,
            deprecationReason: null,
          },
          {
            name: 'UNION',
            isDeprecated: false,
            deprecationReason: null,
          },
          {
            name: 'ENUM',
            isDeprecated: false,
            deprecationReason: null,
          },
          {
            name: 'ENUM_VALUE',
            isDeprecated: false,
            deprecationReason: null,
          },
          {
            name: 'INPUT_OBJECT',
            isDeprecated: false,
            deprecationReason: null,
          },
          {
            name: 'INPUT_FIELD_DEFINITION',
            isDeprecated: false,
            deprecationReason: null,
          },
        ],
        possibleTypes: null,
      },
    ];

    const include = {
      name: 'include',
      isRepeatable: false,
      locations: ['FIELD', 'FRAGMENT_SPREAD', 'INLINE_FRAGMENT'],
      args: [
        {
          name: 'if',
          type: {
            kind: 'NON_NULL',
            name: null,
            ofType: {
              kind: 'SCALAR',
              name: 'Boolean',
              ofType: null,
            },
          },
          defaultValue: null,
        },
      ],
    };
    const skip = {
      name: 'skip',
      isRepeatable: false,
      locations: ['FIELD', 'FRAGMENT_SPREAD', 'INLINE_FRAGMENT'],
      args: [
        {
          name: 'if',
          type: {
            kind: 'NON_NULL',
            name: null,
            ofType: {
              kind: 'SCALAR',
              name: 'Boolean',
              ofType: null,
            },
          },
          defaultValue: null,
        },
      ],
    };

    const deprecated = {
      name: 'deprecated',
      isRepeatable: false,
      locations: [
        'FIELD_DEFINITION',
        'ARGUMENT_DEFINITION',
        'INPUT_FIELD_DEFINITION',
        'ENUM_VALUE',
      ],
      args: [
        {
          name: 'reason',
          type: {
            kind: 'SCALAR',
            name: 'String',
            ofType: null,
          },
          defaultValue: '"No longer supported"',
        },
      ],
    };

    const specifiedBy = {
      name: 'specifiedBy',
      isRepeatable: false,
      locations: ['SCALAR'],
      args: [
        {
          name: 'url',
          type: {
            kind: 'NON_NULL',
            name: null,
            ofType: {
              kind: 'SCALAR',
              name: 'String',
              ofType: null,
            },
          },
          defaultValue: null,
        },
      ],
    };

    const v16Result = {
      __schema: {
        queryType: { name: 'SomeObject' },
        mutationType: null,
        subscriptionType: null,
        types,
        directives: [include, skip, deprecated, specifiedBy],
      },
    };

    const typesWithSpecifiedByURL = types.map((type) => {
      const newType: { [key: string]: unknown } = {};
      for (const [key, property] of Object.entries(type)) {
        if (key !== 'specifiedByURL') {
          newType[key] = property;
        }
      }
      return newType;
    });

    const v15Result = {
      __schema: {
        queryType: { name: 'SomeObject' },
        mutationType: null,
        subscriptionType: null,
        types: typesWithSpecifiedByURL,
        directives: [include, skip, deprecated, specifiedBy],
      },
    };

    const v14Result = {
      __schema: {
        queryType: { name: 'SomeObject' },
        mutationType: null,
        subscriptionType: null,
        types: typesWithSpecifiedByURL,
        directives: [
          ...[skip, include, deprecated].map((directive) => {
            const name = directive.name;
            const newDirective: { [key: string]: unknown } = {};
            for (const [key, property] of Object.entries(directive)) {
              if (key !== 'isRepeatable') {
                newDirective[key] = property;
              }
              if (name === 'deprecated' && key === 'locations') {
                newDirective.locations = ['FIELD_DEFINITION', 'ENUM_VALUE'];
              }
            }
            return newDirective;
          }),
        ],
      },
    };

    const result = executeSync({ schema, document });
    const expectedResult = {
      data: handlePre16(v16Result, handlePre15(v15Result, v14Result)),
    };
    expect(result).to.deep.equal(expectedResult);
  });

  it('introspects on input object', () => {
    const schema = buildSchema(`
      input SomeInputObject {
        a: String = "tes\\t de\\fault"
        b: [String]
        c: String = null
      }

      type Query {
        someField(someArg: SomeInputObject): String
      }
    `);

    const document = parse(`
      {
        __type(name: "SomeInputObject") {
          kind
          name
          inputFields {
            name
            type { ...TypeRef }
            defaultValue
          }
        }
      }

      fragment TypeRef on __Type {
        kind
        name
        ofType {
          kind
          name
          ofType {
            kind
            name
            ofType {
              kind
              name
            }
          }
        }
      }
    `);

    expect(executeSync({ schema, document })).to.deep.equal({
      data: {
        __type: {
          kind: 'INPUT_OBJECT',
          name: 'SomeInputObject',
          inputFields: [
            {
              name: 'a',
              type: {
                kind: 'SCALAR',
                name: 'String',
                ofType: null,
              },
              defaultValue: '"tes\\t de\\fault"',
            },
            {
              name: 'b',
              type: {
                kind: 'LIST',
                name: null,
                ofType: {
                  kind: 'SCALAR',
                  name: 'String',
                  ofType: null,
                },
              },
              defaultValue: null,
            },
            {
              name: 'c',
              type: {
                kind: 'SCALAR',
                name: 'String',
                ofType: null,
              },
              defaultValue: 'null',
            },
          ],
        },
      },
    });
  });

  it('supports the __type root field', () => {
    const schema = buildSchema(`
      type Query {
        someField: String
      }
    `);

    const document = parse(`
      {
        Query: __type(name: "Query") {
          name
        }
        Unknown: __type(name: "Unknown") {
          name
        }
      }
    `);

    expect(executeSync({ schema, document })).to.deep.equal({
      data: {
        Query: { name: 'Query' },
        Unknown: null,
      },
    });
  });

  it('supports the __directive root field', () => {
    const schema = buildSchema(`
      type Query {
        someField: String
      }
      directive @someDirective on FIELD 
    `);

    const document = parse(`
      {
        someDirective: __directive(name: "someDirective") {
          name
        }
        unknown: __directive(name: "unknown") {
          name
        }
      }
    `);

    expect(executeSync({ schema, document })).to.deep.equal({
      data: {
        someDirective: { name: 'someDirective' },
        unknown: null,
      },
    });
  });

  it('identifies deprecated fields', () => {
    const schema = buildSchema(`
      type Query {
        nonDeprecated: String
        deprecated: String @deprecated(reason: "Removed in 1.0")
        deprecatedWithEmptyReason: String @deprecated(reason: "")
      }
    `);

    const document = parse(`
      {
        __type(name: "Query") {
          fields(includeDeprecated: true) {
            name
            isDeprecated,
            deprecationReason
          }
        }
      }
    `);

    expect(executeSync({ schema, document })).to.deep.equal({
      data: {
        __type: {
          fields: [
            {
              name: 'nonDeprecated',
              isDeprecated: false,
              deprecationReason: null,
            },
            {
              name: 'deprecated',
              isDeprecated: true,
              deprecationReason: 'Removed in 1.0',
            },
            {
              name: 'deprecatedWithEmptyReason',
              isDeprecated: true,
              deprecationReason: '',
            },
          ],
        },
      },
    });
  });

  it('respects the includeDeprecated parameter for fields', () => {
    const schema = buildSchema(`
      type Query {
        nonDeprecated: String
        deprecated: String @deprecated(reason: "Removed in 1.0")
      }
    `);

    const document = parse(`
      {
        __type(name: "Query") {
          trueFields: fields(includeDeprecated: true) {
            name
          }
          falseFields: fields(includeDeprecated: false) {
            name
          }
          omittedFields: fields {
            name
          }
        }
      }
    `);

    expect(executeSync({ schema, document })).to.deep.equal({
      data: {
        __type: {
          trueFields: [{ name: 'nonDeprecated' }, { name: 'deprecated' }],
          falseFields: [{ name: 'nonDeprecated' }],
          omittedFields: [{ name: 'nonDeprecated' }],
        },
      },
    });
  });

  if (versionInfo.major >= 15) {
    it('identifies deprecated args', () => {
      const schema = buildSchema(`
        type Query {
          someField(
            nonDeprecated: String
            deprecated: String @deprecated(reason: "Removed in 1.0")
            deprecatedWithEmptyReason: String @deprecated(reason: "")
          ): String
        }

        directive @someDirective(
          nonDeprecated: String
          deprecated: String @deprecated(reason: "Removed in 1.0")
          deprecatedWithEmptyReason: String @deprecated(reason: "")
        ) on FIELD
      `);

      const document = parse(`
        {
          __type(name: "Query") {
            fields {
              args(includeDeprecated: true) {
                name
                isDeprecated,
                deprecationReason
              }
            }
          }
          __directive(name: "someDirective") {
            args(includeDeprecated: true) {
              name
              isDeprecated,
              deprecationReason
            }
          }
        }
      `);

      expect(executeSync({ schema, document })).to.deep.equal({
        data: {
          __type: {
            fields: [
              {
                args: [
                  {
                    name: 'nonDeprecated',
                    isDeprecated: false,
                    deprecationReason: null,
                  },
                  {
                    name: 'deprecated',
                    isDeprecated: true,
                    deprecationReason: 'Removed in 1.0',
                  },
                  {
                    name: 'deprecatedWithEmptyReason',
                    isDeprecated: true,
                    deprecationReason: '',
                  },
                ],
              },
            ],
          },
          __directive: {
            args: [
              {
                name: 'nonDeprecated',
                isDeprecated: false,
                deprecationReason: null,
              },
              {
                name: 'deprecated',
                isDeprecated: true,
                deprecationReason: 'Removed in 1.0',
              },
              {
                name: 'deprecatedWithEmptyReason',
                isDeprecated: true,
                deprecationReason: '',
              },
            ],
          },
        },
      });
    });

    it('respects the includeDeprecated parameter for args', () => {
      const schema = buildSchema(`
        type Query {
          someField(
            nonDeprecated: String
            deprecated: String @deprecated(reason: "Removed in 1.0")
          ): String
        }

        directive @someDirective(
          nonDeprecated: String
          deprecated: String @deprecated(reason: "Removed in 1.0")
        ) on FIELD
      `);

      const document = parse(`
        {
          __type(name: "Query") {
            fields {
              trueArgs: args(includeDeprecated: true) {
                name
              }
              falseArgs: args(includeDeprecated: false) {
                name
              }
              omittedArgs: args {
                name
              }
            }
          }
          __directive(name: "someDirective") {
            trueArgs: args(includeDeprecated: true) {
              name
            }
            falseArgs: args(includeDeprecated: false) {
              name
            }
            omittedArgs: args {
              name
            }
          }
        }
      `);

      expect(executeSync({ schema, document })).to.deep.equal({
        data: {
          __type: {
            fields: [
              {
                trueArgs: [{ name: 'nonDeprecated' }, { name: 'deprecated' }],
                falseArgs: [{ name: 'nonDeprecated' }],
                omittedArgs: [{ name: 'nonDeprecated' }],
              },
            ],
          },
          __directive: {
            trueArgs: [{ name: 'nonDeprecated' }, { name: 'deprecated' }],
            falseArgs: [{ name: 'nonDeprecated' }],
            omittedArgs: [{ name: 'nonDeprecated' }],
          },
        },
      });
    });
  }

  it('identifies deprecated enum values', () => {
    const schema = buildSchema(`
      enum SomeEnum {
        NON_DEPRECATED
        DEPRECATED @deprecated(reason: "Removed in 1.0")
        ALSO_NON_DEPRECATED
      }

      type Query {
        someField(someArg: SomeEnum): String
      }
    `);

    const document = parse(`
      {
        __type(name: "SomeEnum") {
          enumValues(includeDeprecated: true) {
            name
            isDeprecated,
            deprecationReason
          }
        }
      }
    `);

    expect(executeSync({ schema, document })).to.deep.equal({
      data: {
        __type: {
          enumValues: [
            {
              name: 'NON_DEPRECATED',
              isDeprecated: false,
              deprecationReason: null,
            },
            {
              name: 'DEPRECATED',
              isDeprecated: true,
              deprecationReason: 'Removed in 1.0',
            },
            {
              name: 'ALSO_NON_DEPRECATED',
              isDeprecated: false,
              deprecationReason: null,
            },
          ],
        },
      },
    });
  });

  it('respects the includeDeprecated parameter for enum values', () => {
    const schema = buildSchema(`
      enum SomeEnum {
        NON_DEPRECATED
        DEPRECATED @deprecated(reason: "Removed in 1.0")
        DEPRECATED_WITH_EMPTY_REASON @deprecated(reason: "")
        ALSO_NON_DEPRECATED
      }

      type Query {
        someField(someArg: SomeEnum): String
      }
    `);

    const document = parse(`
      {
        __type(name: "SomeEnum") {
          trueValues: enumValues(includeDeprecated: true) {
            name
          }
          falseValues: enumValues(includeDeprecated: false) {
            name
          }
          omittedValues: enumValues {
            name
          }
        }
      }
    `);

    expect(executeSync({ schema, document })).to.deep.equal({
      data: {
        __type: {
          trueValues: [
            { name: 'NON_DEPRECATED' },
            { name: 'DEPRECATED' },
            { name: 'DEPRECATED_WITH_EMPTY_REASON' },
            { name: 'ALSO_NON_DEPRECATED' },
          ],
          falseValues: [
            { name: 'NON_DEPRECATED' },
            { name: 'ALSO_NON_DEPRECATED' },
          ],
          omittedValues: [
            { name: 'NON_DEPRECATED' },
            { name: 'ALSO_NON_DEPRECATED' },
          ],
        },
      },
    });
  });

  if (versionInfo.major >= 15) {
    it('identifies deprecated for input fields', () => {
      const schema = buildSchema(`
      input SomeInputObject {
        nonDeprecated: String
        deprecated: String @deprecated(reason: "Removed in 1.0")
        deprecatedWithEmptyReason: String @deprecated(reason: "")
      }

      type Query {
        someField(someArg: SomeInputObject): String
      }
    `);

      const document = parse(`
      {
        __type(name: "SomeInputObject") {
          inputFields(includeDeprecated: true) {
            name
            isDeprecated,
            deprecationReason
          }
        }
      }
    `);

      expect(executeSync({ schema, document })).to.deep.equal({
        data: {
          __type: {
            inputFields: [
              {
                name: 'nonDeprecated',
                isDeprecated: false,
                deprecationReason: null,
              },
              {
                name: 'deprecated',
                isDeprecated: true,
                deprecationReason: 'Removed in 1.0',
              },
              {
                name: 'deprecatedWithEmptyReason',
                isDeprecated: true,
                deprecationReason: '',
              },
            ],
          },
        },
      });
    });

    it('respects the includeDeprecated parameter for input fields', () => {
      const schema = buildSchema(`
      input SomeInputObject {
        nonDeprecated: String
        deprecated: String @deprecated(reason: "Removed in 1.0")
      }

      type Query {
        someField(someArg: SomeInputObject): String
      }
    `);

      const document = parse(`
      {
        __type(name: "SomeInputObject") {
          trueFields: inputFields(includeDeprecated: true) {
            name
          }
          falseFields: inputFields(includeDeprecated: false) {
            name
          }
          omittedFields: inputFields {
            name
          }
        }
      }
    `);

      expect(executeSync({ schema, document })).to.deep.equal({
        data: {
          __type: {
            trueFields: [{ name: 'nonDeprecated' }, { name: 'deprecated' }],
            falseFields: [{ name: 'nonDeprecated' }],
            omittedFields: [{ name: 'nonDeprecated' }],
          },
        },
      });
    });
  }

  it('fails as expected on the __type root field without an arg', () => {
    const schema = buildSchema(`
      type Query {
        someField: String
      }
    `);

    const document = parse(`
      {
        __type {
          name
        }
      }
    `);

    expectJSON(executeSync({ schema, document })).toDeepEqual({
      data: {
        __type: null,
      },
      errors: [
        {
          message:
            'Argument "name" of required type "String!" was not provided.',
          locations: [{ line: 3, column: 9 }],
          path: ['__type'],
        },
      ],
    });
  });

  if (versionInfo.major >= 15) {
    it('exposes schema descriptions', () => {
      const schema = buildSchema(`
        type SomeObject {
          someField(arg: String): String
        }

        """Schema description"""
        schema {
          query: SomeObject
        }
      `);

      const document = parse(`
        {
          Schema: __schema { description }
        }
      `);

      expect(executeSync({ schema, document })).to.deep.equal({
        data: {
          Schema: {
            description: 'Schema description',
          },
        },
      });
    });
  }

  it('exposes descriptions', () => {
    const schema = buildSchema(`
      """Enum description"""
      enum SomeEnum {
        """Value description"""
        VALUE
      }

      """Object description"""
      type SomeObject {
        """Field description"""
        someField(
          """Arg description"""
          arg: SomeEnum
        ): String
      }

      """Directive description"""
      directive @someDirective on FIELD

      schema {
        query: SomeObject
      }
    `);

    const document = parse(`
      {
        SomeObject: __type(name: "SomeObject") {
          description,
          fields {
            name
            args {
              name
              description
            }
            description
          }
        }
        SomeEnum: __type(name: "SomeEnum") {
          description
          enumValues {
            name
            description
          }
        }
        someDirective: __directive(name: "someDirective") {
          description
        }
      }
    `);

    expect(executeSync({ schema, document })).to.deep.equal({
      data: {
        SomeEnum: {
          description: 'Enum description',
          enumValues: [
            {
              name: 'VALUE',
              description: 'Value description',
            },
          ],
        },
        SomeObject: {
          description: 'Object description',
          fields: [
            {
              name: 'someField',
              args: [
                {
                  name: 'arg',
                  description: 'Arg description',
                },
              ],
              description: 'Field description',
            },
          ],
        },
        someDirective: {
          description: 'Directive description',
        },
      },
    });
  });

  it('executes an introspection query without calling global resolvers', () => {
    const schema = buildSchema(`
      type Query {
        someField: String
      }
    `);

    const options = {
      descriptions: false,
      specifiedByUrl: true,
      directiveIsRepeatable: true,
    };

    const document = parse(getIntrospectionQuery(options));

    /* c8 ignore start */
    function fieldResolver(
      _1: any,
      _2: any,
      _3: any,
      info: GraphQLResolveInfo,
    ): never {
      expect.fail(`Called on ${info.parentType.name}::${info.fieldName}`);
    }

    function typeResolver(_1: any, _2: any, info: GraphQLResolveInfo): never {
      expect.fail(`Called on ${info.parentType.name}::${info.fieldName}`);
    }
    /* c8 ignore stop */

    const result = executeSync({
      schema,
      document,
      fieldResolver,
      typeResolver,
    });
    expect(result).to.not.have.property('errors');
  });
});
