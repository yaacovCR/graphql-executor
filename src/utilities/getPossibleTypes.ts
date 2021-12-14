import type {
  GraphQLAbstractType,
  GraphQLObjectType,
  GraphQLSchema,
} from 'graphql';

import { isUnionType } from '../type/definition';

import { memoize2 } from '../jsutils/memoize2';

import { getImplementations } from './getImplementations';

function _getPossibleTypes(
  schema: GraphQLSchema,
  abstractType: GraphQLAbstractType,
): ReadonlyArray<GraphQLObjectType> {
  return isUnionType(abstractType)
    ? abstractType.getTypes()
    : getImplementations(schema, abstractType).objects;
}
export const getPossibleTypes = memoize2(_getPossibleTypes);
