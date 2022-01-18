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

import {
  GraphQLIncludeDirective,
  GraphQLSkipDirective,
  GraphQLError,
  Kind,
  SchemaMetaFieldDef,
  TypeMetaFieldDef,
  TypeNameMetaFieldDef,
  locatedError,
} from 'graphql';
import {
  GraphQLDeferDirective,
  GraphQLStreamDirective,
} from '../type/directives.mjs';
import { inspect } from '../jsutils/inspect.mjs';
import { memoize1 } from '../jsutils/memoize1.mjs';
import { memoize2 } from '../jsutils/memoize2.mjs';
import { memoize3 } from '../jsutils/memoize3.mjs';
import { invariant } from '../jsutils/invariant.mjs';
import { devAssert } from '../jsutils/devAssert.mjs';
import { isPromise } from '../jsutils/isPromise.mjs';
import { isObjectLike } from '../jsutils/isObjectLike.mjs';
import { promiseReduce } from '../jsutils/promiseReduce.mjs';
import { addPath, pathToArray } from '../jsutils/Path.mjs';
import { isAsyncIterable } from '../jsutils/isAsyncIterable.mjs';
import { isIterableObject } from '../jsutils/isIterableObject.mjs';
import { resolveAfterAll } from '../jsutils/resolveAfterAll.mjs';
import { Repeater } from '../jsutils/repeater.mjs';
import { toError } from '../jsutils/toError.mjs';
import { isGraphQLError } from '../error/isGraphQLError.mjs';
import { toExecutorSchema } from './toExecutorSchema.mjs';
import {
  getVariableValues,
  getArgumentValues as _getArgumentValues,
  getDirectiveValues,
} from './values.mjs';
import { mapAsyncIterable } from './mapAsyncIterable.mjs';
import { flattenAsyncIterable } from './flattenAsyncIterable.mjs';
/**
 * Terminology
 *
 * "Definitions" are the generic name for top-level statements in the document.
 * Examples of this include:
 * 1) Operations (such as a query)
 * 2) Fragments
 *
 * "Operations" are a generic name for requests in the document.
 * Examples of this include:
 * 1) query,
 * 2) mutation
 *
 * "Selections" are the definitions that can appear legally and at
 * single level of the query. These include:
 * 1) field references e.g `a`
 * 2) fragment "spreads" e.g. `...c`
 * 3) inline fragment "spreads" e.g. `...on Type { a }`
 */

/**
 * Data that must be available at all points during query execution.
 */

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
export class Executor {
  /**
   * A memoized collection of relevant subfields with regard to the return
   * type. Memoizing ensures the subfields are not repeatedly calculated, which
   * saves overhead when resolving lists of values.
   */

  /**
   * A memoized collection of field argument values.
   * Memoizing ensures the subfields are not repeatedly calculated, which
   * saves overhead when resolving lists of values.
   */

  /**
   * A memoized method that looks up the field given a parent type
   * and an array of field nodes.
   */

  /**
   * Creates a field list, memoizing so that functions operating on the
   * field list can be memoized.
   */

  /**
   * Appends to a field list, memoizing so that functions operating on the
   * field list can be memoized.
   */
  constructor(executorArgs) {
    _defineProperty(
      this,
      'collectSubfields',
      memoize3((exeContext, returnType, fieldNodes) =>
        this._collectSubfields(exeContext, returnType, fieldNodes),
      ),
    );

    _defineProperty(
      this,
      'getArgumentValues',
      memoize3((def, node, variableValues) =>
        _getArgumentValues(this._executorSchema, def, node, variableValues),
      ),
    );

    _defineProperty(
      this,
      'getFieldDef',
      memoize2((parentType, fieldNodes) =>
        this._getFieldDef(parentType, fieldNodes),
      ),
    );

    _defineProperty(
      this,
      'createFieldList',
      memoize1((node) => [node]),
    );

    _defineProperty(
      this,
      'updateFieldList',
      memoize2((fieldList, node) => [...fieldList, node]),
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
              : defaultResolver;
          const { contextValue, variableValues } = exeContext; // Build a JS object of arguments from the field.arguments AST, using the
          // variables scope to fulfill any variable references.

          const args = this.getArgumentValues(
            fieldDef,
            fieldNodes[0],
            variableValues,
          ); // The resolve function's optional third argument is a context value that
          // is provided to every resolve function within an execution. It is commonly
          // used to represent an authenticated user, or request-specific caches.

          return resolveFn(source, args, contextValue, info);
        },
    );

    const { schema, executorSchema } = executorArgs; // Schema must be provided.

    schema || devAssert(false, 'Must provide schema.');
    this._schema = schema;
    this._executorSchema =
      executorSchema !== null && executorSchema !== void 0
        ? executorSchema
        : toExecutorSchema(schema);
  }
  /**
   * Implements the "Executing requests" section of the spec.
   */

  execute(args) {
    const exeContext = this.buildExecutionContext(args); // If a valid execution context cannot be created due to incorrect arguments,
    // a "Response" with only errors is returned.

    if (!('fragments' in exeContext)) {
      return {
        errors: exeContext,
      };
    }

    return this.executeImpl(exeContext);
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

  async createSourceEventStream(args) {
    const exeContext = this.buildExecutionContext(args); // If a valid execution context cannot be created due to incorrect arguments,
    // a "Response" with only errors is returned.

    if (!('fragments' in exeContext)) {
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

    if (isPromise(data)) {
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
      return new Repeater((push, stop) => {
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

  assertValidExecutionArguments(document, rawVariableValues) {
    document || devAssert(false, 'Must provide document.'); // Variables, if provided, must be an object.

    rawVariableValues == null ||
      isObjectLike(rawVariableValues) ||
      devAssert(
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
      document,
      rootValue,
      contextValue,
      variableValues: rawVariableValues,
      operationName,
      fieldResolver,
      typeResolver,
      subscribeFieldResolver,
      forceQueryAlgorithm,
      enableIncremental,
    } = args; // If arguments are missing or incorrectly typed, this is an internal
    // developer mistake which should throw an error.

    this.assertValidExecutionArguments(document, rawVariableValues);
    let operation;
    const fragments = Object.create(null);

    for (const definition of document.definitions) {
      switch (definition.kind) {
        case Kind.OPERATION_DEFINITION:
          if (operationName == null) {
            if (operation !== undefined) {
              return [
                new GraphQLError(
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

        case Kind.FRAGMENT_DEFINITION:
          fragments[definition.name.value] = definition;
          break;

        default: // ignore non-executable definitions
      }
    }

    if (!operation) {
      if (operationName != null) {
        return [
          new GraphQLError(`Unknown operation named "${operationName}".`),
        ];
      }

      return [new GraphQLError('Must provide an operation.')];
    } // See: 'https://github.com/graphql/graphql-js/issues/2203'

    const variableDefinitions =
      /* c8 ignore next */
      (_operation$variableDe = operation.variableDefinitions) !== null &&
      _operation$variableDe !== void 0
        ? _operation$variableDe
        : [];
    const coercedVariableValues = getVariableValues(
      this._executorSchema,
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
      enableIncremental:
        enableIncremental !== null && enableIncremental !== void 0
          ? enableIncremental
          : true,
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
      fragments,
      rootValue,
      operation,
      variableValues,
      enableIncremental,
      rootPayloadContext,
    } = exeContext;
    const {
      rootType,
      fieldsAndPatches: { fields, patches },
    } = this.parseOperationRoot(
      fragments,
      variableValues,
      operation,
      enableIncremental,
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

  parseOperationRoot(fragments, variableValues, operation, enableIncremental) {
    const rootType = this._executorSchema.getRootType(operation.operation);

    if (rootType == null) {
      throw new GraphQLError(
        `Schema is not configured to execute ${operation.operation} operation.`,
        operation,
      );
    }

    const fieldsAndPatches = this.collectFields(
      fragments,
      variableValues,
      rootType,
      operation.selectionSet,
      enableIncremental,
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
    return promiseReduce(
      fields.entries(),
      (results, [responseName, fieldNodes]) => {
        const fieldPath = addPath(path, responseName, parentType.name);
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

        if (isPromise(result)) {
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
      const fieldPath = addPath(path, responseName, parentType.name);
      const result = this.executeField(
        exeContext,
        parentType,
        sourceValue,
        fieldNodes,
        fieldPath,
        payloadContext,
      );

      if (result !== undefined) {
        if (isPromise(result)) {
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

    return resolveAfterAll(results, promises);
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
    const fieldDef = this.getFieldDef(parentType, fieldNodes);

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

      if (isPromise(result)) {
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

      if (isPromise(completed)) {
        // Note: we don't rely on a `catch` method, but we do expect "thenable"
        // to take a second callback for the error case.
        return completed.then(undefined, (rawError) => {
          const error = locatedError(
            toError(rawError),
            fieldNodes,
            pathToArray(path),
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
      const error = locatedError(
        toError(rawError),
        fieldNodes,
        pathToArray(path),
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
      schema: this._schema,
      executorSchema: this._executorSchema,
      fragments: exeContext.fragments,
      rootValue: exeContext.rootValue,
      operation: exeContext.operation,
      variableValues: exeContext.variableValues,
    };
  }

  handleFieldError(error, returnType, errors) {
    // If the field type is non-nullable, then it is resolved without any
    // protection from errors, however it still properly locates the error.
    if (this._executorSchema.isNonNullType(returnType)) {
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

    if (this._executorSchema.isNonNullType(returnType)) {
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

    if (this._executorSchema.isListType(returnType)) {
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

    if (this._executorSchema.isLeafType(returnType)) {
      return this.completeLeafValue(returnType, result);
    } // If field type is an abstract type, Interface or Union, determine the
    // runtime Object type and complete for that type.

    if (this._executorSchema.isAbstractType(returnType)) {
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

    if (this._executorSchema.isObjectType(returnType)) {
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
      invariant(
        false,
        'Cannot complete value of unexpected output type: ' +
          inspect(returnType),
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

    if (isAsyncIterable(result)) {
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

    if (!isIterableObject(result)) {
      throw new GraphQLError(
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
    if (!exeContext.enableIncremental) {
      return;
    } // validation only allows equivalent streams on multiple fields, so it is
    // safe to only check the first fieldNode for the stream directive

    const stream = getDirectiveValues(
      this._executorSchema,
      GraphQLStreamDirective,
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
      invariant(false, 'initialCount must be a number');
    stream.initialCount >= 0 ||
      invariant(false, 'initialCount must be a positive integer');
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

      const itemPath = addPath(path, index, undefined);
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
      ? resolveAfterAll(completedResults, promises)
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

      const itemPath = addPath(path, index, undefined);
      let iteration;

      try {
        // eslint-disable-next-line no-await-in-loop
        iteration = await iterator.next();
      } catch (rawError) {
        const error = locatedError(
          toError(rawError),
          fieldNodes,
          pathToArray(itemPath),
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
      ? resolveAfterAll(completedResults, promises)
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

      if (isPromise(item)) {
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

      if (!isPromise(completedItem)) {
        return;
      } // Note: we don't rely on a `catch` method, but we do expect "thenable"
      // to take a second callback for the error case.

      const promise = completedItem
        .then(undefined, (rawError) => {
          const error = locatedError(
            toError(rawError),
            fieldNodes,
            pathToArray(itemPath),
          );
          return this.handleFieldError(error, itemType, payloadContext.errors);
        })
        .then((resolved) => {
          completedResults[index] = resolved;
        });
      promises.push(promise);
    } catch (rawError) {
      const error = locatedError(
        toError(rawError),
        fieldNodes,
        pathToArray(itemPath),
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
        `Expected \`${inspect(returnType)}.serialize(${inspect(
          result,
        )})\` to ` +
          `return non-nullable value, returned: ${inspect(serializedResult)}`,
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

    if (isPromise(runtimeType)) {
      return runtimeType.then((resolvedRuntimeType) =>
        this.completeObjectValue(
          exeContext,
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
          payloadContext,
        ),
      );
    }

    return this.completeObjectValue(
      exeContext,
      this.ensureValidRuntimeType(
        runtimeType,
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
    returnType,
    fieldNodes,
    info,
    result,
  ) {
    if (runtimeTypeOrName == null) {
      throw new GraphQLError(
        `Abstract type "${returnType.name}" must resolve to an Object type at runtime for field "${info.parentType.name}.${info.fieldName}". Either the "${returnType.name}" type should provide a "resolveType" function or each possible type should provide an "isTypeOf" function.`,
        fieldNodes,
      );
    }

    const runtimeTypeName =
      typeof runtimeTypeOrName === 'object' &&
      this._executorSchema.isNamedType(runtimeTypeOrName)
        ? runtimeTypeOrName.name
        : runtimeTypeOrName;

    if (typeof runtimeTypeName !== 'string') {
      throw new GraphQLError(
        `Abstract type "${returnType.name}" must resolve to an Object type at runtime for field "${info.parentType.name}.${info.fieldName}" with ` +
          `value ${inspect(result)}, received "${inspect(runtimeTypeName)}".`,
      );
    }

    const runtimeType = this._executorSchema.getNamedType(runtimeTypeName);

    if (runtimeType == null) {
      throw new GraphQLError(
        `Abstract type "${returnType.name}" was resolved to a type "${runtimeTypeName}" that does not exist inside the schema.`,
        fieldNodes,
      );
    }

    if (!this._executorSchema.isObjectType(runtimeType)) {
      throw new GraphQLError(
        `Abstract type "${returnType.name}" was resolved to a non-object type "${runtimeTypeName}".`,
        fieldNodes,
      );
    }

    if (!this._executorSchema.isSubType(returnType, runtimeType)) {
      throw new GraphQLError(
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

      if (isPromise(isTypeOf)) {
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
    return new GraphQLError(
      `Expected value of type "${returnType.name}" but got: ${inspect(
        result,
      )}.`,
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

  _getFieldDef(parentType, fieldNodes) {
    const fieldName = fieldNodes[0].name.value;

    if (
      fieldName === SchemaMetaFieldDef.name &&
      this._executorSchema.getRootType('query') === parentType
    ) {
      return SchemaMetaFieldDef;
    } else if (
      fieldName === TypeMetaFieldDef.name &&
      this._executorSchema.getRootType('query') === parentType
    ) {
      return TypeMetaFieldDef;
    } else if (fieldName === TypeNameMetaFieldDef.name) {
      return TypeNameMetaFieldDef;
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

    if (!isAsyncIterable(resultOrStream)) {
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

    return flattenAsyncIterable(
      mapAsyncIterable(resultOrStream, mapSourceToResponse),
    );
  }

  async createSourceEventStreamImpl(exeContext) {
    try {
      const eventStream = await this.executeSubscriptionRootField(exeContext); // Assert field returned an event stream, otherwise yield an error.

      if (!isAsyncIterable(eventStream)) {
        throw new Error(
          'Subscription field must return Async Iterable. ' +
            `Received: ${inspect(eventStream)}.`,
        );
      }

      return eventStream;
    } catch (error) {
      // If it GraphQLError, report it as an ExecutionResult, containing only errors and no data.
      // Otherwise treat the error as a system-class error and re-throw it.
      if (isGraphQLError(error)) {
        return {
          errors: [error],
        };
      }

      throw error;
    }
  }

  async executeSubscriptionRootField(exeContext) {
    const {
      fragments,
      rootValue,
      operation,
      variableValues,
      enableIncremental,
    } = exeContext;
    const {
      rootType,
      fieldsAndPatches: { fields },
    } = this.parseOperationRoot(
      fragments,
      variableValues,
      operation,
      enableIncremental,
    );
    const [responseName, fieldNodes] = [...fields.entries()][0];
    const fieldDef = this.getFieldDef(rootType, fieldNodes);

    if (!fieldDef) {
      const fieldName = fieldNodes[0].name.value;
      throw new GraphQLError(
        `The subscription field "${fieldName}" is not defined.`,
        fieldNodes,
      );
    }

    const path = addPath(undefined, responseName, rootType.name);
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
      throw locatedError(toError(error), fieldNodes, pathToArray(path));
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
      const itemPath = addPath(path, index, undefined);
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
          const error = locatedError(
            toError(rawError),
            fieldNodes,
            pathToArray(itemPath),
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
      const itemPath = addPath(path, index, undefined);
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
          const error = locatedError(
            toError(rawError),
            fieldNodes,
            pathToArray(itemPath),
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
      const itemPath = addPath(path, index, undefined);
      const error = locatedError(
        toError(rawError),
        fieldNodes,
        pathToArray(itemPath),
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
      path: path ? pathToArray(path) : [],
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
  /**
   * Given a selectionSet, collects all of the fields and returns them.
   *
   * CollectFields requires the "runtime type" of an object. For a field that
   * returns an Interface or Union type, the "runtime type" will be the actual
   * object type returned by that field.
   */

  collectFields(
    fragments,
    variableValues,
    runtimeType,
    selectionSet,
    enableIncremental = true,
  ) {
    const fields = new Map();
    const patches = [];
    this.collectFieldsImpl(
      fragments,
      variableValues,
      runtimeType,
      selectionSet,
      fields,
      patches,
      new Set(),
      enableIncremental,
    );
    return {
      fields,
      patches,
    };
  }
  /**
   * Given an array of field nodes, collects all of the subfields of the passed
   * in fields, and returns them at the end.
   *
   * CollectSubFields requires the "return type" of an object. For a field that
   * returns an Interface or Union type, the "return type" will be the actual
   * object type returned by that field.
   *
   * @internal
   */

  _collectSubfields(exeContext, returnType, fieldNodes) {
    const subFieldNodes = new Map();
    const visitedFragmentNames = new Set();
    const subPatches = [];
    const subFieldsAndPatches = {
      fields: subFieldNodes,
      patches: subPatches,
    };
    const { fragments, variableValues, enableIncremental } = exeContext;

    for (const node of fieldNodes) {
      if (node.selectionSet) {
        this.collectFieldsImpl(
          fragments,
          variableValues,
          returnType,
          node.selectionSet,
          subFieldNodes,
          subPatches,
          visitedFragmentNames,
          enableIncremental,
        );
      }
    }

    return subFieldsAndPatches;
  }

  collectFieldsImpl(
    fragments,
    variableValues,
    runtimeType,
    selectionSet,
    fields,
    patches,
    visitedFragmentNames,
    enableIncremental,
  ) {
    for (const selection of selectionSet.selections) {
      switch (selection.kind) {
        case Kind.FIELD: {
          if (!this.shouldIncludeNode(variableValues, selection)) {
            continue;
          }

          const name = this.getFieldEntryKey(selection);
          const fieldList = fields.get(name);

          if (fieldList !== undefined) {
            fields.set(name, this.updateFieldList(fieldList, selection));
          } else {
            fields.set(name, this.createFieldList(selection));
          }

          break;
        }

        case Kind.INLINE_FRAGMENT: {
          if (
            !this.shouldIncludeNode(variableValues, selection) ||
            !this.doesFragmentConditionMatch(selection, runtimeType)
          ) {
            continue;
          }

          const defer = this.getDeferValues(
            variableValues,
            selection,
            enableIncremental,
          );

          if (defer) {
            const patchFields = new Map();
            this.collectFieldsImpl(
              fragments,
              variableValues,
              runtimeType,
              selection.selectionSet,
              patchFields,
              patches,
              visitedFragmentNames,
              enableIncremental,
            );
            patches.push({
              label: defer.label,
              fields: patchFields,
            });
          } else {
            this.collectFieldsImpl(
              fragments,
              variableValues,
              runtimeType,
              selection.selectionSet,
              fields,
              patches,
              visitedFragmentNames,
              enableIncremental,
            );
          }

          break;
        }

        case Kind.FRAGMENT_SPREAD: {
          const fragName = selection.name.value;

          if (!this.shouldIncludeNode(variableValues, selection)) {
            continue;
          }

          const defer = this.getDeferValues(
            variableValues,
            selection,
            enableIncremental,
          );

          if (visitedFragmentNames.has(fragName) && !defer) {
            continue;
          }

          const fragment = fragments[fragName];

          if (
            !fragment ||
            !this.doesFragmentConditionMatch(fragment, runtimeType)
          ) {
            continue;
          }

          visitedFragmentNames.add(fragName);

          if (defer) {
            const patchFields = new Map();
            this.collectFieldsImpl(
              fragments,
              variableValues,
              runtimeType,
              fragment.selectionSet,
              patchFields,
              patches,
              visitedFragmentNames,
              enableIncremental,
            );
            patches.push({
              label: defer.label,
              fields: patchFields,
            });
          } else {
            this.collectFieldsImpl(
              fragments,
              variableValues,
              runtimeType,
              fragment.selectionSet,
              fields,
              patches,
              visitedFragmentNames,
              enableIncremental,
            );
          }

          break;
        }
      }
    }
  }
  /**
   * Returns an object containing the `@defer` arguments if a field should be
   * deferred based on the experimental flag, defer directive present and
   * not disabled by the "if" argument.
   */

  getDeferValues(variableValues, node, enableIncremental) {
    if (!enableIncremental) {
      return;
    }

    const defer = getDirectiveValues(
      this._executorSchema,
      GraphQLDeferDirective,
      node,
      variableValues,
    );

    if (!defer) {
      return;
    }

    if (defer.if === false) {
      return;
    }

    return {
      label: typeof defer.label === 'string' ? defer.label : undefined,
    };
  }
  /**
   * Determines if a field should be included based on the `@include` and `@skip`
   * directives, where `@skip` has higher precedence than `@include`.
   */

  shouldIncludeNode(variableValues, node) {
    const skip = getDirectiveValues(
      this._executorSchema,
      GraphQLSkipDirective,
      node,
      variableValues,
    );

    if ((skip === null || skip === void 0 ? void 0 : skip.if) === true) {
      return false;
    }

    const include = getDirectiveValues(
      this._executorSchema,
      GraphQLIncludeDirective,
      node,
      variableValues,
    );

    if (
      (include === null || include === void 0 ? void 0 : include.if) === false
    ) {
      return false;
    }

    return true;
  }
  /**
   * Determines if a fragment is applicable to the given type.
   */

  doesFragmentConditionMatch(fragment, type) {
    const typeConditionNode = fragment.typeCondition;

    if (!typeConditionNode) {
      return true;
    }

    const conditionalType = this._executorSchema.getType(typeConditionNode);

    if (conditionalType === type) {
      return true;
    }

    if (
      conditionalType &&
      this._executorSchema.isAbstractType(conditionalType)
    ) {
      return this._executorSchema.isSubType(conditionalType, type);
    }

    return false;
  }
  /**
   * Implements the logic to compute the key of a given field's entry
   */

  getFieldEntryKey(node) {
    return node.alias ? node.alias.value : node.name.value;
  }
}
/**
 * If a resolve function is not given, then a default resolve behavior is used
 * which takes the property of the source object of the same name as the field
 * and returns it as the result, or if it's a function, returns the result
 * of calling that function while passing along args and context value.
 */

export const defaultFieldResolver = function (
  source,
  args,
  contextValue,
  info,
) {
  // ensure source is a value for which property access is acceptable.
  if (isObjectLike(source) || typeof source === 'function') {
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

export const defaultTypeResolver = function (
  value,
  contextValue,
  info,
  abstractType,
) {
  // First, look for `__typename`.
  if (isObjectLike(value) && typeof value.__typename === 'string') {
    return value.__typename;
  } // Otherwise, test each possible type.

  const possibleTypes = info.executorSchema.getPossibleTypes(abstractType);
  const promisedIsTypeOfResults = [];

  for (let i = 0; i < possibleTypes.length; i++) {
    const type = possibleTypes[i];

    if (type.isTypeOf) {
      const isTypeOfResult = type.isTypeOf(value, contextValue, info);

      if (isPromise(isTypeOfResult)) {
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
