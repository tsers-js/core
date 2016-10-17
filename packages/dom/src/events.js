import {__, O, defer} from "@tsers/core"
import matches from "matches-selector"


export class Events {
  constructor() {
    this.s = O.Adapter.makeSubject()
    this.uid = 0
    this.lis = new Map()      // listeners
    this.del = new Map()      // delegates
    this.dom = null
  }

  mount(dom) {
    this.dom = dom
    this.lis.forEach(lis => lis.mount())
  }

  add(id, sel, type, capture) {
    const uid = ++this.uid
    const dels = getOr(getOr(this.del, id, () => new Map()), type, () => [])
    const lis = getOr(this.lis, typeKey(type, capture), () => new Listener(this, type, capture))
    dels.push({uid, sel})
    lis.start()
    return {uid, stream: eventStream(this.s.stream, uid)}
  }

  remove(id, type, capture, uid) {
    let byId, dels
    // remove delegate
    if ((byId = this.del.get(id)) && (dels = byId.get(type))) {
      const idx = dels.findIndex(d => d.uid === uid)
      idx >= 0 && dels.splice(idx, 1)
      !dels.length && byId.delete(type)
      !byId.size && this.del.delete(id)
    }
    defer(() => {
      let lis
      // stop listener and unmount it if no delegates are depending on
      // the stopped listener. using deferred execution so that we don't need
      // to do expensive listener add/removal if listeners are removed/added
      // sequentially during the same tick (usually happens when switching streams)
      if ((lis = this.lis.get(typeKey(type, capture))) && lis.stop()) {
        this.lis.delete(typeKey(type, capture))
      }
    })
  }

  delegate(event, type) {
    let node = event.target, {dom, del, s: {observer}} = this, d
    while (node && dom && node !== dom) {
      if ((d = del.get(nodeId(node))) && (d = d.get(type))) {
        delegate(event, d, observer)
      }
      node = !node.__scope_end ? node.parentNode : null
    }
  }
}

export function makeEventListener(events, id, selector, type, capture) {
  // TODO: resolve capture!
  capture = false
  const stream =
    O.switchLatest(O.create(({next}) => {
      const {uid, stream} = events.add(id, selector, type, capture)
      next(stream)
      return () => {
        events.remove(id, type, capture, uid)
      }
    }))
  return O.multicast(stream)
}


class Listener {
  constructor(events, type, capture) {
    this.t = type
    this.c = capture
    this.e = events
    this.l = null
    this.n = 0
  }

  start() {
    ++this.n
    this.mount()
  }

  stop() {
    if (--this.n === 0) {
      this.unmount()
      return true
    } else {
      return false
    }
  }

  mount() {
    if (this.n && !this.l && this.e.dom) {
      this.l = event => this.e.delegate(event, this.t)
      this.e.dom.addEventListener(this.t, this.l, this.c)
    }
  }

  unmount() {
    const {l} = this
    this.l = null
    l && this.e.dom && this.e.dom.removeEventListener(this.t, this.l, this.c)
  }
}

function nodeId(dom) {
  return dom.__nodeid
}

function typeKey(type, capture) {
  return `${type}::${capture}`
}

function getOr(map, key, fn) {
  let val = map.get(key)
  !val && (val = fn()) && map.set(key, val)
  return val
}

function eventStream(base, uid) {
  return __(base,
    O.filter(({u}) => u === uid),
    O.map(({e}) => e))
}

function delegate(event, delegates, {next}) {
  for (let i = 0, n = delegates.length; i < n; i++) {
    const {uid, sel} = delegates[i]
    if (matches(event.target, sel)) {
      next({u: uid, e: event})
    }
  }
}
