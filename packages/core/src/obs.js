import most from "most"
import mcreate from "@most/create"
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

export const take = curry(most.take)

export const scan = curry(most.scan)

export const tap = curry(most.tap)

export const combine = curry(function combine(streams) {
  return most.combineArray((...args) => args, streams)
})

export const merge = curry(most.mergeArray)

export const switchLatest = curry(most.switch)

export const multicast = curry(most.multicast)

export const hold = curry(mhold)

export const skipRepeats = curry(most.skipRepeatsWith)

export const tapOnDispose = curry(function tapOnDispose(fn, stream) {
  return new Stream(new TapOnDispose(fn, stream.source))
})

export const mapEnd = curry(function mapEnd(fn, stream) {
  return new Stream(new MapEnd(fn, stream.source))
})

export const create = curry(f => mcreate((next, complete, error) => {
  return f({next, complete, error})
}))

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

const Pipe = {
  event: function event(t, x) {
    this.sink.event(t, x)
  },
  error: function error(t, err) {
    this.sink.error(t, err)
  },
  end: function end(t) {
    this.sink.end(t)
  }
}

function MapEnd(fn, source) {
  this.fn = fn
  this.source = source
}

MapEnd.prototype.run = function (sink, scheduler) {
  return this.source.run(new MapEndSink(this.fn, sink), scheduler)
}

function MapEndSink(fn, sink) {
  this.fn = fn
  this.sink = sink
}

MapEndSink.prototype.event = Pipe.event
MapEndSink.prototype.error = Pipe.error
MapEndSink.prototype.end = function end(t) {
  const f = this.fn
  this.event(t, f())
  this.sink.end(t)
}

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
