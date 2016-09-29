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
    this.cm = childMods
    this.pm = propMods
    this.props = props
    this.ch = children.map(toChild(this))
    this.chReady = children.length            // children ready count

    this.domNode = null

    this._dcm = void 0      // dispose child mods
    this._dpm = void 0      // dispose prop mods
    this._n = void 0        // fn to signal that this node is ready
  }

  canUpdate(vnode) {
    return vnode.t === "n" && this.tag === vnode.tag && this.props.key === vnode.props.key
  }

  run(next) {
    this._n = once(() => next(() => this._mount()))
    const {cm, pm} = this

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

    if (this.chReady === 0) {
      this._n()
    } else {
      const ch = this.ch
      ch.forEach(startChild)
    }

    // return dispose function that handles teardown logic and
    // cleanup when the node is being destroyed
    return () => {
      const dcm = this._dcm, dpm = this._dpm, children = this.ch
      this._dcm = this._dpm = this._n = void 0
      this.ch = []
      dcm && dcm()
      dpm && dpm()
      children && children.forEach(ch => ch.dispose())
    }
  }


  _childReady() {
    const left = --this.chReady
    left === 0 && this._n()
  }

  _childPending() {
    this.chReady++
  }

  _mount() {
    const {tag, props, ch} = this
    const domNode = this.domNode = document.createElement(tag)
    mountChildren(domNode, ch)
    // TODO: mount props
    return {domNode, update: this._update.bind(this)}
  }

  _update(node) {
    console.log("TODO: node update")
  }

  _updateChildAt(idx, vnode) {
    this.ch[idx].update(vnode)
  }

  _updateAllChildren(vnodes) {
    console.log("TODO: Update all children", "ID", this.id)
  }

  _updateChildren(ch, idx) {
    idx >= 0
      ? this._updateChildAt(idx, ch)
      : this._updateAllChildren(ch)
  }

  _updateProps(key, val) {
    console.log("TODO: update props", key, "=", val, "ID", this.id)
  }
}


class Text {
  constructor({id, text}) {
    this.id = id
    this.t = text
    this.domNode = null
  }

  canUpdate(vnode) {
    return vnode.t === "t"
  }

  run(next) {
    next(() => this._mount())
    return noop
  }

  _mount() {
    const domNode = this.domNode = document.createTextNode(this.t)
    return {domNode, update: this._update.bind(this)}
  }

  _update(node) {
    this.id = node.id
    if (this.t !== node.t) {
      this.domNode.nodeValue = this.t = node.t
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


function toChild(parent) {
  return vnode => new Child(parent, vnode)
}

function startChild(child) {
  child.run()
}


class Child {
  constructor(parent, vnode) {
    this.key = vnode.key
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
      parent._childReady()
    })
  }

  mount() {
    const mount = this._m
    const {update, domNode} = mount()
    this._u = update
    return domNode
  }

  update(vnode) {
    const {node} = this
    if (isSame(node, vnode)) return
    if (node.canUpdate(vnode)) {
      this._updateInPlace(vnode)
    } else {
      this._reCreate(vnode)
    }
  }

  dispose() {
    const dispose = this._d
    this._d = void 0
    dispose && dispose()
    this._m && this.parent._childPending()
    this._m = void 0
    this._u = void 0
  }

  _updateInPlace(vnode) {
    const next = create(vnode)
    this.key = next.key
    this.node = next
    const update = this._u
    if (update) {
      update(next)
    } else {
      this.dispose()
      this.run()
    }
  }

  _reCreate(vnode) {
    const next = create(vnode)
    this.key = next.key
    this.node = next
    this.dispose()
    this.run()
  }
}


function isSame(a, b) {
  return a.id === b.id
}

function mountChildren(domNode, children) {
  children.forEach(ch => {
    domNode.appendChild(ch.mount())
  })
}
