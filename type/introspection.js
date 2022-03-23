'use strict';

Object.defineProperty(exports, '__esModule', {
  value: true,
});
exports.introspectionTypes =
  exports.__Type =
  exports.__Schema =
  exports.__InputValue =
  exports.__Field =
  exports.__Directive =
  exports.TypeMetaFieldDef =
  exports.SchemaMetaFieldDef =
  exports.DirectiveMetaFieldDef =
    void 0;

var _graphql = require('graphql');

var _inspect = require('../jsutils/inspect.js');

var _invariant = require('../jsutils/invariant.js');

const __Schema = new _graphql.GraphQLObjectType({
  name: '__Schema',
  description:
    'A GraphQL Schema defines the capabilities of a GraphQL server. It exposes all available types and directives on the server, as well as the entry points for query, mutation, and subscription operations.',
  fields: () => ({
    description: {
      type: _graphql.GraphQLString,
      resolve: (executorSchema) => executorSchema.description,
    },
    types: {
      description: 'A list of all types supported by this server.',
      type: new _graphql.GraphQLNonNull(
        new _graphql.GraphQLList(new _graphql.GraphQLNonNull(__Type)),
      ),
      resolve: (executorSchema) => executorSchema.getNamedTypes(),
    },
    queryType: {
      description: 'The type that query operations will be rooted at.',
      type: new _graphql.GraphQLNonNull(__Type),
      resolve: (executorSchema) => executorSchema.getRootType('query'),
    },
    mutationType: {
      description:
        'If this server supports mutation, the type that mutation operations will be rooted at.',
      type: __Type,
      resolve: (executorSchema) => executorSchema.getRootType('mutation'),
    },
    subscriptionType: {
      description:
        'If this server support subscription, the type that subscription operations will be rooted at.',
      type: __Type,
      resolve: (executorSchema) => executorSchema.getRootType('subscription'),
    },
    directives: {
      description: 'A list of all directives supported by this server.',
      type: new _graphql.GraphQLNonNull(
        new _graphql.GraphQLList(new _graphql.GraphQLNonNull(__Directive)),
      ),
      resolve: (executorSchema) => executorSchema.getDirectives(),
    },
  }),
});

exports.__Schema = __Schema;

const __Directive = new _graphql.GraphQLObjectType({
  name: '__Directive',
  description:
    "A Directive provides a way to describe alternate runtime execution and type validation behavior in a GraphQL document.\n\nIn some cases, you need to provide options to alter GraphQL's execution behavior in ways field arguments will not suffice, such as conditionally including or skipping a field. Directives provide this by describing additional information to the executor.",
  fields: () => ({
    name: {
      type: new _graphql.GraphQLNonNull(_graphql.GraphQLString),
      resolve: (directive) => directive.name,
    },
    description: {
      type: _graphql.GraphQLString,
      resolve: (directive) => directive.description,
    },
    isRepeatable: {
      type: new _graphql.GraphQLNonNull(_graphql.GraphQLBoolean),
      resolve: (directive) => directive.isRepeatable,
    },
    locations: {
      type: new _graphql.GraphQLNonNull(
        new _graphql.GraphQLList(
          new _graphql.GraphQLNonNull(_graphql.__DirectiveLocation),
        ),
      ),
      resolve: (directive) => directive.locations,
    },
    args: {
      type: new _graphql.GraphQLNonNull(
        new _graphql.GraphQLList(new _graphql.GraphQLNonNull(__InputValue)),
      ),
      args: {
        includeDeprecated: {
          type: _graphql.GraphQLBoolean,
          defaultValue: false,
        },
      },

      resolve(field, { includeDeprecated }) {
        return includeDeprecated
          ? field.args
          : field.args.filter((arg) => arg.deprecationReason == null);
      },
    },
  }),
});

exports.__Directive = __Directive;

const __Type = new _graphql.GraphQLObjectType({
  name: '__Type',
  description:
    'The fundamental unit of any GraphQL Schema is the type. There are many kinds of types in GraphQL as represented by the `__TypeKind` enum.\n\nDepending on the kind of a type, certain fields describe information about that type. Scalar types provide no information beyond a name, description and optional `specifiedByURL`, while Enum types provide their values. Object and Interface types provide the fields they describe. Abstract types, Union and Interface, provide the Object types possible at runtime. List and NonNull types compose other types.',
  fields: () => ({
    kind: {
      type: new _graphql.GraphQLNonNull(_graphql.__TypeKind),

      resolve(type, _args, _context, { executorSchema }) {
        if (executorSchema.isScalarType(type)) {
          return _graphql.TypeKind.SCALAR;
        }

        if (executorSchema.isObjectType(type)) {
          return _graphql.TypeKind.OBJECT;
        }

        if (executorSchema.isInterfaceType(type)) {
          return _graphql.TypeKind.INTERFACE;
        }

        if (executorSchema.isUnionType(type)) {
          return _graphql.TypeKind.UNION;
        }

        if (executorSchema.isEnumType(type)) {
          return _graphql.TypeKind.ENUM;
        }

        if (executorSchema.isInputObjectType(type)) {
          return _graphql.TypeKind.INPUT_OBJECT;
        }

        if (executorSchema.isListType(type)) {
          return _graphql.TypeKind.LIST;
        }

        if (executorSchema.isNonNullType(type)) {
          return _graphql.TypeKind.NON_NULL;
        }
        /* c8 ignore next 3 */
        // Not reachable, all possible types have been considered)

        false ||
          (0, _invariant.invariant)(
            false,
            `Unexpected type: "${(0, _inspect.inspect)(type)}".`,
          );
      },
    },
    name: {
      type: _graphql.GraphQLString,
      resolve: (type) => ('name' in type ? type.name : undefined),
    },
    description: {
      type: _graphql.GraphQLString,
      resolve: (
        type, // FIXME: add test case
      ) =>
        /* c8 ignore next */
        'description' in type ? type.description : undefined,
    },
    specifiedByURL: {
      type: _graphql.GraphQLString,
      resolve: (obj) =>
        'specifiedByURL' in obj ? obj.specifiedByURL : undefined,
    },
    fields: {
      type: new _graphql.GraphQLList(new _graphql.GraphQLNonNull(__Field)),
      args: {
        includeDeprecated: {
          type: _graphql.GraphQLBoolean,
          defaultValue: false,
        },
      },

      resolve(type, { includeDeprecated }, _context, { executorSchema }) {
        if (
          executorSchema.isObjectType(type) ||
          executorSchema.isInterfaceType(type)
        ) {
          const fields = Object.values(type.getFields());
          return includeDeprecated
            ? fields
            : fields.filter((field) => field.deprecationReason == null);
        }
      },
    },
    interfaces: {
      type: new _graphql.GraphQLList(new _graphql.GraphQLNonNull(__Type)),

      resolve(type) {
        if ('getInterfaces' in type) {
          return type.getInterfaces();
        }
      },
    },
    possibleTypes: {
      type: new _graphql.GraphQLList(new _graphql.GraphQLNonNull(__Type)),

      resolve(type, _args, _context, { executorSchema }) {
        if (executorSchema.isAbstractType(type)) {
          return executorSchema.getPossibleTypes(type);
        }
      },
    },
    enumValues: {
      type: new _graphql.GraphQLList(
        new _graphql.GraphQLNonNull(_graphql.__EnumValue),
      ),
      args: {
        includeDeprecated: {
          type: _graphql.GraphQLBoolean,
          defaultValue: false,
        },
      },

      resolve(type, { includeDeprecated }, _context, { executorSchema }) {
        if (executorSchema.isEnumType(type)) {
          const values = type.getValues();
          return includeDeprecated
            ? values
            : values.filter((field) => field.deprecationReason == null);
        }
      },
    },
    inputFields: {
      type: new _graphql.GraphQLList(new _graphql.GraphQLNonNull(__InputValue)),
      args: {
        includeDeprecated: {
          type: _graphql.GraphQLBoolean,
          defaultValue: false,
        },
      },

      resolve(type, { includeDeprecated }, _context, { executorSchema }) {
        if (executorSchema.isInputObjectType(type)) {
          const values = Object.values(type.getFields());
          return includeDeprecated
            ? values
            : values.filter((field) => field.deprecationReason == null);
        }
      },
    },
    ofType: {
      type: __Type,
      resolve: (type) => ('ofType' in type ? type.ofType : undefined),
    },
  }),
});

exports.__Type = __Type;

const __Field = new _graphql.GraphQLObjectType({
  name: '__Field',
  description:
    'Object and Interface types are described by a list of Fields, each of which has a name, potentially a list of arguments, and a return type.',
  fields: () => ({
    name: {
      type: new _graphql.GraphQLNonNull(_graphql.GraphQLString),
      resolve: (field) => field.name,
    },
    description: {
      type: _graphql.GraphQLString,
      resolve: (field) => field.description,
    },
    args: {
      type: new _graphql.GraphQLNonNull(
        new _graphql.GraphQLList(new _graphql.GraphQLNonNull(__InputValue)),
      ),
      args: {
        includeDeprecated: {
          type: _graphql.GraphQLBoolean,
          defaultValue: false,
        },
      },

      resolve(field, { includeDeprecated }) {
        return includeDeprecated
          ? field.args
          : field.args.filter((arg) => arg.deprecationReason == null);
      },
    },
    type: {
      type: new _graphql.GraphQLNonNull(__Type),
      resolve: (field) => field.type,
    },
    isDeprecated: {
      type: new _graphql.GraphQLNonNull(_graphql.GraphQLBoolean),
      resolve: (field) => field.deprecationReason != null,
    },
    deprecationReason: {
      type: _graphql.GraphQLString,
      resolve: (field) => field.deprecationReason,
    },
  }),
});

exports.__Field = __Field;

const __InputValue = new _graphql.GraphQLObjectType({
  name: '__InputValue',
  description:
    'Arguments provided to Fields or Directives and the input fields of an InputObject are represented as Input Values which describe their type and optionally a default value.',
  fields: () => ({
    name: {
      type: new _graphql.GraphQLNonNull(_graphql.GraphQLString),
      resolve: (inputValue) => inputValue.name,
    },
    description: {
      type: _graphql.GraphQLString,
      resolve: (inputValue) => inputValue.description,
    },
    type: {
      type: new _graphql.GraphQLNonNull(__Type),
      resolve: (inputValue) => inputValue.type,
    },
    defaultValue: {
      type: _graphql.GraphQLString,
      description:
        'A GraphQL-formatted string representing the default value for this input value.',

      resolve(inputValue) {
        const { type, defaultValue } = inputValue;
        const valueAST = (0, _graphql.astFromValue)(defaultValue, type);
        return valueAST ? (0, _graphql.print)(valueAST) : null;
      },
    },
    isDeprecated: {
      type: new _graphql.GraphQLNonNull(_graphql.GraphQLBoolean),
      resolve: (field) => field.deprecationReason != null,
    },
    deprecationReason: {
      type: _graphql.GraphQLString,
      resolve: (obj) => obj.deprecationReason,
    },
  }),
});
/**
 * Note that these are GraphQLField and not GraphQLFieldConfig,
 * so the format for args is different.
 */

exports.__InputValue = __InputValue;
const SchemaMetaFieldDef = {
  name: '__schema',
  type: new _graphql.GraphQLNonNull(__Schema),
  description: 'Access the current type schema of this server.',
  args: [],
  resolve: (_source, _args, _context, { executorSchema }) => executorSchema,
  isDeprecated: false,
  deprecationReason: undefined,
  extensions: Object.create(null),
  astNode: undefined,
};
exports.SchemaMetaFieldDef = SchemaMetaFieldDef;
const nameArgument = {
  name: 'name',
  description: undefined,
  type: new _graphql.GraphQLNonNull(_graphql.GraphQLString),
  defaultValue: undefined,
  deprecationReason: undefined,
  extensions: Object.create(null),
  astNode: undefined,
};
const TypeMetaFieldDef = {
  name: '__type',
  type: __Type,
  description: 'Request the type information of a single type.',
  args: [nameArgument],
  resolve: (_source, { name }, _context, { executorSchema }) =>
    executorSchema.getNamedType(name),
  isDeprecated: false,
  deprecationReason: undefined,
  extensions: Object.create(null),
  astNode: undefined,
};
exports.TypeMetaFieldDef = TypeMetaFieldDef;
const DirectiveMetaFieldDef = {
  name: '__directive',
  type: __Directive,
  description: 'Request the directive information of a single directive.',
  args: [nameArgument],
  resolve: (_source, { name }, _context, { executorSchema }) =>
    executorSchema.getDirective(name),
  isDeprecated: false,
  deprecationReason: undefined,
  extensions: Object.create(null),
  astNode: undefined,
};
exports.DirectiveMetaFieldDef = DirectiveMetaFieldDef;
const introspectionTypes = Object.freeze([
  __Schema,
  __Directive,
  _graphql.__DirectiveLocation,
  __Type,
  __Field,
  __InputValue,
  _graphql.__EnumValue,
  _graphql.__TypeKind,
]);
exports.introspectionTypes = introspectionTypes;
