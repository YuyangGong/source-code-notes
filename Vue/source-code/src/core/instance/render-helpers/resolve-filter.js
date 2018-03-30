/* @flow */

import { identity, resolveAsset } from 'core/util/index'

/**
 * Runtime helper for resolving filters
 */
// 用于解析filters的运行时辅助函数
export function resolveFilter (id: string): Function {
  // 如果存在filter则照常返回， 不存在就返回identity函数(此函数返回其第一个参数自身)
  // 即如果我们使用filter时, 用到的filter是不存在的, 则返回自身
  // TODO: 这里需要加一句判断吧, 判断环境
  return resolveAsset(this.$options, 'filters', id, true) || identity
}
