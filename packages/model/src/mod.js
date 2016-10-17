import {isFun, identity} from "@tsers/core"
import {update} from "./lenses"


export default (warn) => {
  function Mod(fn, lens) {
    if (!isFun(fn)) {
      warn("The given modification", fn, "is not a function. Ignoring it...")
      fn = identity
    }
    this.f = fn
    this.l = lens
  }

  Mod.prototype.exec = function (state) {
    const {f, l} = this
    return update(l, f, state)
  }

  return Mod
}
