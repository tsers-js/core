import R from "ramda"
import {__, O, curry, always, isObj, keys} from "@tsers/core"
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
    const model = M(1, O.from([1, -1, 2, 3, -3].map(always)), {eq})
    const expected = [1, 2, 3]
    __(model, subscribeAndExpect(expected, done))
  })

  it("has shortcut for replacing/(re)setting the state", done => {
    const model = M(1, O.empty(), {}, O.from([2, 3, 4]))
    const expected = [1, 2, 3, 4]
    __(model, subscribeAndExpect(expected, done))
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

  describe("sub-state selection", () => {
    it("makes a sub-model that observes changes of the selected part", done => {
      const res = run({foo: "tsers", bar: 1}, model => {
        const foo = model.select("foo")
        const mods = model.update(O.from([
          R.assoc("foo", "tsers!"),
          R.assoc("bar", 1),
          R.assoc("foo", "tsers!")
        ]))
        return [foo, mods]
      })
      // skip duplicates apply to selected sub-model as well!
      const expected = ["tsers", "tsers!"]
      __(res, subscribeAndExpect(expected, done))
    })

    it("propagates sub-model changes to the parent model as well", done => {
      const parent = run({foo: "tsers", bar: 1}, model => {
        const child = model.select("foo")
        const mods = child.set(O.of("tsers!"))
        return [model, mods]
      })
      const expected = [{foo: "tsers", bar: 1}, {foo: "tsers!", bar: 1}]
      __(parent, subscribeAndExpect(expected, done))
    })
  })

  describe("child array mapping", () => {
    const Child = (item, id) => ({
      DOM: O.merge([O.of(id + "-1d"), O.of(id + "-2d").delay(10)]),
      Eff: O.merge([O.of(id + "-1e"), O.of(id + "-2e").delay(10)])
    })

    it("creates sinks for each key", () => {
      const model = Model([{id: "1"}, {id: "2"}])(O.never(), O.Adapter)
      const children = model.mapChildrenById(Child, ["Foo", "Bar"], ["Lol"])
      isObj(children).should.be.true()
      keys(children).length.should.eql(3)
      O.is(children.Foo).should.be.true()
      O.is(children.Bar).should.be.true()
      O.is(children.Lol).should.be.true()
    })

    it("combines value sinks of children over time", done => {
      const foo = run([{id: "a"}, {id: "b"}], model => {
        const children = model.mapChildrenById(Child, ["Eff"], ["DOM"])
        const expected = [["a-1d", "b-1d"], ["a-1d", "b-2d"], ["a-2d", "b-2d"]]
        __(children.DOM.take(3), subscribeAndExpect(expected, done))
        return [model, O.empty()]
      })
      O.subscribe({}, foo)
    })

    it("merges event sinks from children", done => {
      const foo = run([{id: "a"}, {id: "b"}], model => {
        const children = model.mapChildrenById(Child, ["Eff"], ["DOM"])
        const expected = ["b-1e", "a-1e", "b-2e", "a-2e"]
        __(children.Eff.take(4), subscribeAndExpect(expected, done))
        return [model, O.empty()]
      })
      O.subscribe({}, foo)
    })

    it("preserves the underlying subscriptions even if children change", done => {
      const foo = run([{id: "a"}, {id: "b"}], model => {
        const children = model.mapChildrenById(Child, ["Eff"], ["DOM"])
        const expected = [
          ["a-1d", "b-1d"],
          ["a-1d", "b-1d", "c-1d"],
          ["a-1d", "b-2d", "c-1d"],
          ["a-2d", "b-2d", "c-1d"],
          ["a-2d", "b-2d", "c-2d"]
        ]
        __(children.DOM.take(5), subscribeAndExpect(expected, done))
        return [model, model.update(O.of(R.append({id: "c"})).delay(3))]
      })
      O.subscribe({}, foo)
    })
  })
})


const run = (initial, fn, opts) => {
  const m = Model(initial, opts)
  const {observer, stream} = O.Adapter.makeSubject()
  const [model, mods] = fn(m(stream, O.Adapter))
  O.subscribe(observer, mods)
  return model.value
}

const M = (initial, mods = O.empty(), opts = {}, sets = O.empty()) =>
  run(initial, model => [model, O.merge([model.update(mods), model.set(sets)])], opts)

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
