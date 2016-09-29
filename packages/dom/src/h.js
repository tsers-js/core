import parse from "parse-sel"
import {__, O, isObj, isArray, find, always, identity, keys, zipObj, extend} from "@tsers/core"
import VNode, {isVNode} from "./snabbdom/vnode"
import is from "./snabbdom/is"
import {toKlass, isStr} from "./util"
import {isAttr, isHtmlProp} from "./consts"


class ObservableData {
  constructor(tag, key, mods) {
    this.__vnode = null
    this.__dispose = void 0
    this.__content = VNode(tag, {}, [], undefined, key)

    const applyContent = mod => {
      this.__content = mod(this.__content)
    }

    const effs = mods.map(m => O.map(applyContent))
    this.__resolve =
      __(O.combine(effs),
        O.map(() => this.__content),
        O.multicast)

    this.hooks = {
      create: (_, vnode) => {
        this.__vnode = extend({}, vnode, {data: {}})
        this.render(this.__content)
      },
      update: (oldVnode) => {
        this.__vnode = content(oldVnode)
        this.render(this.__content)
      },
    }
  }

  render(vtree) {
    vtree && this.__vnode && (this.__vnode = render(this.__vnode, vtree))
  }

  start() {
    if (!this.__dispose) {
      this.__dispose = __(this.__resolve, O.subscribe({
        next: vtree => this.render(vtree)
      }))
      return O.take(1, this.__resolve)
    }
  }
}


function content(vnode) {
  return vnode.data.__content || vnode
}


export function waitUntilReady(childObs) {
  return __(childObs, O.map(_start), O.switchLatest)
}

function _start(children) {
  const streams = collectStreams(isArray(children) ? children : [children], [])
  return !streams.length
    ? O.just(children)
    : O.mapEnd(() => children, O.merge(streams))
}


export function collectStreams(vnodes, streams) {
  vnodes.forEach(vnode => {
    let i
    vnode && (i = vnode.data) && i.start && (i = i.start()) && streams.push(i)
    (i = vnode.children) && collectStreams(i, streams)
  })
  return streams
}


export default (SA) => {
  const isObs = SA.isValidStream
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
      throw new Error("Tag selector must be a string")
    }

    const mods = []
    const {tagName, id, className} = parse(selector)

    // Resolve children. There are three different cases when resolving...
    if (isObs(children)) {
      mods.push(__(convertIn(children), waitUntilReady, O.map(children => vnode => updateChildren(vnode, children))))
      children = []
    } else {
      children = isArray(children) ? children : [children]
      if (find(isObs, children)) {
        const resolvedChildren = Array(children.length)
        children.forEach((ch, idx) => {
          mods.push(
            __(isObs(ch) ? convertIn(ch) : O.of(ch),
              waitUntilReady,
              O.map(child => vnode => {
                resolvedChildren[idx] = ch
                return updateChildren(vnode, resolvedChildren)
              })))
        })
        children = []
      } else {
        children = sanitizeChildren(children)
      }
    }

    let key
    if (isObs(props)) {
      mods.push(__(convertIn(props), O.map(props => vnode => updateProps(vnode, props, className, id))))
      props = {}
    } else {
      const propKeys = keys(props)
      if (find(key => isObs(props[key]), propKeys)) {
        const resolvedProps = {}
        propKeys.forEach(key => {
          const prop = props[key]
          if (isObs(prop)) {
            mods.push(__(convertIn(prop), O.map(prop => vnode => {
              resolvedProps[key] = prop
              return updateProps(vnode, resolvedProps, className, id)
            })))
          } else {
            resolvedProps[key] = prop
          }
        })
        key = props.key
        props = {}
      } else {
        key = props.key
        props = parseProps(props, propKeys, className, id)
      }
    }

    const data = mods.length ? new ObservableData(tag, key, mods) : {props}
    return VNode(
      tagName,
      data,
      children,
      undefined,
      key
    )
  }

  function updateChildren(vnode, children) {
    return VNode(
      vnode.tag,
      vnode.data,
      sanitizeChildren(children),
      vnode.text,
      vnode.key
    )
  }

  function updateProps(vnode, props, className, id) {
    props = parseProps(props, keys(props), className, id)
    return VNode(
      vnode.tag,
      extend(extend({}, vnode.data), {props}),
      vnode.children,
      vnode.text,
      props.key
    )
  }

  function sanitizeChildren(children) {
    return children.map(child =>
      isVNode(child)
        ? child
        : is.primitive(child)
        ? VNode(undefined, undefined, undefined, `${child}`)
        : throws(`Invalid virtual node: ${child}`))
  }

  function parseProps(props, propKeys, className, id) {
    const attrs = {}, htmlProps = {}
    const style = props.style || {}
    const klass = toKlass(className + (props.class || props.className || ''))
    propKeys.forEach(k => {
      isAttr(k) && (attrs[k] = props[k])
      isHtmlProp(k) && (htmlProps[k] = props[k])
    })
    id && !attrs.id && (attrs.id = id)
    return {attrs, htmlProps, style, klass}
  }

  function throws(msg) {
    throw new Error(msg)
  }
}

