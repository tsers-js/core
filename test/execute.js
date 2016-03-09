import "should"
import Rx, {Observable as O} from "rx"
import {drivers, run, execute} from "../src/index"


const tsersDriver = (executor, signals = O.just("tsers").delay(0)) => () => ({
  signals,
  executor
})

describe("execute()", () => {

  it("executes the output signals by driver name and discards additional signals", done => {
    const s = new Rx.Subject()
    const {signals, transducers: {signal: {fromKey}}, executors} = drivers({
      A: tsersDriver(out$ => out$.subscribe(msg => {
        msg.should.equal("tsers!")
        s.onNext()
      })),
      B: tsersDriver(out$ => out$.subscribe(msg => {
        msg.should.equal("tsers?")
        s.onNext()
      })),
      C: tsersDriver(() => {})
    })

    s.bufferWithCount(2).subscribe(() => done())
    execute(executors, run(signals, in$ => ({
      out: {
        A: fromKey(in$, "A").map(t => t + "!"),
        B: fromKey(in$, "B").map(t => t + "?"),
        D: fromKey(in$, "D").map(t => t + "%")
      }
    })))
  })

  it("returns a dispose function that allows disposing the running main", done => {
    const s = new Rx.Subject()
    const input$ = O.just("tsers!").delay(0)
      .merge(O.just("tsers?").delay(5))

    let d
    const {signals, transducers: {signal: {fromKey}}, executors} = drivers({
      tsers: tsersDriver(out$ => out$.subscribe(msg => {
        s.onNext(msg)
        if (d) { d.dispose(); d = null }
      }), input$),
      noop: tsersDriver(() => {})
    })
    s.bufferWithTime(200).subscribe(msgs => {
      msgs.should.deepEqual(["tsers!"])
      done()
    })
    d = execute(executors, run(signals, in$ => ({
      out: { tsers: fromKey(in$, "tsers") }
    })))
  })

})
