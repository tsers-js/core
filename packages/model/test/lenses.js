import {extend} from "@tsers/core"
import R from "ramda"
import P, * as L from "../src/lenses"


const obj = (msg = "foo") => ({
  foo: msg
})

describe("Built-in lenses", () => {
  it("have a lens for identity", () => {
    const o = obj("foo")
    L.get(L.identity, o).should.deepEqual(obj("foo"))
    L.set(L.identity, obj("bar"), o).should.deepEqual(obj("bar"))
    o.should.deepEqual(obj("foo"))
  })

  it("have a lens for props", () => {
    const o = obj("tsers"), l = P("foo")
    L.get(l, o).should.equal("tsers")
    L.set(l, 123, o).should.deepEqual(obj(123))
    L.update(l, x => x + "!", o).should.deepEqual(obj("tsers!"))
    L.set(l, undefined, o).should.deepEqual({})
    o.should.deepEqual(obj("tsers"))
  })

  it("have a lens array items", () => {
    const o = [{id: 1, msg: "foo"}, {id: 2, msg: "bar"}], l = L.find(x => x.id === 1)
    L.get(l, o).should.deepEqual({id: 1, msg: "foo"})
    L.set(l, "tsers", o).should.deepEqual(["tsers", {id: 2, msg: "bar"}])
    L.update(l, x => extend({}, x, {msg: "..."}), o).should.deepEqual([{id: 1, msg: "..."}, {id: 2, msg: "bar"}])
    L.set(l, undefined, o).should.deepEqual([{id: 2, msg: "bar"}])
    o.should.deepEqual([{id: 1, msg: "foo"}, {id: 2, msg: "bar"}])
  })

  it("support Ramda lenses interop", () => {
    const o = obj("tsers"), l = P(R.lensProp("foo"))
    L.get(l, o).should.equal("tsers")
    L.set(l, 123, o).should.deepEqual(obj(123))
    L.update(l, x => x + "!", o).should.deepEqual(obj("tsers!"))
    o.should.deepEqual(obj("tsers"))
  })

  it("support lens compositions", () => {
    const f = L.find(x => x.id === 1)
    const l1 = L.comp(P("foo"), f)
    const l2 = L.comp(P("bar"), f)
    const o = {
      foo: [{id: 1, msg: "foo"}, {id: 2, msg: "foo"}],
      bar: [{id: 1, msg: "bar"}, {id: 2, msg: "bar"}],
      msg: "tsers"
    }
    L.get(l1, o).should.deepEqual({id: 1, msg: "foo"})
    L.get(l2, o).should.deepEqual({id: 1, msg: "bar"})
    L.set(l1, "tsers", o).should.deepEqual(extend({}, o, {foo: ["tsers", {id: 2, msg: "foo"}]}))
    L.set(l2, undefined, o).should.deepEqual(extend({}, o, {bar: [{id: 2, msg: "bar"}]}))
  })
})
