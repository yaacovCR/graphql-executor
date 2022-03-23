import {
  GraphQLList,
  GraphQLNonNull,
  Kind,
  TypeNameMetaFieldDef,
} from 'graphql';
import { inspect } from '../jsutils/inspect.mjs';
import { invariant } from '../jsutils/invariant.mjs';
import { memoize1 } from '../jsutils/memoize1.mjs';
import {
  SchemaMetaFieldDef,
  TypeMetaFieldDef,
  introspectionTypes,
} from '../type/introspection.mjs';

function is(x, type) {
  if (Object.prototype.toString.call(x) === `[object ${type}]`) {
    return true;
  }

  const prototype = Object.getPrototypeOf(x);

  if (prototype == null) {
    return false;
  }

  return is(prototype, type);
}

function _isScalarType(type) {
  return is(type, 'GraphQLScalarType');
}

function _isObjectType(type) {
  return is(type, 'GraphQLObjectType');
}

function _isInterfaceType(type) {
  return is(type, 'GraphQLInterfaceType');
}

function _isUnionType(type) {
  return is(type, 'GraphQLUnionType');
}

function _isEnumType(type) {
  return is(type, 'GraphQLEnumType');
}

function _isInputObjectType(type) {
  return is(type, 'GraphQLInputObjectType');
} // type predicate uses GraphQLList<any> for compatibility with graphql-js v15 and earlier

function _isListType(type) {
  return Object.prototype.toString.call(type) === '[object GraphQLList]';
}

function _isNonNullType(type) {
  return Object.prototype.toString.call(type) === '[object GraphQLNonNull]';
}

class TypeTree {
  constructor() {
    this._rootNode = {
      [Kind.NAMED_TYPE]: new Map(),
    };
    this.typeStrings = new Set();
  }

  add(type) {
    this._add(type, this._rootNode);

    this.typeStrings.add(type.toString());
  }

  get(typeNode) {
    return this._get(typeNode, this._rootNode);
  }

  has(typeString) {
    return this.typeStrings.has(typeString);
  }

  _get(typeNode, node) {
    switch (typeNode.kind) {
      case Kind.LIST_TYPE: {
        const listNode = node[Kind.LIST_TYPE]; // this never happens because the ExecutorSchema adds all possible types

        /* c8 ignore next 3 */

        if (!listNode) {
          return;
        }

        return this._get(typeNode.type, listNode);
      }

      case Kind.NON_NULL_TYPE: {
        const nonNullNode = node[Kind.NON_NULL_TYPE]; // this never happens because the ExecutorSchema adds all possible types

        /* c8 ignore next 3 */

        if (!nonNullNode) {
          return;
        }

        return this._get(typeNode.type, nonNullNode);
      }

      case Kind.NAMED_TYPE:
        return node[Kind.NAMED_TYPE].get(typeNode.name.value);
    }
  }

  _add(originalType, node, type = originalType) {
    if (_isListType(type)) {
      let listTypeNode = node[Kind.LIST_TYPE];

      if (!listTypeNode) {
        listTypeNode = node[Kind.LIST_TYPE] = {
          [Kind.NAMED_TYPE]: new Map(),
        };
      }

      this._add(originalType, listTypeNode, type.ofType);
    } else if (_isNonNullType(type)) {
      let nonNullTypeNode = node[Kind.NON_NULL_TYPE];

      if (!nonNullTypeNode) {
        nonNullTypeNode = node[Kind.NON_NULL_TYPE] = {
          [Kind.NAMED_TYPE]: new Map(),
        };
      }

      this._add(originalType, nonNullTypeNode, type.ofType);
    } else {
      node[Kind.NAMED_TYPE].set(type.name, originalType);
    }
  }
}

function getInputTypeInfo(type, wrapper) {
  if (!_isNonNullType(type) && !_isListType(type)) {
    return {
      nonNullListWrappers: [],
      nonNull: _isNonNullType(wrapper),
      namedType: type,
    };
  }

  const inputTypeInfo = getInputTypeInfo(type.ofType, type);

  if (_isNonNullType(type)) {
    return inputTypeInfo;
  }

  inputTypeInfo.nonNullListWrappers.push(_isNonNullType(wrapper));
  return inputTypeInfo;
}

function getPossibleSequences(nonNullListWrappers) {
  if (!nonNullListWrappers.length) {
    return [[]];
  }

  const nonNull = nonNullListWrappers.pop();

  if (nonNull) {
    return getPossibleSequences(nonNullListWrappers).map((sequence) => [
      true,
      ...sequence,
    ]);
  }

  return [
    ...getPossibleSequences(nonNullListWrappers).map((sequence) => [
      true,
      ...sequence,
    ]),
    ...getPossibleSequences(nonNullListWrappers).map((sequence) => [
      false,
      ...sequence,
    ]),
  ];
}

function inputTypesFromSequences(sequences, inputType) {
  return sequences.map((sequence) =>
    sequence.reduce((acc, nonNull) => {
      let wrapped = new GraphQLList(acc);

      if (nonNull) {
        wrapped = new GraphQLNonNull(wrapped);
      }

      return wrapped;
    }, inputType),
  );
}

function getPossibleInputTypes(type) {
  const { nonNullListWrappers, nonNull, namedType } = getInputTypeInfo(type);
  const sequences = getPossibleSequences(nonNullListWrappers);
  const wrapped = new GraphQLNonNull(namedType);

  if (nonNull) {
    return inputTypesFromSequences(sequences, wrapped);
  }

  return [
    ...inputTypesFromSequences(sequences, namedType),
    ...inputTypesFromSequences(sequences, wrapped),
  ];
}

function _toExecutorSchema(schema) {
  const listTypes = new Set();
  const nonNullTypes = new Set();
  const namedTypes = new Map();
  const inputTypes = new Set();
  const leafTypes = new Set();
  const scalarTypes = new Set();
  const enumTypes = new Set();
  const abstractTypes = new Set();
  const interfaceTypes = new Set();
  const unionTypes = new Set();
  const objectTypes = new Set();
  const inputObjectTypes = new Set();
  const typeTree = new TypeTree();
  const subTypesMap = new Map();
  const possibleTypesMap = new Map();

  function addOutputType(type) {
    typeTree.add(type);
  }

  function addInputType(type) {
    inputTypes.add(type);
    typeTree.add(type);
  }

  function processType(type) {
    if (_isListType(type) && !listTypes.has(type)) {
      listTypes.add(type);
      processType(type.ofType);
    } else if (_isNonNullType(type) && !nonNullTypes.has(type)) {
      nonNullTypes.add(type);
      processType(type.ofType);
    } else if (_isScalarType(type) && !namedTypes.get(type.name)) {
      namedTypes.set(type.name, type);
      leafTypes.add(type);
      scalarTypes.add(type);
    } else if (_isObjectType(type) && !namedTypes.get(type.name)) {
      namedTypes.set(type.name, type);
      objectTypes.add(type);
      addOutputType(type);

      for (const iface of Object.values(type.getInterfaces())) {
        processType(iface);
        let subTypes = subTypesMap.get(iface);

        if (!subTypes) {
          subTypes = new Set();
          subTypesMap.set(iface, subTypes);
        }

        subTypes.add(type);
        let possibleTypes = possibleTypesMap.get(iface);

        if (!possibleTypes) {
          possibleTypes = [];
          possibleTypesMap.set(iface, possibleTypes);
        }

        possibleTypes.push(type);
      }

      for (const field of Object.values(type.getFields())) {
        processType(field.type);

        for (const arg of field.args) {
          addInputType(arg.type);
          processType(arg.type);
        }
      }
    } else if (_isInterfaceType(type) && !namedTypes.get(type.name)) {
      namedTypes.set(type.name, type);
      abstractTypes.add(type);
      interfaceTypes.add(type);
      addOutputType(type); // NOTE: pre-v15 compatibility

      if ('getInterfaces' in type) {
        for (const iface of Object.values(type.getInterfaces())) {
          processType(iface);
          let subTypes = subTypesMap.get(iface);

          if (!subTypes) {
            subTypes = new Set();
            subTypesMap.set(iface, subTypes);
          }

          subTypes.add(type);
        }
      }

      for (const field of Object.values(type.getFields())) {
        processType(field.type); // TODO: add test

        /* c8 ignore next 4 */

        for (const arg of field.args) {
          addInputType(arg.type);
          processType(arg.type);
        }
      }
    } else if (_isUnionType(type) && !namedTypes.get(type.name)) {
      namedTypes.set(type.name, type);
      abstractTypes.add(type);
      unionTypes.add(type);
      addOutputType(type);
      let subTypes = subTypesMap.get(type);

      if (!subTypes) {
        subTypes = new Set();
        subTypesMap.set(type, subTypes);
      }

      let possibleTypes = possibleTypesMap.get(type);

      if (!possibleTypes) {
        possibleTypes = [];
        possibleTypesMap.set(type, possibleTypes);
      }

      for (const possibleType of type.getTypes()) {
        processType(possibleType);
        subTypes.add(possibleType);
        possibleTypes.push(possibleType);
      }
    } else if (_isEnumType(type) && !namedTypes.get(type.name)) {
      namedTypes.set(type.name, type);
      leafTypes.add(type);
      enumTypes.add(type);
    } else if (_isInputObjectType(type) && !namedTypes.get(type.name)) {
      namedTypes.set(type.name, type);
      inputObjectTypes.add(type);

      for (const field of Object.values(type.getFields())) {
        addInputType(field.type);
        processType(field.type);
      }
    }
  }

  for (const type of Object.values(schema.getTypeMap())) {
    if (!type.name.startsWith('__')) {
      processType(type);
    }
  }

  for (const directive of schema.getDirectives()) {
    for (const arg of directive.args) {
      addInputType(arg.type);
      processType(arg.type);
    }
  } // add all possible input types to schema
  // as variables can add non-null wrappers to input types defined in schema

  for (const inputType of inputTypes.values()) {
    const possibleInputTypes = getPossibleInputTypes(inputType);

    for (const possibleInputType of possibleInputTypes) {
      const typeString = possibleInputType.toString();

      if (!typeTree.has(typeString)) {
        addInputType(possibleInputType);
        processType(possibleInputType);
      }
    }
  }

  for (const type of introspectionTypes) {
    processType(type);
  }

  for (const fieldDef of [
    SchemaMetaFieldDef,
    TypeMetaFieldDef,
    TypeNameMetaFieldDef,
  ]) {
    processType(fieldDef.type);

    for (const arg of fieldDef.args) {
      addInputType(arg.type);
      processType(arg.type);
    }
  }

  const queryType = schema.getQueryType();
  const mutationType = schema.getMutationType();
  const subscriptionType = schema.getSubscriptionType();

  function isListType(type) {
    return listTypes.has(type);
  }

  function isNonNullType(type) {
    return nonNullTypes.has(type);
  }

  function isNamedType(type) {
    return namedTypes.get(type.name) !== undefined;
  }

  function isInputType(type) {
    return inputTypes.has(type);
  }

  function isLeafType(type) {
    return leafTypes.has(type);
  }

  function isScalarType(type) {
    return scalarTypes.has(type);
  }

  function isEnumType(type) {
    return enumTypes.has(type);
  }

  function isAbstractType(type) {
    return abstractTypes.has(type);
  }

  function isInterfaceType(type) {
    return interfaceTypes.has(type);
  }

  function isUnionType(type) {
    return unionTypes.has(type);
  }

  function isObjectType(type) {
    return objectTypes.has(type);
  }

  function isInputObjectType(type) {
    return inputObjectTypes.has(type);
  }

  function getDirectives() {
    return schema.getDirectives();
  }

  function getDirective(directiveName) {
    var _schema$getDirective;

    // cast necessary pre v15 to convert null to undefined
    return (_schema$getDirective = schema.getDirective(directiveName)) !==
      null && _schema$getDirective !== void 0
      ? _schema$getDirective
      : undefined;
  }

  function getNamedTypes() {
    return Array.from(namedTypes.values());
  }

  function getNamedType(typeName) {
    return namedTypes.get(typeName);
  }

  function getType(typeNode) {
    return typeTree.get(typeNode);
  }

  function getRootType(operation) {
    if (operation === 'query') {
      return queryType !== null && queryType !== void 0 ? queryType : undefined;
    } else if (operation === 'mutation') {
      return mutationType !== null && mutationType !== void 0
        ? mutationType
        : undefined;
    } else if (operation === 'subscription') {
      return subscriptionType !== null && subscriptionType !== void 0
        ? subscriptionType
        : undefined;
    }
    /* c8 ignore next 3 */
    // Not reachable. All possible operation types have been considered.

    false ||
      invariant(false, 'Unexpected operation type: ' + inspect(operation));
  }

  function getPossibleTypes(abstractType) {
    var _possibleTypesMap$get;

    // TODO: add test
    return (_possibleTypesMap$get = possibleTypesMap.get(abstractType)) !==
      /* c8 ignore next */
      null && _possibleTypesMap$get !== void 0
      ? _possibleTypesMap$get
      : [];
  }

  function isSubType(abstractType, maybeSubType) {
    var _subTypesMap$get$has, _subTypesMap$get;

    return (_subTypesMap$get$has =
      (_subTypesMap$get = subTypesMap.get(abstractType)) === null ||
      _subTypesMap$get === void 0
        ? void 0
        : _subTypesMap$get.has(maybeSubType)) !==
      /* c8 ignore start */
      null && _subTypesMap$get$has !== void 0
      ? _subTypesMap$get$has // TODO: add test
      : false;
    /* c8 ignore stop */
  }

  return {
    description: schema.description,
    isListType,
    isNonNullType,
    isNamedType,
    isInputType,
    isLeafType,
    isScalarType,
    isEnumType,
    isAbstractType,
    isInterfaceType,
    isUnionType,
    isObjectType,
    isInputObjectType,
    getDirectives,
    getDirective,
    getNamedTypes,
    getNamedType,
    getType,
    getRootType,
    getPossibleTypes,
    isSubType,
  };
}

export const toExecutorSchema = memoize1(_toExecutorSchema);
