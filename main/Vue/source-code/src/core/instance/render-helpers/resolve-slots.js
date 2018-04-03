/* @flow */

import type VNode from 'core/vdom/vnode'

/**
 * Runtime helper for resolving raw children VNodes into a slot object.
 */
/**zh-cn
 * 运行时的辅助函数, 将raw children VNodes解析成slot对象
 */
export function resolveSlots (
  children: ?Array<VNode>,
  context: ?Component
): { [key: string]: Array<VNode> } {
  const slots = {}
  if (!children) {
    return slots
  }
  for (let i = 0, l = children.length; i < l; i++) {
    const child = children[i]
    const data = child.data
    // remove slot attribute if the node is resolved as a Vue slot node
    // 如果节点作为Vue的slot被解析的话, 就移除其slot属性
    // 后文通过data.slot去拿slot name
    if (data && data.attrs && data.attrs.slot) {
      delete data.attrs.slot
    }
    // named slots should only be respected if the vnode was rendered in the
    // same context.
    // 只有在相同的context中, 具名slots才应该被使用
    if ((child.context === context || child.fnContext === context) &&
      data && data.slot != null
    ) {
      const name = data.slot
      const slot = (slots[name] || (slots[name] = []))
      // 当为template时, 将此template的children全部push进我们的slot中
      if (child.tag === 'template') {
        slot.push.apply(slot, child.children || [])
      } else {
        slot.push(child)
      }
    } else {
      // 当slot名不存在, 或者context不同时候, push进default slots中(WHY 什么时候context会不同)
      (slots.default || (slots.default = [])).push(child)
    }
  }
  // ignore slots that contains only whitespace
  // 忽略仅仅包含空格的slots
  for (const name in slots) {
    if (slots[name].every(isWhitespace)) {
      delete slots[name]
    }
  }
  return slots
}

// 判断是否是空格
function isWhitespace (node: VNode): boolean {
  /**zh-cn
   * 俩种情况：
   * 1. 注释节点, 且其不是异步工厂占位符
   * 2. 其text为空格' '
   */
  return (node.isComment && !node.asyncFactory) || node.text === ' '
}

export function resolveScopedSlots (
  fns: ScopedSlotsData, // see flow/vnode
  res?: Object
): { [key: string]: Function } {
  res = res || {}
  for (let i = 0; i < fns.length; i++) {
    if (Array.isArray(fns[i])) {
      resolveScopedSlots(fns[i], res)
    } else {
      // scoped slot就是将其相对应
      res[fns[i].key] = fns[i].fn
    }
  }
  return res
}
