import Children from "./Children"
import Props from "./Props"
import {create, mount, unmount, replace} from "./index"
import {remove} from "../dom"


export default class Element {
  constructor({id, tag, props, ch}, parent) {
    this.id = id
    this.tag = tag
    this.p = parent
    this.props = new Props(this, props)
    this.ch = new Children(this, ch)
    this.dom = null
    this.ref = 0
  }

  accepts(node) {
    return node instanceof Element && this.tag === node.tag
  }

  start() {
    if (this.ref++ === 0) {
      this.props.start()
      this.ch.start()
    } else if (this.isReady()) {
      this.p.onChildReady(this)
    }
  }

  stop() {
    if (--this.ref === 0) {
      this.ch.stop()
      this.props.stop()
    }
  }

  create() {
    const dom = this.dom = document.createElement(this.tag)
    this.props.create(dom)
    this.ch.create(dom)
    mount(this)
    return dom
  }

  update(prev) {
    replace(prev, this)
    const {props, ch, dom} = prev
    this.dom = dom
    this.props.update(props, dom)
    this.ch.update(ch, dom)
  }

  remove(parentDOM) {
    remove(parentDOM, this.dom)
    this.dom = null
    this.ch.remove()
    unmount(this)
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
