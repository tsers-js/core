import {__, O} from "@tsers/core"
import dom from "./snabbdom"
import {isStr} from "./util"
import {create, update, destroy} from "./modules"
import h from "./h"


export default function (domRoot, SA) {
  const convertIn = O.adaptIn(SA.streamSubscribe)

  function DOMDriver(vdom) {
    const patch = dom.init([/* TODO */])

    let prev = domRoot = isStr(domRoot) ? document.querySelector(domRoot) : domRoot
    __(convertIn(vdom),
      O.subscribe({
        next: vtree => {
          vtree = cloneTree(vtree)
          patch(prev, vtree)
          prev = vtree
        }
      }))

    return {
      h: h(SA)
    }
  }

  DOMDriver.streamAdapter = O.Adapter
  return DOMDriver
}
