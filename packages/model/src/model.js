import {__, O, pipe, keys, always, extend} from "@tsers/core"
import lift, {get, comp, find} from "./lenses"
import {MapChildrenSource, CycleSinkExtractSource} from "./children"


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

    function mapChildrenBy(identityFn, fn, eventSinks = ["Model"], valueSinks = ["DOM"]) {
      // make sure identity is string type
      const ident = pipe(identityFn, str)

      // augment transform function so that it converts output item stream to
      // model and converts returned cycle sinks (from app) back to internal streams
      const childFn = (item, key) => {
        const itemValue = outValue(item)
        const itemLens = find(it => ident(it) === key)
        const itemModel = Model(itemValue, comp(rootLens, itemLens))
        return cycleSinksToInternal(fn(itemModel, key))
      }

      // create custom MapChildren source that does the list state management,
      // calls childFn function every time when new item is added to the observed
      // list and is compatible with child value extraction
      const mcSource = new MapChildrenSource(value.source, ident, childFn, valueSinks, eventSinks)
      // create output sinks by extracting them by their key from the map children source
      const events = extract(mcSource, eventSinks, pipe(O.multicast, convertOut), false)
      const values = extract(mcSource, valueSinks, pipe(O.hold, outValue), true)
      return extend({}, events, values)
    }

    function mapChildren(fn, eventSinks, valueSinks) {
      return mapChildrenBy(it => it.id, fn, eventSinks, valueSinks)
    }

    return {
      value: outValue(value),
      select, set, update,
      mapChildrenBy, mapChildren
    }
  }

  function extract(mapChildrenSource, sinkNames, toOutput, isValue) {
    const extracted = {}
    for (let i = 0, n = sinkNames.length; i < n; i++) {
      const name = sinkNames[i]
      const stream = O.fromSource(new CycleSinkExtractSource(mapChildrenSource, name, isValue))
      extracted[name] = toOutput(stream)
    }
    return extracted
  }

  function cycleSinksToInternal(sinks) {
    const internal = {}
    let k = keys(sinks), i = k.length
    while (i--) {
      const name = k[i]
      internal[name] = convertIn(sinks[name])
    }
    return internal
  }


  return Model
}

function str(x) {
  return `${x}`
}
