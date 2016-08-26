/* eslint semi: 0, quotes: 0 */
import {isArray} from "@tsers/core"

module.exports = {
  array: isArray,
  primitive: function (s) {
    return typeof s === 'string' || typeof s === 'number';
  }
};
