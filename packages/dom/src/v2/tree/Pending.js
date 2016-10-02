


export default class Pending {
  constructor({id}) {
    this.id = id
  }

  start() {
  }

  mount() {
    throw new Error("Deferred node can't be mounted")
  }

  accepts(vnode) {
    return vnode.t === "d"
  }

  update() {
  }

  stop() {
  }
}
