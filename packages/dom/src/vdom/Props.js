import {PPENDING} from "../consts"
import {startMods, stopMods} from "../util"


export default ({patch: {patchProps, patchProp}}) => {
  class Props {
    constructor(elem, {v: values, m: mods, p: numPending}) {
      this.el = elem
      this.v = values
      this.m = mods
      this.n = numPending
      this.d = void 0
    }

    start() {
      this.n ? (this.d = startMods(this.m, this)) : this.el.onPropsReady()
    }

    isReady() {
      return this.n === 0
    }

    create(dom) {
      patchProps({}, this.v, dom)
    }

    update({v: prevProps}, dom) {
      patchProps(prevProps, this.v, dom)
    }

    stop() {
      this.d = stopMods(this.d)
    }

    onMod({k: key, v: next}) {
      const prev = this.v[key]
      this.v[key] = next
      if (prev === PPENDING && --this.n === 0) {
        this.el.onPropsReady()
      } else if (this.el.dom) {
        patchProp(key, prev, next, this.el.dom)
      }
    }
  }

  return Props
}

