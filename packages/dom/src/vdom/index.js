import {NodeTypes} from "../consts"
import Text from "./Text"
import Element from "./Elem"

const {ELEM, TEXT} = NodeTypes


export function create(vnode, parent) {
  switch (vnode.t) {
    case ELEM:
      return new Element(vnode, parent)
    case TEXT:
      return new Text(vnode, parent)
    default:
      return null
  }
}
