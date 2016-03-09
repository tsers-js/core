import "should"
import {Observable as O} from "rx"
import {drivers, run} from "../src/index"


const tsersDriver = () => ({
  signals: O.just("tsers").delay(0)
})

describe("run()", () => {

  it("is lazy", done => {
    const {signals, transducers: {signal: {fromKey}}} = drivers({tsers: tsersDriver})
    const out = run(signals, in$ => ({
      loop: {
        t: fromKey(in$, "tsers").do(done.fail)
      },
      out: {
        msg: fromKey(in$, "t")
      }
    }))
    out.msg.should.be.instanceof(O)
    setTimeout(done, 10)
  })

  it("loops 'loop' signals back to input and 'out' outside the system", done => {
    const {signals, transducers: {signal: {fromKey}}} = drivers({tsers: tsersDriver})
    const out = run(signals, in$ => ({
      loop: {
        t: fromKey(in$, "tsers").map(t => t + "!")
      },
      out: {
        msg: fromKey(in$, "t").map(t => t + "!")
      }
    }))
    out.msg.subscribe(t => {
      t.should.equal("tsers!!")
      done()
    })
  })

  it("disposes the signal loop if the output stream is disposed", done => {
    const {signals, transducers: {signal: {fromKey}}} = drivers({tsers: tsersDriver})
    const out = run(signals, in$ => ({
      loop: {
        t: fromKey(in$, "tsers").delay(5).do(done.fail).merge(fromKey(in$, "tsers"))
      },
      out: {
        msg: fromKey(in$, "t")
      }
    }))
    const d = out.msg.subscribe(() => {
      d.dispose()
      setTimeout(done, 50)
    })
  })

})
