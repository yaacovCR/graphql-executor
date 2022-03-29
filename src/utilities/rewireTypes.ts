import type {
  GraphQLFieldConfigArgumentMap,
  GraphQLFieldConfigMap,
  GraphQLInputFieldConfigMap,
  GraphQLNamedType,
  GraphQLType,
} from 'graphql';
import {
  GraphQLDirective,
  GraphQLEnumType,
  GraphQLInputObjectType,
  GraphQLInterfaceType,
  GraphQLList,
  GraphQLObjectType,
  GraphQLNonNull,
  GraphQLScalarType,
  GraphQLUnionType,
  isInterfaceType,
  isEnumType,
  isInputObjectType,
  isListType,
  isNamedType,
  isNonNullType,
  isObjectType,
  isScalarType,
  isUnionType,
  isSpecifiedScalarType,
  isSpecifiedDirective,
} from 'graphql';

import { inspect } from '../jsutils/inspect';
import { invariant } from '../jsutils/invariant';

import type { ObjMap } from '../jsutils/ObjMap';

export function rewireTypes(
  originalTypeMap: ObjMap<GraphQLNamedType | null>,
  directives: ReadonlyArray<GraphQLDirective>,
): {
  typeMap: ObjMap<GraphQLNamedType>;
  directives: Array<GraphQLDirective>;
} {
  const referenceTypeMap: ObjMap<GraphQLNamedType | null> = Object.create(null);
  for (const [typeName, type] of Object.entries(originalTypeMap)) {
    referenceTypeMap[typeName] = type;
  }
  const newTypeMap: ObjMap<GraphQLNamedType> = Object.create(null);

  for (const [typeName, type] of Object.entries(referenceTypeMap)) {
    const namedType = type;

    if (namedType == null || typeName.startsWith('__')) {
      continue;
    }

    const newName = namedType.name;
    if (newTypeMap[newName]) {
      throw new Error(
        `Schema must contain uniquely named types but rewired types include multiple types named "${newName}".`,
      );
    }

    newTypeMap[newName] = namedType;
  }

  for (const [typeName, type] of Object.entries(newTypeMap)) {
    newTypeMap[typeName] = rewireNamedType(type);
  }

  const newDirectives = directives.map((directive) =>
    rewireDirective(directive),
  );

  return {
    typeMap: newTypeMap,
    directives: newDirectives,
  };

  function rewireDirective(directive: GraphQLDirective): GraphQLDirective {
    if (isSpecifiedDirective(directive)) {
      return directive;
    }
    const directiveConfig = directive.toConfig();
    directiveConfig.args = rewireArgs(directiveConfig.args);
    return new GraphQLDirective(directiveConfig);
  }

  function rewireArgs(
    args: GraphQLFieldConfigArgumentMap,
  ): GraphQLFieldConfigArgumentMap {
    const rewiredArgs: GraphQLFieldConfigArgumentMap = {};
    for (const [argName, arg] of Object.entries(args)) {
      const rewiredArgType = rewireType(arg.type);
      if (rewiredArgType != null) {
        arg.type = rewiredArgType;
        rewiredArgs[argName] = arg;
      }
    }
    return rewiredArgs;
  }

  function rewireNamedType<T extends GraphQLNamedType>(type: T) {
    if (isObjectType(type)) {
      const config = type.toConfig();
      const newConfig = {
        ...config,
        fields: () => rewireFields(config.fields),
        interfaces: () => rewireNamedTypes(config.interfaces),
      };
      return new GraphQLObjectType(newConfig);
    } else if (isInterfaceType(type)) {
      const config = type.toConfig();
      const newConfig: any = {
        ...config,
        fields: () => rewireFields(config.fields),
      };
      if ('interfaces' in newConfig) {
        newConfig.interfaces = () =>
          rewireNamedTypes(
            (config as unknown as { interfaces: Array<GraphQLInterfaceType> })
              .interfaces,
          );
      }
      return new GraphQLInterfaceType(newConfig);
    } else if (isUnionType(type)) {
      const config = type.toConfig();
      const newConfig = {
        ...config,
        types: () => rewireNamedTypes(config.types),
      };
      return new GraphQLUnionType(newConfig);
    } else if (isInputObjectType(type)) {
      const config = type.toConfig();
      const newConfig = {
        ...config,
        fields: () => rewireInputFields(config.fields),
      };
      return new GraphQLInputObjectType(newConfig);
    } else if (isEnumType(type)) {
      const enumConfig = type.toConfig();
      return new GraphQLEnumType(enumConfig);
    } else if (isScalarType(type)) {
      if (isSpecifiedScalarType(type)) {
        return type;
      }
      const scalarConfig = type.toConfig();
      return new GraphQLScalarType(scalarConfig);
    }
    /* c8 ignore next 3 */
    // Not reachable. All possible type kinds have been considered.
    invariant(false, 'Unexpected type kind: ' + inspect(type));
  }

  function rewireFields(
    fields: GraphQLFieldConfigMap<unknown, unknown>,
  ): GraphQLFieldConfigMap<unknown, unknown> {
    const rewiredFields: GraphQLFieldConfigMap<unknown, unknown> = {};
    for (const [fieldName, field] of Object.entries(fields)) {
      const rewiredFieldType = rewireType(field.type);
      if (rewiredFieldType != null && field.args) {
        field.type = rewiredFieldType;
        field.args = rewireArgs(field.args);
        rewiredFields[fieldName] = field;
      }
    }
    return rewiredFields;
  }

  function rewireInputFields(
    fields: GraphQLInputFieldConfigMap,
  ): GraphQLInputFieldConfigMap {
    const rewiredFields: GraphQLInputFieldConfigMap = {};
    for (const [fieldName, field] of Object.entries(fields)) {
      const rewiredFieldType = rewireType(field.type);
      if (rewiredFieldType != null) {
        field.type = rewiredFieldType;
        rewiredFields[fieldName] = field;
      }
    }
    return rewiredFields;
  }

  function rewireNamedTypes<T extends GraphQLNamedType>(
    namedTypes: Iterable<T>,
  ): Array<T> {
    const rewiredTypes: Array<T> = [];
    for (const namedType of namedTypes) {
      const rewiredType = rewireType(namedType);
      if (rewiredType != null) {
        rewiredTypes.push(rewiredType);
      }
    }
    return rewiredTypes;
  }

  function rewireType<T extends GraphQLType>(type: T): T | null {
    if (isListType(type)) {
      const rewiredType = rewireType(type.ofType);
      return rewiredType != null ? (new GraphQLList(rewiredType) as T) : null;
    } else if (isNonNullType(type)) {
      const rewiredType = rewireType(type.ofType);
      return rewiredType != null
        ? (new GraphQLNonNull(rewiredType) as T)
        : null;
    } else if (isNamedType(type)) {
      let rewiredType = referenceTypeMap[type.name];
      if (rewiredType === undefined) {
        rewiredType = rewireNamedType(type);
        newTypeMap[rewiredType.name] = referenceTypeMap[type.name] =
          rewiredType;
      }
      return rewiredType != null ? (newTypeMap[rewiredType.name] as T) : null;
    }
    /* c8 ignore next 3 */
    // Not reachable. All possible type kinds have been considered.
    invariant(false, 'Unexpected type kind: ' + inspect(type));
  }
}
