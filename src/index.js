import Rx, {Observable as O} from "rx"

const noop = () => undefined

const objKeys = x =>
  x ? Object.keys(x) : []

const extend = Object.assign

const isFun = x => typeof x === "function"
const isObj = x => typeof x === "object" && x.constructor === Object

const keyNotIn = keys => {
  const hash = keys.reduce((acc, k) => (acc[k] = true) && acc, {})
  return s => !hash[s.key]
}

const from = (in$, key) =>
  in$.filter(s => s.key === key).map(s => s.val)

const to = (out$, key) =>
  out$.map(val => ({key, val}))

const mapValuesWhen = (obj, fn) =>
  objKeys(obj).reduce((o, k) => {
    const a = fn(obj[k]);
    return a ? ((o[k] = a) && o) : o
  }, {})


export default function TSERS(main, interpreters) {
  if (!isObj(interpreters) || objKeys(interpreters).length === 0)
    throw new Error("Interpreters must be an object of initializer functions (at least one interpreter required)")

  const mapListById = mapListBy.bind(null, x => x.id)
  const CommonTransformers = {mux, demux, loop, mapListById, mapListBy, demuxCombined}
  const InterpreterImports = CommonTransformers
  const signalsAndExecutors = mapValuesWhen(interpreters, d => d(InterpreterImports))

  const input = {
    ...CommonTransformers,
    ...mapValuesWhen(signalsAndExecutors, d => d[0] || (!isFun(d) && d))
  }
  const executors =
    mapValuesWhen(signalsAndExecutors, d => d[1] || (isFun(d) && d))

  if (objKeys(executors).length === 0)
    throw new Error("At least one executor is required")

  const noopd = {dispose: noop}
  const out$ = main(input)
  if (!O.isObservable(out$))
    throw new Error("Main must return an Observable")
  const [out] = demux(out$, ...objKeys(interpreters))

  return new Rx.CompositeDisposable(objKeys(out).map(key =>
    executors[key] ? executors[key](out[key]) || noopd : noopd
  ))
}

export function mux(input, rest$) {
  const muxed$ = O.merge(...objKeys(input).map(k => to(input[k], k)))
  return rest$ ? muxed$.merge(rest$) : muxed$
}

export function demux(out$, ...keys) {
  const demuxed = keys.reduce((o, k) => (o[k] = from(out$, k)) && o, {})
  const rest$ = out$.filter(keyNotIn(keys))
  return [demuxed, rest$]
}

export function demuxCombined(list$$, ...keys) {
  const combine = k => list => list.length === 0 ? O.just([])
    : O.combineLatest(...list.map(out$ => from(out$, k)))
  const demuxed = keys.reduce((o, k) => (o[k] = list$$.flatMapLatest(combine(k)).shareReplay(1)) && o, {})
  const rest$ = list$$.flatMapLatest(list => O.merge(list.map(out$ => out$.filter(keyNotIn(keys))))).share()
  return [demuxed, rest$]
}

export function loop(input$, main) {
  let lo = null
  const in$ = input$
    .doOnCompleted(() => lo && lo.onCompleted() && (lo = null))
    .merge(O.create(o => (lo = o) && (() => lo = null)))
    .share()
  const [out$, loop$] = main(in$)
  return out$.merge(loop$.filter(val => lo && lo.onNext(val) && false)).share()
}

export function mapListBy(identity, list$, it) {
  return O.using(() => new Cache(), cache => {
    return list$
      .distinctUntilChanged(items => items.map(item => identity(item)), (a, b) => {
        if (a.length !== b.length) return false
        for (var i = 0; i < a.length; i++) {
          if (a[i] !== b[i]) return false
        }
        return true
      })
      .map(items => {
        const itemByKey = {}
        items.forEach((item, idx) => itemByKey[identity(item)] = {item, idx})
        items.forEach((item, idx) => {
          const key = identity(item)
          if (!cache.contains(key)) {
            const item$ = list$.map(findByIdentityEq(identity, key)).share()
            cache.put(key, it(key, item$), idx)
          } else {
            cache.update(key, idx, item)
          }
        })
        cache.keys().forEach(key => {
          if (!(key in itemByKey)) {
            cache.del(key)
          }
        })
        return cache.list()
      })
  }).shareReplay(1)

  function findByIdentityEq(identity, key) {
    return items => {
      for (var i = 0; i < items.length; i++) {
        if (identity(items[i]) === key) return items[i]
      }
    }
  }
}


function Cache() {
  this.cache = {}
}

extend(Cache.prototype, {
  contains(key) {
    return key in this.cache
  },
  put(key, output$, idx) {
    const out$ = output$.replay(null, 1)
    const disposable = out$.connect()
    this.cache[key] = {
      key,
      out$,
      disposable,
      idx
    }
  },
  update(key, idx) {
    this.cache[key].idx = idx
  },
  del(key) {
    const cached = this.cache[key]
    if (cached) {
      delete this.cache[key]
      cached.disposable.dispose()
    }
  },
  keys() {
    return objKeys(this.cache)
  },
  list() {
    const list = objKeys(this.cache).map(k => this.cache[k])
    list.sort((a, b) => a.idx - b.idx)
    return list.map(x => x.out$)
  },
  dispose() {
    objKeys(this.cache).forEach(key => {
      this.del(key)
    })
  }
})
