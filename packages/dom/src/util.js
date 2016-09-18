// klass == object containing class names as keys and always true as
// values behind those keys
export const toKlass = (className) => {
  let i, list, c, klass = {}
  for (i = 0, list = (className || "").split(" "); i < list.length; i++) {
    if (c = list[i].trim()) klass[c] = true   // eslint-disable-line
  }
  return klass
}

export const isStr = x => typeof x === "string"
