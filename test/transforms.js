import "should"
import {Observable as O} from "rx"
import {mux, demux, loop} from "../src/index"

const noop = () => undefined

describe("common signal stransformers", () => {

  describe("demux(out$, ...keys)", () => {
    it("decomposes streams to object of streams of given keys and rest output", done => {
      const output$ = O.of({key: "A", val: "a"}, {key: "B", val: "b"}, {key: "C", val: "c"})
      const [out, rest$] = demux(output$, "A", "B")
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
      const output$ = O.of({key: "A", val: "a"}, {key: "state$", val: ".."})
      const [_, rest$] = demux(output$, "state$", "val$")
      rest$.bufferWithTime(10).first().subscribe(x => {
        x.should.deepEqual([{key: "A", val: "a"}])
        done()
      })
    })
  })

  describe("loop(in$, main)", () => {
    it("is lazy", done => {
      const input$ = O.just("tsers")
      const out$ = loop(input$, in$ => [in$.do(done.fail), in$.do(done.fail)])
      out$.should.be.instanceof(O)
      setTimeout(done, 10)
    })
    it("loops 2nd argument signals back to input and 1st argument to out", done => {
      const input$ = mux({A: O.just("tsers").delay(0)})
      const out$ = loop(input$, main)
      out$.subscribe(x => {
        x.should.equal("tsers!!")
        done()
      })

      function main(in$) {
        const withBang = s$ => s$.map(x => x + "!")
        const [{A, B}] = demux(in$, "A", "B")
        return [
          withBang(B),               // out
          mux({B: withBang(A)})      // loop
        ]
      }
    })
    it("disposes the signal loop the output stream is disposed", done => {
      function main(in$) {
        return [in$.merge(O.just("lolbal").delay(10)), O.never()]
      }

      const d = loop(O.just("tsers").delay(0), main).subscribe(x => {
        x.should.equal("tsers")
        d.dispose()
        setTimeout(done, 100)
      })
    })
    it("passes 'complete' messages", done => {
      const main = in$ => [in$, O.empty()]
      loop(O.just("tsers").delay(0), main).subscribe(noop, done.fail, done)
    })
    it("passes 'error' messages", done => {
      const main = in$ => [in$, O.empty()]
      loop(O.throw(new Error("tsers")), main).subscribe(noop, () => done())
    })
  })

})
