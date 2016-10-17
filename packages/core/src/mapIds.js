import * as O from "./obs"
import {doPipe as __, keys, isFun} from "./util"
import curry from "./curry"


export default curry(function mapIds(f, streamOfIds) {
  const index = {
    entries: {},
    n: 0
  }
  return __(streamOfIds,
    O.skipRepeats(idsEq),
    O.tapOnDispose(() => {
      let {entries} = index, k = keys(entries), i = k.length
      index.n = 0
      index.entries = {}
      while (i--) {
        const id = k[i]
        disposeEntry(entries[id])
      }
    }),
    O.map(({list: ids, index: idxById}) => {
      const {entries} = index
      let k = keys(entries), i = k.length, res = Array(ids.length), id, entry
      // remove deleted entries
      while (i--) {
        id = k[i]
        if (!(id in idxById)) {
          disposeEntry(entries[id])
          delete entries[id]
          --index.n
        }
      }
      // add new entries to index and construct return value array
      // at the same time
      (k = ids) && (i = k.length)
      while (i--) {
        id = k[i]
        if (id in entries) {
          entry = entries[id]
        } else {
          entry = entries[id] = f(id)
          ++index.n
        }
        res[i] = entry
      }
      return res
    })
  )
})

const idsEq = ({list: a}, {list: b}) => {
  if (a.length !== b.length) return false
  let i = a.length
  while (i--) {
    if (a[i] !== b[i]) return false
  }
  return true
}

const disposeEntry = entry => {
  entry && isFun(entry.dispose) && entry.dispose()
}
