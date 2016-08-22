import {__, isObj, pipe, comp} from "../src/index"


describe("common utils", () => {
  const withBang = x => x + "!"
  const withDot = x => x + "."
  const Obj = () => {
  }
  describe("isObj", () => {
    it("detects whether x is plain js object or not", () => {
      isObj({}).should.equal(true)
      isObj([]).should.equal(false)
      isObj(new Obj()).should.equal(false)
      isObj(null).should.equal(false)
      isObj(undefined).should.equal(false)
    })
  })

  describe("pipe", () => {
    it("composes functions from left to right", () => {
      const f = pipe(withBang, withDot)
      f("tsers").should.equal("tsers!.")
    })
    it("provides 'doPipe' shortcut", () => {
      __("tsers",
        withBang,
        withDot).should.equal("tsers!.")
    })
  })

  describe("comp", () => {
    it("composes functions from right to left", () => {
      const f = comp(withBang, withDot)
      f("tsers").should.equal("tsers.!")
    })
  })
})
