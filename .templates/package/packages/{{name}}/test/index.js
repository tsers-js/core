import index from "../src/index"

describe("index default export", () => {
  it("should return package name", () => {
    index().should.equal("{{name}}")
  })
})
