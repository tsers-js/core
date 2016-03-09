import Rx, {Observable as O} from "rx"

const objKeys = x =>
  x ? Object.keys(x) : []
const isObj = x =>
  x && typeof x === "object" && x.constructor === Object

const fromKey = (s$, key) =>
  s$.filter(s => s.key === key).map(s => s.val)

const fromKeys = (s$, ...keys) =>
  keys.reduce((o, k) => ({...o, [k]: fromKey(s$, k)}), {})

const withKey = (s$, key, ext = false) =>
  s$.map(val => ({key, val, ext}))

const withKeys = (objOfS$, ext = false) =>
  O.merge(objKeys(objOfS$).map(k => withKey(objOfS$[k], k, ext)))

const CommonSignalTransducers = {
  fromKeys,
  fromKey,
  withKeys,
  withKey
}


// drivers :: {A: () -> {s$, t, e}} -> {s$, t: {A: [t]}, e: {A: [e]}}
export const drivers = spec => {
  const mapValuesWhen = (obj, fn) =>
    objKeys(obj).reduce((o, k) => { let a = fn(obj[k]); return a ? ({...o, [k]: a}) : o}, {})

  if (!isObj(spec)) {
    throw new Error("Drivers must be an object of initializer functions")
  }
  const drivers =
    mapValuesWhen(spec, f => f())
  const signals =
    withKeys(mapValuesWhen(drivers, d => d.signals), true)
  const transducers = {
    signal: CommonSignalTransducers,
    ...mapValuesWhen(drivers, d => d.transducers)
  }
  const executors =
    mapValuesWhen(drivers, d => d.executor)
  return { signals, transducers, executors }
}

// run :: s$ -> (s$ -> {s$, o$}) -> o$
export const run = (input$, main) => {
  let lo = null
  const inputWithLoop$ = input$
    .filter(s => s.ext)
    .merge(O.create(o => (lo = o) && (() => lo = null)))
    .share()

  const {loop, out} = main(inputWithLoop$)
  const all$ = withKeys({loop: withKeys(loop), out: withKeys(out)})

  const output$ = O.create(out => {
    return all$.subscribe(
      ({key, val}) => key === "out" ? out.onNext(val) : (lo && lo.onNext(val)),
      error => out.onError(error),
      () => out.onCompleted()
    )
  })
  return fromKeys(output$.share(), ...objKeys(out))
}

const noopDispose = { dispose() {} }

// execute :: {A: o$ -> dispose} -> {A: o$} -> dispose
export const execute = (executors, output) => {
  if (objKeys(executors).length === 0) {
    throw new Error("At least one executor is required")
  }
  return new Rx.CompositeDisposable(...objKeys(output).map(key =>
    executors[key] ? executors[key](output[key]) || noopDispose : noopDispose
  ))
}

// for concise
export default (spec, main) => {
  const {signals: s, transducers: t, executors: e} = drivers(spec)
  return execute(e, run(s, main(t)))
}
