import buble from "rollup-plugin-buble"
import nodeResolve from "rollup-plugin-node-resolve"

export default {
  entry: "src/index.js",
  dest: "dist/tsers.model.js",
  format: "umd",
  moduleName: "TSERS.Model",
  sourceMap: true,
  plugins: [
    buble(),
    nodeResolve({
      jsnext: true,
      main: true,
      browser: true
    })
  ]
}
