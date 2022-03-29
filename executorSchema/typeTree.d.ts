import type {
  GraphQLList,
  GraphQLNonNull,
  GraphQLType,
  TypeNode,
} from 'graphql';
/**
 * @internal
 */
export declare class TypeTree {
  private _isListType;
  private _isNonNullType;
  private _rootNode;
  private _typeStrings;
  constructor(
    isListType: (type: unknown) => type is GraphQLList<any>,
    isNonNullType: (type: unknown) => type is GraphQLNonNull<any>,
  );
  add(type: GraphQLType): void;
  get(typeNode: TypeNode): GraphQLType | undefined;
  has(typeString: string): boolean;
  private _get;
  private _add;
}
