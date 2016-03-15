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
    const A = () => [O.just(".."), {}]
    should.throws(() => TSERS({A}))
  })

  it("creates transducers, (input) signals and executor from drivers", () => {
    const {driver: A, contents: eA} = makeDriver()
    const {driver: B, contents: eB} = makeDriver()
    const [T, S, E] = TSERS({A, B})

    S.should.be.instanceof(O)
    should(T.A.foo === eA[0].foo).be.true()
    should(T.B.foo === eB[0].foo).be.true()
    should(T.A.foo === T.B.foo).be.false()
    should(E).be.Function()

    function makeDriver() {
      const Transducers = { foo: () => null }
      const signals = O.just("tsers")
      const executor = () => null
      const contents = [Transducers, signals, executor]
      const driver = () => contents
      return {driver, contents}
    }
  })

  it("adds common signal transducers", () => {
    const A = () => noop
    const [T, _, __] = TSERS({A})
    const { compose, decompose, extract, lift, liftArray, run } = T

    compose.should.be.Function()
    decompose.should.be.Function()
    extract.should.be.Function()
    lift.should.be.Function()
    liftArray.should.be.Function()
    run.should.be.Function()
  })

  it("discards null and undefined values", () => {
    const signals = O.just("a"), Transducers = {}, executor = noop
    const A = () => [Transducers, signals]
    const B = () => [Transducers, null, executor]
    const C = () => [null, signals, executor]
    const [T, _, __] = TSERS({A, B, C})
    should(T.C).be.undefined()
    should(T.A).not.be.undefined()
  })

  it("allows creating env with no signals at all", done => {
    const A = () => [{}, null, noop]
    const [_, S, __] = TSERS({A})
    S.subscribe(done.fail, done.fail, done)
  })

  it("merges signals and marks them with drivers key", done => {
    const A = () => [null, O.just("a"), noop]
    const B = () => [null, O.just("b").delay(1), noop]
    const [_, S, __] = TSERS({A, B})

    S.bufferWithCount(2).subscribe(s => {
      s.should.be.deepEqual([{key: "A", val: "a", ext: true}, {key: "B", val: "b", ext: true}])
      done()
    })
  })

})
