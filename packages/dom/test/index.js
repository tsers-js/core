import DOM from "../src/index"
import {run} from "@cycle/most-run"
import {O} from "@tsers/core"
import * as most from "most"


let s

function START_PERF() {
  console.log("start perf")
  s = performance.now()
}

run(main, {
  DOM: DOM("#app")
})

setTimeout(function END_PERF() {
  console.log("end perf", performance.now() - s, "ms")
}, 100)


function main({DOM: {h, lift}}) {
  //const vdom = h("div", ["tsers!"])
  //const vdom = h("div", ["tsers: ", Timer(100)])
  //const vdom = h("div", Inc(100))
  const vdom = h("table", [
    h("tbody", most.mergeArray([O.of([]).tap(START_PERF), BigList(10000, 1000).delay(1)]).tap(() => console.log("asd")))
  ])

  return {
    DOM: lift(vdom)
  }

  function Inc(t) {
    return O.periodic(t, 1)
      .scan((x, y) => x + y, 0)
      .map(n => [
        "INC: ",
        n.toString()
      ])
  }

  /*
   <tr className={id === selected ? 'danger' : ''} childrenType={ ChildrenTypes.NON_KEYED }>
   <td className="col-md-1" childrenType={ ChildrenTypes.TEXT }>{id}</td>
   <td className="col-md-4" childrenType={ ChildrenTypes.NODE }>
   <a onClick={clickEvent} value={{func: selectFunc, id}} childrenType={ ChildrenTypes.TEXT }>{d.label}</a>
   </td>
   <td className="col-md-1"><a onClick={clickEvent} value={{func: deleteFunc, id}}><span className="glyphicon glyphicon-remove" aria-hidden="true"></span></a></td>
   <td className="col-md-6"></td>
   </tr>
   */

  function BigList(n, t) {
    console.log("big")
    const l = []
    //l.push(Timer(t).map(x => `timer: ${x}`))
    for (let i = 0; i < n; i++) {
      l.push(O.of(h("tr", [
        h("td", `id-${i}`),
        h("td", [
          h("a", `row ${i}`)
        ]),
        h("td", [
          h("a", [h("span", [])])
        ]),
        h("td", [])
      ])))
    }
    return O.combine(l)
  }

  function Timer(t) {
    return most.periodic(t, 1)
      .scan((x, y) => x + y, 0)
      .map(n => n.toString())
  }
}

