// see https://developer.mozilla.org/en/docs/Web/JavaScript/Reference/Global_Objects/Array/isArray
const isArrayPolyfill = x =>
  (x && Object.prototype.toString.call(x) === "[object Array]")

export const isFun = f => typeof f === "function"

export const isDef = x => typeof x !== "undefined"

export const isObj = x => x ? x.constructor === Object : false

export const isArray = Array.isArray || isArrayPolyfill

export const isStr = x => typeof x === "string"

export const pipe = (fn, ...fns) =>
  fns.length ? fns.reduce((g, f) => x => f(g(x)), fn) : fn

export const doPipe = (x, ...fns) =>
  fns.reduce((res, f) => f(res), x)

export const comp = (fn, ...fns) =>
  fns.length ? fns.reduce((g, f) => x => g(f(x)), fn) : fn

export const keys = Object.keys

export const index = idents => {
  let idx = {}, i = idents.length
  while (i--) {
    idx[idents[i]] = i
  }
  return idx
}

export const extend = (a, b, c, d) => {
  b && _extend(a, b)
  c && _extend(a, c)
  d && _extend(a, d)
  return a
}

const _extend = (a, b) => {
  keys(b).forEach(key => {
    if (b.hasOwnProperty(key)) {
      a[key] = b[key]
    }
  })
}

export const identity = x => x

export const always = x => () => x

export const zipObj = pairs => {
  const o = {}
  pairs.forEach(([k, v]) => o[k] = v)
  return o
}

export const find = (pred, xs) => {
  if (isArray(xs)) {
    for (let i = 0, n = xs.length; i < n; i++) {
      if (pred(xs[i])) return xs[i]
    }
  }
}

export const defer = fn => {
  Promise.resolve(undefined).then(fn)
}

export const throws = msg => {
  throw new Error(msg)
}
