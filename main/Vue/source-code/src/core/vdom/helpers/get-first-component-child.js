/* @flow */

import { isDef } from 'shared/util'
import { isAsyncPlaceholder } from './is-async-placeholder'

// 获取第一个子组件
export function getFirstComponentChild (children: ?Array<VNode>): ?VNode {
  if (Array.isArray(children)) {
    for (let i = 0; i < children.length; i++) {
      const c = children[i]
      // 已定义(即不为null或undefined), 或为异步组件占位符
      if (isDef(c) && (isDef(c.componentOptions) || isAsyncPlaceholder(c))) {
        return c
      }
    }
  }
}
