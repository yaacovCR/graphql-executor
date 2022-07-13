import type { DirectiveNode, FieldNode, VariableDefinitionNode } from 'graphql';

import { GraphQLError, Kind, print } from 'graphql';

import type { ObjMap } from '../jsutils/ObjMap';
import type { Maybe } from '../jsutils/Maybe';
import { keyMap } from '../jsutils/keyMap';
import { inspect } from '../jsutils/inspect';
import { printPathArray } from '../jsutils/printPathArray';

import { coerceInputValue } from '../utilities/coerceInputValue';
import { valueFromAST } from '../utilities/valueFromAST';

import type {
  Directive,
  ExecutorSchema,
  Field,
} from '../executorSchema/executorSchema';

type CoercedVariableValues =
  | { errors: ReadonlyArray<GraphQLError>; coerced?: never }
  | { coerced: { [variable: string]: unknown }; errors?: never };

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
export function getVariableValues(
  executorSchema: ExecutorSchema,
  varDefNodes: ReadonlyArray<VariableDefinitionNode>,
  inputs: { readonly [variable: string]: unknown },
  options?: { maxErrors?: number },
): CoercedVariableValues {
  const errors = [];
  const maxErrors = options?.maxErrors;
  try {
    const coerced = coerceVariableValues(
      executorSchema,
      varDefNodes,
      inputs,
      (error) => {
        if (maxErrors != null && errors.length >= maxErrors) {
          throw new GraphQLError(
            'Too many errors processing variables, error limit reached. Execution aborted.',
          );
        }
        errors.push(error);
      },
    );

    if (errors.length === 0) {
      return { coerced };
    }
  } catch (error) {
    errors.push(error);
  }

  return { errors };
}

function coerceVariableValues(
  executorSchema: ExecutorSchema,
  varDefNodes: ReadonlyArray<VariableDefinitionNode>,
  inputs: { readonly [variable: string]: unknown },
  onError: (error: GraphQLError) => void,
): { [variable: string]: unknown } {
  const coercedValues: { [variable: string]: unknown } = {};
  for (const varDefNode of varDefNodes) {
    const varName = varDefNode.variable.name.value;
    const varType = executorSchema.getType(varDefNode.type);
    if (!varType || !executorSchema.isInputType(varType)) {
      // Must use input types for variables. This should be caught during
      // validation, however is checked again here for safety.
      const varTypeStr = print(varDefNode.type);
      onError(
        new GraphQLError(
          `Variable "$${varName}" expected value of type "${varTypeStr}" which cannot be used as an input type.`,
          varDefNode.type,
        ),
      );
      continue;
    }

    if (!hasOwnProperty(inputs, varName)) {
      if (varDefNode.defaultValue) {
        coercedValues[varName] = valueFromAST(
          executorSchema,
          varDefNode.defaultValue,
          varType,
        );
      } else if (executorSchema.isNonNullType(varType)) {
        const varTypeStr = varType.toString();
        onError(
          new GraphQLError(
            `Variable "$${varName}" of required type "${varTypeStr}" was not provided.`,
            varDefNode,
          ),
        );
      }
      continue;
    }

    const value = inputs[varName];
    if (value === null && executorSchema.isNonNullType(varType)) {
      const varTypeStr = varType.toString();
      onError(
        new GraphQLError(
          `Variable "$${varName}" of non-null type "${varTypeStr}" must not be null.`,
          varDefNode,
        ),
      );
      continue;
    }

    coercedValues[varName] = coerceInputValue(
      executorSchema,
      value,
      varType,
      (path, invalidValue, error) => {
        let prefix =
          `Variable "$${varName}" got invalid value ` + inspect(invalidValue);
        if (path.length > 0) {
          prefix += ` at "${varName}${printPathArray(path)}"`;
        }
        onError(
          new GraphQLError(
            prefix + '; ' + error.message,
            varDefNode,
            undefined,
            undefined,
            undefined,
            error.originalError,
          ),
        );
      },
    );
  }

  return coercedValues;
}

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
export function getArgumentValues(
  executorSchema: ExecutorSchema,
  def: Field<unknown, unknown> | Directive,
  node: FieldNode | DirectiveNode,
  variableValues?: Maybe<ObjMap<unknown>>,
): { [argument: string]: unknown } {
  const coercedValues: { [argument: string]: unknown } = {};

  // FIXME: https://github.com/graphql/graphql-js/issues/2203
  /* c8 ignore next */
  const argumentNodes = node.arguments ?? [];
  const argNodeMap = keyMap(argumentNodes, (arg) => arg.name.value);

  for (const argDef of def.args) {
    const name = argDef.name;
    const argType = argDef.type;
    const argumentNode = argNodeMap[name];

    if (!argumentNode) {
      if (argDef.defaultValue !== undefined) {
        coercedValues[name] = argDef.defaultValue;
      } else if (executorSchema.isNonNullType(argType)) {
        throw new GraphQLError(
          `Argument "${name}" of required type "${argType.toString()}" ` +
            'was not provided.',
          node,
        );
      }
      continue;
    }

    const valueNode = argumentNode.value;
    let isNull = valueNode.kind === Kind.NULL;

    if (valueNode.kind === Kind.VARIABLE) {
      const variableName = valueNode.name.value;
      if (
        variableValues == null ||
        !hasOwnProperty(variableValues, variableName)
      ) {
        if (argDef.defaultValue !== undefined) {
          coercedValues[name] = argDef.defaultValue;
        } else if (executorSchema.isNonNullType(argType)) {
          throw new GraphQLError(
            `Argument "${name}" of required type "${argType.toString()}" ` +
              `was provided the variable "$${variableName}" which was not provided a runtime value.`,
            valueNode,
          );
        }
        continue;
      }
      isNull = variableValues[variableName] == null;
    }

    if (isNull && executorSchema.isNonNullType(argType)) {
      throw new GraphQLError(
        `Argument "${name}" of non-null type "${argType.toString()}" ` +
          'must not be null.',
        valueNode,
      );
    }

    const coercedValue = valueFromAST(
      executorSchema,
      valueNode,
      argType,
      variableValues,
    );
    if (coercedValue === undefined) {
      // Note: ValuesOfCorrectTypeRule validation should catch this before
      // execution. This is a runtime check to ensure execution does not
      // continue with an invalid argument value.
      throw new GraphQLError(
        `Argument "${name}" has invalid value ${print(valueNode)}.`,
        valueNode,
      );
    }
    coercedValues[name] = coercedValue;
  }
  return coercedValues;
}

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
export function getDirectiveValues(
  executorSchema: ExecutorSchema,
  directiveDef: Directive,
  node: { readonly directives?: ReadonlyArray<DirectiveNode> },
  variableValues?: Maybe<ObjMap<unknown>>,
): undefined | { [argument: string]: unknown } {
  const directiveNode = node.directives?.find(
    (directive) => directive.name.value === directiveDef.name,
  );

  if (directiveNode) {
    return getArgumentValues(
      executorSchema,
      directiveDef,
      directiveNode,
      variableValues,
    );
  }
}

function hasOwnProperty(obj: unknown, prop: string): boolean {
  return Object.prototype.hasOwnProperty.call(obj, prop);
}
