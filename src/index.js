import Rx, {Observable as O} from "rx"

const objKeys = x =>
  x ? Object.keys(x) : []

const isObj = x => typeof x === "object" && x.constructor === Object

const noop = () => {
}

const mapValuesWhen = (obj, fn) =>
  objKeys(obj).reduce((o, k) => {
    let a = fn(obj[k]);
    return a ? ({...o, [k]: a}) : o
  }, {})


function TSERS(drivers) {
  if (!isObj(drivers)) throw new Error("Drivers must be an object of initializer functions")
  const driverKeys = objKeys(drivers)
  if (driverKeys.length === 0) throw new Error("At least one driver is required")

  const from = (in$, key) =>
    in$.filter(s => s.key === key).map(s => s.val)

  const fromMany = (in$, ...keys) =>
    keys.reduce((o, k) => ({...o, [k]: from(in$, k)}), {})

  const to = (out$, key, ext = false) =>
    out$.map(val => ({key, val, ext}))

  const toMany = (objOf$, ext = false) =>
    O.merge(...objKeys(objOf$).map(k => to(objOf$[k], k, ext)))

  const decompose = (out$, ...extraKeys) =>
    fromMany(out$, ...[...driverKeys, ...extraKeys])

  const compose = objOf$ => toMany(objOf$, true)

  const loop = (in$, main) => {
    let lo = null
    const loop$ = in$
      .filter(s => s.ext)
      .doOnCompleted(() => lo && lo.onCompleted() && (lo = null))
      .merge(O.create(o => (lo = o) && (() => lo = null)))
      .share()

    const [looped$, out$] = main(loop$)
    const all$ = compose({lo: looped$ || O.never(), out: out$ || O.never()})

    return O.create(out => {
      return all$.subscribe(
        ({key, val}) => key === "out" ? out.onNext(val) : (lo && lo.onNext(val)),
        error => out.onError(error),
        () => out.onCompleted()
      )
    }).share()
  }

  const run = (in$, main, ...extraKeys) =>
    decompose(loop(in$, main), ...extraKeys)


  const CommonTransducers = {from, fromMany, to, toMany, compose, decompose, loop, run}
  const DriverImports = CommonTransducers
  const dds = mapValuesWhen(drivers, d => d(DriverImports))

  const T = {
    ...CommonTransducers,
    ...mapValuesWhen(dds, d => d.transducers)
  }
  const S =
    compose(mapValuesWhen(dds, d => d.signals))

  const executors =
    mapValuesWhen(dds, d => d.executor)

  if (objKeys(executors).length === 0) throw new Error("At least one executor is required")

  const E = function execute(output$) {
    const noopd = {dispose: noop}
    const out = decompose(output$)
    return new Rx.CompositeDisposable(...objKeys(out).map(key =>
      executors[key] ? executors[key](out[key]) || noopd : noopd
    ))
  }

  return [T, S, E] // R S
}

module.exports = TSERS
module.exports.default = TSERS
