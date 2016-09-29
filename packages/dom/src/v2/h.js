import parse from "parse-sel"
import {__, O, extend, isObj, isArray, find, always, identity, keys, zipObj} from "@tsers/core"
import {newId, noop, isStr, isPrimitive} from "./util"


const VNODE = {}
const PENDING = {}

function deferred() {
  return {id: newId(), _: VNODE, t: "d"}
}

function text(val) {
  return {id: newId(), _: VNODE, t: "t", text: val}
}

function vnode(tag, key, props, children, cm, pm) {
  return {
    id: newId(), _: VNODE, t: "n",
    tag,
    key,
    props,
    children,
    cm,
    pm
  }
}

function throws(msg) {
  throw new Error(msg)
}


function toVNode(x) {
  return isVNode(x)
    ? x
    : (x === null || x === undefined || x === false)
    ? text("")
    : isPrimitive(x)
    ? text(`${x}`)
    : throws(`Not a valid virtual node ${x}`)
}

export function isVNode(x) {
  return x && x._ === VNODE
}

export function isPending(x) {
  return x === PENDING
}

export default (SA) => {
  const isObs = x => x && SA.isValidStream(x)
  const convertIn = O.adaptIn(SA.streamSubscribe)


  return function h(selector, props, children) {
    if (arguments.length === 1) {
      props = {}
      children = []
    } else if (arguments.length === 2) {
      if (isObj(props)) {
        children = []
      } else {
        children = props
        props = {}
      }
    }

    if (!isStr(selector)) {
      //throw new Error("Tag selector must be a string")
    }

    const cm = [], pm = []
    const tagName = selector //{tagName, id, className} = parse(selector)

    if (isObs(children)) {
      cm.push(__(convertIn(children), O.map(children => ({ch: children.map(toVNode), idx: -1}))))
      children = [deferred()]
    } else {
      children = isArray(children) ? children : [children]
      children = children.map((child, idx) => {
        if (isObs(child)) {
          cm.push(__(convertIn(child), O.map(ch => ({ch: toVNode(ch), idx}))))
          return deferred()
        } else {
          return toVNode(child)
        }
      })
    }

    const key = props.key
    const p = {}
    keys(props).forEach(key => {
      if (key !== "key") {
        const val = props[key]
        if (isObs(val)) {
          pm.push(__(convertIn(val), O.map(prop => ({key, val: prop}))))
          p[key] = PENDING
        } else {
          p[key] = val
        }
      }
    })

    return vnode(tagName, key, p, children, cm, pm)
  }
}

