import {__, O} from "@tsers/core"
import {identity} from "./lenses"
import makeMod from "./mod"
import makeModel from "./model"


export default function (initial, opts = {}) {
  const {
    eq = defaultEquality,
    warn = defaultWarn,
    error = defaultError,
    } = opts


  function ModelDriver(mods, SA) {
    const Mod = makeMod(warn)
    const Model = makeModel(SA, Mod, eq)

    const value =
      __(mods,
        O.filter(mod => (mod instanceof Mod) || (warn(
          "Received modification that was not created by using model's 'mod' method. Ignoring it..."
        ) && false)),
        O.scan((s, mod) => mod.exec(s), initial),
        O.skipRepeats(eq),
        O.hold)

    __(value, O.subscribe({error}))

    return Model(value, identity)
  }

  ModelDriver.streamAdapter = O.Adapter
  return ModelDriver
}

function defaultEquality(a, b) {
  return a === b
}

function defaultWarn() {
  const args = Array.prototype.slice.call(arguments)
  console.warn(args)      // eslint-disable-line
}

function defaultError() {
  const args = Array.prototype.slice.call(arguments)
  console.error(args)     // eslint-disable-line
}
