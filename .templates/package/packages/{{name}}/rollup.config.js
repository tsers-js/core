import buble from "rollup-plugin-buble"
import nodeResolve from "rollup-plugin-node-resolve"

export default {
  entry: "lib/index.js",
  dest: "dist/tsers.{{name}}.js",
  format: "umd",
  moduleName: "{{! moduleName # CommonJS module name}}",
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
