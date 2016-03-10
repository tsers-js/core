import "should"
import Rx, {Observable as O} from "rx"
import TSERS from "../src/index"


const driver = executor => () => ({executor})

describe("execute()", () => {

  it("executes the output signals by driver name and discards additional signals", done => {
    const s = new Rx.Subject()
    const check = expected => out$ => out$.subscribe(actual => {
      actual.should.equal(expected)
      s.onNext()
    })

    const [{compose}, _, E] = TSERS({
      A: driver(check("a")),
      B: driver(check("b")),
      C: driver(undefined)
    })

    const out$ = compose({A: O.just("a"), B: O.just("b"), D: O.just("d")})
    s.bufferWithCount(2).subscribe(() => done())
    E(out$)
  })

  it("returns a dispose function that allows disposing the running main", done => {
    let d, s = new Rx.Subject()
    const [{compose}, _, E] = TSERS({
      A: driver(out$ => out$.subscribe(() => d && d.dispose())),
      B: driver(out$ => out$.subscribe(done.fail, done.fail, done.fail))
    })

    const out$ = compose({
      A: O.just("a").delay(0),
      B: O.just("b").delay(10).do(done.fail)
    })
    s.bufferWithTime(200).first().subscribe(() => done())
    d = E(out$)
  })

})

