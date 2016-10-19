import _Children from "./Children"
import _Props from "./Props"


export default (ctx) => {
  const {mount, unmount, replace, domApi, events} = ctx

  const Children = _Children(ctx)
  const Props = _Props(ctx)

  class Element {
    constructor(id, tag, props, ch) {
      this.id = id
      this.tag = tag
      this.props = new Props(this, props)
      this.ch = new Children(this, ch)
      this.ref = 0
      this.p = this.dom = null
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
      const dom = this.dom = domApi.createElement(this.tag, this.id)
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
      domApi.remove(parentDOM, this.dom)
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

    on(selector, type, capture) {
      return events.toObs(this.id, selector, type, capture)
    }
  }

  Element.prototype.static = false
  Element.prototype.__isNode = true
  return Element
}
