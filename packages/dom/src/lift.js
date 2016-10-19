import {O} from "@tsers/core"
import {throws} from "./util"


export default (SA, {newId, Nodes: {Lifted}}) => {
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

  function lifted(vnode) {
    return new Lifted(newId(), vnode)
  }

  function liftInner(vnode) {
    !isVNode(vnode) && throws(`Can't lift vnode: ${vnode}`)
    return lifted(vnode)
  }

  function isVNode(x) {
    return x && x.__isNode
  }
}

