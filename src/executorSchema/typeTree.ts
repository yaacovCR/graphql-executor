import type {
  GraphQLList,
  GraphQLNamedType,
  GraphQLNonNull,
  GraphQLType,
  TypeNode,
} from 'graphql';
import { Kind } from 'graphql';

interface TypeTreeNode {
  [Kind.LIST_TYPE]?: TypeTreeNode;
  [Kind.NON_NULL_TYPE]?: TypeTreeNode;
  [Kind.NAMED_TYPE]: Map<string, GraphQLType>;
}

/**
 * @internal
 */
export class TypeTree {
  private _isListType: (type: unknown) => type is GraphQLList<any>;
  private _isNonNullType: (type: unknown) => type is GraphQLNonNull<any>;
  private _rootNode: TypeTreeNode;
  private _typeStrings: Set<string>;

  constructor(
    isListType: (type: unknown) => type is GraphQLList<any>,
    isNonNullType: (type: unknown) => type is GraphQLNonNull<any>,
  ) {
    this._isListType = isListType;
    this._isNonNullType = isNonNullType;
    this._rootNode = {
      [Kind.NAMED_TYPE]: new Map(),
    };
    this._typeStrings = new Set();
  }

  add(type: GraphQLType): void {
    this._add(type, this._rootNode);
    this._typeStrings.add(type.toString());
  }

  get(typeNode: TypeNode): GraphQLType | undefined {
    return this._get(typeNode, this._rootNode);
  }

  has(typeString: string): boolean {
    return this._typeStrings.has(typeString);
  }

  private _get(
    typeNode: TypeNode,
    node: TypeTreeNode,
  ): GraphQLType | undefined {
    switch (typeNode.kind) {
      case Kind.LIST_TYPE: {
        const listNode = node[Kind.LIST_TYPE];
        // this never happens because the ExecutorSchema adds all possible types
        /* c8 ignore next 3 */
        if (!listNode) {
          return;
        }
        return this._get(typeNode.type, listNode);
      }
      case Kind.NON_NULL_TYPE: {
        const nonNullNode = node[Kind.NON_NULL_TYPE];
        // this never happens because the ExecutorSchema adds all possible types
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

  private _add(
    originalType: GraphQLType,
    node: TypeTreeNode,
    type = originalType,
  ): void {
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
      node[Kind.NAMED_TYPE].set((type as GraphQLNamedType).name, originalType);
    }
  }
}
