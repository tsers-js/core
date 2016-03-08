import "should"
import {Observable as O} from "rx"
import {drivers, run} from "../src/index"


const tsersDriver = () => ({
  signals: O.just("tsers").delay(0)
})

describe("run()", () => {

  it("is lazy", done => {
    const {signals} = drivers({tsers: tsersDriver})
    const out = run(signals, signals => ({
      in: {
        t: signals.of("tsers").do(done.fail)
      },
      out: {
        msg: signals.of("t")
      }
    }))
    out.msg.should.be.instanceof(O)
    setTimeout(done, 10)
  })

  it("loops 'in' signals back to input and 'out' outside the system", done => {
    const {signals} = drivers({tsers: tsersDriver})
    const out = run(signals, signals => ({
      in: {
        t: signals.of("tsers").map(t => t + "!")
      },
      out: {
        msg: signals.of("t").map(t => t + "!")
      }
    }))
    out.msg.subscribe(t => {
      t.should.equal("tsers!!")
      done()
    })
  })

  it("disposes the signal loop if the output stream is disposed", done => {
    const {signals} = drivers({tsers: tsersDriver})
    const out = run(signals, signals => ({
      in: {
        t: signals.of("tsers").delay(5).do(done.fail).merge(signals.of("tsers"))
      },
      out: {
        msg: signals.of("t")
      }
    }))
    const d = out.msg.subscribe(() => {
      d.dispose()
      setTimeout(done, 50)
    })
  })

})
