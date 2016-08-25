import P, * as L from "partial.lenses"
import {__, O, extend, pipe, isFun, identity, always, mapIds, isArray} from "@tsers/core"


export default function (initial, opts = {}) {
  const {
    equality = (a, b) => a === b,
    logging = false,
    info = (...args) => console.info(...args),      // eslint-disable-line
    warn = (...args) => console.warn(...args),      // eslint-disable-line
    error = (...args) => console.error(...args),    // eslint-disable-line
    } = opts

  const skipDups = O.skipRepeats(equality)
  const toProp = pipe(skipDups, O.hold)

  class Mod {
    constructor(fn, lens) {
      if (!isFun(fn)) {
        warn("The given modification", fn, "is not a function. Ignoring it...")
        fn = identity
      }
      this.f = L.modify(lens, fn)
    }

    exec(state) {
      const f = this.f
      return f(state)
    }
  }


  function ModelDriver(mods, SA) {
    const toInput =
      O.adaptIn(SA.streamSubscribe)
    const toOutput =
      pipe(O.adaptOut(SA), SA.remember)

    const state =
      __(mods,
        O.filter(mod => (mod instanceof Mod) || (warn(
          "Received modification that was not created by using model's 'mod' method. Ignoring it..."
        ) && false)),
        O.scan((s, mod) => mod.exec(s), initial),
        toProp)

    // TODO: implement dispose so that this subscrition can be disposed
    __(state, O.subscribe({
      next: s => {
        logging && info("New state:", s)
      },
      error: e => error(e)
    }))

    return Model(state, L.identity, toOutput)

    // recursive model definition, must be inside ModelDriver function so that
    // we can capture "toInput" and "toOutput" from the closure
    function Model(state, l) {
      const lens = ls =>
        Model(__(state, O.map(L.get(ls)), toProp), P(l, ls))

      const mod =
        pipe(toInput, O.map(mod => new Mod(mod, l)), toOutput)

      const set =
        pipe(toInput, O.map(val => new Mod(always(val), l)), toOutput)

      const log = (...labels) =>
        Model(__(state, O.tap(s => info(...labels, s)), O.hold), l)

      const mapItems = (ident, fn) => {
        const str = id => "" + id
        const indexed = __(state,
          O.map(items => {
            if (!isArray(items)) {
              throw new Error(`mapItems requires that the mapped value is an array, instead got ${typeof items}`)
            }
            const ids = Array(items.length), index = {}
            items.forEach((it, idx) => {
              const id = ident(it)
              ids[idx] = str(id)
              index[id] = it
            })
            return {ids, index}
          }),
          O.hold)
        const ids = indexed.map(x => x.ids)
        return __(ids,
          mapIds(id => {
            const ls = L.find(it => it && str(ident(it)) === id)
            const item = Model(__(indexed, O.map(L.get(P("index", str(id)))), toProp), P(l, ls))
            return fn(item, id)
          }),
          toOutput)
      }

      const mapItemsById = fn =>
        mapItems(it => it.id, fn)

      return extend(toOutput(state), {
        lens,
        mod,
        set,
        log,
        mapItems,
        mapItemsById
      })
    }
  }

  ModelDriver.streamAdapter = O.Adapter
  return ModelDriver
}
