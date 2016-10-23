import {O, keys, isArray, throws} from "@tsers/core"

const NONE = {}

const DEV = process.env.NODE_ENV === "development"

/**
 * Source for combinator:
 *
 *  Stream<[Item]> -> (Item -> string) -> (Stream<Item> -> {[string]: Stream<A>}) -> Stream<{[string]: A}>
 *
 */
export class MapChildrenSource {
  constructor(source, ident, fn, valueSinks, eventSinks) {
    this.source = source
    this.sink = null
    this.ident = ident
    this.fn = fn
    this.vs = valueSinks
    this.es = eventSinks
  }

  run(sink, scheduler, name, isValue) {
    const mcsink = this.sink = this._sink(scheduler)
    return mcsink.addSink(sink, name, isValue)
  }

  _sink(scheduler) {
    return this.sink || new MapChildrenSink(this, scheduler, this.ident, this.fn, this.vs, this.es)
  }
}

/**
 * Source for combinator:
 *
 *  Stream<{[string]: A}> -> string -> Stream<A>
 *
 */
export class CycleSinkExtractSource {
  constructor(source, name, isValue) {
    this.source = source
    this.name = name
    this.isVal = isValue
  }

  run(sink, scheduler) {
    return this.source.run(sink, scheduler, this.name, this.isVal)
  }
}

/**
 * This sink coordinates the whole process from array of items to final
 * events. It works in two phases:
 *
 *  1) It receives an event containing an array of items (with string based
 *     identity) and creates `Item`s for each item. This sink also keeps record
 *     of previous `Item`s so that if the item with the specific key already
 *     exists, then it's being updated instead of created. So pseudo code:
 *
 *       if (key(item) in record) {
 *         update(get(key(item), record), item)
 *       } else {
 *         set(key(item), record, new Item(item))
 *         create(get(key(item), record))
 *       }
 *
 *  2) When item is created it starts emitting values with name (e.g. DOM, HTTP,
 *     ...). There are two types of emissions: "values" and "events". "Values" are
 *     continous over time, which means that if one item emits such, cached
 *     values from all other items are concatenated and the resulting array
 *     is emitted forward (= combine). "Events" are discrete emissions that
 *     doesn't need concatenation, they're emitted forward as they are
 *     (= merge). Pseudo code:
 *
 *       eventName = getName(event)
 *       if (type(event) === "Value") {
 *         cache(getValue(event), getItem(event))
 *         if (forall(hasValue(eventName), items)) {
 *           emit({val: map(getValue(eventName), items), name: eventName})
 *         }
 *       } else {
 *         emit({val: getValue(event), name: eventName})
 *       }
 *
 */
class MapChildrenSink {
  constructor(source, scheduler, ident, fn, valueSinks, eventSinks) {
    this.src = source
    // scheduler that is needed for further emissions (when items are being created)
    this.scheduler = scheduler
    // this disposable comes from parent source when the first sink is being added
    this.disposable = null
    // identity and transform functions for children
    this.ident = ident
    this.fn = fn
    // number of active sinks, per name (e.g. "DOM", "HTTP")
    this.activeSinks = 0
    // active sinks (most sinks, having {event, error, end})
    this.sinks = {}
    // cache containing the state of this sink: items (1st phase) that are live and their
    // result values (2nd phase) by name. using also index by item keys for fast diffs
    this.cache = null
    this.cacheIdx = {}
    // number of pending items for "value" type sinks by name (e.g. "DOM", "HTTP")
    this.nPending = zeroCounters(valueSinks)
    // queue for events, errors and end events that might occur during 1st phase item updates
    this.queue = []
    this.vs = valueSinks
    this.es = eventSinks
  }

  /**
   * Adds sink by given name (e.g. HTTP, DOM) and starts the underlying source.
   * NOTE: all added sinks are either multicast or hold so ONLY ONE sink will be
   * added per name.
   */
  addSink(sink, name, isValue) {
    DEV && this.sinks[name] && throws("Invariant violation: sink already exists " + name)
    this.sinks[name] = sink
    if (++this.activeSinks === 1) {
      this.disposable = this.src.source.run(this, this.scheduler)
    } else if (isValue) {
      this._trySendValues(name)
    }
    return new MCDisposable(this, name)
  }

  /**
   * Called by MCDisposable
   */
  removeSink(name) {
    DEV && !this.sinks[name] && throws("Invariant violation: removed sinks didn't exist anymore " + name)
    delete this.sinks[name]
    if (--this.activeSinks === 0) {
      this.src.sink = null
      this.disposable.dispose()
      this.disposable = null
    }
  }

  /**
   * This function is called when source stream emits an array of items
   * @param t
   * @param items
   */
  event(t, items) {
    DEV && !isArray(items) && throws("mapChildren model must be an observable of array, instead got " + items)

    // mark update as started
    this.cache = null
    // do updates
    const {nextCache, nextIdx, orderChanged} = this._updateCaches(t, items)
    // mark update as ended
    this.cacheIdx = nextIdx
    this.cache = nextCache

    orderChanged && this._resendAllReadyValues()
    this._sendQueuedUpdates()
  }

  error(t, err) {
    let {sinks} = this, k = keys(sinks), i = k.length
    while (i--) sinks[k[i]].error(t, err)
  }

  end() {
    DEV && throws("Model should not end")
  }

  itemEvent(t, val, name, idx) {
    const {cache} = this
    if (cache === null) {
      this.q.push({type: "event", t, val, name, idx})
    } else if (idx !== -1) {
      this._handleValue(t, val, name, cache[idx])
    } else {
      this._emitEvent(t, val, name)
    }
  }

  itemError(t, err, name) {
    const {cache, sinks: {[name]: sink}} = this
    if (cache === null) {
      this.q.push({type: "error", t, err, name})
    } else {
      sink && sink.error(t, err)
    }
  }

  /**
   * This method adds value to cache and if all items have a value
   * in the cache, then this emits those values (as array) to the
   * next sink.
   */
  _handleValue(t, val, name, {result}) {
    !(name in result) && --this.nPending[name]
    result[name] = val
    if (this.nPending[name] === 0) {
      this._emitValue(t, name)
    }
  }

  _emitValue(t, name) {
    const {cache, sinks: {[name]: sink}} = this
    if (sink) {
      let i = cache.length, val = Array(i)
      while (i--) {
        val[i] = cache[i].result[name]
      }
      sink.event(t, val)
    }
  }

  _emitEvent(t, val, name) {
    const sink = this.sinks[name]
    sink && sink.event(t, val)
  }

  _updateCaches(t, items) {
    const {ident, fn, scheduler, cacheIdx, vs: valueSinks, es: eventSinks} = this
    let nItems = items.length
    let nextCache = Array(nItems)
    let nextIdx = {}
    let orderChanged = false

    // add new items or update existing ones
    for (let idx = 0, cached; idx < nItems; idx++) {
      const item = items[idx]
      const key = ident(item)
      if ((cached = cacheIdx[key])) {
        orderChanged = orderChanged || cached.item.i !== idx
        nextCache[idx] = cached
        cached.item.update(t, idx, item)
      } else {
        this._inc()
        cached = nextCache[idx] = {item: new Item(this), result: {}}
        cached.item.start(scheduler, t, idx, item, key, fn, valueSinks, eventSinks)
      }
      nextIdx[key] = cached
    }

    // dispose removed items
    const oldKeys = keys(cacheIdx)
    for (let i = 0, n = oldKeys.length; i < n; i++) {
      const key = oldKeys[i]
      if (!(key in nextIdx)) {
        orderChanged = true
        this._dec(cacheIdx[key])
        cacheIdx[key].item.dispose(t)
      }
    }

    return {nextCache, nextIdx, orderChanged}
  }

  _sendQueuedUpdates() {
    const {queue} = this
    const n = queue.length
    if (n) {
      this.queue = []
      for (let i = 0; i < n; i++) {
        this._sendQueued(queue[i])
      }
    }
  }

  _sendQueued(delivery) {
    const {t, type, name} = delivery
    switch (type) {
      case "event":
        return this.itemEvent(t, delivery.val, name, delivery.idx)
      case "error":
        return this.itemError(t, delivery.err, name)
      case "end":
        return this.itemEnd(t, name, delivery.idx)
    }
  }

  _inc() {
    const {vs: valueSinks} = this
    for (let i = 0, n = valueSinks.length; i < n; i++) {
      ++this.nPending[valueSinks[i]]
    }
  }

  _dec({result}) {
    const {vs: valueSinks} = this
    for (let i = 0, n = valueSinks.length; i < n; i++) {
      const name = valueSinks[i]
      !(name in result) && --this.nPending[name]
    }
  }

  /**
   * If items are re-ordered then try to send the changed
   * order from values.
   */
  _resendAllReadyValues() {
    const {vs: valueSinks} = this
    for (let i = 0, n = valueSinks.length; i < n; i++) {
      this._trySendValues(valueSinks[i])
    }
  }

  _trySendValues(name) {
    if (this.cache && this.nPending[name] === 0) {
      this._emitValue(this.scheduler.now(), name)
    }
  }
}


/**
 * Item is like Inner sink in swich map instead it emits multiple different
 * events, by their name (e.g. DOM, HTTP...). Those events are passed back
 * to the parent MapChildrenSink via itemEnd/Error/Event function.
 *
 * This also handles the inner subscriptions to all child (cycle) sinks.
 */
class Item {
  constructor(mcSink) {
    this.mc = mcSink
    this.t = -1           // timestamp
    this.v = NONE         // value
    this.i = 0            // index
    this.d = null         // disposable
    this.task = null
    this.sink = null
  }

  start(scheduler, t, idx, val, key, fn, valueSinks, eventSinks) {
    this.t = t
    this.v = val
    this.i = idx
    this.d = subscribeAll(this, fn(O.fromSource(this), key), scheduler, valueSinks, eventSinks)
  }

  update(t, idx, item) {
    this.i = idx
    this.t = t
    if (item !== this.v) {
      this.v = item
      this.sink && this.sink.event(t, item)
    }
  }

  /**
   * This run method is called when item is being started. This happens when we are
   * executing .start method (subscribeAll) because that propagates the subscription
   * chain back to source (which is this instance!)
   */
  run(sink, scheduler) {
    DEV && this.sink && throws("Item subscription already created")
    this.sink = sink
    return scheduler.asap(this.task = new ItemTask(this))
  }


  /**
   * Called by NamedSink when child component emits a value
   */
  event(t, val, name, isValue) {
    this.mc && this.mc.itemEvent(t, val, name, isValue ? this.i : -1)
  }

  /**
   * Called by NamedSink when child component emits an error
   */
  error(t, err, name) {
    this.mc && this.mc.itemError(t, err, name)
  }

  dispose(t) {
    const {sink, d: disposable} = this
    this.sink = this.d = this.mc = null
    sink && sink.end(t)
    disposable.dispose()
  }

  /**
   * Called by scheduler when task is acutally run
   */
  _started() {
    const {sink, t, v} = this
    if (sink && v !== NONE) {
      sink.event(t, v)
    }
  }
}

class ItemTask {
  constructor(item) {
    this.it = item
  }

  run() {
    this.it._started()
  }
}


class NamedSink {
  constructor(sink, name, isValueType) {
    this.n = name
    this.s = sink
    this.vt = isValueType
  }

  event(t, val) {
    this.s.event(t, val, this.n, this.vt)
  }

  error(t, err) {
    this.s.error(t, err, this.n)
  }

  end() {
    // end propagation not supported at the moment because
    // parent model does not end in any way...
  }
}


class MultiDisposable {
  constructor(disposables) {
    this.d = disposables
  }

  dispose() {
    const {d} = this
    this.d = []
    let i = d.length
    while (i--) d[i].dispose()
  }
}


class MCDisposable {
  constructor(sink, name) {
    this.sink = sink
    this.name = name
  }

  dispose() {
    const {sink, name} = this
    if (sink) {
      this.sink = null
      sink.removeSink(name)
    }
  }
}

function zeroCounters(valueSinks) {
  const p = {}
  valueSinks.forEach(name => p[name] = 0)
  return p
}

function subscribeAll(next, cycleSinks, scheduler, valueSinks, eventSinks) {
  const disposables = []
  subs(valueSinks, O.of(undefined), true)
  subs(eventSinks, O.empty(), false)
  return new MultiDisposable(disposables)

  function subs(sinkNames, fallback, isValue) {
    sinkNames.forEach(name => {
      const cs = cycleSinks[name] || fallback
      disposables.push(cs.source.run(new NamedSink(next, name, isValue), scheduler))
    })
  }
}
