import { isUnionType } from '../type/definition.mjs';
import { memoize2 } from '../jsutils/memoize2.mjs';
import { getImplementations } from './getImplementations.mjs';

function _getPossibleTypes(schema, abstractType) {
  return isUnionType(abstractType)
    ? abstractType.getTypes()
    : getImplementations(schema, abstractType).objects;
}

export const getPossibleTypes = memoize2(_getPossibleTypes);
