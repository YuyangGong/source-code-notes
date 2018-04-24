/* @flow */

import config from 'core/config'

import {
  warn,
  isObject,
  toObject,
  isReservedAttribute
} from 'core/util/index'

/**
 * Runtime helper for merging v-bind="object" into a VNode's data.
 */
/**zh-cn
 * 运行时的辅助函数, 用于归并v-bind="object", 到VNode的data中去。
 * eg: v-bind="{disabled: true, id: 'test-id', readonly: isReadonly(在当前模板vue实例中可以查询到的变量)}"
 * 此时的v-bind没有如v-bind:props中的props这种参数, 
 * 只是一种裸露的bind, 用于绑定一个对象,
 * 将其key作为attribute, 值为attribute的value
 */
export function bindObjectProps (
  data: any,
  tag: string,
  value: any,
  asProp: boolean,
  isSync?: boolean
): VNodeData {
  if (value) {
    if (!isObject(value)) {
      // 我们期望的传入是对象或数组
      process.env.NODE_ENV !== 'production' && warn(
        'v-bind without argument expects an Object or Array value',
        this
      )
    } else {
      // 如果是对象数组, 则归并为一个对象
      if (Array.isArray(value)) {
        value = toObject(value)
      }
      let hash
      for (const key in value) {
        // 如果是class style或者保留属性如key,ref,slot,slot-scope,is的话,
        // 则直接将其设置在data上(如果存在同名属性, 则会跳过, 不会覆盖)
        if (
          key === 'class' ||
          key === 'style' ||
          isReservedAttribute(key) // 包括key,ref,slot,slot-scope,is
        ) {
          hash = data
        } else {
          const type = data.attrs && data.attrs.type
          // mustUseProp判断是否是必须使用的prop, 根据平台而定。
          // 一般是直接使用data.attrs
          hash = asProp || config.mustUseProp(tag, type, key)
            ? data.domProps || (data.domProps = {})
            : data.attrs || (data.attrs = {})
        }
        // 不存在hash中才会设置, 也就是后续的props不会覆盖之前的,
        // 而编译器中会优先处理单个的非对象prop, 然后再来处理对象prop,
        // 而后续对象prop中如果出现了单个prop中出现过的prop, 将会跳过,
        // 不进行覆盖
        if (!(key in hash)) {
          hash[key] = value[key]

          // 如果设置了同步, 则绑定其data.on上面相关的函数`update:${key}`这种格式
          // 具体见[sync](https://cn.vuejs.org/v2/guide/components.html#sync-修饰符)
          if (isSync) {
            const on = data.on || (data.on = {})
            // 子组件$emit的时候, 需要传入新的值, 如`this.$emit('update:foo', newValue)`
            on[`update:${key}`] = function ($event) {
              value[key] = $event
            }
          }
        }
      }
    }
  }
  return data
}
