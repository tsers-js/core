import should from "should"
import {Observable as O} from "rx"
import tsers, {run, interpret} from "../src/index"


describe("tsers core", () => {

  describe("initializer function", () => {
    it("creates signals, transforms and interpreters from drivers", () => {
      const {driver: A, contents: eA} = makeDriver()
      const {driver: B, contents: eB} = makeDriver()
      const {signals, transforms, interpreters} = tsers({A, B})

      signals.should.be.instanceof(O)
      should(transforms.A.foo === eA.transforms.foo).be.true()
      should(transforms.B.foo === eB.transforms.foo).be.true()
      should(transforms.A.foo === transforms.B.foo).be.false()
      should(interpreters.A === eA.interpreter).be.true()
      should(interpreters.B === eB.interpreter).be.true()

      function makeDriver() {
        const contents = {
          signals: O.just("a"),
          transforms: {
            foo: () => {
            }
          },
          interpreter: () => {
          }
        }
        const driver = () => contents
        return {driver, contents}
      }
    })
    it("discards missing keys", () => {
      const signals = O.just("a"), transforms = {}, interpreter = () => {}
      const A = () => ({signals, transforms})
      const B = () => ({transforms, interpreter})
      const C = () => ({signals, interpreter})

      const {transforms: t, interpreters: i} = tsers({A, B, C})
      should(i.A).be.undefined()
      should(i.B).not.be.undefined()
      should(t.C).be.undefined()
      should(t.A).not.be.undefined()
    })
    it("allows creating env with no signals at all", done => {
      const A = () => ({transforms: {}, interpreter: () => {}})
      const {signals} = tsers({A})
      signals.subscribe(done.fail, done.fail, done)
    })
  })


})
