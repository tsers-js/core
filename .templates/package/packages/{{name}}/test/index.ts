/// <reference path="../typings/index.d.ts" />
import * as assert from "power-assert"
import index from "../src/index"

describe("index default export", () => {
  it("should return package name", () => {
    assert(index() === "{{name}}")
  })
})
