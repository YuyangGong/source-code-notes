/* @flow */

import { warn, extend, isPlainObject } from 'core/util/index'

// v-on 绑定监听对象, eg: v-on="{ mousedown: doThis, mouseup: doThat }"
export function bindObjectListeners (data: any, value: any): VNodeData {
  if (value) {
    if (!isPlainObject(value)) {
      // 仅仅支持普通对象
      process.env.NODE_ENV !== 'production' && warn(
        'v-on without argument expects an Object value',
        this
      )
    } else {
      // 如果存在data.on, 则借助extend浅拷贝一层, 否则先赋值空对象
      const on = data.on = data.on ? extend({}, data.on) : {}
      for (const key in value) {
        const existing = on[key]
        const ours = value[key]
        // 合并原本绑定的事件和目前需要绑定的事件
        on[key] = existing ? [].concat(existing, ours) : ours
      }
    }
  }
  return data
}
