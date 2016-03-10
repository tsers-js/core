import Rx, {Observable as O} from "rx"

const objKeys = x =>
  x ? Object.keys(x) : []

const isObj = x => typeof x === "object" && x.constructor === Object

const isArray = x => x && Array.isArray(x)

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

  const compose = (objOf$, rest$, ext = false) => {
    const composed$ = O.merge(...objKeys(objOf$).map(k => to(objOf$[k], k, ext)))
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

  const run = (in$, main) => {
    let lo = null
    const loop$ = in$
      .filter(s => s.ext)
      .doOnCompleted(() => lo && lo.onCompleted() && (lo = null))
      .merge(O.create(o => (lo = o) && (() => lo = null)))
      .share()

    const res = main(loop$)
    const out$ = isArray(res) ? res[0] : res
    const looped$ = isArray(res) ? res[1] : undefined
    const all$ = compose({lo: looped$ || O.never(), out: out$ || O.never()})

    return O.create(out => {
      return all$.subscribe(
        ({key, val}) => key === "out" ? out.onNext(val) : (lo && lo.onNext(val)),
        error => out.onError(error),
        () => out.onCompleted()
      )
    }).share()
  }

  const CommonTransducers = {compose, decompose, run, extract, lift, liftArray}
  const DriverImports = CommonTransducers
  const dds = mapValuesWhen(drivers, d => d(DriverImports))

  const T = {
    ...CommonTransducers,
    ...mapValuesWhen(dds, d => d.transducers)
  }
  const S =
    compose(mapValuesWhen(dds, d => d.signals), null, true)

  const executors =
    mapValuesWhen(dds, d => d.executor)

  if (objKeys(executors).length === 0) throw new Error("At least one executor is required")

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
