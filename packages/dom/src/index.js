import {__, O} from "@tsers/core"
import {isStr} from "./util"
import {create} from "./vdom"
import H from "./h"


export default function (domRoot) {

  function Lift(SA) {
    const convertOut = O.adaptOut(SA)

    return function lift(vdom) {
      const out = convertOut(O.of(vdom))
      out.__vnode = vdom
      return out
    }
  }

  function DOMDriver(vdom, SA) {
    const convertIn = O.adaptIn(SA.streamSubscribe)
    const h = H(SA)
    const lift = Lift(SA)

    domRoot = isStr(domRoot) ? document.querySelector(domRoot) : domRoot
    __(convertIn(vdom), O.subscribe({
      next: vnode => {
        const appRoot = create(vnode, {
          onChildReady: (app) => {
            domRoot.appendChild(app.create())
          }
        })
        appRoot.start()
      }
    }))

    return {
      h, lift
    }
  }

  DOMDriver.streamAdapter = O.Adapter
  return DOMDriver
}
