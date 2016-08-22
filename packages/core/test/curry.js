import {curry} from "../src/index"


describe("currying", () => {
  it("works with f.length > 3", () => {
    const f4 = curry((a, b, c, d) => a + b + c + d)
    f4(1, 2, 3, 4).should.equal(10)
    f4(1)(2, 3, 4).should.equal(10)
    f4(1, 2)(3, 4).should.equal(10)
    f4(1, 2, 3)(4).should.equal(10)
    f4(1, 2, 3, 4, 5).should.equal(10)
  })
  it("works with f.length === 3", () => {
    const f3 = curry((a, b, c) => a + b + c)
    f3(1, 2, 3).should.equal(6)
    f3(1)(2, 3).should.equal(6)
    f3(1, 2)(3).should.equal(6)
    f3(1, 2, 3, 4).should.equal(6)
  })
  it("works with f.length === 2", () => {
    const f2 = curry((a, b) => a + b)
    f2(1, 2).should.equal(3)
    f2(1)(2).should.equal(3)
    f2(1, 2, 3).should.equal(3)
  })
})
