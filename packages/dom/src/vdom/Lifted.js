export default ({link}) => {
  class Lifted {
    constructor(id, vnode) {
      this.id = id
      this.n = link(vnode, this)
      this.static = this.n.static
      this.p = null
      this.dom = null
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
      const dom = this.dom = this.n.create()
      dom.__scope_end = true
      return dom
    }

    update(prev) {
      this.dom = prev.dom
      this.n.update(prev.n)
    }

    remove(parentDOM) {
      this.dom = null
      this.n.remove(parentDOM)
    }

    onChildReady() {
      this.p.onChildReady(this)
    }
  }

  Lifted.prototype.__isNode = true
  return Lifted
}

