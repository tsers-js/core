import {create} from "./index"


export default class Lifted {
  constructor({n: vnode}, parent) {
    this.p = parent
    this.n = create(vnode, this)
  }

  accepts(node) {
    return node instanceof Lifted && this.n.accepts(node.n)
  }

  isReady() {
    return this.n.isReady()
  }

  start() {
    this.n.start()
  }

  stop() {
    this.n.stop()
  }

  create() {
    const dom = this.n.create()
    dom.__scope_end = true
    return dom
  }

  update(prev) {
    this.n.update(prev.n)
  }

  remove(parentDOM) {
    this.n.remove(parentDOM)
  }

  onChildReady() {
    this.p.onChildReady(this)
  }
}

