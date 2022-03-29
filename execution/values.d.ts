import type {
  DirectiveNode,
  FieldNode,
  GraphQLDirective,
  GraphQLField,
  VariableDefinitionNode,
} from 'graphql';
import { GraphQLError } from 'graphql';
import type { ObjMap } from '../jsutils/ObjMap';
import type { Maybe } from '../jsutils/Maybe';
import type { ExecutorSchema } from '../executorSchema/executorSchema';
declare type CoercedVariableValues =
  | {
      errors: ReadonlyArray<GraphQLError>;
      coerced?: never;
    }
  | {
      coerced: {
        [variable: string]: unknown;
      };
      errors?: never;
    };
/**
 * Prepares an object map of variableValues of the correct type based on the
 * provided variable definitions and arbitrary input. If the input cannot be
 * parsed to match the variable definitions, a GraphQLError will be thrown.
 *
 * Note: The returned value is a plain Object with a prototype, since it is
 * exposed to user code. Care should be taken to not pull values from the
 * Object prototype.
 *
 * @internal
 */
export declare function getVariableValues(
  executorSchema: ExecutorSchema,
  varDefNodes: ReadonlyArray<VariableDefinitionNode>,
  inputs: {
    readonly [variable: string]: unknown;
  },
  options?: {
    maxErrors?: number;
  },
): CoercedVariableValues;
/**
 * Prepares an object map of argument values given a list of argument
 * definitions and list of argument AST nodes.
 *
 * Note: The returned value is a plain Object with a prototype, since it is
 * exposed to user code. Care should be taken to not pull values from the
 * Object prototype.
 *
 * @internal
 */
export declare function getArgumentValues(
  executorSchema: ExecutorSchema,
  def: GraphQLField<unknown, unknown> | GraphQLDirective,
  node: FieldNode | DirectiveNode,
  variableValues?: Maybe<ObjMap<unknown>>,
): {
  [argument: string]: unknown;
};
/**
 * Prepares an object map of argument values given a directive definition
 * and a AST node which may contain directives. Optionally also accepts a map
 * of variable values.
 *
 * If the directive does not exist on the node, returns undefined.
 *
 * Note: The returned value is a plain Object with a prototype, since it is
 * exposed to user code. Care should be taken to not pull values from the
 * Object prototype.
 */
export declare function getDirectiveValues(
  executorSchema: ExecutorSchema,
  directiveDef: GraphQLDirective,
  node: {
    readonly directives?: ReadonlyArray<DirectiveNode>;
  },
  variableValues?: Maybe<ObjMap<unknown>>,
):
  | undefined
  | {
      [argument: string]: unknown;
    };
export {};
