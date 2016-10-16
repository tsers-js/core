import {mount, unmount, replace} from "./index"
import {remove} from "../dom"


export default class Text {
  constructor({id, text}, parent) {
    this.id = id
    this.t = text
    this.p = parent
    this.dom = null
  }

  accepts(node) {
    return node instanceof Text
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
    mount(this)
    return (this.dom = document.createTextNode(this.t))
  }

  update(prev) {
    replace(prev, this)
    const {t, dom} = prev
    this.dom = dom
    if (this.t !== t) {
      dom.nodeValue = this.t
    }
  }

  remove(parentDOM) {
    unmount(this)
    remove(parentDOM, this.dom)
    this.dom = null
  }
}
