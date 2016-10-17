import {__, O, pipe, mapIds, throws, isArray, keys, always} from "@tsers/core"
import lift, {get, comp, find, prop} from "./lenses"


export default (SA, Mod, equality) => {
  const convertIn = O.adaptIn(SA.streamSubscribe)
  const convertOut = O.adaptOut(SA)
  const outValue = pipe(convertOut, SA.remember)

  const toMod = lens => fn =>
    new Mod(fn, lens)

  const skipDups = O.skipRepeats(equality)
  const toValue = pipe(skipDups, O.hold)

  function Model(value, rootLens) {

    function select(selector) {
      const lens = lift(selector)
      return Model(toValue(O.map(v => get(lens, v), value)), comp(rootLens, lens))
    }

    function set(values) {
      return __(convertIn(values), O.map(always), O.map(toMod(rootLens)), convertOut)
    }

    function update(reducers) {
      return __(convertIn(reducers), O.map(toMod(rootLens)), convertOut)
    }

    function mapChildren(ident, fn, eventSinks = ["Model"], valueSinks = ["DOM"]) {
      const indexed = __(value,
        O.map(items => {
          !isArray(items) && throws(`mapChildren requires that the mapped value is an array, instead got ${typeof items}`)
          let i = items.length, list = Array(i), index = {}, it
          while (i--) {
            it = items[i]
            index[list[i] = str(ident(it))] = it
          }
          return {list, index}
        }),
        O.hold)

      return extract(eventSinks, valueSinks, mapIds(id => {
        const sid = str(id)
        const wl = find(it => it && str(ident(it)) === sid)
        const rl = comp(prop("index"), prop(sid))
        const item = toValue(O.map(items => get(rl, items), indexed))
        return new Child(fn(Model(item, comp(rootLens, wl)), sid), eventSinks, valueSinks)
      }, indexed))
    }

    function mapChildrenById(fn, eventSinks, valueSinks) {
      return mapChildren(it => it.id, fn, eventSinks, valueSinks)
    }

    return {
      value: outValue(value),
      select, set, update,
      mapChildren, mapChildrenById
    }
  }

  function extract(eventSinks, valueSinks, children) {
    const extracted = {}
    extractWith(extracted, eventSinks, children, O.merge, pipe(O.multicast, convertOut))
    extractWith(extracted, valueSinks, children, O.combine, outValue)
    return extracted
  }

  function extractWith(target, sinks, children, fnInner, fnOuter) {
    sinks.forEach(key => {
      target[key] = __(children,
        O.map(ch => {
          const nc = ch.length, extracted = Array(nc)
          for (let j = 0; j < nc; j++) {
            extracted[j] = ch[j].s[key]
          }
          return fnInner(extracted)
        }),
        O.switchLatest,
        fnOuter)
    })
  }

  function Child(sinks, eventSinks, valueSinks) {
    const s = this.s = {}
    const d = this.d = {}
    for (let i = 0, n = eventSinks.length; i < n; i++) {
      const key = eventSinks[i]
      const sink = s[key] = sinks[key] ? O.multicast(convertIn(sinks[key])) : O.never()
      d[key] = O.subscribe({}, sink)
    }
    for (let i = 0, n = valueSinks.length; i < n; i++) {
      const key = valueSinks[i]
      const sink = s[key] = sinks[key] ? O.hold(convertIn(sinks[key])) : O.of(undefined)
      d[key] = O.subscribe({}, sink)
    }
  }

  Child.prototype.dispose = function () {
    const {d} = this
    this.d = this.s = null
    keys(d).forEach(key => {
      const dispose = d[key]
      dispose()
    })
  }

  return Model
}


function str(x) {
  return `${x}`
}
