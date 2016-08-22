const curry2 = f => function curried2(a0, a1) {
  switch (arguments.length) {
    case 0:
    case 1:
      return (a1) => f(a0, a1)
    default:
      return f(a0, a1)
  }
}

const curry3 = f => function curried3(a0, a1, a2) {
  switch (arguments.length) {
    case 0:
    case 1:
      return curry2((a1, a2) => f(a0, a1, a2))
    case 2:
      return (a2) => f(a0, a1, a2)
    default:
      return f(a0, a1, a2)
  }
}

const curryN = f => {
  const curried = prev => function curriedN(...args) {
    const n = prev.length + args.length
    if (n >= f.length) {
      return f(...prev.concat(args))
    } else {
      return curried(prev.concat(args))
    }
  }
  return curried([])
}

const curry = f => {
  switch (f.length) {
    case 0:
    case 1:
      return f
    case 2:
      return curry2(f)
    case 3:
      return curry3(f)
    default:
      return curryN(f)
  }
}

export default curry
