'use strict';

Object.defineProperty(exports, '__esModule', {
  value: true,
});
exports.getImplementations = void 0;

var _memoize = require('../jsutils/memoize1.js');

var _memoize2 = require('../jsutils/memoize2.js');

var _definition = require('../type/definition.js');

function _getImplementationsMap(schema) {
  const implementationsMap = Object.create(null);

  for (const namedType of Object.values(schema.getTypeMap())) {
    // Backwards compatibility with v14
    if (
      typeof namedType === 'object' &&
      namedType &&
      (0, _definition.isInterfaceType)(namedType) &&
      'getInterfaces' in namedType
    ) {
      // Store implementations by interface.
      for (const iface of namedType.getInterfaces()) {
        if ((0, _definition.isInterfaceType)(iface)) {
          let implementations = implementationsMap[iface.name]; // TODO: add test

          /* c8 ignore next 6 */

          if (implementations === undefined) {
            implementations = implementationsMap[iface.name] = {
              objects: [],
              interfaces: [],
            };
          }

          implementations.interfaces.push(namedType);
        }
      }
    } else if (
      typeof namedType === 'object' &&
      namedType &&
      (0, _definition.isObjectType)(namedType)
    ) {
      // Store implementations by objects.
      for (const iface of namedType.getInterfaces()) {
        if ((0, _definition.isInterfaceType)(iface)) {
          let implementations = implementationsMap[iface.name];

          if (implementations === undefined) {
            implementations = implementationsMap[iface.name] = {
              objects: [],
              interfaces: [],
            };
          }

          implementations.objects.push(namedType);
        }
      }
    }
  }

  return implementationsMap;
}

const getImplementationsMap = (0, _memoize.memoize1)(_getImplementationsMap);

function _getImplementations(schema, interfaceType) {
  const implementationsMap = getImplementationsMap(schema);
  return implementationsMap[interfaceType.name];
}

const getImplementations = (0, _memoize2.memoize2)(_getImplementations);
exports.getImplementations = getImplementations;
