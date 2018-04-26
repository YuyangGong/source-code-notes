/* @flow */

import { warn } from 'core/util/index'

// v-on如果是用于对象, 如<button v-on="{ mousedown: doThis, mouseup: doThat }"></button>,
// 则不支持modifiers
export default function on (el: ASTElement, dir: ASTDirective) {
  if (process.env.NODE_ENV !== 'production' && dir.modifiers) {
    warn(`v-on without argument does not support modifiers.`)
  }
  el.wrapListeners = (code: string) => `_g(${code},${dir.value})`
}
