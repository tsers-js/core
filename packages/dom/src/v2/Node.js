import {__, O, extend} from "@tsers/core"
import {once, newId, noop} from "./util"


export function create(vnode) {
  switch (vnode.t) {
    case "n": return new Node(vnode)
    case "d": return new Deferred(vnode)
    case "t": return new Text(vnode)
  }
}


class Node {
  constructor({id, tag, key, props, children, cm: childMods, pm: propMods}) {
    this.id = id
    this.key = key
    this.tag = tag
    this.props = props
    this.ch = children.map(toChild(this))
    this.dom = null

    // dynamic content
    this.cm = childMods
    this.cp = children.length
    this.pm = propMods

    // functions
    this._dcm = void 0      // dispose child mods
    this._dpm = void 0      // dispose prop mods
    this._n = void 0        // fn to signal that this node is ready
  }

  canUpdate(vnode) {
    return vnode.t === "n" && this.tag === vnode.tag && this.key === vnode.props.key
  }

  run(next) {
    const {cm, pm} = this
    this._n = next

    if (cm.length) {
      this._dcm =
        __(O.merge(cm), O.subscribe({
          next: ({ch, idx}) => {
            this._updateChildren(ch, idx)
          }
        }))
    }

    if (pm.length) {
      this._dpm =
        __(O.merge(pm), O.subscribe({
          next: ({key, val}) => {
            this._updateProps(key, val)
          }
        }))
    }

    if (this.cp === 0) {
      this._markReady()
    } else {
      const ch = this.ch
      ch.forEach(startChild)
    }

    // return dispose function that handles teardown logic and
    // cleanup when the node is being destroyed
    return parentDom => {
      const dcm = this._dcm, dpm = this._dpm, children = this.ch, dom = this.dom
      this._dcm = this._dpm = this._n = void 0
      this.dom = null
      this.ch = []
      dcm && dcm()
      dpm && dpm()
      if (parentDom && dom) {
        parentDom.removeChild(dom)
      }
      children && children.forEach(ch => ch.remove())
    }
  }


  _childReady(child) {
    const dom = this.dom, left = --this.cp
    if (dom) {
      child.mount(dom)
    } else if (left === 0) {
      this._markReady()
    }
  }

  _childPending() {
    this.cp++
  }

  _markReady() {
    const next = this._n
    this._n = void 0
    next && next(() => this._mount())
  }

  _mount() {
    const {tag, ch} = this
    const dom = this.dom = document.createElement(tag)
    ch.forEach(child => child.mount(dom))
    // TODO: mount props
    return {dom, update: this._update.bind(this)}
  }

  _update(node) {
    console.log("TODO: node update")
  }

  _updateChildAt(idx, vnode) {
    this.ch[idx].update(vnode, idx)
  }

  _updateAllChildren(vnodes) {
    const {ch} = this

    let i, n = ch.length, oldIdxById = {}, newIdxById = {}, newCh = Array(vnodes.length), toRm = [], rmi = 0
    n = n < vnodes.length ? n : vnodes.length
    // index new and existing nodes by their ids
    for (i = 0; i < n; i++) {
      oldIdxById[ch[i].node.id] = i
      newIdxById[vnodes[i].id] = i
    }
    if (vnodes.length < ch.length) {
      for (n = ch.length; i < n; i++) {
        oldIdxById[ch[i].node.id] = i
      }
    } else if (ch.length < vnodes.length) {
      for (n = vnodes.length; i < n; i++) {
        newIdxById[vnodes[i].id] = i
      }
    }

    // mark old children that are candidates for removal
    for (i = 0, n = ch.length; i < n; i++) {
      const child = ch[i]
      !(child.node.id in newIdxById) && toRm.push(child)
    }

    // patch all existing children and add new ones if needed
    for (i = 0, n = vnodes.length; i < n; i++) {
      const vnode = vnodes[i]
      const {id} = vnode
      if (id in oldIdxById) {
        const idx = oldIdxById[id]
        const child = ch[idx]
        newCh[i] = child
        child.update(vnode, i)
      } else {
        const old = toRm[rmi++]
        if (old) {
          newCh[i] = old
          old.update(vnode, i)
        } else {
          const child = new Child(this, vnode, i)
          newCh[i] = child
          child.run()
        }
      }
    }

    // remove old
    if ((n = toRm.length) > rmi) {
      for (i = 0; i < n; i++) {
        toRm[i].remove()
      }
    }

    this.ch = newCh
  }

  _updateChildren(vnodes, idx) {
    idx >= 0
      ? this._updateChildAt(idx, vnodes)
      : this._updateAllChildren(vnodes)
  }

  _updateProps(key, val) {
    console.log("TODO: update props", key, "=", val, "ID", this.id)
  }
}


class Text {
  constructor({id, text}) {
    this.id = id
    this.t = text
    this.dom = null
  }

  canUpdate(vnode) {
    return vnode.t === "t"
  }

  run(next) {
    next(() => this._mount())
    return parentDom => {
      const {dom} = this
      this.dom = null
      parentDom && dom && parentDom.removeChild(dom)
    }
  }

  _mount() {
    const dom = this.dom = document.createTextNode(this.t)
    return {dom, update: this._update.bind(this)}
  }

  _update(node) {
    this.id = node.id
    if (this.t !== node.t) {
      this.dom.nodeValue = this.t = node.t
    }
  }
}

class Deferred {
  constructor({id}) {
    this.id = id
  }
  canUpdate(vnode) {
    return vnode.t === "d"
  }
  run() {
    return noop
  }
}


function toChild(parent, idx) {
  return vnode => new Child(parent, vnode, idx)
}

function startChild(child) {
  child.run()
}


class Child {
  constructor(parent, vnode, idx) {
    this.key = vnode.key
    this.idx = idx
    this.node = create(vnode)
    this.parent = parent
    this._m = void 0      // mount
    this._u = void 0      // update
    this._d = void 0      // dispose
  }

  run() {
    const {node, parent} = this
    this._d = node.run(mount => {
      this._m = mount
      parent._childReady(this)
    })
  }

  mount(parentDom) {
    const {_m: mount, idx} = this
    const {update, dom} = mount()
    this._u = update
    //if (idx < parentDom.childNodes.length - 1) {
    //  parentDom.insertBefore(dom, parentDom.childNodes[idx + 1])
    //} else {
      parentDom.appendChild(dom)
    //}
  }

  update(vnode, idx) {
    const {node} = this
    if (isSame(node, vnode)) {
      this._ensurePosition(idx)
      return
    }
    if (node.canUpdate(vnode)) {
      this._updateInPlace(vnode, idx)
    } else {
      this._reCreate(vnode, idx)
    }
  }

  remove() {
    const dispose = this._d
    this._d = this._m = this._u = void 0
    dispose && dispose(this.parent.dom)
  }

  _ensurePosition(idx) {
    const {idx: prev} = this
    if (prev > idx) {
      const {parent, node} = this
      if (parent.dom && node.dom) {
        parent.dom.insertBefore(node.dom, idx < parent.dom.childNodes ? parent.dom.childNodes[idx].nextSibling : null)
      }
    }
  }

  _updateInPlace(vnode, idx) {
    const next = create(vnode)
    this.key = next.key
    this.node = next
    const update = this._u
    if (update) {
      this._ensurePosition(idx)
      update(next)
    } else {
      this._markPending()
      this.remove()
      this.run()
    }
  }

  _reCreate(vnode, idx) {
    const next = create(vnode)
    this.key = next.key
    this.node = next
    this.idx = idx
    this._markPending()
    this.remove()
    this.run()
  }

  _markPending() {
    this._m && this.parent._childPending()
  }
}


function isSame(a, b) {
  return a.id === b.id
}

