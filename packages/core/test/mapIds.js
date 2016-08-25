import {mapIds, O, __} from "../src/index"


describe("mapIds", () => {
  it("maps same sequential id only once", done => {
    const expected = ["id1", "id2", "id3", "id4"]
    const ids = O.from([["id1", "id2", "id3"], ["id1", "id2", "id3", "id4"]])
    __(ids,
      mapIds(id => {
        id.should.equal(expected.shift())
        return O.of(id)
      }),
      O.subscribe({
        complete: () => {
          expected.length.should.equal(0)
          done()
        },
        error: done
      }))
  })

  it("skips repeats if id sequence doesn't change", done => {
    let count = 0
    const ids = O.from([["id1", "id2"], ["id1", "id2"], ["id1", "id2"]])
    __(ids,
      mapIds(id => {
        count++
        return O.of(id)
      }),
      O.subscribe({
        complete: () => {
          count.should.equal(2)     // id1 + id2
          done()
        },
        error: done
      }))
  })

  it("disposes its values when stream completes if values have 'dispose' function", done => {
    const ids = O.from([["id1", "id2"], ["id1", "id2"], ["id1", "id2"]])
    const disposed = new Set()
    __(ids,
      mapIds(id => ({
        dispose: () => disposed.add(id)
      })),
      O.subscribe({
        complete: () => {
          disposed.should.deepEqual(new Set(["id1", "id2"]))
          done()
        },
        error: done
      }))
  })
})
