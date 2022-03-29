'use strict';

Object.defineProperty(exports, '__esModule', {
  value: true,
});
exports.TypeTree = void 0;

var _graphql = require('graphql');

/**
 * @internal
 */
class TypeTree {
  constructor(isListType, isNonNullType) {
    this._isListType = isListType;
    this._isNonNullType = isNonNullType;
    this._rootNode = {
      [_graphql.Kind.NAMED_TYPE]: new Map(),
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
      case _graphql.Kind.LIST_TYPE: {
        const listNode = node[_graphql.Kind.LIST_TYPE]; // this never happens because the ExecutorSchema adds all possible types

        /* c8 ignore next 3 */

        if (!listNode) {
          return;
        }

        return this._get(typeNode.type, listNode);
      }

      case _graphql.Kind.NON_NULL_TYPE: {
        const nonNullNode = node[_graphql.Kind.NON_NULL_TYPE]; // this never happens because the ExecutorSchema adds all possible types

        /* c8 ignore next 3 */

        if (!nonNullNode) {
          return;
        }

        return this._get(typeNode.type, nonNullNode);
      }

      case _graphql.Kind.NAMED_TYPE:
        return node[_graphql.Kind.NAMED_TYPE].get(typeNode.name.value);
    }
  }

  _add(originalType, node, type = originalType) {
    if (this._isListType(type)) {
      let listTypeNode = node[_graphql.Kind.LIST_TYPE];

      if (!listTypeNode) {
        listTypeNode = node[_graphql.Kind.LIST_TYPE] = {
          [_graphql.Kind.NAMED_TYPE]: new Map(),
        };
      }

      this._add(originalType, listTypeNode, type.ofType);
    } else if (this._isNonNullType(type)) {
      let nonNullTypeNode = node[_graphql.Kind.NON_NULL_TYPE];

      if (!nonNullTypeNode) {
        nonNullTypeNode = node[_graphql.Kind.NON_NULL_TYPE] = {
          [_graphql.Kind.NAMED_TYPE]: new Map(),
        };
      }

      this._add(originalType, nonNullTypeNode, type.ofType);
    } else {
      node[_graphql.Kind.NAMED_TYPE].set(type.name, originalType);
    }
  }
}

exports.TypeTree = TypeTree;
