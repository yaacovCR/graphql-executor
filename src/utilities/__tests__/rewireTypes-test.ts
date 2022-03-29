import { expect } from 'chai';
import { describe, it } from 'mocha';

import {
  assertDirective,
  assertEnumType,
  assertInputObjectType,
  assertInterfaceType,
  assertObjectType,
  assertScalarType,
  assertUnionType,
  buildSchema,
  GraphQLObjectType,
  GraphQLSchema,
  GraphQLString,
  printSchema as _printSchema,
} from 'graphql';
import type { GraphQLNamedType } from 'graphql';

import type { ObjMap } from '../../jsutils/ObjMap';

import { dedent } from '../../__testUtils__/dedent';

import { rewireTypes } from '../rewireTypes';
import { handlePre15 } from '../../__testUtils__/handlePre15';

// necessary for trailing newline pre v16
function printSchema(schema: GraphQLSchema): string {
  return _printSchema(schema).trim();
}

describe('rewireTypes', () => {
  it('works with a basic schema', () => {
    const schema = buildSchema(`
      directive @SomeDirective on FIELD

      type Query {
        field(input: SomeInput): String
        scalarField: SomeScalar
        enumField: SomeEnum
        listField: [String]
        nonNullableField: String!
      }

      type SomeType implements SomeInterface {
        someField: String
      }

      interface SomeInterface {
        someField: String
      }

      union SomeUnion = SomeType

      scalar SomeScalar

      enum SomeEnum {
        VALUE
      }

      input SomeInput {
        field: String
        listField: [String]
        nonNullableField: String!
      }
    `);

    const { typeMap, directives } = rewireTypes(
      schema.getTypeMap(),
      schema.getDirectives(),
    );

    const newSchema = new GraphQLSchema({
      types: Object.values(typeMap),
      directives,
    });

    expect(printSchema(newSchema)).to.equal(
      handlePre15(
        dedent`
          directive @SomeDirective on FIELD

          type Query {
            field(input: SomeInput): String
            scalarField: SomeScalar
            enumField: SomeEnum
            listField: [String]
            nonNullableField: String!
          }

          type SomeType implements SomeInterface {
            someField: String
          }

          interface SomeInterface {
            someField: String
          }

          union SomeUnion = SomeType

          scalar SomeScalar

          enum SomeEnum {
            VALUE
          }

          input SomeInput {
            field: String
            listField: [String]
            nonNullableField: String!
          }
      `,
        dedent`
          directive @SomeDirective on FIELD

          type Query {
            field(input: SomeInput): String
            scalarField: SomeScalar
            enumField: SomeEnum
            listField: [String]
            nonNullableField: String!
          }

          enum SomeEnum {
            VALUE
          }

          input SomeInput {
            field: String
            listField: [String]
            nonNullableField: String!
          }

          interface SomeInterface {
            someField: String
          }

          scalar SomeScalar

          type SomeType implements SomeInterface {
            someField: String
          }

          union SomeUnion = SomeType
      `,
      ),
    );

    expect(assertObjectType(schema.getType('Query'))).to.not.equal(
      assertObjectType(newSchema.getType('Query')),
    );
    expect(assertObjectType(schema.getType('SomeType'))).to.not.equal(
      assertObjectType(newSchema.getType('SomeType')),
    );
    expect(assertInterfaceType(schema.getType('SomeInterface'))).to.not.equal(
      assertInterfaceType(newSchema.getType('SomeInterface')),
    );
    expect(assertUnionType(schema.getType('SomeUnion'))).to.not.equal(
      assertUnionType(newSchema.getType('SomeUnion')),
    );
    expect(assertScalarType(schema.getType('SomeScalar'))).to.not.equal(
      assertScalarType(newSchema.getType('SomeScalar')),
    );
    expect(assertEnumType(schema.getType('SomeEnum'))).to.not.equal(
      assertEnumType(newSchema.getType('SomeEnum')),
    );
    expect(assertInputObjectType(schema.getType('SomeInput'))).to.not.equal(
      assertInputObjectType(newSchema.getType('SomeInput')),
    );
    expect(assertDirective(schema.getDirective('SomeDirective'))).to.not.equal(
      assertDirective(newSchema.getDirective('SomeDirective')),
    );
  });

  it('works to remove a type', () => {
    const schema = buildSchema(`
      type Query {
        someField: SomeType
        someListField: [SomeType]
        someNonNullableField: SomeType!
        anotherField: AnotherType
        anotherListField: [AnotherType]
        anotherNonNullableField: AnotherType!
      }

      type SomeType {
        someField: String
      }

      type AnotherType {
        someField: String
      }
    `);

    const modifiedTypeMap: ObjMap<GraphQLNamedType | null> =
      Object.create(null);
    for (const [typeName, type] of Object.entries(schema.getTypeMap())) {
      modifiedTypeMap[typeName] = typeName !== 'AnotherType' ? type : null;
    }

    const { typeMap, directives } = rewireTypes(
      modifiedTypeMap,
      schema.getDirectives(),
    );

    const newSchema = new GraphQLSchema({
      types: Object.values(typeMap),
      directives,
    });

    expect(printSchema(newSchema)).to.equal(dedent`
      type Query {
        someField: SomeType
        someListField: [SomeType]
        someNonNullableField: SomeType!
      }

      type SomeType {
        someField: String
      }
    `);
  });

  it('works to rename a type', () => {
    const schema = buildSchema(`
      type Query {
        field: SomeType
      }

      type SomeType {
        someField: String
      }
    `);

    const modifiedTypeMap: ObjMap<GraphQLNamedType> = Object.create(null);
    for (const [typeName, type] of Object.entries(schema.getTypeMap())) {
      modifiedTypeMap[typeName] = type;
    }

    const SomeType = assertObjectType(schema.getType('SomeType'));
    modifiedTypeMap.SomeType = new GraphQLObjectType({
      ...SomeType.toConfig(),
      name: 'SomeName',
    });

    const { typeMap, directives } = rewireTypes(
      modifiedTypeMap,
      schema.getDirectives(),
    );

    const newSchema = new GraphQLSchema({
      types: Object.values(typeMap),
      directives,
    });

    expect(printSchema(newSchema)).to.equal(dedent`
      type Query {
        field: SomeName
      }

      type SomeName {
        someField: String
      }
    `);
  });

  it('throws when renaming causes a type clash', () => {
    const schema = buildSchema(`
      type Query {
        field: SomeType
      }

      type SomeType {
        someField: String
      }

      type AnotherType {
        anotherField: String
      }
    `);

    const modifiedTypeMap: ObjMap<GraphQLNamedType> = Object.create(null);
    for (const [typeName, type] of Object.entries(schema.getTypeMap())) {
      modifiedTypeMap[typeName] = type;
    }

    const SomeType = assertObjectType(schema.getType('SomeType'));
    modifiedTypeMap.SomeType = new GraphQLObjectType({
      ...SomeType.toConfig(),
      name: 'AnotherType',
    });

    expect(() => rewireTypes(modifiedTypeMap, schema.getDirectives())).to.throw(
      'Schema must contain uniquely named types but rewired types include multiple types named "AnotherType".',
    );
  });

  it('works to add a type', () => {
    const schema = buildSchema(`
      type Query {
        field: String
      }
    `);

    const modifiedTypeMap: ObjMap<GraphQLNamedType> = Object.create(null);
    for (const [typeName, type] of Object.entries(schema.getTypeMap())) {
      modifiedTypeMap[typeName] = type;
    }

    const Query = assertObjectType(schema.getType('Query'));
    const config = Query.toConfig();
    modifiedTypeMap.Query = new GraphQLObjectType({
      ...config,
      fields: {
        ...config.fields,
        field: {
          ...config.fields.field,
          type: new GraphQLObjectType({
            name: 'SomeType',
            fields: {
              someField: {
                type: GraphQLString,
              },
            },
          }),
        },
      },
    });

    const { typeMap, directives } = rewireTypes(
      modifiedTypeMap,
      schema.getDirectives(),
    );

    const newSchema = new GraphQLSchema({
      types: Object.values(typeMap),
      directives,
    });

    expect(printSchema(newSchema)).to.equal(dedent`
      type Query {
        field: SomeType
      }

      type SomeType {
        someField: String
      }
    `);
  });
});
