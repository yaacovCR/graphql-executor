import { GraphQLError } from 'graphql';

import type { Path } from '../jsutils/Path';
import { inspect } from '../jsutils/inspect';
import { invariant } from '../jsutils/invariant';
import { didYouMean } from '../jsutils/didYouMean';
import { isObjectLike } from '../jsutils/isObjectLike';
import { suggestionList } from '../jsutils/suggestionList';
import { printPathArray } from '../jsutils/printPathArray';
import { addPath, pathToArray } from '../jsutils/Path';
import { isIterableObject } from '../jsutils/isIterableObject';

import { isGraphQLError } from '../error/isGraphQLError';

import type {
  ExecutorSchema,
  InputType,
} from '../executorSchema/executorSchema';

type OnErrorCB = (
  path: ReadonlyArray<string | number>,
  invalidValue: unknown,
  error: GraphQLError,
) => void;

/**
 * Coerces a JavaScript value given a GraphQL Input Type.
 */
export function coerceInputValue(
  executorSchema: ExecutorSchema,
  inputValue: unknown,
  type: InputType,
  onError: OnErrorCB = defaultOnError,
): unknown {
  return coerceInputValueImpl(
    executorSchema,
    inputValue,
    type,
    onError,
    undefined,
  );
}

function defaultOnError(
  path: ReadonlyArray<string | number>,
  invalidValue: unknown,
  error: GraphQLError,
): void {
  let errorPrefix = 'Invalid value ' + inspect(invalidValue);
  if (path.length > 0) {
    errorPrefix += ` at "value${printPathArray(path)}"`;
  }
  error.message = errorPrefix + ': ' + error.message;
  throw error;
}

function coerceInputValueImpl(
  executorSchema: ExecutorSchema,
  inputValue: unknown,
  type: InputType,
  onError: OnErrorCB,
  path: Path | undefined,
): unknown {
  if (executorSchema.isNonNullType(type)) {
    if (inputValue != null) {
      return coerceInputValueImpl(
        executorSchema,
        inputValue,
        type.ofType,
        onError,
        path,
      );
    }
    onError(
      pathToArray(path),
      inputValue,
      new GraphQLError(
        `Expected non-nullable type "${type.toString()}" not to be null.`,
      ),
    );
    return;
  }

  if (inputValue == null) {
    // Explicitly return the value null.
    return null;
  }

  if (executorSchema.isListType(type)) {
    const itemType = type.ofType;
    if (isIterableObject(inputValue)) {
      return Array.from(inputValue, (itemValue, index) => {
        const itemPath = addPath(path, index, undefined);
        return coerceInputValueImpl(
          executorSchema,
          itemValue,
          itemType,
          onError,
          itemPath,
        );
      });
    }
    // Lists accept a non-list value as a list of one.
    return [
      coerceInputValueImpl(executorSchema, inputValue, itemType, onError, path),
    ];
  }

  if (executorSchema.isInputObjectType(type)) {
    if (!isObjectLike(inputValue)) {
      onError(
        pathToArray(path),
        inputValue,
        new GraphQLError(`Expected type "${type.name}" to be an object.`),
      );
      return;
    }

    const coercedValue: any = {};
    const fieldDefs = type.getFields();

    for (const field of Object.values(fieldDefs)) {
      const fieldValue = inputValue[field.name];

      if (fieldValue === undefined) {
        if (field.defaultValue !== undefined) {
          coercedValue[field.name] = field.defaultValue;
        } else if (executorSchema.isNonNullType(field.type)) {
          const typeStr = field.type.toString();
          onError(
            pathToArray(path),
            inputValue,
            new GraphQLError(
              `Field "${field.name}" of required type "${typeStr}" was not provided.`,
            ),
          );
        }
        continue;
      }

      coercedValue[field.name] = coerceInputValueImpl(
        executorSchema,
        fieldValue,
        field.type,
        onError,
        addPath(path, field.name, type.name),
      );
    }

    // Ensure every provided field is defined.
    for (const fieldName of Object.keys(inputValue)) {
      if (!fieldDefs[fieldName]) {
        const suggestions = suggestionList(
          fieldName,
          Object.keys(type.getFields()),
        );
        onError(
          pathToArray(path),
          inputValue,
          new GraphQLError(
            `Field "${fieldName}" is not defined by type "${type.name}".` +
              didYouMean(suggestions),
          ),
        );
      }
    }
    return coercedValue;
  }

  if (executorSchema.isLeafType(type)) {
    let parseResult;

    // Scalars and Enums determine if a input value is valid via parseValue(),
    // which can throw to indicate failure. If it throws, maintain a reference
    // to the original error.
    try {
      parseResult = type.parseValue(inputValue);
    } catch (error) {
      // TODO: add test
      /* c8 ignore next 2 */
      if (isGraphQLError(error)) {
        onError(pathToArray(path), inputValue, error);
      } else {
        onError(
          pathToArray(path),
          inputValue,
          new GraphQLError(
            `Expected type "${type.name}". ` + error.message,
            undefined,
            undefined,
            undefined,
            undefined,
            error,
          ),
        );
      }
      return;
    }
    if (parseResult === undefined) {
      onError(
        pathToArray(path),
        inputValue,
        new GraphQLError(`Expected type "${type.name}".`),
      );
    }
    return parseResult;
  }
  /* c8 ignore next 3 */
  // Not reachable, all possible types have been considered.
  invariant(false, 'Unexpected input type: ' + (type as InputType).toString());
}
