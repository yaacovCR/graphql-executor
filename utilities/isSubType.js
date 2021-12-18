'use strict';

Object.defineProperty(exports, '__esModule', {
  value: true,
});
exports.isSubType = void 0;

var _definition = require('../type/definition.js');

var _memoize = require('../jsutils/memoize1.js');

var _memoize2 = require('../jsutils/memoize3.js');

var _getImplementations = require('./getImplementations.js');

function _getSubTypeMap(_schema) {
  return Object.create(null);
}

const getSubTypeMap = (0, _memoize.memoize1)(_getSubTypeMap);

function _isSubType(schema, abstractType, maybeSubType) {
  const subTypeMap = getSubTypeMap(schema);
  let map = subTypeMap[abstractType.name];

  if (map === undefined) {
    map = Object.create(null);

    if ((0, _definition.isUnionType)(abstractType)) {
      for (const type of abstractType.getTypes()) {
        map[type.name] = true;
      }
    } else {
      const implementations = (0, _getImplementations.getImplementations)(
        schema,
        abstractType,
      );

      for (const type of implementations.objects) {
        map[type.name] = true;
      }

      for (const type of implementations.interfaces) {
        map[type.name] = true;
      }
    }

    subTypeMap[abstractType.name] = map;
  }

  return map[maybeSubType.name] !== undefined;
}

const isSubType = (0, _memoize2.memoize3)(_isSubType);
exports.isSubType = isSubType;
