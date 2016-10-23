import * as most from "most"
import {create as mcreate} from "@most/create"
import mhold from "@most/hold"
import {subject} from "most-subject"
import curry from "./curry"
import {isFun} from "./util"

const {Stream} = most

// This module contains only the minimal set of curried observable
// combinators and creators that are needed for TSERSful module
// development. Add new operators here if the upcoming modules
// require some combinator that does not exist here yet.

export const of = most.of

export const from = most.from

export const empty = most.empty

export const never = most.never

export const map = curry(most.map)

export const filter = curry(most.filter)

export const scan = curry(most.scan)

export const tap = curry(most.tap)

export const combine = curry(function combine(streams) {
  return !streams.length ? most.just([]) : most.combineArray(function () {
    let a = arguments, i = a.length, comb = Array(i)
    while (i--) comb[i] = a[i]
    return comb
  }, streams)
})

export const merge = curry(function merge(streams) {
  return streams.length ? most.mergeArray(streams) : empty()
})

export const switchLatest = curry(most.switch)

export const multicast = curry(most.multicast)

export const hold = curry(mhold)

export const skipRepeats = curry(most.skipRepeatsWith)

export const tapOnDispose = curry(function tapOnDispose(fn, stream) {
  return new Stream(new TapOnDispose(fn, stream.source))
})

export const create = curry(f => mcreate((next, complete, error) => {
  return f({next, complete, error})
}))

export const fromSource = source => {
  return new Stream(source)
}

export const subscribe = curry((obs, s) => {
  const subs = s.subscribe(obs)
  return () => subs.unsubscribe()
})

export const is = s =>
  (s && isFun(s.drain) && isFun(s.subscribe) && isFun(s.observe))

export const adaptIn = curry((originStreamSubscribe, stream) =>
  is(stream) ? stream : create(obs => originStreamSubscribe(stream, obs)))

export const adaptOut = curry((SA, stream) =>
  SA.adapt(stream, Adapter.streamSubscribe))

export const Adapter = {
  adapt: (stream, subs) => adaptIn(subs, stream),
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


///

function TapOnDispose(fn, source) {
  this.fn = fn
  this.source = source
}

TapOnDispose.prototype.run = function (sink, scheduler) {
  const fn = this.fn
  const disposable = this.source.run(sink, scheduler)
  return new CallbackDisposable(() => {
    fn()
    disposable.dispose()
  })
}

function CallbackDisposable(cb) {
  this.cb = cb
}

CallbackDisposable.prototype.dispose = function () {
  const cb = this.cb
  if (cb) {
    this.cb = void 0
    cb()
  }
}
