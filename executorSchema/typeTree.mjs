import { Kind } from 'graphql';

/**
 * @internal
 */
export class TypeTree {
  constructor(isListType, isNonNullType) {
    this._isListType = isListType;
    this._isNonNullType = isNonNullType;
    this._rootNode = {
      [Kind.NAMED_TYPE]: new Map(),
    };
    this._typeStrings = new Set();
  }

  add(type) {
    this._add(type, this._rootNode);

    this._typeStrings.add(type.toString());
  }

  get(typeNode) {
    return this._get(typeNode, this._rootNode);
  }

  has(typeString) {
    return this._typeStrings.has(typeString);
  }

  _get(typeNode, node) {
    switch (typeNode.kind) {
      case Kind.LIST_TYPE: {
        const listNode = node[Kind.LIST_TYPE]; // this never happens because the ExecutorSchema adds all possible types

        /* c8 ignore next 3 */

        if (!listNode) {
          return;
        }

        return this._get(typeNode.type, listNode);
      }

      case Kind.NON_NULL_TYPE: {
        const nonNullNode = node[Kind.NON_NULL_TYPE]; // this never happens because the ExecutorSchema adds all possible types

        /* c8 ignore next 3 */

        if (!nonNullNode) {
          return;
        }

        return this._get(typeNode.type, nonNullNode);
      }

      case Kind.NAMED_TYPE:
        return node[Kind.NAMED_TYPE].get(typeNode.name.value);
    }
  }

  _add(originalType, node, type = originalType) {
    if (this._isListType(type)) {
      let listTypeNode = node[Kind.LIST_TYPE];

      if (!listTypeNode) {
        listTypeNode = node[Kind.LIST_TYPE] = {
          [Kind.NAMED_TYPE]: new Map(),
        };
      }

      this._add(originalType, listTypeNode, type.ofType);
    } else if (this._isNonNullType(type)) {
      let nonNullTypeNode = node[Kind.NON_NULL_TYPE];

      if (!nonNullTypeNode) {
        nonNullTypeNode = node[Kind.NON_NULL_TYPE] = {
          [Kind.NAMED_TYPE]: new Map(),
        };
      }

      this._add(originalType, nonNullTypeNode, type.ofType);
    } else {
      node[Kind.NAMED_TYPE].set(type.name, originalType);
    }
  }
}
