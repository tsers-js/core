export default ({link, mount, unmount, replace, domApi, patch: {patchProps, patchChildren}, events}) => {
  class StaticElement {
    constructor(id, tag, props, ch) {
      this.id = id
      this.tag = tag
      this.props = props
      this.ch = {v: linkNodes(ch.v, this)}
      this.p = this.dom = null
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
      const dom = this.dom = domApi.createElement(this.tag, this.id)
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
      domApi.remove(parentDOM, this.dom)
      this.dom = null
      removeNodes(this.ch.v)
      unmount(this)
    }

    on(selector, type, capture) {
      return events.toObs(this.id, selector, type, capture)
    }
  }

  function linkNodes(vnodes, parent) {
    let n = vnodes.length, vnode
    while (n--) {
      (vnode = vnodes[n]) && link(vnode, parent)
    }
    return vnodes
  }

  function removeNodes(nodes) {
    let i = nodes.length, node
    while (i--) {
      (node = nodes[i]) && node.remove()
    }
  }

  function mountNodes(nodes, dom) {
    const fragment = domApi.createFragment()
    for (let i = 0, n = nodes.length; i < n; ++i) {
      fragment.appendChild(nodes[i].create())
    }
    domApi.appendFragment(dom, fragment)
  }

  StaticElement.prototype.static = true
  StaticElement.prototype.__isNode = true
  return StaticElement
}

