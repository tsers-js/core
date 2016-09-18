import parse from "parse-sel"
import {__, O, isObj, find, always, identity, keys, zipObj} from "@tsers/core"
import VNode, {isVNode} from "./snabbdom/vnode"
import {toKlass, isStr} from "./util"
import {isAttr, isHtmlProp} from "./consts"


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

    const {tagName, id, className} = parse(selector)

    const deferreds = []
    if (isObs(children) || find(isObs, children)) {
      children = isObs(children) ? convertIn(children) : O.combine(children.map(ch => isObs(ch) ? convertIn(ch) : O.of(ch)))
      deferreds.push(__(children,
        O.map(children => {
          const childDeferreds = []
          children.forEach(ch => ch && ch.data && !ch.data.__defer.ready && childDeferreds.push(ch.data.__defer.stream))
          return O.firstAs(children, childDeferreds.length ? O.merge(childDeferreds) : O.empty())
        }),
        O.switchLatest,
        O.map(children => vnode => VNode(
          vnode.tag,
          vnode.data,
          sanitizeChildren(children),
          vnode.text,
          vnode.key
        ))))
      children = []
    } else {
      children = sanitizeChildren(children)
    }

    const propKeys = keys(props)
    if (isObs(props) || find(k => isObs(props[k]), propKeys)) {
      const toKv = key => {
        const prop = props[key]
        return isObs(prop) ? O.map(val => [key, val], prop) : O.of([key, prop])
      }
      props = isObs(props) ? convertIn(props) : O.map(zipObj, O.combine(propKeys.map(toKv)))
      deferreds.push(O.map(props => vnode => {
        props = parseProps(props, propKeys)
        return VNode(
          vnode.tag,
          {...vnode.data, props},
          vnode.children,
          vnode.text,
          props.key
        )
      }))
      props = {}
    } else {
      props = parseProps(props, propKeys)
    }

    const data = {
      __defer: {
        ready: true,
        stream: undefined,
        vnode: undefined
      },
      id,
      className,
      props
    }

    if (deferreds.length) {
      const d = data.__defer
      d.ready = false
      // add initial vnode which will be modified by effects functions
      d.vnode = VNode(tagName, {props, id, className}, children, undefined, props.key)
      // combine effects and emit _one_ ready event when all required effects
      // are combined but after that don't emit events anymore
      const effs = deferreds.map(O.tap(eff => d.vnode = eff(d.vnode)))
      d.stream = __(O.combine(effs),
        O.scan(() => {
          const was = d.ready
          d.ready = true
          return was
        }, true),
        O.filter(reject => !reject),
        O.map(always("ready")))

      data.hook = hooks()
    }

    return VNode(
      tagName,
      data,
      children,
      undefined,
      props.key || data.__defer.stream
    )
  }

  function hooks() {
    let prev
    return {
      create: (old, current) => {
         
      },
      update: () => {
        throws("Should not be possible?")
      }
    }
  }

  function sanitizeChildren(children) {
    return children.map(child =>
      isVNode(child)
        ? child
        : isPrimitive(child)
        ? VNode(undefined, undefined, undefined, `${child}`)
        : throws(`Invalid virtual node: ${child}`))
  }

  function parseProps(props, propKeys) {
    const attrs = {}, htmlProps = {}
    const style = props.style || {}
    const klass = toKlass(props.class || props.className)
    propKeys.forEach(k => {
      isAttr(k) && (attrs[k] = props[k])
      isHtmlProp(k) && (htmlProps[k] = props[k])
    })
    return {attrs, htmlProps, style, klass}
  }

  function throws(msg) {
    throw new Error(msg)
  }
}

