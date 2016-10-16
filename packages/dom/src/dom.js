export function insertTo(parent, child, idx) {
  const cn = parent.childNodes
  idx < cn.length
    ? insertBefore(parent, child, nextSibling(cn[idx]))
    : append(parent, child)
}

export function nextSibling(node) {
  return node ? node.nextSibling : null
}

export function insertBefore(parent, child, before) {
  parent.insertBefore(child, before)
}

export function append(parent, child) {
  parent.appendChild(child)
}

export function remove(parent, child) {
  child && parent.removeChild(child)
}
