import should from "should"
import {Observable as O} from "rx"
import {drivers} from "../src/index"


describe("drivers()", () => {

  it("creates signals, transforms and executors from drivers", () => {
    const {driver: A, contents: eA} = makeDriver()
    const {driver: B, contents: eB} = makeDriver()
    const {signals, transforms, executors} = drivers({A, B})

    signals.should.be.instanceof(O)
    should(transforms.A.foo === eA.transforms.foo).be.true()
    should(transforms.B.foo === eB.transforms.foo).be.true()
    should(transforms.A.foo === transforms.B.foo).be.false()
    should(executors.A === eA.executor).be.true()
    should(executors.B === eB.executor).be.true()

    function makeDriver() {
      const contents = {
        signals: O.just("a"),
        transforms: {
          foo: () => {
          }
        },
        executor: () => {
        }
      }
      const driver = () => contents
      return {driver, contents}
    }
  })

  it("discards missing keys", () => {
    const signals = O.just("a"), transforms = {}, executor = () => {}
    const A = () => ({signals, transforms})
    const B = () => ({transforms, executor})
    const C = () => ({signals, executor})

    const {transforms: t, executors: i} = drivers({A, B, C})
    should(i.A).be.undefined()
    should(i.B).not.be.undefined()
    should(t.C).be.undefined()
    should(t.A).not.be.undefined()
  })

  it("allows creating env with no signals at all", done => {
    const A = () => ({transforms: {}, executor: () => {}})
    const {signals} = drivers({A})
    signals.subscribe(done.fail, done.fail, done)
  })

  it("merges signals and marks them with drivers key", done => {
    const A = () => ({signals: O.just("a")})
    const B = () => ({signals: O.just("b").delay(1)})
    const {signals: s$} = drivers({A, B})
    s$.bufferWithCount(2).subscribe(s => {
      s.should.be.deepEqual([{key: "A", val: "a", local: false}, {key: "B", val: "b", local: false}])
      done()
    })
  })

})
