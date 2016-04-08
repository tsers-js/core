import Rx from "@tsers/rx"
import TSERS, * as T from "../src/index"

const O = Rx.TSERS

export default function RxTSERS(main, interpreters) {
  return TSERS(Rx, main, interpreters)
}

export const mux = T.mux(O)
export const demux = T.demux(O)
export const demuxCombined = T.demuxCombined(O)
export const loop = T.loop(O)
export const mapListBy = T.mapListBy(O)
