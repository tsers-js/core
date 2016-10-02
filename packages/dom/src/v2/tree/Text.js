import {unmount} from "./helpers"

export default class Text {
  constructor({id, text}, parent) {
    this.id = id
    this.t = text
    this.dom = null
    this.p = parent
  }

  start() {
    this.p.ready(this)
  }

  mount() {
    return (this.dom = document.createTextNode(this.t))
  }

  accepts(vnode) {
    return vnode.t === "t"
  }

  update(vnode) {
    this.id = vnode.id
    if (this.t !== vnode.t) {
      this.dom.nodeValue = this.t = vnode.text
    }
  }

  stop() {
    unmount(this)
    this.p = null
  }
}
