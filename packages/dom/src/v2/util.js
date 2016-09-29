let __ID__ = 0

export const once = fn => {
  let called = false
  return arg => !called && (called = true) && fn(arg)
}

export const newId = () =>
  ++__ID__


export const noop = () => undefined

export const isStr = x => typeof x === "string"

export const isNum = x => typeof x === "number"

export const isPrimitive = x => isStr(x) || isNum(x)

