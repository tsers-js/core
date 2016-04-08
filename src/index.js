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

export default function TSERS(ObservableImpl, main, interpreters) {
  const O = ObservableImpl && ObservableImpl.TSERS
  if (!O)
    throw new Error("The given Observable bindings are not TSERS compatible")
  if (!isObj(interpreters) || objKeys(interpreters).length === 0)
    throw new Error("Interpreters must be an object of initializer functions (at least one interpreter required)")

  const CommonTransformers = {
    ...mapValuesWhen({mux, demux, demuxCombined, loop, mapListBy}, t => t(O)),
    mapListById: mapListBy(O).bind(null, x => x.id)
  }
  const InterpreterImports = {...CommonTransformers, O}
  const signalsAndExecutors = mapValuesWhen(interpreters, d => d(InterpreterImports))

  const input = {
    ...CommonTransformers,
    ...mapValuesWhen(signalsAndExecutors, d => d[0] || (!isFun(d) && d))
  }
  const executors =
    mapValuesWhen(signalsAndExecutors, d => d[1] || (isFun(d) && d))

  if (objKeys(executors).length === 0)
    throw new Error("At least one executor is required")

  const out$ = main(input)
  if (!O.is(out$))
    throw new Error("Main must return an Observable")
  const [out] = demux(O)(out$, ...objKeys(interpreters))
  const disposes = objKeys(out).map(key => executors[key] && executors[key](out[key]))
  return O.disposeMany(disposes.filter(d => d))
}

export const mux = O => (input, rest$) => {
  rest$ = rest$ && new O(rest$)
  const muxed$ = O.merge(objKeys(input).map(k => to(new O(input[k]), k)))
  return (rest$ ? O.merge([muxed$, rest$]) : muxed$).return()
}

export const demux = O => (out$, ...keys) => {
  out$ = (new O(out$)).multicast()
  const demuxed = keys.reduce((o, k) => (o[k] = from(out$, k).return()) && o, {})
  const rest$ = out$.filter(keyNotIn(keys))
  return [demuxed, rest$.return()]
}

export const demuxCombined = O => (list$$, ...keys) => {
  list$$ = new O(list$$)
  const combine = k => list => O.combine(list.map(out$ => from(new O(out$), k)))
  const demuxed = keys.reduce((o, k) => (o[k] = list$$.flatMapLatest(combine(k)).toProperty().return()) && o, {})
  const rest$ = list$$.flatMapLatest(list => O.merge(list.map(out$ => new O(out$).filter(keyNotIn(keys)))))
  return [demuxed, rest$.return()]
}

export const loop = O => (input$, main) => {
  input$ = new O(input$)
  let lo = null
  const in$ = O.merge([
    input$,
    O.create(o => (lo = o) && (() => lo = null))
  ])
  const [out$, loop$] = main(in$.return()).map(o => new O(o))
  const lo$ = loop$
    .doOnCompleted(() => lo && lo.completed())
    .filter(val => lo && lo.next(val) && false)
  return O.merge([out$, lo$]).return()
}

export const mapListBy = O => (identity, list$, it) => {
  const res$ = O.create(o => {
    const cache = new Cache()
    const indexed$ = new O(list$)
      .map(items => ({
        list: items,
        byKey: items.reduce((o, item, idx) => (o[identity(item)] = {item, idx}) && o, {})
      }))
      .toProperty()

    const cached$ = indexed$
      .skipDuplicates(({list: a}, {list: b}) => {
        if (a.length !== b.length) return false
        for (var i = 0; i < a.length; i++) {
          if (identity(a[i]) !== identity(b[i])) return false
        }
        return true
      })
      .map(x => {
        const items = x.list
        const itemByKey = x.byKey
        items.forEach((item, idx) => {
          const key = identity(item)
          if (!cache.contains(key)) {
            const item$ = indexed$.map(x => x.byKey[key]).return()
            cache.put(key, new O(it(key, item$)), idx)
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
    o.next(cached$)
    return () => cache.dispose()
  })

  return res$
    .flatMapLatest(x => x)
    .toProperty()
    .return()
}


function Cache() {
  this.cache = {}
}

extend(Cache.prototype, {
  contains(key) {
    return key in this.cache
  },
  put(key, output$, idx) {
    const [out$, dispose] = output$.hot(true)
    this.cache[key] = {
      key,
      out$: out$.return(),
      dispose,
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
      cached.dispose()
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
