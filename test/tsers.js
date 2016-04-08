import should from "should"
import Rx, {Observable as O} from "rx"
import TSERS, {mux} from "./index"


const noop = () => undefined
const interpreter = executor => () => [null, executor]

describe("TSERS(main, interpreters)", () => {

  it("requires interpreters to be an object", () => {
    should.throws(() => TSERS(noop, "tsers"))
  })

  it("requires at least one executor", () => {
    const A = () => O.just("..")
    should.throws(() => TSERS(noop, {A}))
  })

  it("throws an error if main doesn't return an observable", () => {
    should.throws(() => TSERS(() => "tsers", {A: interpreter(noop)}))
  })

  it("combines the inputs/transforms from interpreters by key", done => {
    const A = {}, B = {}
    TSERS(main, {
      A: () => [A, noop],
      B: () => [B, noop]
    })

    function main(input) {
      should(input.A === A).be.true()
      should(input.B === B).be.true()
      done()
      return O.empty()
    }
  })


  it("adds common signal transformers", done => {
    TSERS(main, {A: () => noop})
    function main(input) {
      input.mux.should.be.Function()
      input.demux.should.be.Function()
      input.loop.should.be.Function()
      input.mapListById.should.be.Function()
      input.mapListBy.should.be.Function()
      input.demuxCombined.should.be.Function()
      done()
      return O.empty()
    }
  })

  it("executes the main's output signals by interpreter name and discards additional signals", done => {
    const s = new Rx.Subject()
    const check = expected => out$ => out$.subscribe(actual => {
      actual.should.equal(expected)
      s.onNext()
    })

    function main() {
      return mux({A: O.just("a"), B: O.just("b"), D: O.just("d")}).delay(1)
    }

    s.bufferWithCount(2).subscribe(() => done())
    TSERS(main, {
      A: interpreter(check("a")),
      B: interpreter(check("b")),
      C: interpreter(null)
    })
  })

  it("returns a dispose function that allows stopping the main running", done => {
    let dispose, s = new Rx.Subject()

    function main() {
      return mux({
        A: O.just("a").delay(0),
        B: O.just("b").delay(10).do(done.fail)
      })
    }

    s.bufferWithTime(200).first().subscribe(() => done())
    dispose = TSERS(main, {
      A: interpreter(out$ => out$.subscribe(() => dispose && dispose())),
      B: interpreter(out$ => out$.subscribe(done.fail, done.fail, done.fail))
    })
  })

})

