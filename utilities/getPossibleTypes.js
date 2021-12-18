'use strict';

Object.defineProperty(exports, '__esModule', {
  value: true,
});
exports.getPossibleTypes = void 0;

var _definition = require('../type/definition.js');

var _memoize = require('../jsutils/memoize2.js');

var _getImplementations = require('./getImplementations.js');

function _getPossibleTypes(schema, abstractType) {
  return (0, _definition.isUnionType)(abstractType)
    ? abstractType.getTypes()
    : (0, _getImplementations.getImplementations)(schema, abstractType).objects;
}

const getPossibleTypes = (0, _memoize.memoize2)(_getPossibleTypes);
exports.getPossibleTypes = getPossibleTypes;
