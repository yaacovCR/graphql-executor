'use strict';

Object.defineProperty(exports, '__esModule', {
  value: true,
});
exports.defaultTypeResolver =
  exports.defaultFieldResolver =
  exports.Executor =
    void 0;

var _graphql = require('graphql');

var _directives = require('../type/directives.js');

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

var _repeater = require('../jsutils/repeater.js');

var _toError = require('../jsutils/toError.js');

var _isGraphQLError = require('../error/isGraphQLError.js');

var _definition = require('../type/definition.js');

var _isSubType = require('../utilities/isSubType.js');

var _getPossibleTypes = require('../utilities/getPossibleTypes.js');

var _values = require('./values.js');

var _collectFields = require('./collectFields.js');

var _mapAsyncIterable = require('./mapAsyncIterable.js');

var _flattenAsyncIterable = require('./flattenAsyncIterable.js');

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
      (0, _memoize.memoize3)((exeContext, returnType, fieldNodes) => {
        const { schema, fragments, variableValues, disableIncremental } =
          exeContext;
        return (0, _collectFields.collectSubfields)(
          schema,
          fragments,
          variableValues,
          returnType,
          fieldNodes,
          disableIncremental,
        );
      }),
    );

    _defineProperty(
      this,
      'getArgumentValues',
      (0, _memoize.memoize3)((def, node, variableValues) =>
        (0, _values.getArgumentValues)(def, node, variableValues),
      ),
    );

    _defineProperty(
      this,
      'buildFieldResolver',
      (resolverKey, defaultResolver) =>
        (exeContext, fieldDef, source, info, fieldNodes) => {
          var _fieldDef$resolverKey;

          const resolveFn =
            (_fieldDef$resolverKey = fieldDef[resolverKey]) !== null &&
            _fieldDef$resolverKey !== void 0
              ? _fieldDef$resolverKey
              : defaultResolver; // Build a JS object of arguments from the field.arguments AST, using the
          // variables scope to fulfill any variable references.

          const args = this.getArgumentValues(
            fieldDef,
            fieldNodes[0],
            exeContext.variableValues,
          ); // The resolve function's optional third argument is a context value that
          // is provided to every resolve function within an execution. It is commonly
          // used to represent an authenticated user, or request-specific caches.

          const contextValue = exeContext.contextValue;
          return resolveFn(source, args, contextValue, info);
        },
    );
  }

  /**
   * Implements the "Executing requests" section of the spec.
   */
  execute(args) {
    const exeContext = this.buildExecutionContext(args); // If a valid execution context cannot be created due to incorrect arguments,
    // a "Response" with only errors is returned.

    if (!('schema' in exeContext)) {
      return {
        errors: exeContext,
      };
    }

    return this.executeImpl(exeContext);
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

  executeImpl(exeContext) {
    const { operation, forceQueryAlgorithm } = exeContext;

    if (forceQueryAlgorithm) {
      return this.executeQueryAlgorithm(exeContext);
    }

    const operationType = operation.operation;

    switch (operationType) {
      case 'query':
        return this.executeQueryImpl(exeContext);

      case 'mutation':
        return this.executeMutationImpl(exeContext);

      default:
        return this.executeSubscriptionImpl(exeContext);
    }
  }

  executeQueryImpl(exeContext) {
    return this.executeQueryAlgorithm(exeContext);
  }
  /**
   * Implements the ExecuteQuery algorithm described in the GraphQL
   * specification. This algorithm is used to execute query operations
   * and to implement the ExecuteSubscriptionEvent algorith,
   *
   * If errors are encountered while executing a GraphQL field, only that
   * field and its descendants will be omitted, and sibling fields will still
   * be executed. An execution which encounters errors will still result in a
   * resolved Promise.
   *
   * Errors from sub-fields of a NonNull type may propagate to the top level,
   * at which point we still log the error and null the parent field, which
   * in this case is the entire response.
   */

  executeQueryAlgorithm(exeContext) {
    return this.executeQueryOrMutationImpl(
      exeContext,
      this.executeFields.bind(this),
    );
  }
  /**
   * Implements the ExecuteMutation algorithm described in the Graphql
   * specification.
   */

  executeMutationImpl(exeContext) {
    return this.executeQueryOrMutationImpl(
      exeContext,
      this.executeFieldsSerially.bind(this),
    );
  }
  /**
   * Implements the Execute algorithm described in the GraphQL specification
   * for queries/mutations, using the provided parallel or serial fields
   * executor.
   */

  executeQueryOrMutationImpl(exeContext, fieldsExecutor) {
    let data;

    try {
      data = this.executeRootFields(exeContext, fieldsExecutor);
    } catch (error) {
      exeContext.rootPayloadContext.errors.push(error);
      return this.buildResponse(exeContext, null);
    }

    if ((0, _isPromise.isPromise)(data)) {
      return data.then(
        (resolvedData) => this.buildResponse(exeContext, resolvedData),
        (error) => {
          exeContext.rootPayloadContext.errors.push(error);
          return this.buildResponse(exeContext, null);
        },
      );
    }

    return this.buildResponse(exeContext, data);
  }
  /**
   * Given a completed execution context and data, build the `{ errors, data }`
   * response defined by the "Response" section of the GraphQL specification.
   */

  buildResponse(exeContext, data) {
    const { rootPayloadContext } = exeContext;
    const errors = rootPayloadContext.errors;
    const initialResult =
      errors.length === 0
        ? {
            data,
          }
        : {
            errors,
            data,
          };

    if (this.hasNext(exeContext)) {
      return new _repeater.Repeater((push, stop) => {
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        stop.then(() =>
          Promise.all(
            Array.from(exeContext.iterators.values()).map((iterator) => {
              var _iterator$return;

              return (_iterator$return = iterator.return) === null ||
                _iterator$return === void 0
                ? void 0
                : _iterator$return.call(iterator);
            }),
          ),
        );
        exeContext.publisher = {
          push,
          stop,
        };
        const { pushedPayloads, pendingPayloads } = exeContext;
        pushedPayloads.set(rootPayloadContext, true); // eslint-disable-next-line @typescript-eslint/no-floating-promises

        push({ ...initialResult, hasNext: true });
        const parentPendingPayloads = pendingPayloads.get(rootPayloadContext);

        if (parentPendingPayloads) {
          this.pushResults(exeContext, push, stop, parentPendingPayloads);
        }

        pendingPayloads.delete(rootPayloadContext);
      });
    }

    return initialResult;
  }
  /**
   * Essential assertions before executing to provide developer feedback for
   * improper use of the GraphQL library.
   */

  assertValidExecutionArguments(schema, document, rawVariableValues) {
    document || (0, _devAssert.devAssert)(false, 'Must provide document.'); // Schema must be provided.

    schema || (0, _devAssert.devAssert)(false, 'Must provide schema.'); // Variables, if provided, must be an object.

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
      forceQueryAlgorithm,
      disableIncremental,
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

        default: // ignore non-executable definitions
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
    } // See: 'https://github.com/graphql/graphql-js/issues/2203'

    const variableDefinitions =
      /* c8 ignore next */
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

    const defaultResolveFieldValueFn =
      fieldResolver !== null && fieldResolver !== void 0
        ? fieldResolver
        : defaultFieldResolver;
    return {
      schema,
      fragments,
      rootValue,
      contextValue,
      operation,
      variableValues: coercedVariableValues.coerced,
      fieldResolver: defaultResolveFieldValueFn,
      typeResolver:
        typeResolver !== null && typeResolver !== void 0
          ? typeResolver
          : defaultTypeResolver,
      forceQueryAlgorithm:
        forceQueryAlgorithm !== null && forceQueryAlgorithm !== void 0
          ? forceQueryAlgorithm
          : false,
      disableIncremental:
        disableIncremental !== null && disableIncremental !== void 0
          ? disableIncremental
          : false,
      resolveField:
        operation.operation === 'subscription' && !forceQueryAlgorithm
          ? this.buildFieldResolver(
              'subscribe',
              subscribeFieldResolver !== null &&
                subscribeFieldResolver !== void 0
                ? subscribeFieldResolver
                : defaultFieldResolver,
            )
          : this.buildFieldResolver('resolve', defaultResolveFieldValueFn),
      rootPayloadContext: {
        errors: [],
      },
      iterators: new Set(),
      publisher: undefined,
      pendingPushes: 0,
      pushedPayloads: new WeakMap(),
      pendingPayloads: new WeakMap(),
    };
  }
  /**
   * Constructs a perPayload ExecutionContext object from an initial
   * ExecutionObject and the payload value.
   */

  buildPerPayloadExecutionContext(exeContext, payload) {
    return {
      ...exeContext,
      rootValue: payload,
      forceQueryAlgorithm: true,
      resolveField: this.buildFieldResolver(
        'resolve',
        exeContext.fieldResolver,
      ),
      rootPayloadContext: {
        errors: [],
      },
      iterators: new Set(),
      publisher: undefined,
      pendingPushes: 0,
      pushedPayloads: new WeakMap(),
      pendingPayloads: new WeakMap(),
    };
  }
  /**
   * Executes the root fields specified by the operation.
   */

  executeRootFields(exeContext, fieldsExecutor) {
    const {
      schema,
      fragments,
      rootValue,
      operation,
      variableValues,
      disableIncremental,
      rootPayloadContext,
    } = exeContext;
    const {
      rootType,
      fieldsAndPatches: { fields, patches },
    } = this.parseOperationRoot(
      schema,
      fragments,
      variableValues,
      operation,
      disableIncremental,
    );
    const path = undefined;
    const result = fieldsExecutor(
      exeContext,
      rootType,
      rootValue,
      path,
      fields,
      rootPayloadContext,
    );
    this.addPatches(
      exeContext,
      patches,
      rootType,
      rootValue,
      path,
      rootPayloadContext,
    );
    return result;
  }

  parseOperationRoot(
    schema,
    fragments,
    variableValues,
    operation,
    disableIncremental,
  ) {
    // TODO: replace getOperationRootType with schema.getRootType
    // after pre-v16 is dropped
    const rootType = (0, _graphql.getOperationRootType)(schema, operation);
    const fieldsAndPatches = (0, _collectFields.collectFields)(
      schema,
      fragments,
      variableValues,
      rootType,
      operation.selectionSet,
      disableIncremental,
    );
    return {
      rootType,
      fieldsAndPatches,
    };
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
          exeContext.rootPayloadContext,
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

  executeFields(
    exeContext,
    parentType,
    sourceValue,
    path,
    fields,
    payloadContext,
  ) {
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
        payloadContext,
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

  executeField(
    exeContext,
    parentType,
    source,
    fieldNodes,
    path,
    payloadContext,
  ) {
    const fieldDef = this.getFieldDef(
      exeContext.schema,
      parentType,
      fieldNodes[0],
    );

    if (!fieldDef) {
      return;
    }

    const returnType = fieldDef.type;
    const info = this.buildResolveInfo(
      exeContext,
      fieldDef,
      fieldNodes,
      parentType,
      path,
    ); // Get the resolved field value, regardless of if its result is normal or abrupt (error).
    // Then, complete the field

    try {
      const result = exeContext.resolveField(
        exeContext,
        fieldDef,
        source,
        info,
        fieldNodes,
      );
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
            payloadContext,
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
          payloadContext,
        );
      }

      if ((0, _isPromise.isPromise)(completed)) {
        // Note: we don't rely on a `catch` method, but we do expect "thenable"
        // to take a second callback for the error case.
        return completed.then(undefined, (rawError) => {
          const error = (0, _graphql.locatedError)(
            (0, _toError.toError)(rawError),
            fieldNodes,
            (0, _Path.pathToArray)(path),
          );
          return this.handleFieldError(
            error,
            returnType,
            payloadContext.errors,
          );
        });
      }

      return completed;
    } catch (rawError) {
      const error = (0, _graphql.locatedError)(
        (0, _toError.toError)(rawError),
        fieldNodes,
        (0, _Path.pathToArray)(path),
      );
      return this.handleFieldError(error, returnType, payloadContext.errors);
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

  handleFieldError(error, returnType, errors) {
    // If the field type is non-nullable, then it is resolved without any
    // protection from errors, however it still properly locates the error.
    if ((0, _definition.isNonNullType)(returnType)) {
      throw error;
    } // Otherwise, error protection is applied, logging the error and resolving
    // a null value for this field if one is encountered.

    errors.push(error);
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

  completeValue(
    exeContext,
    returnType,
    fieldNodes,
    info,
    path,
    result,
    payloadContext,
  ) {
    // If result is an Error, throw a located error.
    if (result instanceof Error) {
      throw result;
    } // If field type is NonNull, complete for inner type, and throw field error
    // if result is null.

    if ((0, _definition.isNonNullType)(returnType)) {
      const completed = this.completeValue(
        exeContext,
        returnType.ofType,
        fieldNodes,
        info,
        path,
        result,
        payloadContext,
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

    if ((0, _definition.isListType)(returnType)) {
      return this.completeListValue(
        exeContext,
        returnType,
        fieldNodes,
        info,
        path,
        result,
        payloadContext,
      );
    } // If field type is a leaf type, Scalar or Enum, serialize to a valid value,
    // returning null if serialization is not possible.

    if ((0, _definition.isLeafType)(returnType)) {
      return this.completeLeafValue(returnType, result);
    } // If field type is an abstract type, Interface or Union, determine the
    // runtime Object type and complete for that type.

    if ((0, _definition.isAbstractType)(returnType)) {
      return this.completeAbstractValue(
        exeContext,
        returnType,
        fieldNodes,
        info,
        path,
        result,
        payloadContext,
      );
    } // If field type is Object, execute and complete all sub-selections.

    if ((0, _definition.isObjectType)(returnType)) {
      return this.completeObjectValue(
        exeContext,
        returnType,
        fieldNodes,
        info,
        path,
        result,
        payloadContext,
      );
    }
    /* c8 ignore next 6 */
    // Not reachable. All possible output types have been considered

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

  completeListValue(
    exeContext,
    returnType,
    fieldNodes,
    info,
    path,
    result,
    payloadContext,
  ) {
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
        payloadContext,
      );
    }

    if (!(0, _isIterableObject.isIterableObject)(result)) {
      throw new _graphql.GraphQLError(
        `Expected Iterable, but did not find one for field "${info.parentType.name}.${info.fieldName}".`,
      );
    }

    const iterator = result[Symbol.iterator]();
    return this.completeIteratorValue(
      exeContext,
      itemType,
      fieldNodes,
      info,
      path,
      iterator,
      payloadContext,
    );
  }
  /**
   * Returns an object containing the `@stream` arguments if a field should be
   * streamed based on the experimental flag, stream directive present and
   * not disabled by the "if" argument.
   */

  getStreamValues(exeContext, fieldNodes) {
    if (exeContext.disableIncremental) {
      return;
    } // validation only allows equivalent streams on multiple fields, so it is
    // safe to only check the first fieldNode for the stream directive

    const stream = (0, _values.getDirectiveValues)(
      _directives.GraphQLStreamDirective,
      fieldNodes[0],
      exeContext.variableValues,
    );

    if (!stream) {
      return;
    }

    if (stream.if === false) {
      return;
    }

    typeof stream.initialCount === 'number' ||
      (0, _invariant.invariant)(false, 'initialCount must be a number');
    stream.initialCount >= 0 ||
      (0, _invariant.invariant)(
        false,
        'initialCount must be a positive integer',
      );
    return {
      initialCount: stream.initialCount,
      label: typeof stream.label === 'string' ? stream.label : undefined,
    };
  }
  /**
   * Complete an iterator value by completing each result.
   */

  completeIteratorValue(
    exeContext,
    itemType,
    fieldNodes,
    info,
    path,
    iterator,
    payloadContext,
  ) {
    const stream = this.getStreamValues(exeContext, fieldNodes); // This is specified as a simple map, however we're optimizing the path
    // where the list contains no Promises by avoiding creating another Promise.

    const promises = [];
    const completedResults = [];
    let index = 0; // eslint-disable-next-line no-constant-condition

    while (true) {
      if (
        stream &&
        typeof stream.initialCount === 'number' &&
        index >= stream.initialCount
      ) {
        this.addIteratorValue(
          index,
          iterator,
          exeContext,
          fieldNodes,
          info,
          itemType,
          path,
          stream.label,
          payloadContext,
        );
        break;
      }

      const itemPath = (0, _Path.addPath)(path, index, undefined);
      const iteration = iterator.next();

      if (iteration.done) {
        break;
      }

      this.completeListItemValue(
        completedResults,
        index,
        promises,
        iteration.value,
        exeContext,
        itemType,
        fieldNodes,
        info,
        itemPath,
        payloadContext,
      );
      index++;
    }

    return promises.length
      ? (0, _resolveAfterAll.resolveAfterAll)(completedResults, promises)
      : completedResults;
  }
  /**
   * Complete an async iterator value by completing each result.
   */

  async completeAsyncIteratorValue(
    exeContext,
    itemType,
    fieldNodes,
    info,
    path,
    iterator,
    payloadContext,
  ) {
    const stream = this.getStreamValues(exeContext, fieldNodes); // This is specified as a simple map, however we're optimizing the path
    // where the list contains no Promises by avoiding creating another Promise.

    const promises = [];
    const completedResults = [];
    let index = 0; // eslint-disable-next-line no-constant-condition

    while (true) {
      if (
        stream &&
        typeof stream.initialCount === 'number' &&
        index >= stream.initialCount
      ) {
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        this.addAsyncIteratorValue(
          index,
          iterator,
          exeContext,
          fieldNodes,
          info,
          itemType,
          path,
          stream.label,
          payloadContext,
        );
        break;
      }

      const itemPath = (0, _Path.addPath)(path, index, undefined);
      let iteration;

      try {
        // eslint-disable-next-line no-await-in-loop
        iteration = await iterator.next();
      } catch (rawError) {
        const error = (0, _graphql.locatedError)(
          (0, _toError.toError)(rawError),
          fieldNodes,
          (0, _Path.pathToArray)(itemPath),
        );
        completedResults.push(
          this.handleFieldError(error, itemType, payloadContext.errors),
        );
        break;
      }

      if (iteration.done) {
        break;
      }

      this.completeListItemValue(
        completedResults,
        index,
        promises,
        iteration.value,
        exeContext,
        itemType,
        fieldNodes,
        info,
        itemPath,
        payloadContext,
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
    payloadContext,
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
            payloadContext,
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
          payloadContext,
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
            (0, _toError.toError)(rawError),
            fieldNodes,
            (0, _Path.pathToArray)(itemPath),
          );
          return this.handleFieldError(error, itemType, payloadContext.errors);
        })
        .then((resolved) => {
          completedResults[index] = resolved;
        });
      promises.push(promise);
    } catch (rawError) {
      const error = (0, _graphql.locatedError)(
        (0, _toError.toError)(rawError),
        fieldNodes,
        (0, _Path.pathToArray)(itemPath),
      );
      completedResults[index] = this.handleFieldError(
        error,
        itemType,
        payloadContext.errors,
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
    payloadContext,
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
          payloadContext,
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
      payloadContext,
    );
  }

  ensureValidRuntimeType(
    runtimeTypeOrName,
    exeContext,
    returnType,
    fieldNodes,
    info,
    result,
  ) {
    if (runtimeTypeOrName == null) {
      throw new _graphql.GraphQLError(
        `Abstract type "${returnType.name}" must resolve to an Object type at runtime for field "${info.parentType.name}.${info.fieldName}". Either the "${returnType.name}" type should provide a "resolveType" function or each possible type should provide an "isTypeOf" function.`,
        fieldNodes,
      );
    }

    const runtimeTypeName =
      typeof runtimeTypeOrName === 'object' &&
      (0, _definition.isNamedType)(runtimeTypeOrName)
        ? runtimeTypeOrName.name
        : runtimeTypeOrName;

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

    if (!(0, _definition.isObjectType)(runtimeType)) {
      throw new _graphql.GraphQLError(
        `Abstract type "${returnType.name}" was resolved to a non-object type "${runtimeTypeName}".`,
        fieldNodes,
      );
    }

    if (
      !(0, _isSubType.isSubType)(exeContext.schema, returnType, runtimeType)
    ) {
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

  completeObjectValue(
    exeContext,
    returnType,
    fieldNodes,
    info,
    path,
    result,
    payloadContext,
  ) {
    // If there is an isTypeOf predicate function, call it with the
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

          return this.collectAndExecuteSubfields(
            exeContext,
            returnType,
            fieldNodes,
            path,
            result,
            payloadContext,
          );
        });
      }

      if (!isTypeOf) {
        throw this.invalidReturnTypeError(returnType, result, fieldNodes);
      }
    }

    return this.collectAndExecuteSubfields(
      exeContext,
      returnType,
      fieldNodes,
      path,
      result,
      payloadContext,
    );
  }

  invalidReturnTypeError(returnType, result, fieldNodes) {
    return new _graphql.GraphQLError(
      `Expected value of type "${returnType.name}" but got: ${(0,
      _inspect.inspect)(result)}.`,
      fieldNodes,
    );
  }

  collectAndExecuteSubfields(
    exeContext,
    returnType,
    fieldNodes,
    path,
    result,
    payloadContext,
  ) {
    // Collect sub-fields to execute to complete this value.
    const { fields: subFieldNodes, patches: subPatches } =
      this.collectSubfields(exeContext, returnType, fieldNodes);
    const subFields = this.executeFields(
      exeContext,
      returnType,
      result,
      path,
      subFieldNodes,
      payloadContext,
    );
    this.addPatches(
      exeContext,
      subPatches,
      returnType,
      result,
      path,
      payloadContext,
    );
    return subFields;
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
  /**
   * Implements the "Subscribe" algorithm described in the GraphQL specification.
   *
   * Returns a Promise which resolves to either an AsyncIterator (if successful)
   * or an ExecutionResult (error). The promise will be rejected if the schema or
   * other arguments to this function are invalid, or if the resolved event stream
   * is not an async iterable.
   *
   * If the client-provided arguments to this function do not result in a
   * compliant subscription, a GraphQL Response (ExecutionResult) with
   * descriptive errors and no data will be returned.
   *
   * If the source stream could not be created due to faulty subscription
   * resolver logic or underlying systems, the promise will resolve to a single
   * ExecutionResult containing `errors` and no `data`.
   *
   * If the operation succeeded, the promise resolves to an AsyncIterator, which
   * yields a stream of ExecutionResults representing the response stream.
   *
   * Accepts either an object with named arguments, or individual arguments.
   */

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
      return this.executeSubscriptionEvent(perPayloadExecutionContext);
    }; // Map every source value to a ExecutionResult value as described above.

    return (0, _flattenAsyncIterable.flattenAsyncIterable)(
      (0, _mapAsyncIterable.mapAsyncIterable)(
        resultOrStream,
        mapSourceToResponse,
      ),
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
      if ((0, _isGraphQLError.isGraphQLError)(error)) {
        return {
          errors: [error],
        };
      }

      throw error;
    }
  }

  async executeSubscriptionRootField(exeContext) {
    const {
      schema,
      fragments,
      rootValue,
      operation,
      variableValues,
      disableIncremental,
    } = exeContext;
    const {
      rootType,
      fieldsAndPatches: { fields },
    } = this.parseOperationRoot(
      schema,
      fragments,
      variableValues,
      operation,
      disableIncremental,
    );
    const [responseName, fieldNodes] = [...fields.entries()][0];
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
      const eventStream = await exeContext.resolveField(
        exeContext,
        fieldDef,
        rootValue,
        info,
        fieldNodes,
      );

      if (eventStream instanceof Error) {
        throw eventStream;
      }

      return eventStream;
    } catch (error) {
      throw (0, _graphql.locatedError)(
        (0, _toError.toError)(error),
        fieldNodes,
        (0, _Path.pathToArray)(path),
      );
    }
  }

  executeSubscriptionEvent(exeContext) {
    return this.executeQueryAlgorithm(exeContext);
  }

  addPatches(
    exeContext,
    patches,
    parentType,
    source,
    path,
    parentPayloadContext,
  ) {
    for (const patch of patches) {
      exeContext.pendingPushes++;
      const { label, fields: patchFields } = patch;
      const payloadContext = {
        errors: [],
        label,
      };
      Promise.resolve(source)
        .then(() =>
          this.executeFields(
            exeContext,
            parentType,
            source,
            path,
            patchFields,
            payloadContext,
          ),
        )
        .then(
          (data) =>
            this.queue(
              exeContext,
              payloadContext,
              parentPayloadContext,
              data,
              path,
            ),
          (error) => {
            this.handleFieldError(error, parentType, payloadContext.errors);
            this.queue(
              exeContext,
              payloadContext,
              parentPayloadContext,
              null,
              path,
            );
          },
        );
    }
  }

  addIteratorValue(
    initialIndex,
    iterator,
    exeContext,
    fieldNodes,
    info,
    itemType,
    path,
    label,
    parentPayloadContext,
  ) {
    let index = initialIndex;
    let prevPayloadContext = parentPayloadContext;
    let iteration = iterator.next();

    while (!iteration.done) {
      const _prevPayloadContext = prevPayloadContext;
      const payloadContext = {
        errors: [],
        label,
      }; // avoid unsafe reference of variable from functions inside a loop
      // see https://eslint.org/docs/rules/no-loop-func

      exeContext.pendingPushes++;
      const itemPath = (0, _Path.addPath)(path, index, undefined);
      Promise.resolve(iteration.value)
        .then((resolved) =>
          this.completeValue(
            exeContext,
            itemType,
            fieldNodes,
            info,
            itemPath,
            resolved,
            payloadContext,
          ),
        )
        .then((data) =>
          this.queue(
            exeContext,
            payloadContext,
            _prevPayloadContext,
            data,
            itemPath,
          ),
        )
        .then(undefined, (rawError) => {
          const error = (0, _graphql.locatedError)(
            (0, _toError.toError)(rawError),
            fieldNodes,
            (0, _Path.pathToArray)(itemPath),
          );
          payloadContext.errors.push(error);
          this.queue(
            exeContext,
            payloadContext,
            _prevPayloadContext,
            null,
            itemPath,
          );
        });
      index++;
      prevPayloadContext = payloadContext;
      iteration = iterator.next();
    }
  }

  async addAsyncIteratorValue(
    initialIndex,
    iterator,
    exeContext,
    fieldNodes,
    info,
    itemType,
    path,
    label,
    parentPayloadContext,
  ) {
    const { iterators } = exeContext;
    iterators.add(iterator);
    let index = initialIndex;
    let prevPayloadContext = parentPayloadContext;
    let currentPayloadContext = {
      errors: [],
      label,
    };
    let iteration = await this.advanceAsyncIterator(
      index,
      iterator,
      exeContext,
      fieldNodes,
      itemType,
      path,
      currentPayloadContext,
      parentPayloadContext,
    );

    while (iteration && !iteration.done) {
      // avoid unsafe reference of variable from functions inside a loop
      // see https://eslint.org/docs/rules/no-loop-func
      const _prevPayloadContext = prevPayloadContext;
      const _currentPayloadContext = currentPayloadContext;
      exeContext.pendingPushes++;
      const itemPath = (0, _Path.addPath)(path, index, undefined);
      Promise.resolve(iteration.value)
        .then((resolved) =>
          this.completeValue(
            exeContext,
            itemType,
            fieldNodes,
            info,
            itemPath,
            resolved,
            _currentPayloadContext,
          ),
        )
        .then((data) =>
          this.queue(
            exeContext,
            _currentPayloadContext,
            _prevPayloadContext,
            data,
            itemPath,
          ),
        )
        .then(undefined, (rawError) => {
          const error = (0, _graphql.locatedError)(
            (0, _toError.toError)(rawError),
            fieldNodes,
            (0, _Path.pathToArray)(itemPath),
          );

          _currentPayloadContext.errors.push(error);

          this.queue(
            exeContext,
            _currentPayloadContext,
            _prevPayloadContext,
            null,
            itemPath,
          );
        });
      index++;
      prevPayloadContext = currentPayloadContext;
      currentPayloadContext = {
        errors: [],
        label,
      }; // eslint-disable-next-line no-await-in-loop

      iteration = await this.advanceAsyncIterator(
        index,
        iterator,
        exeContext,
        fieldNodes,
        itemType,
        path,
        currentPayloadContext,
        prevPayloadContext,
      );
    }

    this.closeAsyncIterator(exeContext, iterator);
  }

  async advanceAsyncIterator(
    index,
    iterator,
    exeContext,
    fieldNodes,
    itemType,
    path,
    payloadContext,
    prevPayloadContext,
  ) {
    try {
      return await iterator.next();
    } catch (rawError) {
      exeContext.pendingPushes++;
      const itemPath = (0, _Path.addPath)(path, index, undefined);
      const error = (0, _graphql.locatedError)(
        (0, _toError.toError)(rawError),
        fieldNodes,
        (0, _Path.pathToArray)(itemPath),
      );
      this.handleFieldError(error, itemType, payloadContext.errors);
      this.queue(
        exeContext,
        payloadContext,
        prevPayloadContext,
        null,
        itemPath,
      );
    }
  }

  closeAsyncIterator(exeContext, iterator) {
    const { iterators, publisher } = exeContext;
    iterators.delete(iterator);

    if (!this.hasNext(exeContext) && publisher) {
      const { push, stop } = publisher; // eslint-disable-next-line @typescript-eslint/no-floating-promises

      push({
        hasNext: false,
      });
      stop();
    }
  }

  hasNext(exeContext) {
    return exeContext.pendingPushes > 0 || exeContext.iterators.size > 0;
  }

  queue(exeContext, payloadContext, parentPayloadContext, data, path) {
    const { pushedPayloads } = exeContext;

    if (pushedPayloads.get(parentPayloadContext)) {
      // Repeater executors are executed lazily, only after the first payload
      // is requested, and so we cannot add the push and stop methods to
      // the execution context during construction.
      // The publisher will always available before we need it, as we only use
      // the push and stop methods after the first payload has been requested
      // and sent.
      // TODO: create a method that returns an eager (or primed) repeater, as
      // well as its push and stop methods.
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const publisher = exeContext.publisher;
      const { push, stop } = publisher;
      this.pushResult(exeContext, push, stop, payloadContext, data, path);
      return;
    }

    const { pendingPayloads } = exeContext;
    const parentPendingPayloads =
      exeContext.pendingPayloads.get(parentPayloadContext);

    if (parentPendingPayloads) {
      parentPendingPayloads.push({
        payloadContext,
        data,
        path,
      });
      return;
    }

    pendingPayloads.set(parentPayloadContext, [
      {
        payloadContext,
        data,
        path,
      },
    ]);
  }

  pushResult(exeContext, push, stop, payloadContext, data, path) {
    exeContext.pendingPushes--;
    exeContext.pushedPayloads.set(payloadContext, true);
    const { errors, label } = payloadContext; // eslint-disable-next-line @typescript-eslint/no-floating-promises

    push(this.createPatchResult(exeContext, data, errors, path, label)).then(
      () => {
        if (!this.hasNext(exeContext)) {
          stop();
        }
      },
    );
    const { pendingPayloads } = exeContext;
    const parentPendingPayloads = pendingPayloads.get(payloadContext);

    if (parentPendingPayloads) {
      this.pushResults(exeContext, push, stop, parentPendingPayloads);
    }

    pendingPayloads.delete(payloadContext);
  }

  pushResults(exeContext, push, stop, results) {
    const promises = [];
    const { pendingPayloads } = exeContext;

    for (const result of results) {
      exeContext.pendingPushes--;
      const { payloadContext, data, path } = result;
      exeContext.pushedPayloads.set(payloadContext, true);
      const { errors, label } = payloadContext;
      promises.push(
        push(this.createPatchResult(exeContext, data, errors, path, label)),
      );
      const parentPendingPayloads = pendingPayloads.get(payloadContext);

      if (parentPendingPayloads) {
        this.pushResults(exeContext, push, stop, parentPendingPayloads);
      }

      pendingPayloads.delete(payloadContext);
    } // eslint-disable-next-line @typescript-eslint/no-floating-promises

    Promise.all(promises).then(() => {
      if (!this.hasNext(exeContext)) {
        stop();
      }
    });
  }

  createPatchResult(exeContext, data, errors, path, label) {
    const value = {
      data,
      path: path ? (0, _Path.pathToArray)(path) : [],
      hasNext: this.hasNext(exeContext),
    };

    if (label != null) {
      value.label = label;
    }

    if (errors.length > 0) {
      value.errors = errors;
    }

    return value;
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

  const possibleTypes = (0, _getPossibleTypes.getPossibleTypes)(
    info.schema,
    abstractType,
  );
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
