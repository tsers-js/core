import {O} from "@tsers/core"

let __ID__ = 0

export const newId = () => {
  return ++__ID__
}

export const noop = () => {
}

export const isStr = x => {
  return typeof x === "string"
}

export const isNum = x => {
  return typeof x === "number"
}

export const isBool = x => {
  return typeof x === "boolean"
}

export const isPrimitive = x => {
  return isStr(x) || isNum(x) || isBool(x)
}


export const startMods = (mods, observer) => {
  const next = mod => {
    observer.onMod(mod)
  }
  return mods && mods.length ? O.subscribe({next}, mods.length > 1 ? O.merge(mods) : mods[0]) : void 0
}

export const stopMods = dispose => {
  dispose && dispose()
  return void 0
}
