import "should"
import {Observable as O} from "rx"
import tsers from "../src/index"

describe("tsers()", () => {

  it("does all heavy lifting", done => {
    const driver = () => ({
      signals: O.just("tsers").delay(0),
      transforms: {
        upper: signals$ => signals$.map(t => t.toUpperCase())
      },
      executor: out$ => out$.subscribe(msg => {
        msg.should.equal("TSERS")
        done()
      })
    })

    const main = ({T}) => signals => ({
      in: {
        tt: T.upper(signals.of("T"))
      },
      out: {
        T: signals.of("tt")
      }
    })

    tsers({T: driver}, main)
  })

})
