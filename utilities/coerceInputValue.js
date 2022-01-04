'use strict';

Object.defineProperty(exports, '__esModule', {
  value: true,
});
exports.coerceInputValue = coerceInputValue;

var _graphql = require('graphql');

var _inspect = require('../jsutils/inspect.js');

var _invariant = require('../jsutils/invariant.js');

var _didYouMean = require('../jsutils/didYouMean.js');

var _isObjectLike = require('../jsutils/isObjectLike.js');

var _suggestionList = require('../jsutils/suggestionList.js');

var _printPathArray = require('../jsutils/printPathArray.js');

var _Path = require('../jsutils/Path.js');

var _isIterableObject = require('../jsutils/isIterableObject.js');

var _isGraphQLError = require('../error/isGraphQLError.js');

/**
 * Coerces a JavaScript value given a GraphQL Input Type.
 */
function coerceInputValue(
  executorSchema,
  inputValue,
  type,
  onError = defaultOnError,
) {
  return coerceInputValueImpl(
    executorSchema,
    inputValue,
    type,
    onError,
    undefined,
  );
}

function defaultOnError(path, invalidValue, error) {
  let errorPrefix = 'Invalid value ' + (0, _inspect.inspect)(invalidValue);

  if (path.length > 0) {
    errorPrefix += ` at "value${(0, _printPathArray.printPathArray)(path)}"`;
  }

  error.message = errorPrefix + ': ' + error.message;
  throw error;
}

function coerceInputValueImpl(executorSchema, inputValue, type, onError, path) {
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
      (0, _Path.pathToArray)(path),
      inputValue,
      new _graphql.GraphQLError(
        `Expected non-nullable type "${(0, _inspect.inspect)(
          type,
        )}" not to be null.`,
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

    if ((0, _isIterableObject.isIterableObject)(inputValue)) {
      return Array.from(inputValue, (itemValue, index) => {
        const itemPath = (0, _Path.addPath)(path, index, undefined);
        return coerceInputValueImpl(
          executorSchema,
          itemValue,
          itemType,
          onError,
          itemPath,
        );
      });
    } // Lists accept a non-list value as a list of one.

    return [
      coerceInputValueImpl(executorSchema, inputValue, itemType, onError, path),
    ];
  }

  if (executorSchema.isInputObjectType(type)) {
    if (!(0, _isObjectLike.isObjectLike)(inputValue)) {
      onError(
        (0, _Path.pathToArray)(path),
        inputValue,
        new _graphql.GraphQLError(
          `Expected type "${type.name}" to be an object.`,
        ),
      );
      return;
    }

    const coercedValue = {};
    const fieldDefs = type.getFields();

    for (const field of Object.values(fieldDefs)) {
      const fieldValue = inputValue[field.name];

      if (fieldValue === undefined) {
        if (field.defaultValue !== undefined) {
          coercedValue[field.name] = field.defaultValue;
        } else if (executorSchema.isNonNullType(field.type)) {
          const typeStr = (0, _inspect.inspect)(field.type);
          onError(
            (0, _Path.pathToArray)(path),
            inputValue,
            new _graphql.GraphQLError(
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
        (0, _Path.addPath)(path, field.name, type.name),
      );
    } // Ensure every provided field is defined.

    for (const fieldName of Object.keys(inputValue)) {
      if (!fieldDefs[fieldName]) {
        const suggestions = (0, _suggestionList.suggestionList)(
          fieldName,
          Object.keys(type.getFields()),
        );
        onError(
          (0, _Path.pathToArray)(path),
          inputValue,
          new _graphql.GraphQLError(
            `Field "${fieldName}" is not defined by type "${type.name}".` +
              (0, _didYouMean.didYouMean)(suggestions),
          ),
        );
      }
    }

    return coercedValue;
  }

  if (executorSchema.isLeafType(type)) {
    let parseResult; // Scalars and Enums determine if a input value is valid via parseValue(),
    // which can throw to indicate failure. If it throws, maintain a reference
    // to the original error.

    try {
      parseResult = type.parseValue(inputValue);
    } catch (error) {
      // TODO: add test

      /* c8 ignore next 2 */
      if ((0, _isGraphQLError.isGraphQLError)(error)) {
        onError((0, _Path.pathToArray)(path), inputValue, error);
      } else {
        onError(
          (0, _Path.pathToArray)(path),
          inputValue,
          new _graphql.GraphQLError(
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
        (0, _Path.pathToArray)(path),
        inputValue,
        new _graphql.GraphQLError(`Expected type "${type.name}".`),
      );
    }

    return parseResult;
  }
  /* c8 ignore next 3 */
  // Not reachable, all possible types have been considered.

  false ||
    (0, _invariant.invariant)(
      false,
      'Unexpected input type: ' + (0, _inspect.inspect)(type),
    );
}
