import {__, O, extend} from "@tsers/core"
import {isStr, newId} from "./util"
import H from "./h"
import Lift from "./lift"
import Lifecycle from "./lifecycle"
import P from "./patching"
import {Events, make} from "./events"
import * as domApi from "./dom"

import Lifted from "./vdom/Lifted"
import Text from "./vdom/Text"
import Element from "./vdom/Elem"
import StaticElement from "./vdom/StaticElem"


export default function (domRoot) {
  function DOMDriver(vdom, SA) {
    const convertIn = O.adaptIn(SA.streamSubscribe)
    const events = new Events()
    const context = {}

    extend(context, {domApi, newId})
    extend(context, Lifecycle(context))
    extend(context, {events: make(SA, events)})
    extend(context, {patch: P(context)})
    extend(context, {
      Nodes: {
        Lifted: Lifted(context),
        Text: Text(context),
        Element: Element(context),
        StaticElement: StaticElement(context)
      }
    })
    extend(context, {
      h: H(SA, context),
      lift: Lift(SA, context)
    })


    domRoot = isStr(domRoot) ? document.querySelector(domRoot) : domRoot
    const rootNode = {
      onChildReady: (app) => {
        domRoot.appendChild(app.create())
      }
    }
    __(convertIn(vdom), O.subscribe({
      next: vnode => {
        const app = context.link(vnode, rootNode)
        events.mount(domRoot)
        app.start()
      }
    }))

    const Source = context.lift
    Source.h = context.h
    Source.lift = context.lift
    return Source
  }

  DOMDriver.streamAdapter = O.Adapter
  return DOMDriver
}
