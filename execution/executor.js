'use strict';

Object.defineProperty(exports, '__esModule', {
  value: true,
});
exports.defaultTypeResolver =
  exports.defaultFieldResolver =
  exports.Executor =
    void 0;

var _graphql = require('graphql');

var _inspect = require('../jsutils/inspect.js');

var _memoize = require('../jsutils/memoize3.js');

var _invariant = require('../jsutils/invariant.js');

var _devAssert = require('../jsutils/devAssert.js');

var _isPromise = require('../jsutils/isPromise.js');

var _isObjectLike = require('../jsutils/isObjectLike.js');

var _promiseReduce = require('../jsutils/promiseReduce.js');

var _Path = require('../jsutils/Path.js');

var _isAsyncIterable = require('../jsutils/isAsyncIterable.js');

var _isIterableObject = require('../jsutils/isIterableObject.js');

var _resolveAfterAll = require('../jsutils/resolveAfterAll.js');

var _values = require('./values.js');

var _collectFields = require('./collectFields.js');

var _mapAsyncIterator = require('./mapAsyncIterator.js');

function _defineProperty(obj, key, value) {
  if (key in obj) {
    Object.defineProperty(obj, key, {
      value: value,
      enumerable: true,
      configurable: true,
      writable: true,
    });
  } else {
    obj[key] = value;
  }
  return obj;
}

/**
 * Executor class responsible for implementing the Execution section of the GraphQL spec.
 *
 * This class is exported only to assist people in implementing their own executors
 * without duplicating too much code and should be used only as last resort for cases
 * such as experimental syntax or if certain features could not be contributed upstream.
 *
 * It is still part of the internal API and is versioned, so any changes to it are never
 * considered breaking changes. If you still need to support multiple versions of the
 * library, please use the `versionInfo` variable for version detection.
 *
 * @internal
 */
class Executor {
  constructor() {
    _defineProperty(
      this,
      'collectSubfields',
      (0, _memoize.memoize3)((exeContext, returnType, fieldNodes) =>
        (0, _collectFields.collectSubfields)(
          exeContext.schema,
          exeContext.fragments,
          exeContext.variableValues,
          returnType,
          fieldNodes,
        ),
      ),
    );
  }

  /**
   * Implements the "Executing requests" section of the spec for queries and mutations.
   */
  executeQueryOrMutation(args) {
    const exeContext = this.buildExecutionContext(args); // If a valid execution context cannot be created due to incorrect arguments,
    // a "Response" with only errors is returned.

    if (!('schema' in exeContext)) {
      return {
        errors: exeContext,
      };
    }

    return this.executeQueryOrMutationImpl(exeContext);
  }

  async executeSubscription(args) {
    const exeContext = this.buildExecutionContext(args); // If a valid execution context cannot be created due to incorrect arguments,
    // a "Response" with only errors is returned.

    if (!('schema' in exeContext)) {
      return {
        errors: exeContext,
      };
    }

    return this.executeSubscriptionImpl(exeContext);
  }

  async createSourceEventStream(args) {
    const exeContext = this.buildExecutionContext(args); // If a valid execution context cannot be created due to incorrect arguments,
    // a "Response" with only errors is returned.

    if (!('schema' in exeContext)) {
      return {
        errors: exeContext,
      };
    }

    return this.createSourceEventStreamImpl(exeContext);
  }

  executeQueryOrMutationImpl(exeContext) {
    // Return data or a Promise that will eventually resolve to the data described
    // by the "Response" section of the GraphQL specification.
    // If errors are encountered while executing a GraphQL field, only that
    // field and its descendants will be omitted, and sibling fields will still
    // be executed. An execution which encounters errors will still result in a
    // resolved Promise.
    //
    // Errors from sub-fields of a NonNull type may propagate to the top level,
    // at which point we still log the error and null the parent field, which
    // in this case is the entire response.
    try {
      const result = this.executeQueryOrMutationRootFields(exeContext);

      if ((0, _isPromise.isPromise)(result)) {
        return result.then(
          (data) => this.buildResponse(data, exeContext.errors),
          (error) => {
            exeContext.errors.push(error);
            return this.buildResponse(null, exeContext.errors);
          },
        );
      }

      return this.buildResponse(result, exeContext.errors);
    } catch (error) {
      exeContext.errors.push(error);
      return this.buildResponse(null, exeContext.errors);
    }
  }
  /**
   * Given a completed execution context and data, build the `{ errors, data }`
   * response defined by the "Response" section of the GraphQL specification.
   */

  buildResponse(data, errors) {
    return errors.length === 0
      ? {
          data,
        }
      : {
          errors,
          data,
        };
  }
  /**
   * Essential assertions before executing to provide developer feedback for
   * improper use of the GraphQL library.
   */

  assertValidExecutionArguments(schema, document, rawVariableValues) {
    document || (0, _devAssert.devAssert)(false, 'Must provide document.'); // If the schema used for execution is invalid, throw an error.

    (0, _graphql.assertValidSchema)(schema); // Variables, if provided, must be an object.

    rawVariableValues == null ||
      (0, _isObjectLike.isObjectLike)(rawVariableValues) ||
      (0, _devAssert.devAssert)(
        false,
        'Variables must be provided as an Object where each property is a variable value. Perhaps look to see if an unparsed JSON string was provided.',
      );
  }
  /**
   * Constructs a ExecutionContext object from the arguments passed to
   * execute, which we will pass throughout the other execution methods.
   *
   * Returns an array of GraphQLErrors if a valid execution context
   * cannot be created.
   */

  buildExecutionContext(args) {
    var _definition$name, _operation$variableDe;

    const {
      schema,
      document,
      rootValue,
      contextValue,
      variableValues: rawVariableValues,
      operationName,
      fieldResolver,
      typeResolver,
      subscribeFieldResolver,
    } = args; // If arguments are missing or incorrectly typed, this is an internal
    // developer mistake which should throw an error.

    this.assertValidExecutionArguments(schema, document, rawVariableValues);
    let operation;
    const fragments = Object.create(null);

    for (const definition of document.definitions) {
      switch (definition.kind) {
        case _graphql.Kind.OPERATION_DEFINITION:
          if (operationName == null) {
            if (operation !== undefined) {
              return [
                new _graphql.GraphQLError(
                  'Must provide operation name if query contains multiple operations.',
                ),
              ];
            }

            operation = definition;
          } else if (
            ((_definition$name = definition.name) === null ||
            _definition$name === void 0
              ? void 0
              : _definition$name.value) === operationName
          ) {
            operation = definition;
          }

          break;

        case _graphql.Kind.FRAGMENT_DEFINITION:
          fragments[definition.name.value] = definition;
          break;
      }
    }

    if (!operation) {
      if (operationName != null) {
        return [
          new _graphql.GraphQLError(
            `Unknown operation named "${operationName}".`,
          ),
        ];
      }

      return [new _graphql.GraphQLError('Must provide an operation.')];
    } // istanbul ignore next (See: 'https://github.com/graphql/graphql-js/issues/2203')

    const variableDefinitions =
      (_operation$variableDe = operation.variableDefinitions) !== null &&
      _operation$variableDe !== void 0
        ? _operation$variableDe
        : [];
    const coercedVariableValues = (0, _values.getVariableValues)(
      schema,
      variableDefinitions,
      rawVariableValues !== null && rawVariableValues !== void 0
        ? rawVariableValues
        : {},
      {
        maxErrors: 50,
      },
    );

    if (coercedVariableValues.errors) {
      return coercedVariableValues.errors;
    }

    return {
      schema,
      fragments,
      rootValue,
      contextValue,
      operation,
      variableValues: coercedVariableValues.coerced,
      fieldResolver:
        fieldResolver !== null && fieldResolver !== void 0
          ? fieldResolver
          : defaultFieldResolver,
      typeResolver:
        typeResolver !== null && typeResolver !== void 0
          ? typeResolver
          : defaultTypeResolver,
      subscribeFieldResolver:
        subscribeFieldResolver !== null && subscribeFieldResolver !== void 0
          ? subscribeFieldResolver
          : defaultFieldResolver,
      errors: [],
    };
  }
  /**
   * Constructs a perPayload ExecutionContext object from an initial
   * ExecutionObject and the payload value.
   */

  buildPerPayloadExecutionContext(exeContext, payload) {
    return { ...exeContext, rootValue: payload, errors: [] };
  }
  /**
   * Executes the root fields specified by query or mutation operation.
   */

  executeQueryOrMutationRootFields(
    exeContext, // @ts-expect-error
  ) {
    const { schema, operation, rootValue } = exeContext; // TODO: replace getOperationRootType with schema.getRootType

    const rootType = (0, _graphql.getOperationRootType)(schema, operation);
    /* if (rootType == null) {
      throw new GraphQLError(
        `Schema is not configured to execute ${operation.operation} operation.`,
        operation,
      );
    } */

    const rootFields = (0, _collectFields.collectFields)(
      exeContext.schema,
      exeContext.fragments,
      exeContext.variableValues,
      rootType,
      operation.selectionSet,
    );
    const path = undefined;

    switch (operation.operation) {
      // TODO: Change 'query', etc. => to OperationTypeNode.QUERY, etc. when upstream
      // graphql-js properly exports OperationTypeNode as a value.
      case 'query':
        return this.executeFields(
          exeContext,
          rootType,
          rootValue,
          path,
          rootFields,
        );

      case 'mutation':
        return this.executeFieldsSerially(
          exeContext,
          rootType,
          rootValue,
          path,
          rootFields,
        );

      case 'subscription':
        // TODO: deprecate `subscribe` and move all logic here
        // Temporary solution until we finish merging execute and subscribe together
        return this.executeFields(
          exeContext,
          rootType,
          rootValue,
          path,
          rootFields,
        );
    }
  }
  /**
   * Implements the "Executing selection sets" section of the spec
   * for fields that must be executed serially.
   */

  executeFieldsSerially(exeContext, parentType, sourceValue, path, fields) {
    return (0, _promiseReduce.promiseReduce)(
      fields.entries(),
      (results, [responseName, fieldNodes]) => {
        const fieldPath = (0, _Path.addPath)(
          path,
          responseName,
          parentType.name,
        );
        const result = this.executeField(
          exeContext,
          parentType,
          sourceValue,
          fieldNodes,
          fieldPath,
        );

        if (result === undefined) {
          return results;
        }

        if ((0, _isPromise.isPromise)(result)) {
          return result.then((resolvedResult) => {
            results[responseName] = resolvedResult;
            return results;
          });
        }

        results[responseName] = result;
        return results;
      },
      Object.create(null),
    );
  }
  /**
   * Implements the "Executing selection sets" section of the spec
   * for fields that may be executed in parallel.
   */

  executeFields(exeContext, parentType, sourceValue, path, fields) {
    const results = Object.create(null);
    const promises = [];

    for (const [responseName, fieldNodes] of fields.entries()) {
      const fieldPath = (0, _Path.addPath)(path, responseName, parentType.name);
      const result = this.executeField(
        exeContext,
        parentType,
        sourceValue,
        fieldNodes,
        fieldPath,
      );

      if (result !== undefined) {
        if ((0, _isPromise.isPromise)(result)) {
          const promise = result.then((resolved) => {
            results[responseName] = resolved;
          });
          promises.push(promise);
        } else {
          results[responseName] = result;
        }
      }
    } // If there are no promises, we can just return the object

    if (!promises.length) {
      return results;
    } // Otherwise, results will only eventually be a map from field name to the
    // result of resolving that field, which is possibly a promise. Return a
    // promise that will return this map after resolution is complete.

    return (0, _resolveAfterAll.resolveAfterAll)(results, promises);
  }
  /**
   * Implements the "Executing field" section of the spec
   * In particular, this function figures out the value that the field returns by
   * calling its resolve function, then calls completeValue to complete promises,
   * serialize scalars, or execute the sub-selection-set for objects.
   */

  executeField(exeContext, parentType, source, fieldNodes, path) {
    var _fieldDef$resolve;

    const fieldDef = this.getFieldDef(
      exeContext.schema,
      parentType,
      fieldNodes[0],
    );

    if (!fieldDef) {
      return;
    }

    const returnType = fieldDef.type;
    const resolveFn =
      (_fieldDef$resolve = fieldDef.resolve) !== null &&
      _fieldDef$resolve !== void 0
        ? _fieldDef$resolve
        : exeContext.fieldResolver;
    const info = this.buildResolveInfo(
      exeContext,
      fieldDef,
      fieldNodes,
      parentType,
      path,
    ); // Get the resolve function, regardless of if its result is normal or abrupt (error).

    try {
      // Build a JS object of arguments from the field.arguments AST, using the
      // variables scope to fulfill any variable references.
      // TODO: find a way to memoize, in case this field is within a List type.
      const args = (0, _values.getArgumentValues)(
        fieldDef,
        fieldNodes[0],
        exeContext.variableValues,
      ); // The resolve function's optional third argument is a context value that
      // is provided to every resolve function within an execution. It is commonly
      // used to represent an authenticated user, or request-specific caches.

      const contextValue = exeContext.contextValue;
      const result = resolveFn(source, args, contextValue, info);
      let completed;

      if ((0, _isPromise.isPromise)(result)) {
        completed = result.then((resolved) =>
          this.completeValue(
            exeContext,
            returnType,
            fieldNodes,
            info,
            path,
            resolved,
          ),
        );
      } else {
        completed = this.completeValue(
          exeContext,
          returnType,
          fieldNodes,
          info,
          path,
          result,
        );
      }

      if ((0, _isPromise.isPromise)(completed)) {
        // Note: we don't rely on a `catch` method, but we do expect "thenable"
        // to take a second callback for the error case.
        return completed.then(undefined, (rawError) => {
          const error = (0, _graphql.locatedError)(
            rawError,
            fieldNodes,
            (0, _Path.pathToArray)(path),
          );
          return this.handleFieldError(error, returnType, exeContext);
        });
      }

      return completed;
    } catch (rawError) {
      const error = (0, _graphql.locatedError)(
        rawError,
        fieldNodes,
        (0, _Path.pathToArray)(path),
      );
      return this.handleFieldError(error, returnType, exeContext);
    }
  }

  buildResolveInfo(exeContext, fieldDef, fieldNodes, parentType, path) {
    // The resolve function's optional fourth argument is a collection of
    // information about the current execution state.
    return {
      fieldName: fieldDef.name,
      fieldNodes,
      returnType: fieldDef.type,
      parentType,
      path,
      schema: exeContext.schema,
      fragments: exeContext.fragments,
      rootValue: exeContext.rootValue,
      operation: exeContext.operation,
      variableValues: exeContext.variableValues,
    };
  }

  handleFieldError(error, returnType, exeContext) {
    // If the field type is non-nullable, then it is resolved without any
    // protection from errors, however it still properly locates the error.
    if ((0, _graphql.isNonNullType)(returnType)) {
      throw error;
    } // Otherwise, error protection is applied, logging the error and resolving
    // a null value for this field if one is encountered.

    exeContext.errors.push(error);
    return null;
  }
  /**
   * Implements the instructions for completeValue as defined in the
   * "Field entries" section of the spec.
   *
   * If the field type is Non-Null, then this recursively completes the value
   * for the inner type. It throws a field error if that completion returns null,
   * as per the "Nullability" section of the spec.
   *
   * If the field type is a List, then this recursively completes the value
   * for the inner type on each item in the list.
   *
   * If the field type is a Scalar or Enum, ensures the completed value is a legal
   * value of the type by calling the `serialize` method of GraphQL type
   * definition.
   *
   * If the field is an abstract type, determine the runtime type of the value
   * and then complete based on that type
   *
   * Otherwise, the field type expects a sub-selection set, and will complete the
   * value by executing all sub-selections.
   */

  completeValue(exeContext, returnType, fieldNodes, info, path, result) {
    // If result is an Error, throw a located error.
    if (result instanceof Error) {
      throw result;
    } // If field type is NonNull, complete for inner type, and throw field error
    // if result is null.

    if ((0, _graphql.isNonNullType)(returnType)) {
      const completed = this.completeValue(
        exeContext,
        returnType.ofType,
        fieldNodes,
        info,
        path,
        result,
      );

      if (completed === null) {
        throw new Error(
          `Cannot return null for non-nullable field ${info.parentType.name}.${info.fieldName}.`,
        );
      }

      return completed;
    } // If result value is null or undefined then return null.

    if (result == null) {
      return null;
    } // If field type is List, complete each item in the list with the inner type

    if ((0, _graphql.isListType)(returnType)) {
      return this.completeListValue(
        exeContext,
        returnType,
        fieldNodes,
        info,
        path,
        result,
      );
    } // If field type is a leaf type, Scalar or Enum, serialize to a valid value,
    // returning null if serialization is not possible.

    if ((0, _graphql.isLeafType)(returnType)) {
      return this.completeLeafValue(returnType, result);
    } // If field type is an abstract type, Interface or Union, determine the
    // runtime Object type and complete for that type.

    if ((0, _graphql.isAbstractType)(returnType)) {
      return this.completeAbstractValue(
        exeContext,
        returnType,
        fieldNodes,
        info,
        path,
        result,
      );
    } // If field type is Object, execute and complete all sub-selections.
    // istanbul ignore else (See: 'https://github.com/graphql/graphql-js/issues/2618')

    if ((0, _graphql.isObjectType)(returnType)) {
      return this.completeObjectValue(
        exeContext,
        returnType,
        fieldNodes,
        info,
        path,
        result,
      );
    } // istanbul ignore next (Not reachable. All possible output types have been considered)

    false ||
      (0, _invariant.invariant)(
        false,
        'Cannot complete value of unexpected output type: ' +
          (0, _inspect.inspect)(returnType),
      );
  }
  /**
   * Complete a list value by completing each item in the list with the
   * inner type
   */

  completeListValue(exeContext, returnType, fieldNodes, info, path, result) {
    const itemType = returnType.ofType;

    if ((0, _isAsyncIterable.isAsyncIterable)(result)) {
      const iterator = result[Symbol.asyncIterator]();
      return this.completeAsyncIteratorValue(
        exeContext,
        itemType,
        fieldNodes,
        info,
        path,
        iterator,
      );
    }

    if (!(0, _isIterableObject.isIterableObject)(result)) {
      throw new _graphql.GraphQLError(
        `Expected Iterable, but did not find one for field "${info.parentType.name}.${info.fieldName}".`,
      );
    } // This is specified as a simple map, however we're optimizing the path
    // where the list contains no Promises by avoiding creating another Promise.

    const promises = [];
    const completedResults = [];
    let index = 0;

    for (const item of result) {
      // No need to modify the info object containing the path,
      // since from here on it is not ever accessed by resolver functions.
      const itemPath = (0, _Path.addPath)(path, index, undefined);
      this.completeListItemValue(
        completedResults,
        index++,
        promises,
        item,
        exeContext,
        itemType,
        fieldNodes,
        info,
        itemPath,
      );
    }

    if (!promises.length) {
      return completedResults;
    }

    return (0, _resolveAfterAll.resolveAfterAll)(completedResults, promises);
  }
  /**
   * Complete a async iterator value by completing the result and calling
   * recursively until all the results are completed.
   */

  async completeAsyncIteratorValue(
    exeContext,
    itemType,
    fieldNodes,
    info,
    path,
    iterator,
  ) {
    // This is specified as a simple map, however we're optimizing the path
    // where the list contains no Promises by avoiding creating another Promise.
    const promises = [];
    const completedResults = [];
    let index = 0; // eslint-disable-next-line no-constant-condition

    while (true) {
      const itemPath = (0, _Path.addPath)(path, index, undefined);
      let iteratorResult;

      try {
        // eslint-disable-next-line no-await-in-loop
        iteratorResult = await iterator.next();
      } catch (rawError) {
        const error = (0, _graphql.locatedError)(
          rawError,
          fieldNodes,
          (0, _Path.pathToArray)(itemPath),
        );
        completedResults.push(
          this.handleFieldError(error, itemType, exeContext),
        );
        break;
      }

      const { value: item, done } = iteratorResult;

      if (done) {
        break;
      }

      this.completeListItemValue(
        completedResults,
        index,
        promises,
        item,
        exeContext,
        itemType,
        fieldNodes,
        info,
        itemPath,
      );
      index++;
    }

    return promises.length
      ? (0, _resolveAfterAll.resolveAfterAll)(completedResults, promises)
      : completedResults;
  }

  completeListItemValue(
    completedResults,
    index,
    promises,
    item,
    exeContext,
    itemType,
    fieldNodes,
    info,
    itemPath,
  ) {
    try {
      let completedItem;

      if ((0, _isPromise.isPromise)(item)) {
        completedItem = item.then((resolved) =>
          this.completeValue(
            exeContext,
            itemType,
            fieldNodes,
            info,
            itemPath,
            resolved,
          ),
        );
      } else {
        completedItem = this.completeValue(
          exeContext,
          itemType,
          fieldNodes,
          info,
          itemPath,
          item,
        );
      }

      completedResults[index] = completedItem;

      if (!(0, _isPromise.isPromise)(completedItem)) {
        return;
      } // Note: we don't rely on a `catch` method, but we do expect "thenable"
      // to take a second callback for the error case.

      const promise = completedItem
        .then(undefined, (rawError) => {
          const error = (0, _graphql.locatedError)(
            rawError,
            fieldNodes,
            (0, _Path.pathToArray)(itemPath),
          );
          return this.handleFieldError(error, itemType, exeContext);
        })
        .then((resolved) => {
          completedResults[index] = resolved;
        });
      promises.push(promise);
    } catch (rawError) {
      const error = (0, _graphql.locatedError)(
        rawError,
        fieldNodes,
        (0, _Path.pathToArray)(itemPath),
      );
      completedResults[index] = this.handleFieldError(
        error,
        itemType,
        exeContext,
      );
    }
  }
  /**
   * Complete a Scalar or Enum by serializing to a valid value, returning
   * null if serialization is not possible.
   */

  completeLeafValue(returnType, result) {
    const serializedResult = returnType.serialize(result);

    if (serializedResult == null) {
      throw new Error(
        `Expected \`${(0, _inspect.inspect)(returnType)}.serialize(${(0,
        _inspect.inspect)(result)})\` to ` +
          `return non-nullable value, returned: ${(0, _inspect.inspect)(
            serializedResult,
          )}`,
      );
    }

    return serializedResult;
  }
  /**
   * Complete a value of an abstract type by determining the runtime object type
   * of that value, then complete the value for that type.
   */

  completeAbstractValue(
    exeContext,
    returnType,
    fieldNodes,
    info,
    path,
    result,
  ) {
    var _returnType$resolveTy;

    const resolveTypeFn =
      (_returnType$resolveTy = returnType.resolveType) !== null &&
      _returnType$resolveTy !== void 0
        ? _returnType$resolveTy
        : exeContext.typeResolver;
    const contextValue = exeContext.contextValue;
    const runtimeType = resolveTypeFn(result, contextValue, info, returnType);

    if ((0, _isPromise.isPromise)(runtimeType)) {
      return runtimeType.then((resolvedRuntimeType) =>
        this.completeObjectValue(
          exeContext,
          this.ensureValidRuntimeType(
            resolvedRuntimeType,
            exeContext,
            returnType,
            fieldNodes,
            info,
            result,
          ),
          fieldNodes,
          info,
          path,
          result,
        ),
      );
    }

    return this.completeObjectValue(
      exeContext,
      this.ensureValidRuntimeType(
        runtimeType,
        exeContext,
        returnType,
        fieldNodes,
        info,
        result,
      ),
      fieldNodes,
      info,
      path,
      result,
    );
  }

  ensureValidRuntimeType(
    runtimeTypeName,
    exeContext,
    returnType,
    fieldNodes,
    info,
    result,
  ) {
    if (runtimeTypeName == null) {
      throw new _graphql.GraphQLError(
        `Abstract type "${returnType.name}" must resolve to an Object type at runtime for field "${info.parentType.name}.${info.fieldName}". Either the "${returnType.name}" type should provide a "resolveType" function or each possible type should provide an "isTypeOf" function.`,
        fieldNodes,
      );
    } // releases before 16.0.0 supported returning `GraphQLObjectType` from `resolveType`
    // TODO: remove in 17.0.0 release

    if ((0, _graphql.isObjectType)(runtimeTypeName)) {
      throw new _graphql.GraphQLError(
        'Support for returning GraphQLObjectType from resolveType was removed in graphql-js@16.0.0 please return type name instead.',
      );
    }

    if (typeof runtimeTypeName !== 'string') {
      throw new _graphql.GraphQLError(
        `Abstract type "${returnType.name}" must resolve to an Object type at runtime for field "${info.parentType.name}.${info.fieldName}" with ` +
          `value ${(0, _inspect.inspect)(result)}, received "${(0,
          _inspect.inspect)(runtimeTypeName)}".`,
      );
    }

    const runtimeType = exeContext.schema.getType(runtimeTypeName);

    if (runtimeType == null) {
      throw new _graphql.GraphQLError(
        `Abstract type "${returnType.name}" was resolved to a type "${runtimeTypeName}" that does not exist inside the schema.`,
        fieldNodes,
      );
    }

    if (!(0, _graphql.isObjectType)(runtimeType)) {
      throw new _graphql.GraphQLError(
        `Abstract type "${returnType.name}" was resolved to a non-object type "${runtimeTypeName}".`,
        fieldNodes,
      );
    }

    if (!exeContext.schema.isSubType(returnType, runtimeType)) {
      throw new _graphql.GraphQLError(
        `Runtime Object type "${runtimeType.name}" is not a possible type for "${returnType.name}".`,
        fieldNodes,
      );
    }

    return runtimeType;
  }
  /**
   * Complete an Object value by executing all sub-selections.
   */

  completeObjectValue(exeContext, returnType, fieldNodes, info, path, result) {
    // Collect sub-fields to execute to complete this value.
    const subFieldNodes = this.collectSubfields(
      exeContext,
      returnType,
      fieldNodes,
    ); // If there is an isTypeOf predicate function, call it with the
    // current result. If isTypeOf returns false, then raise an error rather
    // than continuing execution.

    if (returnType.isTypeOf) {
      const isTypeOf = returnType.isTypeOf(
        result,
        exeContext.contextValue,
        info,
      );

      if ((0, _isPromise.isPromise)(isTypeOf)) {
        return isTypeOf.then((resolvedIsTypeOf) => {
          if (!resolvedIsTypeOf) {
            throw this.invalidReturnTypeError(returnType, result, fieldNodes);
          }

          return this.executeFields(
            exeContext,
            returnType,
            result,
            path,
            subFieldNodes,
          );
        });
      }

      if (!isTypeOf) {
        throw this.invalidReturnTypeError(returnType, result, fieldNodes);
      }
    }

    return this.executeFields(
      exeContext,
      returnType,
      result,
      path,
      subFieldNodes,
    );
  }

  invalidReturnTypeError(returnType, result, fieldNodes) {
    return new _graphql.GraphQLError(
      `Expected value of type "${returnType.name}" but got: ${(0,
      _inspect.inspect)(result)}.`,
      fieldNodes,
    );
  }
  /**
   * This method looks up the field on the given type definition.
   * It has special casing for the three introspection fields,
   * __schema, __type and __typename. __typename is special because
   * it can always be queried as a field, even in situations where no
   * other fields are allowed, like on a Union. __schema and __type
   * could get automatically added to the query type, but that would
   * require mutating type definitions, which would cause issues.
   *
   */

  getFieldDef(schema, parentType, fieldNode) {
    const fieldName = fieldNode.name.value;

    if (
      fieldName === _graphql.SchemaMetaFieldDef.name &&
      schema.getQueryType() === parentType
    ) {
      return _graphql.SchemaMetaFieldDef;
    } else if (
      fieldName === _graphql.TypeMetaFieldDef.name &&
      schema.getQueryType() === parentType
    ) {
      return _graphql.TypeMetaFieldDef;
    } else if (fieldName === _graphql.TypeNameMetaFieldDef.name) {
      return _graphql.TypeNameMetaFieldDef;
    }

    return parentType.getFields()[fieldName];
  }

  async executeSubscriptionImpl(exeContext) {
    const resultOrStream = await this.createSourceEventStreamImpl(exeContext);

    if (!(0, _isAsyncIterable.isAsyncIterable)(resultOrStream)) {
      return resultOrStream;
    } // For each payload yielded from a subscription, map it over the normal
    // GraphQL `execute` function, with `payload` as the rootValue.
    // This implements the "MapSourceToResponseEvent" algorithm described in
    // the GraphQL specification. The `execute` function provides the
    // "ExecuteSubscriptionEvent" algorithm, as it is nearly identical to the
    // "ExecuteQuery" algorithm, for which `execute` is also used.

    const mapSourceToResponse = (payload) => {
      const perPayloadExecutionContext = this.buildPerPayloadExecutionContext(
        exeContext,
        payload,
      );
      return this.executeQueryOrMutationImpl(perPayloadExecutionContext);
    }; // Map every source value to a ExecutionResult value as described above.

    return (0, _mapAsyncIterator.mapAsyncIterator)(
      resultOrStream,
      mapSourceToResponse,
    );
  }

  async createSourceEventStreamImpl(exeContext) {
    try {
      const eventStream = await this.executeSubscriptionRootField(exeContext); // Assert field returned an event stream, otherwise yield an error.

      if (!(0, _isAsyncIterable.isAsyncIterable)(eventStream)) {
        throw new Error(
          'Subscription field must return Async Iterable. ' +
            `Received: ${(0, _inspect.inspect)(eventStream)}.`,
        );
      }

      return eventStream;
    } catch (error) {
      // If it GraphQLError, report it as an ExecutionResult, containing only errors and no data.
      // Otherwise treat the error as a system-class error and re-throw it.
      if (error instanceof _graphql.GraphQLError) {
        return {
          errors: [error],
        };
      }

      throw error;
    }
  }

  async executeSubscriptionRootField(exeContext) {
    const { schema, fragments, operation, variableValues, rootValue } =
      exeContext;
    const rootType = schema.getSubscriptionType();

    if (rootType == null) {
      throw new _graphql.GraphQLError(
        'Schema is not configured to execute subscription operation.',
        operation,
      );
    }

    const rootFields = (0, _collectFields.collectFields)(
      schema,
      fragments,
      variableValues,
      rootType,
      operation.selectionSet,
    );
    const [responseName, fieldNodes] = [...rootFields.entries()][0];
    const fieldDef = this.getFieldDef(schema, rootType, fieldNodes[0]);

    if (!fieldDef) {
      const fieldName = fieldNodes[0].name.value;
      throw new _graphql.GraphQLError(
        `The subscription field "${fieldName}" is not defined.`,
        fieldNodes,
      );
    }

    const path = (0, _Path.addPath)(undefined, responseName, rootType.name);
    const info = this.buildResolveInfo(
      exeContext,
      fieldDef,
      fieldNodes,
      rootType,
      path,
    );

    try {
      var _fieldDef$subscribe;

      // Implements the "ResolveFieldEventStream" algorithm from GraphQL specification.
      // It differs from "ResolveFieldValue" due to providing a different `resolveFn`.
      // Build a JS object of arguments from the field.arguments AST, using the
      // variables scope to fulfill any variable references.
      const args = (0, _values.getArgumentValues)(
        fieldDef,
        fieldNodes[0],
        variableValues,
      ); // The resolve function's optional third argument is a context value that
      // is provided to every resolve function within an execution. It is commonly
      // used to represent an authenticated user, or request-specific caches.

      const contextValue = exeContext.contextValue; // Call the `subscribe()` resolver or the default resolver to produce an
      // AsyncIterable yielding raw payloads.

      const resolveFn =
        (_fieldDef$subscribe = fieldDef.subscribe) !== null &&
        _fieldDef$subscribe !== void 0
          ? _fieldDef$subscribe
          : exeContext.subscribeFieldResolver;
      const eventStream = await resolveFn(rootValue, args, contextValue, info);

      if (eventStream instanceof Error) {
        throw eventStream;
      }

      return eventStream;
    } catch (error) {
      throw (0, _graphql.locatedError)(
        error,
        fieldNodes,
        (0, _Path.pathToArray)(path),
      );
    }
  }
}
/**
 * If a resolve function is not given, then a default resolve behavior is used
 * which takes the property of the source object of the same name as the field
 * and returns it as the result, or if it's a function, returns the result
 * of calling that function while passing along args and context value.
 */

exports.Executor = Executor;

const defaultFieldResolver = function (source, args, contextValue, info) {
  // ensure source is a value for which property access is acceptable.
  if ((0, _isObjectLike.isObjectLike)(source) || typeof source === 'function') {
    const property = source[info.fieldName];

    if (typeof property === 'function') {
      return source[info.fieldName](args, contextValue, info);
    }

    return property;
  }
};
/**
 * If a resolveType function is not given, then a default resolve behavior is
 * used which attempts two strategies:
 *
 * First, See if the provided value has a `__typename` field defined, if so, use
 * that value as name of the resolved type.
 *
 * Otherwise, test each possible type for the abstract type by calling
 * isTypeOf for the object being coerced, returning the first type that matches.
 */

exports.defaultFieldResolver = defaultFieldResolver;

const defaultTypeResolver = function (value, contextValue, info, abstractType) {
  // First, look for `__typename`.
  if (
    (0, _isObjectLike.isObjectLike)(value) &&
    typeof value.__typename === 'string'
  ) {
    return value.__typename;
  } // Otherwise, test each possible type.

  const possibleTypes = info.schema.getPossibleTypes(abstractType);
  const promisedIsTypeOfResults = [];

  for (let i = 0; i < possibleTypes.length; i++) {
    const type = possibleTypes[i];

    if (type.isTypeOf) {
      const isTypeOfResult = type.isTypeOf(value, contextValue, info);

      if ((0, _isPromise.isPromise)(isTypeOfResult)) {
        promisedIsTypeOfResults[i] = isTypeOfResult;
      } else if (isTypeOfResult) {
        return type.name;
      }
    }
  }

  if (promisedIsTypeOfResults.length) {
    return Promise.all(promisedIsTypeOfResults).then((isTypeOfResults) => {
      for (let i = 0; i < isTypeOfResults.length; i++) {
        if (isTypeOfResults[i]) {
          return possibleTypes[i].name;
        }
      }
    });
  }
};

exports.defaultTypeResolver = defaultTypeResolver;
