import type { GraphQLInputType } from 'graphql';
import { GraphQLList, GraphQLNonNull } from 'graphql';
export declare function getPossibleInputTypes(
  isListType: (type: unknown) => type is GraphQLList<any>,
  isNonNullType: (type: unknown) => type is GraphQLNonNull<any>,
  type: GraphQLInputType,
): Array<GraphQLInputType>;
