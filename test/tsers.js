import "should"
import {Observable as O} from "rx"
import tsers from "../src/index"

describe("tsers()", () => {

  it("does all heavy lifting", done => {
    const driver = () => ({
      signals: O.just("tsers").delay(0),
      transducers: {
        upper: signals$ => signals$.map(t => t.toUpperCase())
      },
      executor: out$ => out$.subscribe(msg => {
        msg.should.equal("TSERS")
        done()
      })
    })

    const main = ({signal: {fromKey}, T}) => input$ => ({
      loop: {
        tt: T.upper(fromKey(input$, "T"))
      },
      out: {
        T: fromKey(input$, "tt")
      }
    })

    tsers({T: driver}, main)
  })

})
