import {O} from "@tsers/core"


export function unmount(node) {
  const {dom, p: parent} = node
  node.dom = null
  dom && parent.dom && parent.dom.removeChild(dom)
}

export function subsm(o, next) {
  return o.length ? O.subscribe({next}, O.merge(o)) : void 0
}

export function insertTo(node, parent, idx) {
  //console.log("insert")
  const cn = parent.childNodes
  idx < cn.length
    ? parent.insertBefore(node, cn[idx].nextSibling)
    : parent.appendChild(node)
}
