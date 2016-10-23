import * as Obs from "./obs"

export const O = Obs

export {default as curry} from "./curry"

export {
  isFun,
  isDef,
  isObj,
  isStr,
  isArray,
  pipe,
  comp,
  keys,
  extend,
  identity,
  always,
  zipObj,
  find,
  doPipe as __,
  defer,
  index,
  throws
} from "./util"

