import * as O from "./obs"
import {doPipe as __, keys, isFun} from "./util"
import curry from "./curry"


export default curry(function mapIds(f, streamOfIds) {
  let index = {}, n = 0
  return __(streamOfIds,
    O.skipRepeats(idsEq),
    O.tapOnDispose(() => {
      n = 0
      keys(index).forEach(id => {
        disposeEntry(index[id])
        delete index[id]
      })
    }),
    O.map(ids => {
      const idxById = {}
      ids.forEach((id, idx) => idxById[id] = idx)
      // remove deleted entries
      keys(index).forEach(id => {
        if (!(id in idxById)) {
          disposeEntry(index[id])
          delete index[id]
          n--
        }
      })
      // add new entries or update already existing ones
      keys(idxById).forEach(id => {
        if (id in index) {
          index[id].idx = idxById[id]
        } else {
          index[id] = {id, idx: idxById[id], val: f(id)}
          n++
        }
      })
      // use index values from "index" to construct the resulting array
      const res = Array(n)
      keys(index).forEach(id => {
        const entry = index[id]
        res[entry.idx] = entry.obs
      })
      return res
    })
  )
})

const idsEq = (a, b) => {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false
  }
  return true
}

const disposeEntry = ({val}) => {
  val && isFun(val.dispose) && val.dispose()
}
