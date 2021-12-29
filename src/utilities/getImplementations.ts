import type {
  GraphQLInterfaceType,
  GraphQLObjectType,
  GraphQLSchema,
} from 'graphql';

import { memoize1 } from '../jsutils/memoize1';
import { memoize2 } from '../jsutils/memoize2';

import { isInterfaceType, isObjectType } from '../type/definition';

function _getImplementationsMap(schema: GraphQLSchema) {
  const implementationsMap = Object.create(null);
  for (const namedType of Object.values(schema.getTypeMap())) {
    // Backwards compatibility with v14
    if (
      typeof namedType === 'object' &&
      namedType &&
      isInterfaceType(namedType) &&
      'getInterfaces' in namedType
    ) {
      // Store implementations by interface.
      for (const iface of (
        namedType as {
          getInterfaces: () => ReadonlyArray<GraphQLInterfaceType>;
        }
      ).getInterfaces()) {
        if (isInterfaceType(iface)) {
          let implementations = implementationsMap[iface.name];
          // TODO: add test
          /* c8 ignore next 6 */
          if (implementations === undefined) {
            implementations = implementationsMap[iface.name] = {
              objects: [],
              interfaces: [],
            };
          }

          implementations.interfaces.push(namedType);
        }
      }
    } else if (
      typeof namedType === 'object' &&
      namedType &&
      isObjectType(namedType)
    ) {
      // Store implementations by objects.
      for (const iface of namedType.getInterfaces()) {
        if (isInterfaceType(iface)) {
          let implementations = implementationsMap[iface.name];
          if (implementations === undefined) {
            implementations = implementationsMap[iface.name] = {
              objects: [],
              interfaces: [],
            };
          }

          implementations.objects.push(namedType);
        }
      }
    }
  }
  return implementationsMap;
}
const getImplementationsMap = memoize1(_getImplementationsMap);

function _getImplementations(
  schema: GraphQLSchema,
  interfaceType: GraphQLInterfaceType,
): {
  objects: ReadonlyArray<GraphQLObjectType>;
  interfaces: ReadonlyArray<GraphQLInterfaceType>;
} {
  const implementationsMap = getImplementationsMap(schema);
  return implementationsMap[interfaceType.name];
}
export const getImplementations = memoize2(_getImplementations);
