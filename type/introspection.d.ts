import type { GraphQLField, GraphQLNamedType } from 'graphql';
import { GraphQLObjectType } from 'graphql';
export declare const __Schema: GraphQLObjectType;
export declare const __Directive: GraphQLObjectType;
export declare const __Type: GraphQLObjectType;
export declare const __Field: GraphQLObjectType;
export declare const __InputValue: GraphQLObjectType;
/**
 * Note that these are GraphQLField and not GraphQLFieldConfig,
 * so the format for args is different.
 */
export declare const SchemaMetaFieldDef: GraphQLField<unknown, unknown, any>;
export declare const TypeMetaFieldDef: GraphQLField<unknown, unknown, any>;
export declare const DirectiveMetaFieldDef: GraphQLField<unknown, unknown, any>;
export declare const introspectionTypes: ReadonlyArray<GraphQLNamedType>;
