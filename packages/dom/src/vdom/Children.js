import {startMods, stopMods} from "../util"


export default ({link, domApi, patch: {patchChildAt, patchChildren}}) => {
  class Children {
    constructor(elem, ch) {
      this.el = elem
      this.c = ch.v ? new Combine(this, ch) : new FlatCombine(this, ch)
      this.v = null
    }

    isReady() {
      return this.v !== null
    }

    start() {
      this.c.start()
    }

    stop() {
      this.c.stop()
    }

    create(parentDOM) {
      let {v: nodes} = this, n = nodes.length, i = 0
      const fragment = domApi.createFragment()
      while (i < n) {
        fragment.appendChild(nodes[i++].create())
      }
      domApi.appendFragment(parentDOM, fragment)
    }

    update({v: prev}, parentDOM) {
      const next = this.v
      patchChildren(prev, next, parentDOM)
    }

    remove() {
      removeNodes(this.v)
    }

    onChildren(children, idx) {
      const {v: previous} = this
      this.v = children
      if (!previous) {
        this.el.onChildrenReady()
      } else if (this.el.dom) {
        idx === -1 ? this.updAll(previous) : this.updAt(idx, previous[idx])
      }
    }

    updAt(idx, prev) {
      patchChildAt(idx, prev, this.v[idx], this.el.dom)
    }

    updAll(prev) {
      const next = this.v
      patchChildren(prev, next, this.el.dom)
    }
  }


  class Combine {
    constructor(ch, {v: list, m: mods}) {
      this.ch = ch
      this.n = list.length
      this.v = linkNodes(list, this)
      this.m = mods
      this.d = void 0
    }

    start() {
      if (this.n) {
        startNodes(this.v)
        this.d = startMods(this.m, this)
      } else {
        this.ch.onChildren(this.v)
      }
    }

    stop() {
      this.d = stopMods(this.d)
      stopNodes(this.v)
    }

    onMod({ch, i}) {
      const prev = this.v[i], next = link(ch, this)
      if (next === prev) {
        return
      } else if (prev) {
        prev.isReady() && this.n++
        prev.stop()
      }
      this.v[i] = next
      next.start()
    }

    onChildReady(node) {
      const left = --this.n
      left === 0 && this.ch.onChildren(this.v.slice(), this.v.indexOf(node))
    }
  }


  class FlatCombine {
    constructor(ch, {m: mods}) {
      this.ch = ch
      this.act = null
      this.pend = null
      this.m = mods
      this.d = void 0
    }

    start() {
      this.d = startMods(this.m, this)
    }

    stop() {
      const {act, pend} = this
      act && act.stop()
      pend && pend !== act && pend.stop()
    }

    onMod(children) {
      const {act, pend} = this
      this.pend = new Inner(this, children)
      this.pend.start()
      act && act.stop()
      pend && pend !== act && pend.stop()
    }

    onInnerReady(children) {
      this.act = this.pend
      this.ch.onChildren(children, -1)
    }
  }


  class Inner {
    constructor(outer, list) {
      this.o = outer
      this.v = linkNodes(list, this)
      this.n = list.length
      this.s = false
    }

    start() {
      this.n ? startNodes(this.v) : this.o.onInnerReady(this.v)
    }

    stop() {
      !this.s && (this.s = true) && stopNodes(this.v)
    }

    onChildReady() {
      const left = --this.n
      left === 0 && this.o.onInnerReady(this.v)
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

  function startNodes(nodes) {
    let i = nodes.length, node
    while (i--) {
      (node = nodes[i]) && node.start()
    }
  }

  function stopNodes(nodes) {
    let i = nodes.length, node
    while (i--) {
      (node = nodes[i]) && node.stop()
    }
  }

  return Children
}


