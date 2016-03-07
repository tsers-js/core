import Rx, {Observable as O} from "rx"

const keys = Object.keys

const fromKey = signal$ => key =>
  signal$.filter(s => s.key === key).map(s => s.value)

const input = signal$ => Object.assign(fromKey(signal$), {
  keys: (...keys) => keys.reduce((o, k) => ({...o, [k]: fromKey(signal$)(k)}), {})
})

const output = (output, local) =>
  O.merge(keys(output).map(key => output[key].map(val => ({val, key, local}))))


export default env => {
  const compact = (obj, fn) =>
    keys(obj).reduce((o, k) => { let a = fn(obj[k]); return a ? ({...o, [k]: a}) : o}, {})

  const drivers = compact(env, f => f())
  return {
    signals: output(compact(drivers, d => d.signals), false),
    transforms: compact(drivers, d => d.transforms),
    interpreters: compact(drivers, d => d.interpreter)
  }
}

export const run = (signal$, main) => {
  let sig = null
  const input$ = signal$
    .filter(s => !s.local)
    .merge(O.create(sink => sig = sink && (() => sig = null)))
    .share()

  const {signals: s, effects: e} = main(input(input$))
  const output$ = output({s: output(s, true), e: output(e)})

  const effect$ = O.create(eff => {
    return output$.subscribe(
      ({key, val}) => key === "e" ? eff.onNext(val) : sig && sig.onNext(val),
      error => eff.onError(error),
      () => eff.onCompleted()
    )
  })
  return input(effect$).keys(...keys(e))
}

export const interpret = (effect, interpreters) => {
  return new Rx.CompositeDisposable(...keys(effect).map(key =>
    interpreters[key] ? interpreters[key](effect[key]) : { dispose() {} }
  ))
}
