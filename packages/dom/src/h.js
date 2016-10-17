import {O, isObj, isArray, keys} from "@tsers/core"
import {newId, isStr, isPrimitive, throws} from "./util"
import {NodeTypes, VNODE, PPENDING} from "./consts"
import {makeEventListener} from "./events"

const {ELEM, TEXT, STATIC_ELEM} = NodeTypes


export default (SA, events) => {
  const isObs = x => x && SA.isValidStream(x)
  const convertIn = O.adaptIn(SA.streamSubscribe)
  const convertOut = O.adaptOut(SA)
  const toMod = (obs, fn) =>
    O.map(fn, convertIn(obs))

  return function h(selector, props, children) {
    let i, ch, stat = true
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

    const sel = parse(selector)

    let chv = null, chm = null
    if (isObs(children)) {
      chm = []
      chm.push(toMod(children, children => children.map(toVNode)))
      stat = false
    } else {
      children = isArray(children) ? children : [children]
      i = children.length
      chv = Array(i)
      while (i--) {
        const child = children[i]
        if (isObs(child)) {
          (i => {
            (chm || (chm = [])).push(toMod(child, child => ({ch: toVNode(child), i})))
          })(i)
          stat = false
        } else {
          chv[i] = ch = toVNode(child)
          stat = stat && isStatic(ch)
        }
      }
    }

    const pKeys = keys(props)
    let pv = {}, pm = null, pp = 0
    sel.id && (pv.id = sel.id)
    sel.classes && (pv.class = sel.classes)
    i = pKeys.length
    while (i--) {
      const key = pKeys[i], val = props[key]
      if (isObs(val)) {
        ((key, val) => {
          (pm || (pm = [])).push(toMod(val, prop => ({k: key, v: prop})))
        })(key, val)
        pv[key] = PPENDING
        ++pp
        stat = false
      } else {
        pv[key] = val
      }
    }

    return elem(sel.tag, {v: pv, m: pm, p: pp}, {v: chv, m: chm}, stat)
  }

  function makeEventsObs(selector, type, capture) {
    return convertOut(makeEventListener(events, this.id, selector, type, capture))
  }

  function emptyEventsObs() {
    return convertOut(O.never())
  }

  function text(val) {
    return {id: newId(), _: VNODE, t: TEXT, text: val, on: emptyEventsObs}
  }

  function elem(tag, props, ch, isStatic) {
    return {
      id: newId(), _: VNODE, t: isStatic ? STATIC_ELEM : ELEM,
      on: makeEventsObs,
      tag, props, ch
    }
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
}


function isStatic(vnode) {
  return vnode.t === STATIC_ELEM || vnode.t === TEXT
}

function isVNode(x) {
  return x && x._ === VNODE
}

// parses selector into object {tag: <str>, id: <str>?, classes: {<str>: true}?}
// t: 0 = tag, 1 = id, 2 = class
function parse(selector) {
  !isStr(selector) && throws("Selector must be a string")
  let s, ch, tag, id, classes = {}, n = selector.length, t = 0, p = 0, i = 0, nc = 0
  for (; i < n; i++) {
    ch = selector.charAt(i)
    switch (ch) {
      case ".":
        s = selector.substring(p, (p = i + 1) - 1)
        t === 0 ? (tag = s) : t === 1 ? (id = s) : ((classes[s] = true) && nc++)
        t = 2
        break
      case "#":
        s = selector.substring(p, (p = i + 1) - 1)
        t === 0 ? (tag = s) : t === 2 ? ((classes[s] = true) && nc++) : void 0
        t = 1
        break
    }
  }
  s = p ? selector.substring(p) : selector
  t === 0 ? (tag = s) : t === 1 ? (id = s) : ((classes[s] = true) && nc++)
  return {
    tag: tag || "div",
    id,
    classes: nc ? classes : null
  }
}

