import most from "most"
import mcreate from "@most/create"
import mhold from "@most/hold"
import {subject} from "most-subject"
import curry from "./curry"
import {isFun} from "./util"


export const of = most.of

export const empty = most.empty

export const never = most.never

export const map = curry(most.map)

export const filter = curry(most.filter)

export const scan = curry(most.scan)

export const tap = curry(most.tap)

export const combine = curry(most.combineArray)

export const merge = curry(most.mergeArray)

export const switchLatest = curry(most.switch)

export const multicast = curry(most.multicast)

export const hold = curry(mhold)

export const create = curry(f => mcreate((next, complete, error) => {
  return f({next, complete, error})
}))

export const subscribe = curry((obs, s) => {
  const subs = s.subscribe(obs)
  return () => subs.unsubscribe()
})

export const is = s =>
  (s && isFun(s.drain) && isFun(s.subscribe) && isFun(s.observe))

export const adapt = (stream, subscribe) =>
  is(stream) ? stream : create(obs => subscribe(stream, obs))


export const Adapter = {
  adapt,
  isValidStream: is,
  remember: hold,
  makeSubject() {
    const s = subject()
    const o = {
      next: x => s.next(x),
      complete: () => s.complete(),
      error: e => s.error(e)
    }
    return {observer: o, stream: s}
  },
  streamSubscribe(s, o) {
    return subscribe(s, o)
  }
}
