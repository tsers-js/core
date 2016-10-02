import Node from "./Node"
import Pending from "./Pending"
import Text from "./Text"


export function create(vnode, parent) {
  switch (vnode.t) {
    case "n":
      return new Node(vnode, parent)
    case "d":
      return new Pending(vnode)
    case "t":
      return new Text(vnode, parent)
  }
}
