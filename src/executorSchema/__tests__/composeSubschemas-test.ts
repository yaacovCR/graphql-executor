import { expect } from 'chai';
import { describe, it } from 'mocha';

import type { GraphQLSchema } from 'graphql';
import { assertObjectType, buildSchema, Kind } from 'graphql';

import { handlePre15 } from '../../__testUtils__/handlePre15';

import { composeSubschemas } from '../composeSubschemas';
import { toExecutorSchema } from '../toExecutorSchema';

describe('ExecutorSchema:', () => {
  it('throws with root query type name clash', () => {
    const testSchema1: GraphQLSchema = buildSchema(`
      schema {
        query: QueryRoot
      }

      type QueryRoot {
        someField: String
      }
    `);

    const testSchema2: GraphQLSchema = buildSchema(`
      type Query {
        someField: String
      }
  `);

    const executorSchema1 = toExecutorSchema(testSchema1);
    const executorSchema2 = toExecutorSchema(testSchema2);

    expect(() =>
      composeSubschemas({
        subschemas: [{ schema: executorSchema1 }, { schema: executorSchema2 }],
      }),
    ).throws(
      'Subchema 1 defines a root query type with name "Query", expected name "QueryRoot".',
    );
  });

  it('throws with root mutation type name clash', () => {
    const testSchema1: GraphQLSchema = buildSchema(`
      schema {
        mutation: MutationRoot
      }

      type MutationRoot {
        someField: String
      }
    `);

    const testSchema2: GraphQLSchema = buildSchema(`
      type Mutation {
        someField: String
      }
    `);

    const executorSchema1 = toExecutorSchema(testSchema1);
    const executorSchema2 = toExecutorSchema(testSchema2);

    expect(() =>
      composeSubschemas({
        subschemas: [{ schema: executorSchema1 }, { schema: executorSchema2 }],
      }),
    ).throws(
      'Subchema 1 defines a root mutation type with name "Mutation", expected name "MutationRoot".',
    );
  });

  it('throws with root subscription type name clash', () => {
    const testSchema1: GraphQLSchema = buildSchema(`
      schema {
        subscription: SubscriptionRoot
      }

      type SubscriptionRoot {
        someField: String
      }
    `);

    const testSchema2: GraphQLSchema = buildSchema(`
      type Subscription {
        someField: String
      }
    `);

    const executorSchema1 = toExecutorSchema(testSchema1);
    const executorSchema2 = toExecutorSchema(testSchema2);

    expect(() =>
      composeSubschemas({
        subschemas: [{ schema: executorSchema1 }, { schema: executorSchema2 }],
      }),
    ).throws(
      'Subchema 1 defines a root subscription type with name "Subscription", expected name "SubscriptionRoot".',
    );
  });

  it('does not throw when merging root fields', () => {
    const testSchema1: GraphQLSchema = buildSchema(`
      schema {
        query: QueryRoot
        mutation: MutationRoot
        subscription: SubscriptionRoot
      }

      type QueryRoot {
        someField: String
      }

      type MutationRoot {
        someField: String
      }

      type SubscriptionRoot {
        someField: String
      }
    `);

    const testSchema2: GraphQLSchema = buildSchema(`
      schema {
        query: QueryRoot
        mutation: MutationRoot
        subscription: SubscriptionRoot
      }

      type QueryRoot {
        someField: String
      }

      type MutationRoot {
        someField: String
      }

      type SubscriptionRoot {
        someField: String
      }
    `);

    const executorSchema1 = toExecutorSchema(testSchema1);
    const executorSchema2 = toExecutorSchema(testSchema2);

    expect(() =>
      composeSubschemas({
        subschemas: [{ schema: executorSchema1 }, { schema: executorSchema2 }],
      }),
    ).to.not.throw();
  });

  it('merges root query fields', () => {
    const testSchema1: GraphQLSchema = buildSchema(`
      schema {
        query: QueryRoot
      }

      type QueryRoot {
        someField: String
      }
    `);

    const testSchema2: GraphQLSchema = buildSchema(`
      schema {
        query: QueryRoot
      }

      type QueryRoot {
        anotherField: String
      }
    `);

    const executorSchema1 = toExecutorSchema(testSchema1);
    const executorSchema2 = toExecutorSchema(testSchema2);

    const composedSchema = composeSubschemas({
      subschemas: [{ schema: executorSchema1 }, { schema: executorSchema2 }],
    });

    const QueryRootType = assertObjectType(
      composedSchema.executorSchema.getType({
        kind: Kind.NAMED_TYPE,
        name: { kind: Kind.NAME, value: 'QueryRoot' },
      }),
    );

    expect(QueryRootType.getFields()).to.deep.equal({
      someField: testSchema1.getQueryType()?.getFields().someField,
      anotherField: testSchema2.getQueryType()?.getFields().anotherField,
    });
  });

  it('merges root mutation fields', () => {
    const testSchema1: GraphQLSchema = buildSchema(`
      schema {
        mutation: MutationRoot
      }

      type MutationRoot {
        someField: String
      }
    `);

    const testSchema2: GraphQLSchema = buildSchema(`
      schema {
        mutation: MutationRoot
      }

      type MutationRoot {
        anotherField: String
      }
    `);

    const executorSchema1 = toExecutorSchema(testSchema1);
    const executorSchema2 = toExecutorSchema(testSchema2);

    expect(() =>
      composeSubschemas({
        subschemas: [{ schema: executorSchema1 }, { schema: executorSchema2 }],
      }),
    ).to.not.throw();
  });

  it('merges root subscription fields', () => {
    const testSchema1: GraphQLSchema = buildSchema(`
      schema {
        subscription: SubscriptionRoot
      }

      type SubscriptionRoot {
        someField: String
      }
    `);

    const testSchema2: GraphQLSchema = buildSchema(`
      schema {
        subscription: SubscriptionRoot
      }

      type SubscriptionRoot {
        anotherField: String
      }
    `);

    const executorSchema1 = toExecutorSchema(testSchema1);
    const executorSchema2 = toExecutorSchema(testSchema2);

    expect(() =>
      composeSubschemas({
        subschemas: [{ schema: executorSchema1 }, { schema: executorSchema2 }],
      }),
    ).to.not.throw();
  });

  it('throws with type clash', () => {
    const testSchema1: GraphQLSchema = buildSchema(`
      scalar SomeType

      type Query {
        someField: SomeType
      }
    `);

    const testSchema2: GraphQLSchema = buildSchema(`
      enum SomeType

      type Query {
        someField: SomeType
      }
    `);

    const executorSchema1 = toExecutorSchema(testSchema1);
    const executorSchema2 = toExecutorSchema(testSchema2);

    expect(() =>
      composeSubschemas({
        subschemas: [{ schema: executorSchema1 }, { schema: executorSchema2 }],
      }),
    ).throws(
      'Subchema 0 includes a type with name "SomeType" of kind "SCALAR", but a type with name "SomeType" in subschema 1 is of kind "ENUM".',
    );
  });

  it('does not throw', () => {
    // TODO: set up new executable test schema
    const testSchema: GraphQLSchema = buildSchema(`
      interface Mammal {
        mother: Mammal
        father: Mammal
      }

      interface Pet {
        name(surname: Boolean): String
      }

      interface Canine${handlePre15(' implements Mammal', '')} {
        name(surname: Boolean): String
        mother: Canine
        father: Canine
      }

      enum DogCommand {
        SIT
        HEEL
        DOWN
      }

      type Dog implements Pet & Mammal & Canine {
        name(surname: Boolean): String
        nickname: String
        barkVolume: Int
        barks: Boolean
        doesKnowCommand(dogCommand: DogCommand): Boolean
        isHouseTrained(atOtherHomes: Boolean = true): Boolean
        isAtLocation(x: Int, y: Int): Boolean
        mother: Dog
        father: Dog
      }

      type Cat implements Pet {
        name(surname: Boolean): String
        nickname: String
        meows: Boolean
        meowsVolume: Int
        furColor: FurColor
      }

      union CatOrDog = Cat | Dog

      type Human {
        name(surname: Boolean): String
        pets: [Pet]
        relatives: [Human]!
      }

      enum FurColor {
        BROWN
        BLACK
        TAN
        SPOTTED
        NO_FUR
        UNKNOWN
      }

      input ComplexInput {
        requiredField: Boolean!
        nonNullField: Boolean! = false
        intField: Int
        stringField: String
        booleanField: Boolean
        stringListField: [String]
      }

      type ComplicatedArgs {
        # TODO List
        # TODO Coercion
        # TODO NotNulls
        intArgField(intArg: Int): String
        nonNullIntArgField(nonNullIntArg: Int!): String
        stringArgField(stringArg: String): String
        booleanArgField(booleanArg: Boolean): String
        enumArgField(enumArg: FurColor): String
        floatArgField(floatArg: Float): String
        idArgField(idArg: ID): String
        stringListArgField(stringListArg: [String]): String
        stringListNonNullArgField(stringListNonNullArg: [String!]): String
        complexArgField(complexArg: ComplexInput): String
        multipleReqs(req1: Int!, req2: Int!): String
        nonNullFieldWithDefault(arg: Int! = 0): String
        multipleOpts(opt1: Int = 0, opt2: Int = 0): String
        multipleOptAndReq(req1: Int!, req2: Int!, opt1: Int = 0, opt2: Int = 0): String
      }

      type QueryRoot {
        human(id: ID): Human
        dog: Dog
        cat: Cat
        pet: Pet
        catOrDog: CatOrDog
        complicatedArgs: ComplicatedArgs
      }

      schema {
        query: QueryRoot
      }

      directive @onField on FIELD
    `);

    const executorSchema1 = toExecutorSchema(testSchema);
    const executorSchema2 = toExecutorSchema(testSchema);

    expect(() =>
      composeSubschemas({
        subschemas: [{ schema: executorSchema1 }, { schema: executorSchema2 }],
      }),
    ).not.to.throw();
  });
});
