/* eslint semi: 0, quotes: 0 */

module.exports = function(tag, data, children, text, elm) {
  var key = data === undefined ? undefined : data.key;
  return {tag: tag, data: data, children: children,
    text: text, elm: elm, key: key};
};
