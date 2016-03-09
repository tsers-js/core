import should from "should"
import {Observable as O} from "rx"
import TSERS from "../src/index"

const noop = () => {
}

describe("initialization", () => {

  it("requires drives to be an object", () => {
    should.throws(() => TSERS("tsers"))
  })

  it("requires at least one executor", () => {
    const A = () => ({signals: O.just(".."), transforms: {}})
    should.throws(() => TSERS({A}))
  })

  it("creates transducers, (input) signals and executor from drivers", () => {
    const {driver: A, contents: eA} = makeDriver()
    const {driver: B, contents: eB} = makeDriver()
    const [T, S, E] = TSERS({A, B})

    S.should.be.instanceof(O)
    should(T.A.foo === eA.transducers.foo).be.true()
    should(T.B.foo === eB.transducers.foo).be.true()
    should(T.A.foo === T.B.foo).be.false()
    should(E).be.Function()

    function makeDriver() {
      const contents = {
        signals: O.just("tsers"),
        transducers: {
          foo: () => null
        },
        executor: () => null
      }
      const driver = () => contents
      return {driver, contents}
    }
  })

  it("adds common signal transducers", done => {
    const A = () => ({executor: noop})
    const [T, _, __] = TSERS({A})
    const { from, fromMany, to, toMany, compose, decompose, loop, run } = T

    // we have other tests for these
    compose.should.be.Function()
    decompose.should.be.Function()
    loop.should.be.Function()
    run.should.be.Function()

    const res$ = O.merge(
      from(O.of([{key: "tsers", val: 1}, {key: "foo", val: 2}]), "tsers")
        .do(x => x.should.equal(1)),
      fromMany(O.just({key: "tsers", val: 1}), "tsers").tsers
        .do(x => x.should.equal(1)),
      to(O.of("tsers"), "lol", true)
        .do(x => x.should.deepEqual({key: "lol", val: "tsers", ext: true})),
      toMany({foo: O.just("bar"), tsers: O.just("tsers").delay(1)})
        .bufferWithCount(2)
        .do(x => x.should.deepEqual([{key: "foo", val: "bar", ext: false}, {key: "tsers", val: "tsers", ext: false}]))
    )
    res$.subscribe(noop, done.fail, done)
  })

  it("discards missing driver keys", () => {
    const signals = O.just("a"), transducers = {}, executor = noop
    const A = () => ({signals, transducers})
    const B = () => ({transducers, executor})
    const C = () => ({signals, executor})
    const [T, _, __] = TSERS({A, B, C})
    should(T.C).be.undefined()
    should(T.A).not.be.undefined()
  })

  it("allows creating env with no signals at all", done => {
    const A = () => ({transducers: {}, executor: noop})
    const [_, S, __] = TSERS({A})
    S.subscribe(done.fail, done.fail, done)
  })

  it("merges signals and marks them with drivers key", done => {
    const A = () => ({signals: O.just("a"), executor: noop})
    const B = () => ({signals: O.just("b").delay(1), executor: noop})
    const [_, S, __] = TSERS({A, B})

    S.bufferWithCount(2).subscribe(s => {
      s.should.be.deepEqual([{key: "A", val: "a", ext: true}, {key: "B", val: "b", ext: true}])
      done()
    })
  })

})
