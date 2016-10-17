import {extend, find as _find, isFun, isStr, isObj, identity as _ident} from "@tsers/core"

export const lift = x =>
  isLens(x)
    ? x
    : isStr(x)
    ? prop(x)
    : isObj(x)
    ? fromObj(x)
    : isFun(x)
    ? fromFn(x)
    : throws(`Not valid lens ${x}`)

export default lift

export const lens = (getter, setter) =>
  (check(getter, `Not valid getter ${getter}`) || check(setter, `Not valid setter ${setter}`) || new Lens(getter, setter))

// van Laarhoven lens -> TSERS lens
export const fromFn = l =>
  lens(vlget(l), vlset(l))

export const fromObj = ({get: getter, set: setter}) =>
  lens(getter, setter)

export const get = ({get: getter}, s) =>
  getter(s)

export const set = ({set: setter}, a, s) =>
  setter(a, s)

export const update = ({get: getter, set: setter}, mod, s) =>
  setter(mod(getter(s)), s)

export const comp = ({get: innerGet, set: outerSet}, {get: outerGet, set: innerSet}) => {
  const getter = s =>
    outerGet(innerGet(s))
  const setter = (a, s) =>
    outerSet(innerSet(a, innerGet(s)), s)
  return lens(getter, setter)
}

export const identity =
  lens(_ident, _ident)

export const prop = p =>
  lens(pget(s => s[p]), pset(() => ({}), (a, s) => assoc(p, a, extend({}, s)), s => dissoc(p, extend({}, s))))

export const find = pred =>
  lens(pget(s => _find(pred, s)), (a, s) => undef(s) ? s : undef(a) ? rm(pred, s) : updAt(pred, a, s))


const pget = f => s =>
  undef(s) ? s : f(s)

const pset = (d, f, r) => (a, s) =>
  undef(s) ? (undef(a) ? s : f(a, d())) : (undef(a) ? r(s) : f(a, s))

const undef = x =>
  (typeof x === "undefined")

// object field assoc
const assoc = (p, a, s) => {
  s = extend({}, s)
  s[p] = a
  return s
}

// object field dissoc
const dissoc = (p, s) => {
  s = extend({}, s)
  delete s[p]
  return s
}

// list removal by predicate
const rm = (pred, xs) => {
  for (let cxs = xs.slice(), i = 0, n = cxs.length; i < n; i++) {
    if (pred(cxs[i])) {
      cxs.splice(i, 1)
      return cxs
    }
  }
  return xs
}

// list update by predicate
const updAt = (pred, a, xs) => {
  for (let cxs = xs.slice(), i = 0, n = cxs.length; i < n; i++) {
    if (pred(cxs[i])) {
      cxs[i] = a
      return cxs
    }
  }
  return xs
}

// lens type
function Lens(getter, setter) {
  this.get = getter
  this.set = setter
}

const isLens = x =>
  (x && x instanceof Lens)

// functors for van Laarhoven lens operations
function Const(x) {
  this.value = x
}
Const.prototype.map = Const.prototype.fmap = function () {
  return this
}
function Ident(x) {
  this.value = x
}
Ident.prototype.map = Ident.prototype.fmap = function (f) {
  return new Ident(f(this.value))
}

// value getter function by using van Laarhoven lenses
const vlget = l => s =>
  l(a => new Const(a))(s).value

// value setter function by using van Laarhoven lenses
const vlset = l => (a, s) =>
  l(() => new Ident(a))(s).value

function check(f, msg) {
  !isFun(f) && throws(msg)
}

function throws(msg) {
  throw new Error(msg)
}
