import DOM from "../src/index"
import {run} from "@cycle/most-run"
import * as O from "most"


run(main, {
  DOM: DOM("#app")
})


function main({DOM: {h, lift}}) {
  const vdom = h("div", [
    "Tsers! ",
    Inc(1000)
  ])

  return {
    DOM: lift(vdom)
  }

  function Inc(t) {
    return O.periodic(t, 1)
      .scan((x, y) => x + y, 0)
      .map(n => n.toString())
  }
}

