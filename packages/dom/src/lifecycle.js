export default () => {
  // TODO: implement non-ES6 compatible version with objects
  const cache = new Map()
  window._cache = cache

  function link(vnode, parent) {
    vnode.p = parent
    return vnode
  }

  function mount(node) {
    //console.log("mount", node.id)
    cache.set(node.id, node)
  }

  function unmount(node) {
    //console.log("unmount", node.id)
    cache.delete(node.id)
  }

  function replace(prev, next) {
    //console.log("replace", prev.id, "->", next.id)
    cache.delete(prev.id)
    cache.set(next.id, next)
  }

  return {
    link, mount, unmount, replace
  }
}

