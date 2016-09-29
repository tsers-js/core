/* eslint semi: 0, quotes: 0 */

export default function VNode(tag, data, children, text, key, id) {
  return {
    id: id || {},
    tag,
    data,
    key,
    children,
    text
  }
};

export const isVNode = x => x && x.id && x.tag
