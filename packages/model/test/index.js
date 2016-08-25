import R from "ramda"
import {__, O, curry, always} from "@tsers/core"
import Model from "../src/index"

describe("Model Driver", () => {
  it("emits its initial value", done => {
    __(M("tsers"), subscribeAndExpect(["tsers"], done))
  })

  it("changes the state based on the given modifications", done => {
    const model = M("tsers", O.from([
      s => s + "!",
      s => s + "?"
    ]))
    const expected = ["tsers", "tsers!", "tsers!?"]
    __(model, subscribeAndExpect(expected, done))
  })

  it("skips duplicate states based on identity", done => {
    const model = M(1, O.from([1, 1, 2, 3, 3, 1].map(always)))
    const expected = [1, 2, 3, 1]
    __(model, subscribeAndExpect(expected, done))
  })

  it("supports custom equality check for duplicate skipping", done => {
    const eq = (a, b) => Math.abs(a) === Math.abs(b)
    const model = M(1, O.from([1, -1, 2, 3, -3].map(always)), {equality: eq})
    const expected = [1, 2, 3]
    __(model, subscribeAndExpect(expected, done))
  })

  it("has shortcut for replacing/(re)setting the state", done => {
    const model = M(1, O.empty(), {}, O.from([2, 3, 4]))
    const expected = [1, 2, 3, 4]
    __(model, subscribeAndExpect(expected, done))
  })

  it("provides way to log model changes", done => {
    const logged = []
    const model = M(1, O.from([2, 3, 4].map(always)), {logging: true, info: (...args) => logged.push(args)})
    __(model, O.subscribe({
      complete: () => {
        logged.should.deepEqual([1, 2, 3, 4].map(x => ["New state:", x]))
        done()
      },
      error: done
    }))
  })

  it("gives a warning if modifications are not functions", done => {
    const warnings = []
    const model = M(1, O.from([2, 3]), {warn: (...args) => warnings.push(args)})
    __(model, O.subscribe({
      complete: () => {
        warnings.should.deepEqual([2, 3].map(x => ["The given modification", x, "is not a function. Ignoring it..."]))
        done()
      },
      error: done
    }))
  })

  it("gives a warning if modifications are not created by using model.mod or model.set", done => {
    const warnings = []
    const model = run(1, m => [m, O.from([2, 3].map(always))], {warn: (...args) => warnings.push(args)})
    __(model, O.subscribe({
      complete: () => {
        warnings.should.deepEqual([2, 3].map(() => ["Received modification that was not created by using model's 'mod' method. Ignoring it..."]))
        done()
      },
      error: done
    }))
  })

  describe("lensing", () => {
    it("makes a sub-model that observes changes of the lensed part", done => {
      const foo = run({foo: "tsers", bar: 1}, model => {
        const lensed = model.lens("foo")
        const mods = model.mod(O.from([
          R.assoc("foo", "tsers!"),
          R.assoc("bar", 1),
          R.assoc("foo", "tsers!")
        ]))
        return [lensed, mods]
      })
      // skip duplicates apply to lensed model as well!
      const expected = ["tsers", "tsers!"]
      __(foo, subscribeAndExpect(expected, done))
    })

    it("propagates sub-model changes to the parent model as well", done => {
      const parent = run({foo: "tsers", bar: 1}, model => {
        const lensed = model.lens("foo")
        const mods = lensed.set(O.of("tsers!"))
        return [model, mods]
      })
      const expected = [{foo: "tsers", bar: 1}, {foo: "tsers!", bar: 1}]
      __(parent, subscribeAndExpect(expected, done))
    })
  })

  describe("sub-item array mapping", () => {
    it("creates a lensed observable sub-model based on item id", done => {
      const foo = run([{id: 1, val: "foo"}, {id: 2, val: "bar"}], model => {
        const first = model.mapItemsById(item => item).map(R.head).switch()
        const mods = model.mod(O.of(R.update(0, {id: 1, val: "foo!"})))
        return [first, mods]
      })
      const expected = [{id: 1, val: "foo"}, {id: 1, val: "foo!"}]
      __(foo, subscribeAndExpect(expected, done))
    })

    it("calls item mapping function only once per id", done => {
      const called = {"1": 0, "2": 0}
      const foo = run([{id: 1, val: "foo"}, {id: 2, val: "bar"}], model => {
        const first = model.mapItemsById((item, id) => ++called[id] && item).map(R.head).switch()
        const mods = model.mod(O.of(R.update(0, {id: 1, val: "foo!"})))
        return [first, mods]
      })
      __(foo, O.subscribe({
        complete: () => {
          called.should.deepEqual({"1": 1, "2": 1})
          done()
        },
        error: done
      }))
    })

    it("propagates item modifications to the parent model as well", done => {
      const foo = run([{id: 1, val: "foo"}, {id: 2, val: "bar"}], model => {
        const mods = model
          .mapItemsById(item => item.mod(O.of(R.evolve({val: s => s + "!"}))))
          .take(1)
          .map(O.merge)
          .switch()
        return [model, mods]
      })
      const expected = [
        [{id: 1, val: "foo"}, {id: 2, val: "bar"}],
        [{id: 1, val: "foo!"}, {id: 2, val: "bar"}],
        [{id: 1, val: "foo!"}, {id: 2, val: "bar!"}]
      ]
      __(foo, subscribeAndExpect(expected, done))

    })

    it("supports custom item identities", done => {
      const ident = it => `${it.id}${it.id}`
      const called = {"11": 0, "22": 0}
      const m = run([{id: 1, val: "foo"}, {id: 2, val: "bar"}], model => {
        return [model.mapItems(ident, (item, id) => ++called[id] && item).map(R.head).switch(), O.empty()]
      })
      __(m, O.subscribe({
        complete: () => {
          called.should.deepEqual({"11": 1, "22": 1})
          done()
        },
        error: done
      }))
    })
  })
})


const run = (initial, fn, opts) => {
  const m = Model(initial, opts)
  const {observer, stream} = O.Adapter.makeSubject()
  const [model, mods] = fn(m(stream, O.Adapter))
  O.subscribe(observer, mods)
  return model
}

const M = (initial, mods = O.empty(), opts = {}, sets = O.empty()) =>
  run(initial, model => [model, O.merge([model.mod(mods), model.set(sets)])], opts)

const subscribeAndExpect = curry((expected, done, stream) => {
  expected = [...expected]
  return __(stream, O.subscribe({
    next: x => x.should.deepEqual(expected.shift()),
    complete: () => {
      expected.length.should.equal(0)
      done()
    },
    error: done
  }))
})
