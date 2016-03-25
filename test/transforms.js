import "should"
import Rx, {Observable as O} from "rx"
import {mux, demux, loop, mapListBy} from "../src/index"

const noop = () => undefined
const keys = x => x ? Object.keys(x) : []

const mapListById = mapListBy.bind(null, x => x.id)


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

  describe("mapListById", () => {
    it("create item sub-streams only once", done => {
      const list$ = O.of([{id: 1}], [{id: 1}], [{id: 1}, {id: 2}])
      mapListById(list$, id => ({A: O.just(id)}))
        .bufferWithTime(100)
        .first()
        .subscribe(
          xs => xs.map(x => x.map(keys)).should.deepEqual([[["A"]], [["A"], ["A"]]]),
          done.fail,
          done
        )
    })
    it("allows re-indexing items without re-creating sub-streams", done => {
      const list$ = O.of([{id: 1}, {id: 2}], [{id: 1}, {id: 2}])
      mapListById(list$, id => ({A: O.just(id)}))
        .bufferWithTime(100)
        .first()
        .subscribe(
          xs => xs.map(x => x.map(keys)).should.deepEqual([[["A"], ["A"]]]),
          done.fail,
          done
        )
    })
    it("removes sub-streams when item is removed from the list", done => {
      const list$ = O.of([{id: 1}], [])
      mapListById(list$, id => ({A: O.just(id)}))
        .bufferWithTime(100)
        .first()
        .subscribe(
          xs => xs.map(x => x.map(keys)).should.deepEqual([[["A"]], []]),
          done.fail,
          done
        )
    })
    it("disposes sub-streams when item is removed", done => {
      const list$ = O.of([{id: 1}], []).merge(O.never())
      mapListById(list$,
        id => ({
          A: O.just(id).finally(() => {
            setTimeout(done, 100)
          })
        }))
        .bufferWithTime(50)
        .first()
        .subscribe(
          xs => xs.map(x => x.map(keys)).should.deepEqual([[["A"]], []]),
          done.fail
        )
    })
    it("makes inner streams hot", done => {
      const list$ = O.of([{id: 1}])
      mapListById(list$, id => ({A: O.just(id).do(() => done())}))
        .subscribe(() => null, done.fail)
    })
    it("disposes all sub-streams when the mapped list stream is disposed", done => {
      const s = new Rx.Subject()
      const list$ = O.of([{id: 1}, {id: 2}])
      const list$$ = O.just(list$).merge(O.just(O.never()).delay(10))

      s.bufferWithCount(2).subscribe(ids => {
        ids.should.deepEqual([1, 2])
        done()
      })
      list$$.flatMapLatest(list$ => mapListById(list$, id => ({
          A: O.just(id).finally(() => s.onNext(id))
        })))
        .subscribe(() => null, done.fail)
    })
  })

})
