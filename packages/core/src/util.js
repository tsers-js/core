// see https://developer.mozilla.org/en/docs/Web/JavaScript/Reference/Global_Objects/Array/isArray
const isArrayPolyfill = x =>
  (x && Object.prototype.toString.call(x) === "[object Array]")

export const isFun = f => typeof f === "function"

export const isDef = x => typeof x !== "undefined"

export const isObj = x => x ? x.constructor === Object : false

export const isArray = Array.isArray || isArrayPolyfill

export const pipe = (fn, ...fns) =>
  fns.length ? fns.reduce((g, f) => x => f(g(x)), fn) : fn

export const doPipe = (x, ...fns) =>
  fns.reduce((res, f) => f(res), x)

export const comp = (fn, ...fns) =>
  fns.length ? fns.reduce((g, f) => x => g(f(x)), fn) : fn

export const keys = Object.keys

export const extend = (a, b) => {
  keys(b).forEach(key => {
    if (b.hasOwnProperty(key)) {
      a[key] = b[key]
    }
  })
}

export const identity = x => x

export const always = x => () => x
