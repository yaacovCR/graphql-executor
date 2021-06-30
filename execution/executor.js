'use strict';

Object.defineProperty(exports, '__esModule', {
  value: true,
});
exports.Executor = void 0;

var _graphql = require('graphql');

var _inspect = require('../jsutils/inspect.js');

var _memoize = require('../jsutils/memoize2.js');

var _invariant = require('../jsutils/invariant.js');

var _devAssert = require('../jsutils/devAssert.js');

var _isObjectLike = require('../jsutils/isObjectLike.js');

var _promiseReduce = require('../jsutils/promiseReduce.js');

var _maybePromise = require('../jsutils/maybePromise.js');

var _maybePromiseForObject = require('../jsutils/maybePromiseForObject.js');

var _Path = require('../jsutils/Path.js');

var _isIterableObject = require('../jsutils/isIterableObject.js');

var _isAsyncIterable = require('../jsutils/isAsyncIterable.js');

var _values = require('./values.js');

var _collectFields = require('./collectFields.js');

var _mapAsyncIterator = require('./mapAsyncIterator.js');

var _GraphQLAggregateError = require('./GraphQLAggregateError.js');

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
  /**
   * A memoized collection of relevant subfields with regard to the return
   * type. Memoizing ensures the subfields are not repeatedly calculated, which
   * saves overhead when resolving lists of values.
   */
  constructor(argsOrExecutionContext) {
    _defineProperty(
      this,
      'collectSubfields',
      (0, _memoize.memoize2)((returnType, fieldNodes) => {
        const { _schema, _fragments, _variableValues } = this;
        let subFieldNodes = new Map();
        const visitedFragmentNames = new Set();

        for (const node of fieldNodes) {
          if (node.selectionSet) {
            subFieldNodes = (0, _collectFields.collectFields)(
              _schema,
              _fragments,
              _variableValues,
              returnType,
              node.selectionSet,
              subFieldNodes,
              visitedFragmentNames,
            );
          }
        }

        return subFieldNodes;
      }),
    );

    const executionContext =
      'fragments' in argsOrExecutionContext
        ? argsOrExecutionContext
        : this.buildExecutionContext(argsOrExecutionContext);
    const {
      schema,
      fragments,
      rootValue,
      contextValue,
      operation,
      variableValues,
      fieldResolver,
      typeResolver,
      subscribeFieldResolver,
      errors,
    } = executionContext;
    this._schema = schema;
    this._fragments = fragments;
    this._rootValue = rootValue;
    this._contextValue = contextValue;
    this._operation = operation;
    this._variableValues = variableValues;
    this._fieldResolver = fieldResolver;
    this._typeResolver = typeResolver;
    this._subscribeFieldResolver = subscribeFieldResolver;
    this._errors = errors;
  }
  /**
   * Implements the "Executing operations" section of the spec for queries and
   * mutations.
   */

  executeQueryOrMutation() {
    const data = this.executeQueryOrMutationRootFields();
    return new _maybePromise.MaybePromise(() => data)
      .then((resolved) => this.buildResponse(resolved))
      .resolve();
  }
  /**
   * Given a completed execution context and data, build the { errors, data }
   * response defined by the "Response" section of the GraphQL specification.
   */

  buildResponse(data) {
    return this._errors.length === 0
      ? {
          data,
        }
      : {
          errors: this._errors,
          data,
        };
  }
  /**
   * Essential assertions before executing to provide developer feedback for
   * improper use of the GraphQL library.
   *
   * @internal
   */

  assertValidArguments(schema, document, rawVariableValues) {
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
   * Throws a GraphQLError if a valid execution context cannot be created.
   *
   * @internal
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
    } = args; // If arguments are missing or incorrect, throw an error.

    this.assertValidArguments(schema, document, rawVariableValues);
    let operation;
    const fragments = Object.create(null);

    for (const definition of document.definitions) {
      switch (definition.kind) {
        case _graphql.Kind.OPERATION_DEFINITION:
          if (operationName == null) {
            if (operation !== undefined) {
              throw new _GraphQLAggregateError.GraphQLAggregateError([
                new _graphql.GraphQLError(
                  'Must provide operation name if query contains multiple operations.',
                ),
              ]);
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
        throw new _GraphQLAggregateError.GraphQLAggregateError([
          new _graphql.GraphQLError(
            `Unknown operation named "${operationName}".`,
          ),
        ]);
      }

      throw new _GraphQLAggregateError.GraphQLAggregateError([
        new _graphql.GraphQLError('Must provide an operation.'),
      ]);
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
      throw new _GraphQLAggregateError.GraphQLAggregateError(
        coercedVariableValues.errors,
      );
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
          : _graphql.defaultFieldResolver,
      typeResolver:
        typeResolver !== null && typeResolver !== void 0
          ? typeResolver
          : _graphql.defaultTypeResolver,
      subscribeFieldResolver,
      errors: [],
    };
  }
  /**
   * Return the data (or a Promise that will eventually resolve to the data)
   * described by the "Response" section of the GraphQL specification.
   *
   * If errors are encountered while executing a GraphQL field, only that
   * field and its descendants will be omitted, and sibling fields will still
   * be executed. An execution which encounters errors will still result in a
   * returned value or resolved Promise.
   * */

  executeQueryOrMutationRootFields() {
    const { _schema, _fragments, _rootValue, _operation, _variableValues } =
      this;
    const type = (0, _graphql.getOperationRootType)(_schema, _operation);
    const fields = (0, _collectFields.collectFields)(
      _schema,
      _fragments,
      _variableValues,
      type,
      _operation.selectionSet,
      new Map(),
      new Set(),
    );
    const path = undefined; // Errors from sub-fields of a NonNull type may propagate to the top level,
    // at which point we still log the error and null the parent field, which
    // in this case is the entire response.

    return new _maybePromise.MaybePromise(() =>
      _operation.operation === 'mutation'
        ? this.executeFieldsSerially(type, _rootValue, path, fields)
        : this.executeFields(type, _rootValue, path, fields),
    )
      .catch((error) => {
        // The underlying executeField method catches all errors, converts
        // them to GraphQLErrors, and, assuming error protection is not
        // applied, rethrows only converted errors.
        // Moreover, we cannot use instanceof to formally check this, as
        // the conversion is done using locatedError which uses a branch
        // check to allow errors from other contexts.
        this.logError(error);
        return null;
      })
      .resolve();
  }
  /**
   * Implements the "Executing selection sets" section of the spec
   * for fields that must be executed serially.
   */

  executeFieldsSerially(parentType, sourceValue, path, fields) {
    return (0, _promiseReduce.promiseReduce)(
      fields.entries(),
      (results, [responseName, fieldNodes]) => {
        const fieldPath = (0, _Path.addPath)(
          path,
          responseName,
          parentType.name,
        );
        const result = this.executeField(
          parentType,
          sourceValue,
          fieldNodes,
          fieldPath,
        );

        if (result === undefined) {
          return results;
        }

        return new _maybePromise.MaybePromise(() => result)
          .then((resolvedResult) => {
            results[responseName] = resolvedResult;
            return results;
          })
          .resolve();
      },
      Object.create(null),
    );
  }
  /**
   * Implements the "Executing selection sets" section of the spec
   * for fields that may be executed in parallel.
   */

  executeFields(parentType, sourceValue, path, fields) {
    const results = Object.create(null);

    for (const [responseName, fieldNodes] of fields.entries()) {
      const fieldPath = (0, _Path.addPath)(path, responseName, parentType.name);
      const result = this.executeField(
        parentType,
        sourceValue,
        fieldNodes,
        fieldPath,
      );

      if (result !== undefined) {
        results[responseName] = new _maybePromise.MaybePromise(() => result);
      }
    } // Otherwise, results is a map from field name to the result of resolving that
    // field, which is possibly a promise. Return a promise that will return this
    // same map, but with any promises replaced with the values they resolved to.

    return (0, _maybePromiseForObject.maybePromiseForObject)(results).resolve();
  }
  /**
   * Implements the "Executing field" section of the spec
   * In particular, this function figures out the value that the field returns by
   * calling its resolve function, then calls completeValue to complete promises,
   * serialize scalars, or execute the sub-selection-set for objects.
   */

  executeField(parentType, source, fieldNodes, path) {
    var _fieldDef$resolve;

    const fieldDef = this.getFieldDef(this._schema, parentType, fieldNodes[0]);

    if (!fieldDef) {
      return;
    }

    const returnType = fieldDef.type;
    const resolveFn =
      (_fieldDef$resolve = fieldDef.resolve) !== null &&
      _fieldDef$resolve !== void 0
        ? _fieldDef$resolve
        : this._fieldResolver;
    const info = this.buildResolveInfo(fieldDef, fieldNodes, parentType, path); // Run the resolve function, regardless of if its result is normal or abrupt (error).

    return new _maybePromise.MaybePromise(() => {
      // Build a JS object of arguments from the field.arguments AST, using the
      // variables scope to fulfill any variable references.
      // TODO: find a way to memoize, in case this field is within a List type.
      const args = (0, _values.getArgumentValues)(
        fieldDef,
        fieldNodes[0],
        this._variableValues,
      ); // The resolve function's optional third argument is a context value that
      // is provided to every resolve function within an execution. It is commonly
      // used to represent an authenticated user, or request-specific caches.

      const contextValue = this._contextValue;
      return resolveFn(source, args, contextValue, info);
    })
      .then((resolved) =>
        this.completeValue(returnType, fieldNodes, info, path, resolved),
      )
      .catch((rawError) => {
        this.handleRawError(returnType, rawError, fieldNodes, path);
        return null;
      })
      .resolve();
  }
  /**
   * @internal
   */

  buildResolveInfo(fieldDef, fieldNodes, parentType, path) {
    const { _schema, _fragments, _rootValue, _operation, _variableValues } =
      this; // The resolve function's optional fourth argument is a collection of
    // information about the current execution state.

    return {
      fieldName: fieldDef.name,
      fieldNodes,
      returnType: fieldDef.type,
      parentType,
      path,
      schema: _schema,
      fragments: _fragments,
      rootValue: _rootValue,
      operation: _operation,
      variableValues: _variableValues,
    };
  }

  handleRawError(returnType, rawError, fieldNodes, path) {
    const pathAsArray = (0, _Path.pathToArray)(path);
    const error =
      rawError instanceof _GraphQLAggregateError.GraphQLAggregateError
        ? new _GraphQLAggregateError.GraphQLAggregateError(
            rawError.errors.map((subError) =>
              (0, _graphql.locatedError)(subError, fieldNodes, pathAsArray),
            ),
            rawError.message,
          )
        : (0, _graphql.locatedError)(rawError, fieldNodes, pathAsArray); // If the field type is non-nullable, then it is resolved without any
    // protection from errors, however it still properly locates the error.

    if ((0, _graphql.isNonNullType)(returnType)) {
      throw error;
    } // Otherwise, error protection is applied, logging the error and resolving
    // a null value for this field if one is encountered.

    this.logError(error);
    return null;
  }

  logError(error) {
    if (error instanceof _GraphQLAggregateError.GraphQLAggregateError) {
      this._errors.push(...error.errors);

      return;
    }

    this._errors.push(error);
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

  completeValue(returnType, fieldNodes, info, path, result) {
    // If result is an Error, throw a located error.
    if (result instanceof Error) {
      throw result;
    } // If field type is NonNull, complete for inner type, and throw field error
    // if result is null.

    if ((0, _graphql.isNonNullType)(returnType)) {
      const completed = this.completeValue(
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
      return this.completeListValue(returnType, fieldNodes, info, path, result);
    } // If field type is a leaf type, Scalar or Enum, serialize to a valid value,
    // returning null if serialization is not possible.

    if ((0, _graphql.isLeafType)(returnType)) {
      return this.completeLeafValue(returnType, result);
    } // If field type is an abstract type, Interface or Union, determine the
    // runtime Object type and complete for that type.

    if ((0, _graphql.isAbstractType)(returnType)) {
      return this.completeAbstractValue(
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

  completeListValue(returnType, fieldNodes, info, path, result) {
    if (!(0, _isIterableObject.isIterableObject)(result)) {
      throw new _graphql.GraphQLError(
        `Expected Iterable, but did not find one for field "${info.parentType.name}.${info.fieldName}".`,
      );
    } // This is specified as a simple map, however we're optimizing the path
    // where the list contains no Promises by avoiding creating another Promise.

    const itemType = returnType.ofType;
    const completedResults = Array.from(result, (item, index) => {
      // No need to modify the info object containing the path,
      // since from here on it is not ever accessed by resolver functions.
      const itemPath = (0, _Path.addPath)(path, index, undefined);
      let completedItem;
      return new _maybePromise.MaybePromise(() => item)
        .then((resolved) => {
          completedItem = this.completeValue(
            itemType,
            fieldNodes,
            info,
            itemPath,
            resolved,
          );
          return completedItem;
        })
        .catch((rawError) => {
          this.handleRawError(itemType, rawError, fieldNodes, itemPath);
          return null;
        });
    });
    return _maybePromise.MaybePromise.all(completedResults).resolve();
  }
  /**
   * Complete a Scalar or Enum by serializing to a valid value, returning
   * null if serialization is not possible.
   */

  completeLeafValue(returnType, result) {
    const serializedResult = returnType.serialize(result);

    if (serializedResult === undefined) {
      throw new Error(
        `Expected a value of type "${(0, _inspect.inspect)(returnType)}" but ` +
          `received: ${(0, _inspect.inspect)(result)}`,
      );
    }

    return serializedResult;
  }
  /**
   * Complete a value of an abstract type by determining the runtime object type
   * of that value, then complete the value for that type.
   */

  completeAbstractValue(returnType, fieldNodes, info, path, result) {
    var _returnType$resolveTy;

    const resolveTypeFn =
      (_returnType$resolveTy = returnType.resolveType) !== null &&
      _returnType$resolveTy !== void 0
        ? _returnType$resolveTy
        : this._typeResolver;
    const contextValue = this._contextValue;
    const runtimeType = resolveTypeFn(result, contextValue, info, returnType);
    return new _maybePromise.MaybePromise(() => runtimeType)
      .then((resolvedRuntimeType) =>
        this.completeObjectValue(
          this.ensureValidRuntimeType(
            resolvedRuntimeType,
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
      )
      .resolve();
  }

  ensureValidRuntimeType(
    runtimeTypeName,
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

    const runtimeType = this._schema.getType(runtimeTypeName);

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

    if (!this._schema.isSubType(returnType, runtimeType)) {
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

  completeObjectValue(returnType, fieldNodes, info, path, result) {
    // Collect sub-fields to execute to complete this value.
    const subFieldNodes = this.collectSubfields(returnType, fieldNodes); // If there is an isTypeOf predicate function, call it with the
    // current result. If isTypeOf returns false, then raise an error rather
    // than continuing execution.

    if (returnType.isTypeOf) {
      const isTypeOf = returnType.isTypeOf(result, this._contextValue, info);
      return new _maybePromise.MaybePromise(() => isTypeOf)
        .then((resolvedIsTypeOf) => {
          if (!resolvedIsTypeOf) {
            throw this.invalidReturnTypeError(returnType, result, fieldNodes);
          }

          return this.executeFields(returnType, result, path, subFieldNodes);
        })
        .resolve();
    }

    return this.executeFields(returnType, result, path, subFieldNodes);
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
   * @internal
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
  /**
   * Implements the "Executing operations" section of the spec for subscriptions
   */

  async executeSubscription() {
    const resultOrStream = await this.createSourceEventStream();

    if (!(0, _isAsyncIterable.isAsyncIterable)(resultOrStream)) {
      return resultOrStream;
    } // For each payload yielded from a subscription, map it over the normal
    // GraphQL `execute` function, with `payload` as the rootValue and with
    // an empty set of errors.
    // This implements the "MapSourceToResponseEvent" algorithm described in
    // the GraphQL specification. The `execute` function provides the
    // "ExecuteSubscriptionEvent" algorithm, as it is nearly identical to the
    // "ExecuteQuery" algorithm, for which `execute` is also used.

    const mapSourceToResponse = (payload) => {
      const {
        _schema,
        _fragments,
        _contextValue,
        _operation,
        _variableValues,
        _fieldResolver,
        _typeResolver,
        _subscribeFieldResolver,
      } = this;
      const executor = new Executor({
        schema: _schema,
        fragments: _fragments,
        rootValue: payload,
        contextValue: _contextValue,
        operation: _operation,
        variableValues: _variableValues,
        fieldResolver: _fieldResolver,
        typeResolver: _typeResolver,
        subscribeFieldResolver: _subscribeFieldResolver,
        errors: [],
      });
      return executor.executeQueryOrMutation();
    }; // Map every source value to a ExecutionResult value as described above.

    return (0, _mapAsyncIterator.mapAsyncIterator)(
      resultOrStream,
      mapSourceToResponse,
    );
  }
  /**
   * Implements the "CreateSourceEventStream" algorithm described in the
   * GraphQL specification, resolving the subscription source event stream.
   *
   * Returns a Promise which resolves to either an AsyncIterable (if successful)
   * or an ExecutionResult (error). The promise will be rejected if the schema or
   * other arguments to this function are invalid, or if the resolved event stream
   * is not an async iterable.
   *
   * If the client-provided arguments to this function do not result in a
   * compliant subscription, a GraphQL Response (ExecutionResult) with
   * descriptive errors and no data will be returned.
   *
   * If the the source stream could not be created due to faulty subscription
   * resolver logic or underlying systems, the promise will resolve to a single
   * ExecutionResult containing `errors` and no `data`.
   *
   * If the operation succeeded, the promise resolves to the AsyncIterable for the
   * event stream returned by the resolver.
   *
   * A Source Event Stream represents a sequence of events, each of which triggers
   * a GraphQL execution for that event.
   *
   * This may be useful when hosting the stateful subscription service in a
   * different process or machine than the stateless GraphQL execution engine,
   * or otherwise separating these two steps. For more on this, see the
   * "Supporting Subscriptions at Scale" information in the GraphQL specification.
   */

  async createSourceEventStream() {
    const eventStream = await this.executeSubscriptionRootField();

    if (this._errors.length !== 0) {
      return {
        errors: this._errors,
      };
    } // Assert field returned an event stream, otherwise yield an error.

    if (!(0, _isAsyncIterable.isAsyncIterable)(eventStream)) {
      throw new Error(
        'Subscription field must return Async Iterable. ' +
          `Received: ${(0, _inspect.inspect)(eventStream)}.`,
      );
    }

    return eventStream;
  }

  async executeSubscriptionRootField() {
    const { _schema, _fragments, _operation, _variableValues, _rootValue } =
      this;
    const type = (0, _graphql.getOperationRootType)(_schema, _operation);
    const fields = (0, _collectFields.collectFields)(
      _schema,
      _fragments,
      _variableValues,
      type,
      _operation.selectionSet,
      new Map(),
      new Set(),
    );
    const [responseName, fieldNodes] = [...fields.entries()][0];
    const fieldDef = this.getFieldDef(_schema, type, fieldNodes[0]);

    if (!fieldDef) {
      const fieldName = fieldNodes[0].name.value;

      this._errors.push(
        new _graphql.GraphQLError(
          `The subscription field "${fieldName}" is not defined.`,
          fieldNodes,
        ),
      );

      return null;
    }

    const path = (0, _Path.addPath)(undefined, responseName, type.name);
    const info = this.buildResolveInfo(fieldDef, fieldNodes, type, path);

    try {
      var _fieldDef$subscribe;

      // Implements the "ResolveFieldEventStream" algorithm from GraphQL specification.
      // It differs from "ResolveFieldValue" due to providing a different `resolveFn`.
      // Build a JS object of arguments from the field.arguments AST, using the
      // variables scope to fulfill any variable references.
      const args = (0, _values.getArgumentValues)(
        fieldDef,
        fieldNodes[0],
        _variableValues,
      ); // The resolve function's optional third argument is a context value that
      // is provided to every resolve function within an execution. It is commonly
      // used to represent an authenticated user, or request-specific caches.

      const contextValue = this._contextValue; // Call the `subscribe()` resolver or the default resolver to produce an
      // AsyncIterable yielding raw payloads.

      const resolveFn =
        (_fieldDef$subscribe = fieldDef.subscribe) !== null &&
        _fieldDef$subscribe !== void 0
          ? _fieldDef$subscribe
          : this._fieldResolver;
      const eventStream = await resolveFn(_rootValue, args, contextValue, info);

      if (eventStream instanceof Error) {
        throw eventStream;
      }

      return eventStream;
    } catch (rawError) {
      return this.handleRawError(fieldDef.type, rawError, fieldNodes, path);
    }
  }
}

exports.Executor = Executor;
