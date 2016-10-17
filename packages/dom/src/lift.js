import {O} from "@tsers/core"
import {isVNode, lifted} from "./h"
import {throws} from "./util"


export default (SA) => {
  const convertOut = O.adaptOut(SA)
  const convertIn = O.adaptIn(SA.streamSubscribe)
  const isObs = x => x && SA.isValidStream(x)
  const hold = SA.remember

  return function lift(vdom) {
    if (isVNode(vdom)) {
      const vnode = lifted(vdom)
      const obs = convertOut(O.of(vnode))
      obs.__vnode = vnode
      return obs
    } else if (isObs(vdom)) {
      const obs = convertOut(O.map(liftInner, convertIn(vdom)))
      return hold(obs)
    } else {
      throws(`Can't lift vdom: ${vdom}`)
    }
  }

  function liftInner(vnode) {
    !isVNode(vnode) && throws(`Can't lift vnode: ${vnode}`)
    return lifted(vnode)
  }
}

