import Rx, {Observable as O} from "rx"

const keys = Object.keys

const fromKey = signal$ => key =>
  signal$.filter(s => s.key === key).map(s => s.val)


const mergeObj = (output, local = false) =>
  O.merge(keys(output).map(key => output[key].map(val => ({val, key, local}))))

export const signals = signal$ => ({
  of: fromKey(signal$),
  ofKeys: (...keys) => keys.reduce((o, k) => ({...o, [k]: fromKey(signal$)(k)}), {})
})

export const drivers = spec => {
  const compact = (obj, fn) =>
    keys(obj).reduce((o, k) => { let a = fn(obj[k]); return a ? ({...o, [k]: a}) : o}, {})

  const drivers = compact(spec, f => f())
  return {
    signals: mergeObj(compact(drivers, d => d.signals), false),
    transforms: compact(drivers, d => d.transforms),
    executors: compact(drivers, d => d.executor)
  }
}

export const run = (signal$, main) => {
  let loop = null
  const input$ = signal$
    .filter(s => !s.local)
    .merge(O.create(sink => (loop = sink) && (() => loop = null)))
    .share()

  const res = main(signals(input$))
  const all$ = mergeObj({in: mergeObj(res.in, true), out: mergeObj(res.out)})

  const output$ = O.create(out => {
    return all$.subscribe(
      ({key, val}) => key === "out" ? out.onNext(val) : (loop && loop.onNext(val)),
      error => out.onError(error),
      () => out.onCompleted()
    )
  })
  return signals(output$).ofKeys(...keys(res.out))
}

export const interpret = (effect, executors) => {
  return new Rx.CompositeDisposable(...keys(effect).map(key =>
    executors[key] ? executors[key](effect[key]) : { dispose() {} }
  ))
}

export default (main, spec) => {
  const {signals: s, transforms: t, executors: e} = drivers(spec)
  return interpret(run(s, main(t)), e)
}
