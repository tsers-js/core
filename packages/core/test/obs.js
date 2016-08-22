import xs from "xstream"
import XAdapter from "@cycle/xstream-adapter"
import {__, O} from "../src/index"


describe("observable interface", () => {
  it("provides adapter for Cycle stream conversions", done => {
    const expect = [1, 2, 3, 4]
    const xstream = xs.fromArray([...expect])

    __(O.Adapter.adapt(xstream, XAdapter.streamSubscribe),
      O.subscribe({
        next: x => {
          x.should.equal(expect.shift())
        },
        error: done.fail,
        complete: () => {
          expect.length.should.equal(0)
          done()
        }
      }))
  })
})
