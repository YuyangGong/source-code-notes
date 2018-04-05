/* @flow */

import VNode from '../vnode'
import { createFnInvoker } from './update-listeners'
import { remove, isDef, isUndef, isTrue } from 'shared/util'

export function mergeVNodeHook (def: Object, hookKey: string, hook: Function) {
  if (def instanceof VNode) {
    def = def.data.hook || (def.data.hook = {})
  }
  let invoker
  const oldHook = def[hookKey]

  function wrappedHook () {
    hook.apply(this, arguments)
    // important: remove merged hook to ensure it's called only once
    // and prevent memory leak
    // 移除已经merge的钩子去确保其只调用一次并且避免内存泄露
    // WHY 这里为什么要确保只调用一次? 钩子不是每次都有用么？
    remove(invoker.fns, wrappedHook)
  }

  if (isUndef(oldHook)) {
    // no existing hook
    // 当原本不存在钩子时
    // 这里用数组包一层是必须的, 需要包装invoker.fns为数组,
    // 后续需要对这个数组进行push和remove操作
    invoker = createFnInvoker([wrappedHook])
  } else {
    /* istanbul ignore if */
    if (isDef(oldHook.fns) && isTrue(oldHook.merged)) {
      // already a merged invoker
      // 当oldHook已经merge过时, 已经把包装后的新钩子push进调用器的fns数组中即可
      invoker = oldHook
      invoker.fns.push(wrappedHook)
    } else {
      // existing plain hook
      // 当存在oldHook且其没有merge过时,
      // 以oldHook和wrappedHook创建数组并生成调用器(Invoker)
      invoker = createFnInvoker([oldHook, wrappedHook])
    }
  }

  invoker.merged = true
  def[hookKey] = invoker
}
