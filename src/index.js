import Rx, {Observable as O} from "rx"

const objKeys = x =>
  x ? Object.keys(x) : []

const isFun = x => typeof x === "function"
const isObj = x => typeof x === "object" && x.constructor === Object
const isArray = x => x && Array.isArray(x)
const isObs = x => x && x instanceof O

const noop = () => undefined

const keyNotIn = keys => {
  const hash = keys.reduce((acc, k) => ({...acc, [k]: true}), {})
  return s => !hash[s.key]
}

const from = (in$, key) =>
  in$.filter(s => s.key === key).map(s => s.val)

const to = (out$, key, ext) =>
  out$.map(val => ({key, val, ext}))

const mapValuesWhen = (obj, fn) =>
  objKeys(obj).reduce((o, k) => {
    let a = fn(obj[k]);
    return a ? ({...o, [k]: a}) : o
  }, {})


function TSERS(drivers) {
  if (!isObj(drivers) || objKeys(drivers).length === 0)
    throw new Error("Drivers must be an object of initializer functions (at least one driver required)")

  const decompose = (s$, ...keys) => {
    const decomposed = keys.reduce((o, k) => ({...o, [k]: from(s$, k)}), {})
    const rest$ = s$.filter(keyNotIn(keys))
    return [decomposed, rest$]
  }

  const compose = (objOf$, rest$) => {
    const composed$ = O.merge(...objKeys(objOf$).map(k => to(objOf$[k], k, true)))
    return rest$ ? composed$.merge(rest$) : composed$
  }

  const extract = from

  const lift = (val$$, ...keys) => {
    const res$ = val$$.switch().share()
    return decompose(res$, ...keys)
  }

  const liftArray = (arr$, it, ...keys) => {
    const out$$ = arr$.map(vals => vals.map(it)).share()
    const step = (obj, k) => ({
      ...obj,
      [k]: out$$.map(o => o.length ? O.combineLatest(...o.map(o$ => from(o$, k))) : O.just([])).switch().share()
    })
    const lifted = keys.reduce(step, {})
    const rest$ = out$$.map(o => O.merge(o)).switch().filter(keyNotIn(keys)).share()
    return [lifted, rest$]
  }

  const run = (input$, main) => {
    let lo = null
    const in$ = input$
      .filter(s => s.ext)
      .doOnCompleted(() => lo && lo.onCompleted() && (lo = null))
      .merge(O.create(o => (lo = o) && (() => lo = null)))
      .share()

    const result = main(in$)
    const out$ = (isArray(result) ? result[0] : result) || O.never()
    const loop$ = (isArray(result) ? result[1] : null) || O.never()
    return out$.merge(loop$.filter(val => lo && lo.onNext({...val, ext: false}) && false)).share()
  }

  const CommonTransducers = {compose, decompose, run, extract, lift, liftArray}
  const DriverImports = CommonTransducers
  const dds = mapValuesWhen(drivers, d => d(DriverImports))

  const executors =
    mapValuesWhen(dds, d => d[2] || (isFun(d) && d))

  if (objKeys(executors).length === 0) throw new Error("At least one executor is required")

  const T = {
    ...CommonTransducers,
    ...mapValuesWhen(dds, d => d[0] || (isObj(d) && d))
  }
  const S =
    compose(mapValuesWhen(dds, d => d[1] || (isObs(d) && d)))

  const E = function execute(output$) {
    const noopd = {dispose: noop}
    const [out] = decompose(output$, ...objKeys(executors))
    return new Rx.CompositeDisposable(...objKeys(out).map(key =>
      executors[key] ? executors[key](out[key]) || noopd : noopd
    ))
  }

  return [T, S, E] // R S
}

module.exports = TSERS
module.exports.default = TSERS
