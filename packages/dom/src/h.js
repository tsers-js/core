import {O, isObj, isArray, keys} from "@tsers/core"
import {isStr, isPrimitive, throws} from "./util"
import {PPENDING} from "./consts"


export default (SA, {newId, Nodes: {Text, Element, StaticElement}}) => {
  const isObs = x => x && SA.isValidStream(x)
  const convertIn = O.adaptIn(SA.streamSubscribe)
  const toMod = (obs, fn) =>
    O.map(fn, convertIn(obs))


  return function h(_selector, _props, _children) {
    let selector = _selector, props = _props, children = _children
    if (arguments.length === 2) {
      if (!isObj(props)) {
        children = props
        props = null
      }
    }

    const sel = parse(selector)
    const p = toProps(props, sel)
    const c = toCh(children)
    return elem(sel.tag, p.val, c.val, p.static && c.static)
  }


  function toProps(props, sel) {
    if (!props) {
      return {val: {v: fromSel(sel), m: null, p: 0}, static: true}
    }

    let pk = keys(props), i = pk.length
    let pv = fromSel(sel), res = {val: {v: pv, m: null, p: 0}, static: true}

    while (i--) {
      const key = pk[i], val = props[key]
      isObs(val) ? setObsProp(res, key, val) : pv[key] = val
    }
    return res
  }

  function fromSel(sel) {
    const props = {}
    sel.id && (props.id = sel.id)
    sel.classes && (props.class = sel.classes)
    return props
  }

  function setObsProp(props, key, obs) {
    props.val.v[key] = PPENDING
    ;(props.val.m || (props.val.m = [])).push(toMod(obs, prop => ({k: key, v: prop})))
    ++props.val.p
    props.static = false
  }

  function toCh(children) {
    if (!children) {
      return {val: {v: [], m: null}, static: true}
    } else if (isObs(children)) {
      return {val: {v: null, m: [toMod(children, ch => ch.map(toVNode))]}, static: false}
    } else {
      return toFixedCh(isArray(children) ? children : [children])
    }
  }

  function toFixedCh(children) {
    let i = children.length, chv = Array(i), s = true
    let res = {val: {v: chv, m: null}, static: true}
    while (i--) {
      const ch = children[i]
      if (isObs(ch) && !isLiftedObs(ch)) {
        setObsChAt(res, i, ch)
        s = false
      } else {
        s = (chv[i] = toVNode(ch)).static && s
      }
    }
    res.static = s
    return res
  }

  function setObsChAt(ch, i, obs) {
    (ch.val.m || (ch.val.m = [])).push(toMod(obs, child => ({ch: toVNode(child), i})))
  }

  function toVNode(x) {
    return isVNode(x)
      ? x
      : (x === null || x === undefined || x === false)
      ? text("")
      : isPrimitive(x)
      ? text(`${x}`)
      : isLiftedObs(x)
      ? x.__vnode
      : throws(`Not a valid virtual node ${x}`)
  }

  function elem(tag, props, ch, staticElem) {
    return staticElem
      ? new StaticElement(newId(), tag, props, ch)
      : new Element(newId(), tag, props, ch)
  }

  function text(t) {
    return new Text(newId(), t)
  }

  function isVNode(x) {
    return x && x.__isNode
  }

  function isLiftedObs(x) {
    return isVNode(x.__vnode)
  }
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

