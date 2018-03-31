/* @flow */

/**
 * Runtime helper for rendering static trees.
 */
/**zh-cn
 * 运行时用于渲染静态树的辅助函数
 */
export function renderStatic (
  index: number,
  isInFor: boolean
): VNode | Array<VNode> {
  const cached = this._staticTrees || (this._staticTrees = [])
  let tree = cached[index]
  // if has already-rendered static tree and not inside v-for,
  // we can reuse the same tree.
  // 如果存在已经渲染的静态树 并且 不再v-for中
  // 我们可以直接复用
  if (tree && !isInFor) {
    return tree
  }
  // otherwise, render a fresh tree.
  // 否则, 渲染一颗"新鲜"的树
  tree = cached[index] = this.$options.staticRenderFns[index].call(
    this._renderProxy,
    null,
    this // for render fns generated for functional component templates
  )
  markStatic(tree, `__static__${index}`, false)
  return tree
}

/**
 * Runtime helper for v-once.
 * Effectively it means marking the node as static with a unique key.
 */
/**zh-cn
 * 用于v-once的运行时辅助函数
 * 事实上这意味着用一个唯一的Key标记节点为静态节点
 */
export function markOnce (
  tree: VNode | Array<VNode>,
  index: number,
  key: string
) {
  markStatic(tree, `__once__${index}${key ? `_${key}` : ``}`, true)
  return tree
}

// 设置数组中的全部节点 或 某个单个节点 为静态Node
function markStatic (
  tree: VNode | Array<VNode>,
  key: string,
  isOnce: boolean
) {
  if (Array.isArray(tree)) {
    for (let i = 0; i < tree.length; i++) {
      // WHY 什么情况下会为string呢?
      if (tree[i] && typeof tree[i] !== 'string') {
        markStaticNode(tree[i], `${key}_${i}`, isOnce)
      }
    }
  } else {
    markStaticNode(tree, key, isOnce)
  }
}

// 标记为静态节点
function markStaticNode (node, key, isOnce) {
  node.isStatic = true
  node.key = key
  node.isOnce = isOnce
}
