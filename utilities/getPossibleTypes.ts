import type {
  GraphQLAbstractType,
  GraphQLObjectType,
  GraphQLSchema,
} from 'graphql';
import { isUnionType } from '../type/definition.ts';
import { memoize2 } from '../jsutils/memoize2.ts';
import { getImplementations } from './getImplementations.ts';

function _getPossibleTypes(
  schema: GraphQLSchema,
  abstractType: GraphQLAbstractType,
): ReadonlyArray<GraphQLObjectType> {
  return isUnionType(abstractType)
    ? abstractType.getTypes()
    : getImplementations(schema, abstractType).objects;
}

export const getPossibleTypes = memoize2(_getPossibleTypes);
