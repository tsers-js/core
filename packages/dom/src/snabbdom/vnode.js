/* eslint semi: 0, quotes: 0 */

module.exports = function(tag, data, children, text, key, id) {
  return {
    id: id || {},
    tag,
    key,
    children,
    text
  }
};
