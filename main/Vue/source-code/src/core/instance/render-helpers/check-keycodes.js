/* @flow */

import config from 'core/config'
import { hyphenate } from 'shared/util'

/**
 * Runtime helper for checking keyCodes from config.
 * exposed as Vue.prototype._k
 * passing in eventKeyName as last argument separately for backwards compat
 */
/**zh-cn
 * 用于在运行时检查 config中keyCodes 的辅助函数
 * 暴露在Vue.prototype._k上
 * (为了向后兼容, 将eventKeyName作为最后一个参数传入)
 */
export function checkKeyCodes (
  eventKeyCode: number,
  key: string,
  builtInAlias?: number | Array<number>,
  eventKeyName?: string
): ?boolean {
  const keyCodes = config.keyCodes[key] || builtInAlias
  if (keyCodes) {
    if (Array.isArray(keyCodes)) {
      // keyCodes若是数组, 则检查是否存在于keyCodes数组中
      return keyCodes.indexOf(eventKeyCode) === -1
    } else {
      // 若不是数组(此时为字符串), 则判断是否相等
      return keyCodes !== eventKeyCode
    }
  } else if (eventKeyName) {
    // WHY:如果eventKeyName存在, 则断言其hyohenate后不等于key
    return hyphenate(eventKeyName) !== key
  }
}
