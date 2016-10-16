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

  start() {
    this.p.onChildReady(this)
  }

  stop(parentDOM) {
    if (parentDOM) {
      remove(parentDOM, this.dom)
      this.dom = null
    }
  }

  isReady() {
    return true
  }

  create() {
    return (this.dom = document.createTextNode(this.t))
  }

  update({t, dom}) {
    this.dom = dom
    if (this.t !== t) {
      dom.nodeValue = this.t
    }
  }
}
