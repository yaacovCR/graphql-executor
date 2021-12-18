import type {
  GraphQLAbstractType,
  GraphQLInterfaceType,
  GraphQLObjectType,
  GraphQLSchema,
} from 'graphql';
import { isUnionType } from '../type/definition.ts';
import { memoize1 } from '../jsutils/memoize1.ts';
import { memoize3 } from '../jsutils/memoize3.ts';
import { getImplementations } from './getImplementations.ts';

function _getSubTypeMap(_schema: GraphQLSchema) {
  return Object.create(null);
}

const getSubTypeMap = memoize1(_getSubTypeMap);

function _isSubType(
  schema: GraphQLSchema,
  abstractType: GraphQLAbstractType,
  maybeSubType: GraphQLObjectType | GraphQLInterfaceType,
): boolean {
  const subTypeMap = getSubTypeMap(schema);
  let map = subTypeMap[abstractType.name];

  if (map === undefined) {
    map = Object.create(null);

    if (isUnionType(abstractType)) {
      for (const type of abstractType.getTypes()) {
        map[type.name] = true;
      }
    } else {
      const implementations = getImplementations(schema, abstractType);

      for (const type of implementations.objects) {
        map[type.name] = true;
      }

      for (const type of implementations.interfaces) {
        map[type.name] = true;
      }
    }

    subTypeMap[abstractType.name] = map;
  }

  return map[maybeSubType.name] !== undefined;
}

export const isSubType = memoize3(_isSubType);
