import xs from "xstream"
import XAdapter from "@cycle/xstream-adapter"
import {__, O} from "../src/index"


describe("observable interface", () => {
  it("provides adapter for Cycle stream conversions", done => {
    const expected = [1, 2, 3, 4]
    const xstream = xs.fromArray([...expected])

    __(O.Adapter.adapt(xstream, XAdapter.streamSubscribe),
      O.subscribe({
        next: x => {
          x.should.equal(expected.shift())
        },
        error: done.fail,
        complete: () => {
          expected.length.should.equal(0)
          done()
        }
      }))
  })

  describe("tapOnDispose", () => {
    it("is called when user disposes the stream programmatically", done => {
      const expected = [1, 2]
      const dispose =
        __(O.from([1, 2, 3, 4]),
          O.tapOnDispose(() => {
            expected.length.should.equal(0)
            done()
          }),
          O.subscribe({
            next: x => {
              x.should.equal(expected.shift())
              expected.length === 0 && dispose()
            },
            error: done
          }))
    })

    it("is called when the stream completes", done => {
      __(O.from([1, 2]),
        O.tapOnDispose(() => {
          done()
        }),
        O.subscribe({
          error: done
        }))
    })
  })
})
