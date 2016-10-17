import {NodeTypes} from "../consts"
import Text from "./Text"
import Element from "./Elem"
import StaticElement from "./StaticElem"
import Lifted from "./Lifted"

const {ELEM, TEXT, STATIC_ELEM, LIFTED} = NodeTypes


// TODO: implement non-ES6 compatible version with objects
const cache = new Map()

window._cache = cache


export function create(vnode, parent) {
  if (cache.has(vnode.id)) {
    return cache.get(vnode.id)
  }
  switch (vnode.t) {
    case ELEM:
      return new Element(vnode, parent)
    case STATIC_ELEM:
      return new StaticElement(vnode, parent)
    case TEXT:
      return new Text(vnode, parent)
    case LIFTED:
      return new Lifted(vnode, parent)
    default:
      return null
  }
}

export function mount(node) {
  cache.set(node.id, node)
}

export function unmount(node) {
  cache.delete(node.id)
}

export function replace(prev, next) {
  cache.delete(prev.id)
  cache.set(next.id, next)
}


