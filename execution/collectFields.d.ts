import type {
  FieldNode,
  FragmentDefinitionNode,
  GraphQLObjectType,
  GraphQLSchema,
  SelectionSetNode,
} from 'graphql';
import type { ObjMap } from '../jsutils/ObjMap';
/**
 * Given a selectionSet, collect all of the fields and returns it at the end.
 *
 * CollectFields requires the "runtime type" of an object. For a field which
 * returns an Interface or Union type, the "runtime type" will be the actual
 * Object type returned by that field.
 *
 * @internal
 */
export declare function collectFields(
  schema: GraphQLSchema,
  fragments: ObjMap<FragmentDefinitionNode>,
  variableValues: {
    [variable: string]: unknown;
  },
  runtimeType: GraphQLObjectType,
  selectionSet: SelectionSetNode,
): Map<string, ReadonlyArray<FieldNode>>;
/**
 * Given an array of field nodes, collects all of the subfields of the passed
 * in fields, and returns it at the end.
 *
 * CollectFields requires the "return type" of an object. For a field which
 * returns an Interface or Union type, the "return type" will be the actual
 * Object type returned by that field.
 *
 * @internal
 */
export declare function collectSubfields(
  schema: GraphQLSchema,
  fragments: ObjMap<FragmentDefinitionNode>,
  variableValues: {
    [variable: string]: unknown;
  },
  returnType: GraphQLObjectType,
  fieldNodes: ReadonlyArray<FieldNode>,
): Map<string, ReadonlyArray<FieldNode>>;
