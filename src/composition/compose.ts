import type {
  GraphQLDirective,
  GraphQLNamedType,
  GraphQLObjectType,
  OperationTypeNode,
} from 'graphql';

import type { Maybe } from '../jsutils/Maybe';
import type { ObjMap } from '../jsutils/ObjMap';

import type { ExecutorSchema } from '../executorSchema/executorSchema';
import { toExecutorSchemaImpl } from '../executorSchema/toExecutorSchema';

import { rewireTypes } from './rewireTypes';
import type { MergeInfo, NamedTypeRef, Subschema } from './typeRefs';
import { mergeTypeRefs } from './typeRefs';

export interface SubschemaConfig {
  schema: ExecutorSchema;
}

export interface CompositeSchema extends MergeInfo {
  executorSchema: ExecutorSchema;
  subschemas: ReadonlyArray<Subschema>;
}

export interface ComposeOptions {
  subschemas: ReadonlyArray<SubschemaConfig>;
}

export function compose(
  options: ComposeOptions,
): CompositeSchema {
  const subschemas: Array<Subschema> = [];

  let subschemaIndex = 0;
  for (const subschema of options.subschemas) {
    subschemas.push({ index: subschemaIndex++, ...subschema });
  }

  const typeRefMap: ObjMap<Array<NamedTypeRef>> = Object.create(null);
  const typeMap: ObjMap<GraphQLNamedType> = Object.create(null);
  const directiveMap: ObjMap<GraphQLDirective> = Object.create(null);

  const rootTypeNames: [
    string | undefined,
    string | undefined,
    string | undefined,
  ] = [undefined, undefined, undefined];

  for (const subschema of subschemas) {
    const { schema, index } = subschema;

    updateRootTypeNamesWithSubschema(rootTypeNames, schema, index);

    for (const type of schema.getNamedTypes()) {
      const typeName = type.name;
      if (!typeName.startsWith('__')) {
        if (!typeRefMap[typeName]) {
          typeRefMap[typeName] = [];
        }
        typeRefMap[typeName].push({ subschema, type });
      }
    }

    for (const directive of schema.getDirectives()) {
      directiveMap[directive.name] = directive;
    }
  }

  const mergedTypeInfo = Object.create(null);
  for (const [typeName, typeRefs] of Object.entries(typeRefMap)) {
    typeMap[typeName] = mergeTypeRefs(typeRefs);
  }

  const { typeMap: rewiredTypeMap, directives: rewiredDirectives } =
    rewireTypes(typeMap, Object.values(directiveMap));

  for (const directive of rewiredDirectives) {
    directiveMap[directive.name] = directive;
  }

  const executorSchema = toExecutorSchemaImpl({
    description: undefined,
    typeMap: rewiredTypeMap,
    directiveMap,
    queryType:
      rootTypeNames[0] === undefined
        ? undefined
        : (typeMap[rootTypeNames[0]] as Maybe<GraphQLObjectType>),
    mutationType:
      rootTypeNames[1] === undefined
        ? undefined
        : (typeMap[rootTypeNames[1]] as Maybe<GraphQLObjectType>),
    subscriptionType:
      rootTypeNames[2] === undefined
        ? undefined
        : (typeMap[rootTypeNames[2]] as Maybe<GraphQLObjectType>),
  });

  return {
    executorSchema,
    subschemas,
    ...mergedTypeInfo,
  };
}

function updateRootTypeNamesWithSubschema(
  rootTypeNames: [string | undefined, string | undefined, string | undefined],
  schema: ExecutorSchema,
  index: number,
): void {
  const operations = ['query', 'mutation', 'subscription'];

  const rootTypes = [
    schema.getRootType('query' as OperationTypeNode),
    schema.getRootType('mutation' as OperationTypeNode),
    schema.getRootType('subscription' as OperationTypeNode),
  ];

  for (let j = 0; j < rootTypeNames.length; j++) {
    const rootType = rootTypes[j];
    const rootTypeName = rootTypeNames[j];
    if (rootType) {
      if (rootTypeName === undefined) {
        rootTypeNames[j] = rootType.name;
        continue;
      }

      if (rootType.name !== rootTypeName) {
        throw new Error(
          `Subchema ${index} defines a root ${operations[j]} type with name "${rootType.name}", expected name "${rootTypeName}".`,
        );
      }
    }
  }
}
