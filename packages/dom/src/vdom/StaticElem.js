import {mount, unmount, replace} from "./index"
import {createNodes, removeNodes} from "./Children"
import {patchProps, patchChildren} from "../patching"
import {createElement, append, remove} from "../dom"


export default class StaticElement {
  constructor({id, tag, props, ch}, parent) {
    this.id = id
    this.tag = tag
    this.p = parent
    this.props = props
    this.ch = {v: createNodes(ch.v, this)}
    this.dom = null
  }

  accepts(node) {
    return node && this.tag === node.tag
  }

  isReady() {
    return true
  }

  start() {
    this.p.onChildReady(this)
  }

  stop() {
  }

  create() {
    const dom = this.dom = createElement(this.tag, this.id)
    patchProps({}, this.props.v, dom)
    mountNodes(this.ch.v, dom)
    mount(this)
    return dom
  }

  update(prev) {
    replace(prev, this)
    const {props, ch, dom} = prev
    this.dom = dom
    patchProps(props.v, this.props.v, dom)
    patchChildren(ch.v, this.ch.v, dom)
  }

  remove(parentDOM) {
    remove(parentDOM, this.dom)
    this.dom = null
    removeNodes(this.ch.v)
    unmount(this)
  }
}


function mountNodes(nodes, dom) {
  for (let i = 0, n = nodes.length; i < n; ++i) {
    append(dom, nodes[i].create())
  }
}
