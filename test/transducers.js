import "should"
import {Observable as O} from "rx"
import TSERS from "../src/index"

const noop = () => null

const tsersDriver = () => ({
  signals: O.just("tsers").delay(0),
  executor: noop
})

describe("common transducers", () => {

  describe("decompose", () => {
    it("decomposes streams to object of streams based on driver keys", done => {
      const [{decompose}] = TSERS({A: tsersDriver, B: tsersDriver})
      const out = decompose(O.of({key: "A", val: "a"}, {key: "B", val: "b"}))
      out.A.should.be.instanceof(O)
      out.B.should.be.instanceof(O)
      Object.keys(out).should.deepEqual(["A", "B"])
      out.A
        .map(a => ({a}))
        .merge(out.B.delay(1).map(b => ({b})))
        .bufferWithCount(2)
        .subscribe(x => {
          x.should.deepEqual([{a: "a"}, {b: "b"}])
          done()
        })
    })
    it("allows extra keys as varargs", done => {
      const [{decompose}] = TSERS({A: tsersDriver, B: tsersDriver})
      const in$ = O.of({key: "A", val: "a"}, {key: "state$", val: ".."})
      const out = decompose(in$, "state$", "val$")
      out.state$.should.be.instanceof(O)
      out.val$.should.be.instanceof(O)
      out.state$.subscribe(noop, done.fail, done)
    })
  })

  describe("loop", () => {
    it("is lazy", done => {
      const [{loop}, S, _] = TSERS({A: tsersDriver})
      const out$ = loop(S, in$ => [in$.do(done.fail), in$.do(done.fail)])
      out$.should.be.instanceof(O)
      setTimeout(done, 10)
    })
    it("allows looping signals back to input", done => {
      const [{loop, from, to, compose, decompose}, S, _] = TSERS({A: tsersDriver})

      function main(in$) {
        const withBang = s$ => s$.map(x => x + "!")
        return [
          compose({A: withBang(from(in$, "A2"))}),    // out
          to(withBang(from(in$, "A")), "A2")          // loop
        ]
      }

      decompose(loop(S, main)).A.subscribe(x => {
        x.should.equal("tsers!!")
        done()
      })
    })
    it("disposes the signal loop the output stream is disposed", done => {
      const [{loop, compose, decompose}, S, _] = TSERS({A: tsersDriver})

      function main(in$) {
        return [in$.merge(compose({A: O.just("lolbal").delay(10)}))]
      }

      const d = decompose(loop(S, main)).A.subscribe(x => {
        x.should.equal("tsers")
        d.dispose()
        setTimeout(done, 100)
      })
    })
    it("passes 'complete' messages", done => {
      const [{loop}, S, _] = TSERS({A: tsersDriver})
      const main = in$ => [in$, in$.filter(() => false)]
      loop(S, main).subscribe(noop, done.fail, done)
    })
    it("passes 'error' messages", done => {
      const [{loop}, _, __] = TSERS({A: tsersDriver})
      const main = in$ => [in$, in$.filter(() => false)]
      loop(O.throw(new Error("tsers")), main).subscribe(noop, () => done())
    })
  })

  describe("run", () => {
    it("adds decomposing sugar around loop", done => {
      const [{run}, S, _] = TSERS({A: tsersDriver})

      function main(in$) {
        return [in$]
      }
      run(S, main).A.subscribe(x => {
        x.should.equal("tsers")
        done()
      })
    })
  })

})
