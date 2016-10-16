import Children from "./Children"
import Props from "./Props"
import {create} from "./index"
import {patchProps, patchProp} from "../patching"
import {remove} from "../dom"


export default class Element {
  constructor({id, tag, props, ch}, parent) {
    this.id = id
    this.tag = tag
    this.p = parent
    this.props = new Props(this, props)
    this.ch = new Children(this, ch)
    this.dom = null
  }

  accepts(node) {
    return node instanceof Element && this.tag === node.tag
  }

  start() {
    this.ch.start()
    this.props.start()
  }

  stop(parentDOM) {
    if (parentDOM) {
      remove(parentDOM, this.dom)
      this.dom = null
    }
    this.ch.stop()
    this.props.stop()
  }

  create() {
    const dom = this.dom = document.createElement(this.tag)
    this.props.create(dom)
    this.ch.create(dom)
    return dom
  }

  update({props, ch, dom}) {
    this.dom = dom
    this.props.update(props, dom)
    this.ch.update(ch, dom)
  }

  onChildrenReady() {
    this.props.isReady() && this.p.onChildReady(this)
  }

  onPropsReady() {
    this.ch.isReady() && this.p.onChildReady(this)
  }

  isReady() {
    return this.ch.isReady() && this.props.isReady()
  }
}
