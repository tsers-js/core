# TSERS

**T**ransform-**S**ignal-**E**xecutor framework for **R**eactive **S**treams
(RxJS only at the moment... :disappointed:).

[![Travis Build](https://img.shields.io/travis/tsers-js/core/master.svg?style=flat-square)](https://travis-ci.org/tsers-js/core)
[![Code Coverage](https://img.shields.io/codecov/c/github/tsers-js/core/master.svg?style=flat-square)](https://codecov.io/github/tsers-js/core)
[![NPM version](https://img.shields.io/npm/v/@tsers/core.svg?style=flat-square)](https://www.npmjs.com/package/@tsers/core)
[![Gitter](https://img.shields.io/gitter/room/tsers-js/chat.js.svg?style=flat-square)](https://gitter.im/tsers-js/chat)
[![GitHub issues](https://img.shields.io/badge/issues-%40tsers%2Fcore-blue.svg?style=flat-square)](https://github.com/tsers-js/core/issues)

> "tsers!"

## Motivation

In the era of the JavaScript fatigue, new JS frameworks pop up like mushrooms
after the rain, each of them providing some new and revolutionary concepts. 
So overwhelming! That's why TSERS was created. **It doesn't provide anything
new.** Instead, it combines some old and well-known techniques/concepts
and packs them into single compact form suitable for the modern web application
development.

Technically the closest relative to TSERS is **[Cycle.js](http://cycle.js.org)**,
but conceptually the closest one is **[CALM^2](https://github.com/calmm-js)**. 
Roughly it could be said that TSERS tries to combine the excellent state consistency 
maintaining strategies from CALM^2 and explicit input/output gates from
Cycle - the best from both worlds.

## Core concepts

`TSERS` applications are built upon the three following concepts

1. **Signals** flowing through the application
2. Signal **Transform** functions transforming `input` signals into `output` signals
3. **Executors** performing effects based on the `output` signals

### Signals

Signals are the backbone of `TSERS` application. They are the only way to
transfer inter-app information and information from `main` to interpreters 
and vice versa. In `TSERS` applications, signals are (RxJS) observables. 

* Observables are immutable so the defined signal flow is always
explicit and declarative
* Observables are first-class objects so they can be transformed into
other observables easily by using higher-order functions

TSERS relies entirely on (RxJS) observables and reactive programming,
so if those concepts are not familiar, you should take a look at some
online resources or books before exploring TSERS. One good online tutorial
to RxJS can be found **[here](https://gist.github.com/staltz/868e7e9bc2a7b8c1f754)**.

`TODO: muxing and demuxing`

### Signal transforms

Assuming you are somehow familiar with RxJS (or some other reactive
library like Kefir or Bacon.js), you've definitely familiar with **signal
transform** functions.

The signature of signal transform function `f` is:
```
f :: (Observable A, ...params) => Observable B
```

So basically it's just a pure function that transforms (referentially 
transparently) an observable into another observable. So all 
observable's higher order functions like `map`, `filter`, `scan` 
(just to name a few) are also signal transformers.

Let's take another example:
```js
function titlesWithPrefix(item$, prefix) {
  return item$
    .map(it => it.title)
    .filter(title => title.indexOf(prefix) === 0)
}
```

Now `titlesWithPrefix` is also a signal transform function: it takes
an observable of items and the prefix that must be matched and returns 
an observable of item titles having the given prefix.
```
titlesWithPrefix :: (Observable Item, String) => Observable String
``` 

And as you can see, `titlesWithPrefix` used internally two other signal
transform functions: `map` and `filter`. Because signal transform functions
are pure, it's trivial to compose and reuse them in order to create the
desired signal flow from `input` signals to `output` signals.

If the signals are the backbone of `TSERS` applications, signal transformers
are the muscles around it and moving it.

### Executors

After flowing through the pure signal transformers, the transformed 
`output` signals arrive to the **executors**. In `TSERS`, executors
are also functions. But **not pure**. They are functions that do nasty
things, cause side-effects and change state. That is, executors' signature
looks like this:
```
executor :: Observable A => Effects
``` 

Let's write an executor for our titles:
```js
function alertNewTitles(title$) {
  title$.subscribe(title => {
    alert(`Got new title! ${title}`)
  })
}
```

And what this makes executors in our human analogy... signals flowing through
the spine down and down and finally to the... *anus*. Yeah, unfortunately
somewhere in the application you must do the crappy part: render DOM to the
browser window, modify the global state etc. In `TSERS` applications, this
part falls down to executors.

But the good news is that these crappy things are (usually) not application
specific and easily generalizable! That's why `TSERS` has the **interpreter
abstraction**.

## Application structure 

As told before, every application inevitably contains good parts and bad
parts. And that's why `TSERS` tries to create an explicit border between
those parts: the **interpreter abstraction**.

The good (pure) parts are inside the signal transform function `main`,
and the bad parts are encoded into interpreters. 

Conceptually the full application structure looks like:
```js
function main(input$) {
  // ... app logic ...
  return output$
}
interpreters = makeInterpreters()
output$ = main(interpreters.signals())
interpreters.execute(output$)
```

### `main` 

`main` function is the place where you should put the application logic
in `TSERS` application. It describes the user interactions and as a result
of those interactions, provides an observable of output signals that
are passed to the interpreters' executor functions.

That is, `main` is just another signal transform function that receives
some core transform functions (explained later) plus input signals and
other transform functions from interpreters that can be used to define
the interactions and the control flow.

### Interpreters

Interpreters are not a new concept: they come from the 
**[Free Monad Pattern](https://gist.github.com/CMCDragonkai/165d9a598b8fb333ea65)**.
In common language (and rounding some edges) interpreters are an API
that separates the representation from the actual computation. If you
are interested in Free Monads, I recommend to read 
[this article](http://underscore.io/blog/posts/2015/04/14/free-monads-are-simple.html). 

In `TSERS`, interpreters consist of two parts:

1. Input signals and/or signal transforms
2. Executor function

Input signals and signal transforms are given to the `main`. They are 
a way for interpreter to encapsulate the computation from the representation.
For example `HTTP` interpreter provides the `request` transform. It takes
an observable of request params and returns an observable of request observables
(`request :: Observable params => Observable (Observable respose)`).

Now the `main` can use that transform:
```js
function main({HTTP}) {
  const click$ = ....
  const users$ = HTTP.request(click$.map(() => ({url: "/users", method: "get"})).switch()
  // ...
}
```

Note that `main` doesn't need to know the actual details what happens inside
`request` - it might create the request by using vanilla JavaScript, 
`superagent` or any other JS library. It may not even make a HTTP request every
time when the click happens but returns a cached result instead! It's not
`main`'s business to know such things.

Some interactions may produce output signals that are not interesting in
`main`. That's why interpreters have also possibility to define an **executor**
function which receives those output signals and *interprets* them, 
(usually) causing some effects defined by the interpreter. 

Let's take the `DOM` interpreter as an example. `main` may produce virtual
dom elements as output signals but it's not interested in how (or where) 
those virtual dom elements are rendered.
```js
function main({DOM}) {
  const {h} = DOM 
  return DOM.prepare(Observable.just(h("h1", "Tsers!")))
}
```

#### What to put into `main` and what into interpreters?

In a rule of thumb, you should use interpreter if you need to produce some
effects. Usually this reduces into three main cases:

1. You need to use Observable's `.subscribe` - you should never need to use that inside the `main`
2. You need to communicate with the external world somehow
3. You need to change some global state

#### When to perform side-effects with signal transform functions and when with executor

In a rule of thumb, you should perform the side-effects with signal transform
functions if the input signal and the side effect result signal have a 
**direct causation**, for example `HTTP request => response`.

You should perform the side-effects with `executor` function when the input signal
doesn't cause any output signals (only effects), for example `VDOM => ()` 

### Why the separation of `main` and interpreters?

You may think that the separation of `main` and interpreters is just waste.
What benefit you get by doing that?

The answer is that separating those significantly improves *testability, 
extensibility and the separation of concerns* of the application.
Imagine that you need to implement universal server rendering to your 
application - just change the `DOM` interpreter to server `DOM` interpreter
that produces HTML strings instead of rendering the virtual dom to the
actual DOM. How about if you need to test your application? Just replace the
interpreters with test interpreters so that they produce signals your test 
case needs and assert the output signals your application produces. How
about if you need to implement undo/redo? Just change the application state
interpreter to keep state revisions in memory. How about if you API version
changes? Just modify you API interpreter to convert the new version data
to the current one.

The list could continue forever...

## From theory to practice 

Now that you're familiar with TSER's core concepts and the application
structure, let's see how to build TSERS application in practice. This
section is just a quick introduction. For more detailed tutorial, please
take a look at the TSERS tutorial in the 
**[examples repository](https://github.com/tsers-js/examples)**.

### Starting the application

First you need to install `@tsers/core` and some interpreters. We're gonna
use two basic interpreters: React DOM interpreter for rendering and Model 
interpreter for our application state managing.
```bash 
npm i --save @tsers/core @tsers/react @tsers/model
```

Now we can create and start our application. `@tsers/core` provides
a function that takes the `main` and the interpreters that are attached
to the application. The official interpreter packages provide always
a factory function that can be used to initialize the actual interpreter.
```js
import TSERS from "@tsers/core"
import ReactDOM from "@tsers/react"
import Model from "@tsers/model"

function main(signals) {
  // your app logic comes here!
}

// start the application with model$ and DOM interpreters
TSERS(main, {
  DOM: ReactDOM("#app"),     // render to #app element
  model$: Model(0)           // create application state model by using initial value: 0
})
```

### Adding some app logic inside the `main` 

Now we can use the signals and transforms provided by those interpreters,
as well as TSERS's core transform functions (see API reference below).
Interpreters' signals and transform functions are always accessible by their
keys. Also output signals must use the those keys:
```js
function main(signals) {
  // All core transforms (like "mux") are also accessible 
  // via "signals" input parameter
  const {DOM, model$, mux} = signals
  const {h} = DOM

  // model$ is an instance of @tsers/model - it provides the application
  // state as an observable, so you can use model$ like any other observable
  // (map, filter, combineLatest, ...).

  // let's use the model$ observable to get its value and render a virtual-dom
  // based on the value. DOM.prepare is needed so that we can derive user event
  // streams from the virtual dom stream
  const vdom$ = DOM.prepare(model$.map(counter =>
    h("div", [
      h("h1", `Counter value is ${counter}`),
      h("button.inc", "++"),
      h("button.dec", "--")
    ])))

  // model$ enables you to change the state by emitting "modify functions"
  // as out output signals. The modify functions have always signature
  // (curState => nextState) - they receive the current state of the model
  // as input and must provide the next state based on the current state

  // Let's make modify functions for the counter: when increment button is
  // clicked, increment the counter state by +1. When decrement button is clicked,
  // decrement the state by -1
  const incMod$ = DOM.events(vdom$, ".inc", "click").map(() => state => state + 1)
  const decMod$ = DOM.events(vdom$, ".dec", "click").map(() => state => state - 1)

  // And because the mods are just observables, we can merge them
  const mod$ = O.merge(incMod$, decMod$)

  // Finally we must produce the output signals. Because JavaScript functions
  // can return only one value (observable), we must multiplex ("mux") DOM
  // and model$ signals into single observable by using "mux" core transform
  return mux({
    DOM: vdom$,
    model$: model$.mod(mod$)
  })
}
```

Again: more detailed tutorial can be found from the TSERS
**[examples repository](https://github.com/tsers-js/examples)**.

## What's different compared to Cycle?

If you read through this documentation, you might wonder that TSERS resembles 
Cycle very much. Technically that's true. Then why not to use Cycle? 

Although the technical implementations of TSERS and Cycle are very similar,
their ideologies are not. Cycle is strongly driven by the classification of
**read-effects** and **write-effects** which means that drivers are not 
"allowed" to provide signal transforms that produce side-effects. Instead,
all side effects must go to sinks and their results must be read from the
sources, regardless of the causation of the side-effect and it's input.

Cycle's drivers are also meant for external world communications
**only**, hence e.g. maintaining the global application state is not 
the drivers' job (although maintaining it with e.g. Relay is!!).

In practice, those features in Cycle result in some unnecessary symptoms like
the existence of [isolation](https://github.com/cyclejs/isolate), usage of `IMV` 
instead of `MVI` (which works pretty well btw, until you have to access the model from
the intents), [proxy subjects](https://github.com/cyclejs/examples/blob/master/advanced-list/src/app.js#L65)
usage, [performance issues](https://github.com/cyclejs/todomvc-cycle/issues/22)
and [unnecessary complexity](https://gist.github.com/milankinen/cb0e898ae52c61e8d5da)
whe sharing the state between parent and child components.

And those are the reasons for the existence of TSERS.


## Core transforms API Reference

### `mux` 

JavaScript allows function to return only one value. That means that `main` can
return only one observable of signals. However, applications usually produce 
multiple types of signals (DOM, WebSocket messages, model state changes...).

That's why TSERS a way to [multiplex](https://en.wikipedia.org/wiki/Multiplexing).
Multiple types of signals into single observable. Multiplexing is way of merging 
multiple signal streams into one stream of signals so that different type of 
signals are identifiable from other signals. 

The signature of `mux` is:
```
mux :: ({signalKey: signal$}, otherMuxed$ = Observable.empty()) => muxedSignal$
```

`mux` takes the multiplexed streams as an object so that object's keys represent the 
type of the multiplexed signals. `mux` takes also second (optional) parameter, that
is a stream of already muxed other signals (coming usually from child components)
and merged it to output.

Usually you want to use `mux` in the end of the main to combine all application
signals into single observable of signals:
```js
function main({DOM, model$}) {
  // ....
  return mux({
    DOM: vdom$,
    model$: mod$
  })
}
```

### `demux` 

De-muxing (or de-multiplexing) is the reverse operation for muxing: it takes
an observable of muxed signals, extracts the given signals by their keys and
returns also the rest of the signals that were not multiplexed
```
demux :: (muxedSignal$, ...keys) => [{signalKey: signal$}, otherMuxed$]
```

Usually you want to use this when you call child application inside other
application and want to post-process its specific output signals (e.g. DOM):
```js
const childOut$ = Counter({...signals, model$: childModel$})
const [{DOM: childDOM$}, rest$] = demux(childOut$, "DOM")
``` 

### `loop` 

`loop` is a transform that allows "looping" signals from downstream back to upstream. 
It takes input signals and a transform function producing `output$` and `loop$` signals
array - `output$` signals are passed through as they are, but `loop$` signals
are merged back to the transform function as input signals.

```js
const initialText$ = O.just("Tsers").shareReplay(1)
const vdom$ = loop(initialText$, text$ => {
  const vdom$ = DOM.prepare(text$.map(...))
  const click$ = DOM.events(vdom$, "button", "click")
  const updatedText$ = click$.withLatestFrom(text$, (_, text) => text + "!")
  // vdom$ signals are passed out, updatedText$ signals are looped back to text$ signals
  return [vdom$, updatedText$]
})
```

### `mapListById` 

Takes a list observable (whose items have `id` property) and iterator function, applies 
the iterator function to each list item and returns a list observable by using the return 
values from the iterator function (conceptually same as `list$.map(items => items.map(...))`).

* Item ids **must be unique within the list**.
* Iterator function receives two arguments: iterated item id and 
an observable containing the item and it's state changes

**ATTENTION:** iterator function is applied only **once** per item (by `id`), although the
list observable emits multiple values. This enables some heavy performance optimizations
to the list processing like duplicate detection, cold->hot observable conversion and
caching.

`TODO: example...`

### `mapListBy`

Same as `mapListById` but allows user to define custom identity function instead of
using `id` property. Actually the `mapListById` is just a shorthand for this transform:
```javascript
const mapListById = mapListById(item => item.id)
```

### `demuxCombined`

`demuxCombined` has the same API contract as `demux` but instead of bare output
signals, `demuxCombined` handles a *list of output signals*. The name already
implies the extraction strategy: after the output signals are extracted by using
the given keys, their latest values are combined by using `Observable.combineLatest`,
thus resulting an observable that produces a list of latest values from the
extracted output signals. Rest of the signals are flattened and merged by using
`Observable.merge` so the return value of `demuxCombined` is identical with 
`demux` (hence can be used in the same way when muxing child signals to parent's
output signals).

`TODO: example...`


## Interpreter API reference

`TODO: ...`


## License

MIT

Logo by [Globalicon](http://www.myiconfinder.com/Globalicon) (CC BY 3.0)
