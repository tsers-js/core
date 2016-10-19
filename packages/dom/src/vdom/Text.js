
export default ({mount, unmount, replace, domApi, events}) => {
  class Text {
    constructor(id, text) {
      this.id = id
      this.t = text
      this.p = null
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
      const dom = this.dom = domApi.createText(this.t)
      mount(this)
      return dom
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
      domApi.remove(parentDOM, this.dom)
      this.dom = null
    }

    on() {
      return events.toEmptyObs()
    }
  }

  Text.prototype.static = true
  Text.prototype.__isNode = true
  return Text
}
