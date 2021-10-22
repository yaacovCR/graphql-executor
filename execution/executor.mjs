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
  GraphQLError,
  Kind,
  SchemaMetaFieldDef,
  TypeMetaFieldDef,
  TypeNameMetaFieldDef,
  assertValidSchema,
  getOperationRootType,
  isObjectType,
  isAbstractType,
  isLeafType,
  isListType,
  isNonNullType,
  locatedError,
} from 'graphql';
import { inspect } from '../jsutils/inspect.mjs';
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
import { getVariableValues, getArgumentValues } from './values.mjs';
import {
  collectFields,
  collectSubfields as _collectSubfields,
} from './collectFields.mjs';
import { mapAsyncIterator } from './mapAsyncIterator.mjs';
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
 *
 * Namely, schema of the type system that is currently executing,
 * and the fragments defined in the query document
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
  constructor() {
    _defineProperty(
      this,
      'collectSubfields',
      memoize3((exeContext, returnType, fieldNodes) =>
        _collectSubfields(
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

      if (isPromise(result)) {
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
    document || devAssert(false, 'Must provide document.'); // If the schema used for execution is invalid, throw an error.

    assertValidSchema(schema); // Variables, if provided, must be an object.

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
      }
    }

    if (!operation) {
      if (operationName != null) {
        return [
          new GraphQLError(`Unknown operation named "${operationName}".`),
        ];
      }

      return [new GraphQLError('Must provide an operation.')];
    } // istanbul ignore next (See: 'https://github.com/graphql/graphql-js/issues/2203')

    const variableDefinitions =
      (_operation$variableDe = operation.variableDefinitions) !== null &&
      _operation$variableDe !== void 0
        ? _operation$variableDe
        : [];
    const coercedVariableValues = getVariableValues(
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

    const rootType = getOperationRootType(schema, operation);
    /* if (rootType == null) {
      throw new GraphQLError(
        `Schema is not configured to execute ${operation.operation} operation.`,
        operation,
      );
    } */

    const rootFields = collectFields(
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

  executeFields(exeContext, parentType, sourceValue, path, fields) {
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
      const args = getArgumentValues(
        fieldDef,
        fieldNodes[0],
        exeContext.variableValues,
      ); // The resolve function's optional third argument is a context value that
      // is provided to every resolve function within an execution. It is commonly
      // used to represent an authenticated user, or request-specific caches.

      const contextValue = exeContext.contextValue;
      const result = resolveFn(source, args, contextValue, info);
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

      if (isPromise(completed)) {
        // Note: we don't rely on a `catch` method, but we do expect "thenable"
        // to take a second callback for the error case.
        return completed.then(undefined, (rawError) => {
          const error = locatedError(rawError, fieldNodes, pathToArray(path));
          return this.handleFieldError(error, returnType, exeContext);
        });
      }

      return completed;
    } catch (rawError) {
      const error = locatedError(rawError, fieldNodes, pathToArray(path));
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
    if (isNonNullType(returnType)) {
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

    if (isNonNullType(returnType)) {
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

    if (isListType(returnType)) {
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

    if (isLeafType(returnType)) {
      return this.completeLeafValue(returnType, result);
    } // If field type is an abstract type, Interface or Union, determine the
    // runtime Object type and complete for that type.

    if (isAbstractType(returnType)) {
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

    if (isObjectType(returnType)) {
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

  completeListValue(exeContext, returnType, fieldNodes, info, path, result) {
    if (!isIterableObject(result)) {
      throw new GraphQLError(
        `Expected Iterable, but did not find one for field "${info.parentType.name}.${info.fieldName}".`,
      );
    } // This is specified as a simple map, however we're optimizing the path
    // where the list contains no Promises by avoiding creating another Promise.

    const itemType = returnType.ofType;
    const promises = [];
    const completedResults = Array.from(result, (item, index) => {
      // No need to modify the info object containing the path,
      // since from here on it is not ever accessed by resolver functions.
      const itemPath = addPath(path, index, undefined);

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

        if (!isPromise(completedItem)) {
          return completedItem;
        } // Note: we don't rely on a `catch` method, but we do expect "thenable"
        // to take a second callback for the error case.

        const promise = completedItem
          .then(undefined, (rawError) => {
            const error = locatedError(
              rawError,
              fieldNodes,
              pathToArray(itemPath),
            );
            return this.handleFieldError(error, itemType, exeContext);
          })
          .then((resolved) => {
            completedResults[index] = resolved;
          });
        promises.push(promise);
        return undefined;
      } catch (rawError) {
        const error = locatedError(rawError, fieldNodes, pathToArray(itemPath));
        return this.handleFieldError(error, itemType, exeContext);
      }
    });

    if (!promises.length) {
      return completedResults;
    }

    return resolveAfterAll(completedResults, promises);
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
      throw new GraphQLError(
        `Abstract type "${returnType.name}" must resolve to an Object type at runtime for field "${info.parentType.name}.${info.fieldName}". Either the "${returnType.name}" type should provide a "resolveType" function or each possible type should provide an "isTypeOf" function.`,
        fieldNodes,
      );
    } // releases before 16.0.0 supported returning `GraphQLObjectType` from `resolveType`
    // TODO: remove in 17.0.0 release

    if (isObjectType(runtimeTypeName)) {
      throw new GraphQLError(
        'Support for returning GraphQLObjectType from resolveType was removed in graphql-js@16.0.0 please return type name instead.',
      );
    }

    if (typeof runtimeTypeName !== 'string') {
      throw new GraphQLError(
        `Abstract type "${returnType.name}" must resolve to an Object type at runtime for field "${info.parentType.name}.${info.fieldName}" with ` +
          `value ${inspect(result)}, received "${inspect(runtimeTypeName)}".`,
      );
    }

    const runtimeType = exeContext.schema.getType(runtimeTypeName);

    if (runtimeType == null) {
      throw new GraphQLError(
        `Abstract type "${returnType.name}" was resolved to a type "${runtimeTypeName}" that does not exist inside the schema.`,
        fieldNodes,
      );
    }

    if (!isObjectType(runtimeType)) {
      throw new GraphQLError(
        `Abstract type "${returnType.name}" was resolved to a non-object type "${runtimeTypeName}".`,
        fieldNodes,
      );
    }

    if (!exeContext.schema.isSubType(returnType, runtimeType)) {
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

      if (isPromise(isTypeOf)) {
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
    return new GraphQLError(
      `Expected value of type "${returnType.name}" but got: ${inspect(
        result,
      )}.`,
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
      fieldName === SchemaMetaFieldDef.name &&
      schema.getQueryType() === parentType
    ) {
      return SchemaMetaFieldDef;
    } else if (
      fieldName === TypeMetaFieldDef.name &&
      schema.getQueryType() === parentType
    ) {
      return TypeMetaFieldDef;
    } else if (fieldName === TypeNameMetaFieldDef.name) {
      return TypeNameMetaFieldDef;
    }

    return parentType.getFields()[fieldName];
  }

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
      return this.executeQueryOrMutationImpl(perPayloadExecutionContext);
    }; // Map every source value to a ExecutionResult value as described above.

    return mapAsyncIterator(resultOrStream, mapSourceToResponse);
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
      if (error instanceof GraphQLError) {
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
      throw new GraphQLError(
        'Schema is not configured to execute subscription operation.',
        operation,
      );
    }

    const rootFields = collectFields(
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
      var _fieldDef$subscribe;

      // Implements the "ResolveFieldEventStream" algorithm from GraphQL specification.
      // It differs from "ResolveFieldValue" due to providing a different `resolveFn`.
      // Build a JS object of arguments from the field.arguments AST, using the
      // variables scope to fulfill any variable references.
      const args = getArgumentValues(fieldDef, fieldNodes[0], variableValues); // The resolve function's optional third argument is a context value that
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
      throw locatedError(error, fieldNodes, pathToArray(path));
    }
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

  const possibleTypes = info.schema.getPossibleTypes(abstractType);
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
