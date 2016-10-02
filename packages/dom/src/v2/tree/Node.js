import {O} from "@tsers/core"
import {unmount, subsm, insertTo} from "./helpers"
import {create} from "./index"


const PENDING = 0
const STARTING = 1
const READY = 2


export default class Node {
  constructor({id, tag, key, props, children, cm: childMods, pm: propMods}, parent) {
    this.id = id
    this.key = key
    this.tag = tag
    this.props = props
    this.ch = toChildren(children, this)
    this.dom = null

    // dynamic content
    this.cm = childMods
    this.cp = children.length
    this.pm = propMods

    // functions
    this._dcm = void 0      // dispose child mods
    this._dpm = void 0      // dispose prop mods
    this.p = parent
    this.s = PENDING
  }

  // --- public ---

  start() {
    this.s = STARTING
    this._startChildMods()
    this._startPropMods()
    this._startChildren()
    {
      ((this.s === READY) && this.p.ready(this)) || (this.s = PENDING)
    }
  }

  ready(child) {
    const n = --this.cp, s = this.s
    if (n === 0) {
      this.s = READY
      if (this.dom) {
        insertTo(child.node.mount(), this.dom, child.idx)
      } else if (s === PENDING) {
        this.p.ready(this)
      }
    }
  }

  mount() {
    //console.log("mount")
    const {tag} = this
    const dom = this.dom = document.createElement(tag)
    this._mountChildren(dom)
    return dom
  }

  accepts(vnode) {
    return vnode.t === "n" && this.tag === vnode.tag && this.key === vnode.key
  }

  update(vnode) {
    //console.log("TODO: update", this, vnode)
  }

  stop() {
    call(this._dcm, this._dcm = void 0)
    call(this._dpm, this._dpm = void 0)
    unmount(this)
    this._stopChildren()
    this.p = null
  }


  // --- private ---

  _startChildMods() {
    this._dcm = subsm(this.cm, ({ch, idx}) => {
      this._updateChildren(ch, idx)
    })
  }

  _startPropMods() {
    this._dpm = subsm(this.pm, ({key, val}) => {
      this._updateProps(key, val)
    })
  }

  _startChildren() {
    let {cp: n, ch} = this
    if (n > 0) {
      while (n--) {
        ch[n].node.start()
      }
    } else {
      this.s = READY
    }
  }

  _stopChildren() {
    let {ch} = this, n = ch.length
    if (n > 0) {
      this.ch = null
      while (n--) {
        ch[n].node.stop()
      }
    }
  }

  _mountChildren(dom) {
    let {ch} = this, n = ch.length, i
    if (n === 1) {
      //console.log("append 0")
      dom.appendChild(ch[0].node.mount())
    } else if (n > 1) {
      i = 0
      while (i < n) {
        //console.log("append x", i)
        dom.appendChild(ch[i++].node.mount())
      }
    }
  }

  _updateChildren(vnodes, idx) {
    idx >= 0
      ? this._updateChildAt(idx, vnodes)
      : this._updateAllChildren(vnodes)
  }

  _updateChildAt(idx, vnode) {
    updateChild(this, this.ch[idx], vnode, idx)
  }

  _updateAllChildren(vnodes) {
    //console.log("update all")
    const {ch} = this

    let i, n = ch.length, oldIdxById = {}, newIdxById = {}, newCh = Array(vnodes.length), toRm = [], rmi = 0, d = vnodes.length - n, added
    n = d > 0 ? n : vnodes.length
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
    if (d > 0) {
      this.cp += d
      added = []
    }
    for (i = 0, n = vnodes.length; i < n; i++) {
      const vnode = vnodes[i]
      const {id} = vnode
      if (id in oldIdxById) {
        const idx = oldIdxById[id]
        updateChild(this, newCh[i] = ch[idx], vnode, i)
      } else {
        const old = toRm[rmi++]
        if (old) {
          updateChild(this, newCh[i] = old, vnode, i)
        } else {
          added.push(newCh[i] = toCh(this, vnode, i))
        }
      }
    }

    // remove old
    if ((n = toRm.length) > rmi) {
      for (i = 0; i < n; i++) {
        toRm[i].stop()
      }
    }

    this.ch = newCh

    // start added children
    for (i = 0; i < d; i++) {
      added[i].node.start()
    }
  }

  _updateProps(key, val) {
    //console.log("TODO: update props", key, "=", val, "ID", this.id)
  }
}



function toChildren(children, parent) {
  let n = children.length, ch = Array(n)
  while (n--) {
    ch[n] = toCh(parent, children[n], n)
  }
  return ch
}

function toCh(parent, vnode, idx) {
  return {
    idx,
    node: create(vnode, parent)
  }
}


function updateChild(parent, child, vnode, idx) {
  const {node} = child
  isSame(node, vnode)
    ? resetPosition(parent, child, idx)
    : node.accepts(vnode)
    ? updateInPlace(parent, child, vnode, idx)
    : reset(parent, child, vnode, idx)
}

function resetPosition(parent, child, idx) {
  const prev = child.idx
  child.idx = idx
  if (prev > idx) {
    const {node: {dom}} = child
    parent.dom && dom && insertTo(dom, parent.dom, idx)
  }
}

function updateInPlace(parent, child, vnode, idx) {
  child.node.update(vnode)
  resetPosition(child, idx, parent)
}

function reset(parent, child, vnode, idx) {
  child.node.stop()
  child.idx = idx
  child.node = create(vnode, parent)
  child.node.start()
}


function isSame(a, b) {
  return a.id === b.id
}

function call(f) {
  f && f()
}
