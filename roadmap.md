# Roadmap to TSERS 2.x

This document contains planned features for upcoming `TSERS` 2.x release.
Please feel free to comment and participate to the discussion.


## Simplify output signal structure

I've noticed that usually DOM is the only thing I'm interested in when I get
signals from child component(s). Other "effects" are just merged to the
component's effects and passed upwards. In order to achieve this, a lot of
`mux` and `demux` calls must be made, leading to boilerplate and inefficient
streams (every mux and demux costs a little bit).

That's why I'm proposing that in `TSERS@2.x` the return value is not a muxed
stream but more like Cycle's sinks. The difference is that instead of having
separate keys for all types of sinks, TSERS components would only return
`{DOM, Eff}` pair (or either of those) where `DOM` (obviously) contain the
component's DOM and `Eff` contains **all** of the component's effects.

There would be no need for additional muxing or demuxing: core would provide
a functions to interpreters that make possible to encode/decode effects for
that specific interpreter:

```js
function MyModelInterpreter({eff}) {
  const Transforms = {
    mod: modFn$ => eff(doSomething(mod$))
  }
  function executor({DOM: dom$, Eff: eff$}) {
    // eff$ contains only interpreter's own effects
  }
  // ...
}
```

Then the actual application/component code could be kept nice and clean:

```js
function main({DOM: {h, ...DOM}, model}) {
  const message = model.lens("message")
  const counter = Counter({DOM, model: model.lens("counter"))
  const vdom = O.combine(message, counter.DOM, (msg, counter) => DOM.prepare(h("div", [
    h("h1", `Hello ${msg}`),
    h("input.msg", {type: "text", value: msg}),
    h("button.reset", "Reset"),
    counter
  ]))
  // just merge child effects into this component's effects
  const eff = O.merge(
    counter.Eff,
    message.set(DOM.events(vdom, ".msg", "input").map(R.path(["target", "value"]))),
    message.set(DOM.events(vdom, ".reset", "click").map(R.always("")))
  )
  return {
    DOM: vdom,
    Eff: eff
  }
} 
```

Another benefit of having the constrained `{DOM, Eff}` API contract is that
it would allow to create more powerful core transforms/combinators like 
e.g. `liftChildren` for list processing:

```js
function main(signals) {
  const {DOM: {h, ...DOM}, model, liftChildren} = signals
  const counters = liftChildren(model.lens("counters").mapListById(counter => 
    Counter({...signals, model: counter})))
  
  // counters.DOM :: Observable<Array<DOM>>
  // counters.Eff :: Observable<Eff>

  const vdom = counters.DOM.map(children => DOM.prepare(h("div", [
    h("h1", `counters`),
    ...children
  ]))
  // just merge child effects into this component's effects
  const eff = O.merge(
    counters.Eff,
    model.set(...)
  )
  return {
    DOM: vdom,
    Eff: eff
  }
} 
```


## Reduce `DOM` boilerplate

Another pattern that's repeated everywhere is to map and combine observables in 
order to embed their values into component's vdom. And again, child
DOM streams must be mapped and combined in parent components. In the end,
(v)dom is meant to reflect the application state (and provide source for
intents). That's why I'm proposing that DOM contract allows to embed observables
directly to the virtual dom and this would be the official way of building
UIs in TSERS apps. 

This would of course change the DOM interpreter contract a little bit:
`prepare` would be renamed to `lift` which does the `vnode<observable> ->
observable<vnode>` transformation and event boundary detection. Of course
lifting is opt-in so if someone wanted to do lifting manually by using
e.g. `combineLatest`, it'd still be possible.

All `vnode` instances would contain `.on(eventType[, selector])` for event 
binding.

```js
function main({DOM: {h, ...DOM}, Model: message}) {
  const vdom = h("div", [
    h("h1", message.map(m => `Hello ${m}`)),
    h("input.msg", {type: "text", value: message}),
    h("button.reset", "Reset")
  ])
  const setText = O.merge(
    vdom.on("input", ".msg").map(R.path(["target", "value"])),
    vdom.on("click", ".reset").map(R.always(""))
  )
  return {
    DOM: DOM.lift(vdom),
    Eff: message.set(setText)
  }
} 
```


## DRY Interpreter API

I like Cycle's driver API - it's nice and clean and allows one-liner
implementations. That said, I'm a little bit worried about the lifecycle
management of the interpreters and especially the cleanup case.

To solve the cleanup case, I'm proposing that `DOM` and `Eff` streams emit
only `next` events and are never-ending *unless* the application is disposed.
The application disposal would emit single `complete` event to the subscribers
and that should trigger interpreter's cleanup actions. 

```js
function MyDOMInterpreter({DOM: dom$, Eff: eff$, eff}) {
  dom$.subscribe({
    next: vdom => { ... render ... },
    complete: () => { ... cleanup ... }
  })
  return { lift, h, ... }
}

const dispose = TSERS(main, { DOM: MyDOMInterpreter })
....
dispose()
```


## Interoperability with streaming libs 

The last but not least improvement in TSERS 2.x would be the streaming library 
interoperability. I've noticed that interpreters are usually very simple when
it comes to the stream/observable combination part: `map`, `filter` and `flatMap`
are usually enough for the interpreters.

My proposal is to implement interoperability by using streaming library specific
"wrapper interface". Core and all official drivers would be implemented by using
use that interface, thus they'd be completely streaming library agnostic.

Here is for example `@tsers/model` implemented with the interoperability wrapper
interface: https://github.com/tsers-js/model/blob/2.x/src/index.js Notice the 
imported `O` variable, that'll do the wrapping.

Interoperability would also require some changes to the public interface: `TSERS`
would take the wrapper as a first parameter. Other parts of the public API would
remain same as in 1.x.

Here is example app by using `kefir`:

```js
import Kefir from "@tsers/kefir"
import TSERS from "@tsers/core"
import Snabbdom from "@tsers/snabbdom"
import Model from "@tsers/model"

function main({DOM, Model}) {
  // ...
  return { DOM: ..., Eff: ... }
}

// start app
TSERS(Kefir, BMI, {
  DOM: Snabbdom("#app"),
  Model: Model({}, {logging: true})
})
```
