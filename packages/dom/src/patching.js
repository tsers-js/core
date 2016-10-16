import {keys} from "@tsers/core"
import {insertTo, insertBefore, nextSibling, append} from "./dom"
import {boolAttrByName, attrByName, propsByName} from "./consts"
import {isStr} from "./util"

const PFT = {}                      // patch function table
const boolAttr = boolAttrByName

keys(attrByName).forEach(attr => {
  PFT[attr] = patchHtmlAttribute
})
keys(propsByName).forEach(prop => {
  PFT[prop] = patchHtmlProp
})

PFT.class = patchClassList
PFT.style = patchStyles


export function patchProps(oldProps, newProps, domNode) {
  let i, key, oldKeys = keys(oldProps), newKeys = keys(newProps)
  i = newKeys.length
  while (i--) {
    key = newKeys[i]
    patchProp(key, oldProps[key], newProps[key], domNode)
  }
  i = oldKeys.length
  while (i--) {
    key = oldKeys[i]
    if (!(key in newKeys)) {
      patchProp(key, oldProps[key], undefined, domNode)
    }
  }
}

export function patchProp(key, oldVal, newVal, domNode) {
  if (key in PFT) {
    const patch = PFT[key]
    patch(key, oldVal, newVal, domNode)
  }
}

export function patchChildAt(idx, prevCh, nextCh, parentDOM) {
  if (isSame(prevCh, nextCh)) {
    return
  } else if (nextCh.accepts(prevCh)) {
    nextCh.update(prevCh)
  } else {
    prevCh.stop(parentDOM)
    insertTo(parentDOM, nextCh.create(), idx)
  }
}

export function patchChildren(prevChildren, nextChildren, parentDOM) {
  let prevStartIdx = 0, nextStartIdx = 0,
    prevEndIdx = prevChildren.length - 1,
    prevStartCh = prevChildren[0],
    prevEndCh = prevChildren[prevEndIdx],
    nextEndIdx = nextChildren.length - 1,
    nextStartCh = nextChildren[0],
    nextEndCh = nextChildren[nextEndIdx]

  while (prevStartIdx <= prevEndIdx && nextStartIdx <= nextEndIdx) {
    if (isSame(prevStartCh, nextStartCh)) {
      prevStartCh = prevChildren[++prevStartIdx]
      nextStartCh = nextChildren[++nextStartIdx]
    } else if (isSame(prevEndCh, nextEndCh)) {
      prevEndCh = prevChildren[--prevEndIdx]
      nextEndCh = nextChildren[--nextEndIdx]
    } else if (isSame(prevStartCh, nextEndCh)) {
      // child moved right
      insertBefore(parentDOM, nextEndCh.dom, nextSibling(prevEndCh.dom))
      prevStartCh = prevChildren[++prevStartIdx]
      nextEndCh = nextChildren[--nextEndIdx]
    } else if (isSame(prevEndCh, nextStartCh)) {
      // child moved left
      insertBefore(parentDOM, prevEndCh.dom, prevStartCh.dom)
      prevEndCh = prevChildren[--prevEndIdx]
      nextStartCh = nextChildren[++nextStartIdx]
    } else {
      // fallback to index based patching
      patchByIdx(prevChildren, nextChildren, prevStartIdx, prevEndIdx, nextStartIdx, nextEndIdx, parentDOM)
      return
    }
  }
  if (prevStartIdx > prevEndIdx) {
    addAll(parentDOM, nextChildren, nextStartIdx, nextEndIdx)
  } else if (nextStartIdx > nextEndIdx) {
    removeAll(parentDOM, prevChildren, prevStartIdx, prevEndIdx)
  }
}


function patchByIdx(prevChildren, nextChildren, prevStartIndex, prevEndIndex, nextStartIndex, nextEndIndex, parentDOM) {
  let i, nextCh, prevCh, prevIdx,
    prevIdxById = {},
    nextIdxById = {},
    rm = {c: null, n: null, p: null},
    rmw = rm

  for (i = nextStartIndex; i <= nextEndIndex; i++) {
    nextIdxById[nextChildren[i].id] = i
  }
  for (i = prevStartIndex; i <= prevEndIndex; i++) {
    prevIdxById[prevChildren[i].id] = i
  }

  for (i = prevStartIndex; i <= prevEndIndex; i++) {
    prevCh = prevChildren[i]
    if (!nextIdxById[prevCh.id]) {
      rmw.c = prevCh
      rmw = (rmw.n = {c: null, n: null, p: rmw})
    }
  }

  for (i = nextStartIndex; i <= nextEndIndex; i++) {
    nextCh = nextChildren[i]
    prevIdx = prevIdxById[nextCh.id]
    if (prevIdx) {
      prevIdx < i && insertTo(parentDOM, nextCh.dom, i)
    } else if (prevCh = rm.c) {
      if (nextCh.accepts(prevCh)) {
        nextCh.update(prevCh)
        prevIdx < i && insertTo(parentDOM, nextCh.dom, i)
      } else {
        insertTo(parentDOM, nextCh.create(), i)
        prevCh.stop(parentDOM)
      }
      rm = rm.n
    } else {
      insertTo(parentDOM, nextCh.create(), i)
    }
  }

  let rmp = rm.p
  rmw = rmw.p
  while (rmp !== rmw) {
    rmw.c.stop(parentDOM)
    rmw = rmw.p
  }
}


function isSame(a, b) {
  return a.id === b.id
}

function addAll(parentDOM, ch, startIdx, endIdx) {
  const before = endIdx + 1 < ch.length ? ch[endIdx + 1].dom : null
  const add = before ? insertBefore : append
  for (; startIdx <= endIdx; ++startIdx) {
    add(parentDOM, ch[startIdx].create(), before)
  }
}

function removeAll(parentDOM, ch, startIdx, endIdx) {
  while (startIdx <= endIdx) {
    ch[endIdx--].stop(parentDOM)
  }
}

function patchHtmlAttribute(key, oldVal, newVal, domNode) {
  if (oldVal !== newVal) {
    if (!newVal && boolAttr[key] || newVal === undefined) {
      domNode.removeAttribute(key)
    } else {
      domNode.setAttribute(key, newVal)
    }
  }
}

function patchHtmlProp(key, oldVal, newVal, domNode) {
  if (oldVal !== newVal) {
    if (newVal === undefined) {
      delete domNode[key]
    } else if (oldVal !== newVal && (key !== "value" || domNode[key] !== newVal)) {
      domNode[key] = newVal
    }
  }
}

function patchClassList(_, oldVal, newVal, domNode) {
  let name, val
  if (!oldVal && !newVal) return
  oldVal = normalizeClass(oldVal)
  newVal = normalizeClass(newVal)

  for (name in oldVal) {
    if (!newVal[name]) {
      domNode.classList.remove(name)
    }
  }
  for (name in newVal) {
    val = newVal[name];
    if (val !== oldVal[name]) {
      domNode.classList[val ? "add" : "remove"](name)
    }
  }
}

function patchStyles(_, oldVal, newVal, domNode) {
  let name, val
  if (!oldVal && !newVal) return
  oldVal = oldVal || {}
  newVal = newVal || {}

  for (name in oldVal) {
    if (!newVal[name]) {
      domNode.style[name] = ""
    }
  }
  for (name in newVal) {
    val = newVal[name];
    if (val !== oldVal[name]) {
      domNode.style[name] = val || ""
    }
  }
}

function normalizeClass(clz) {
  return isStr(clz) ? toBoolMap(clz) : clz || {}
}

function toBoolMap(str) {
  let xs = str.split(" "), i = xs.length, res = {}, s
  while (i--) {
    (s = xs[i].trim()) && (res[s] = true)
  }
  return res
}
