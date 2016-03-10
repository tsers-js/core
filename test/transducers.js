import "should"
import {Observable as O} from "rx"
import TSERS from "../src/index"

const noop = () => null

const tsersDriver = () => ({
  signals: O.just("tsers").delay(0),
  executor: noop
})

describe("common transducers", () => {

  describe("decompose(in$, ...keys)", () => {
    it("decomposes streams to object of streams of given keys and rest output", done => {
      const input$ = O.of({key: "A", val: "a"}, {key: "B", val: "b"}, {key: "C", val: "c"})
      const [{decompose}] = TSERS({A: tsersDriver, B: tsersDriver})
      const [out, rest$] = decompose(input$, "A", "B")
      out.A.should.be.instanceof(O)
      out.B.should.be.instanceof(O)
      rest$.should.be.instanceof(O)
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
    it("re-directs rest output to the second argument stream", done => {
      const [{decompose}] = TSERS({A: tsersDriver, B: tsersDriver})
      const in$ = O.of({key: "A", val: "a"}, {key: "state$", val: ".."})
      const [_, rest$] = decompose(in$, "state$", "val$")
      rest$.bufferWithTime(10).subscribe(x => {
        x.should.deepEqual([{key: "A", val: "a"}])
        done()
      })
    })
  })

  describe("run(in$, main)", () => {
    it("is lazy", done => {
      const [{run}, S, _] = TSERS({A: tsersDriver})
      const out$ = run(S, in$ => [in$.do(done.fail), in$.do(done.fail)])
      out$.should.be.instanceof(O)
      setTimeout(done, 10)
    })
    it("allows returning only output stream", done => {
      const [{run}, S, _] = TSERS({A: tsersDriver})
      const out$ = run(S, in$ => in$)
      out$.should.be.instanceof(O)
      out$.subscribe(() => done())
    })
    it("allows looping signals back to input", done => {
      const [{run, compose, extract}, S, _] = TSERS({A: tsersDriver})

      function main(in$) {
        const withBang = s$ => s$.map(x => x + "!")
        return [
          compose({A3: withBang(extract(in$, "A2").A2)}),    // out
          compose({A2: withBang(extract(in$, "A").A)})       // loop
        ]
      }

      extract(run(S, main), "A3").A3.subscribe(x => {
        x.should.equal("tsers!!")
        done()
      })
    })
    it("disposes the signal loop the output stream is disposed", done => {
      const [{run, compose, extract}, S, _] = TSERS({A: tsersDriver})

      function main(in$) {
        return [in$.merge(compose({A: O.just("lolbal").delay(10)}))]
      }

      const d = extract(run(S, main), "A").A.subscribe(x => {
        x.should.equal("tsers")
        d.dispose()
        setTimeout(done, 100)
      })
    })
    it("passes 'complete' messages", done => {
      const [{run}, S, _] = TSERS({A: tsersDriver})
      const main = in$ => [in$, in$.filter(() => false)]
      run(S, main).subscribe(noop, done.fail, done)
    })
    it("passes 'error' messages", done => {
      const [{run}, _, __] = TSERS({A: tsersDriver})
      const main = in$ => [in$, in$.filter(() => false)]
      run(O.throw(new Error("tsers")), main).subscribe(noop, () => done())
    })
  })

})
