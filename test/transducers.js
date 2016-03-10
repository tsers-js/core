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
      rest$.bufferWithTime(10).first().subscribe(x => {
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
          compose({A3: withBang(extract(in$, "A2"))}),    // out
          compose({A2: withBang(extract(in$, "A"))})       // loop
        ]
      }

      extract(run(S, main), "A3").subscribe(x => {
        x.should.equal("tsers!!")
        done()
      })
    })
    it("disposes the signal loop the output stream is disposed", done => {
      const [{run, compose, extract}, S, _] = TSERS({A: tsersDriver})

      function main(in$) {
        return [in$.merge(compose({A: O.just("lolbal").delay(10)}))]
      }

      const d = extract(run(S, main), "A").subscribe(x => {
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

  describe("lift(val$$, ...keys)", () => {
    it("switches to the latest input and decomposes it by using the given keys", done => {
      const [{lift}, _, __] = TSERS({A: tsersDriver})
      const streams = {
        foo: O.of({key: "A", val: "a1"}, {key: "B", val: "b1"}).merge(O.of({key: "A", val: "a11"}).delay(10)),
        bar: O.of({key: "A", val: "a2"})
      }
      const in$ = O.of("foo").merge(O.of("bar").delay(1))
      const [res] = lift(in$.map(s => streams[s]), "A", "B")
      res.A.should.be.instanceof(O)
      res.B.should.be.instanceof(O)
      res.A.bufferWithTime(100).first().subscribe(x => {
        x.should.deepEqual(["a1", "a2"])
        done()
      })
    })
    it("returns the rest of output as a second parameter stream", done => {
      const [{lift}] = TSERS({A: tsersDriver})
      const streams = {
        foo: O.of({key: "A", val: "a1"}, {key: "B", val: "b1"}).merge(O.of({key: "A", val: "a11"}).delay(1)),
        bar: O.of({key: "A", val: "a2"})
      }
      const in$ = O.of("foo").merge(O.of("bar").delay(1))
      const [_, rest$] = lift(in$.map(s => streams[s]), "A")
      rest$.should.be.instanceof(O)
      rest$.bufferWithTime(100).first().subscribe(x => {
        x.should.deepEqual([{key: "B", val: "b1"}])
        done()
      })
    })
  })

  describe("liftArray(arr$, val => res$, ...keys)", () => {
    it("switches decomposes and combines array values by using given keys", done => {
      const [{liftArray}] = TSERS({A: tsersDriver})
      let n = 0
      const sBy = val =>
        O.of({key: "A", val: "a" + n + val}, {key: "B", val: "b" + n + val})

      const in$ = O.create(o => setTimeout(() => {
        n++
        o.onNext([4, 1, 5])
        setTimeout(() => {
          n++
          o.onNext([2, 5, 3])
        }, 0)
      }, 0))

      const [res, _] = liftArray(in$, sBy, "A")
      res.A.should.be.instanceof(O)
      res.A.bufferWithTime(100).first().subscribe(x => {
        x.should.deepEqual([["a14", "a11", "a15"], ["a22", "a25", "a23"]])
        done()
      })
    })
    it("returns the rest of output as a second parameter stream", done => {
      const [{liftArray}] = TSERS({A: tsersDriver})
      let n = 0
      const sBy = val =>
        O.of({key: "A", val: "a" + n + val}, {key: "B", val: "b" + n + val})

      const in$ = O.create(o => {
        n++
        o.onNext([4, 1, 5])
        setTimeout(() => {
          n++
          o.onNext([2, 5, 3])
        }, 0)
      })

      const [_, rest$] = liftArray(in$, sBy, "A")
      rest$.should.be.instanceof(O)
      rest$.bufferWithTime(100).first().subscribe(x => {
        x.should.deepEqual([
          {key: "B", val: "b14"},
          {key: "B", val: "b11"},
          {key: "B", val: "b15"},
          {key: "B", val: "b22"},
          {key: "B", val: "b25"},
          {key: "B", val: "b23"}
        ])
        done()
      })
    })
    it("supports also empty array values", done => {
      const [{liftArray}] = TSERS({A: tsersDriver})
      const sBy = val => O.of({key: "A", val: "a" + val})

      const in$ = O.just([]).repeat(2)
      const [res, _] = liftArray(in$, sBy, "A")
      res.A.should.be.instanceof(O)
      res.A.bufferWithCount(2).subscribe(x => {
        x.should.deepEqual([[], []])
        done()
      })
    })
  })

})
