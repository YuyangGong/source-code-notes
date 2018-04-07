/* @flow */

import { warn } from 'core/util/index'
import { cached, isUndef, isPlainObject } from 'shared/util'

const normalizeEvent = cached((name: string): {
  name: string,
  once: boolean,
  capture: boolean,
  passive: boolean,
  handler?: Function,
  params?: Array<any>
} => {
  // name中的`&~!`依次代表passive, once, capture
  // 为什么用charAt(0), 而不是直接[0], 而且0也可以省略(省一个字符)
  const passive = name.charAt(0) === '&'
  name = passive ? name.slice(1) : name
  const once = name.charAt(0) === '~' // Prefixed last, checked first
  name = once ? name.slice(1) : name
  const capture = name.charAt(0) === '!'
  name = capture ? name.slice(1) : name
  return {
    name,
    once,
    capture,
    passive
  }
})

// 创建函数调用器(Invoker),
// 并将需被调用的函数挂载在这个调用器的fns属性上
export function createFnInvoker (fns: Function | Array<Function>): Function {
  function invoker () {
    const fns = invoker.fns
    if (Array.isArray(fns)) {
      const cloned = fns.slice()
      for (let i = 0; i < cloned.length; i++) {
        cloned[i].apply(null, arguments)
      }
    } else {
      // return handler return value for single handlers
      // 单个handler的时候, 返回handler的返回值
      return fns.apply(null, arguments)
    }
  }
  invoker.fns = fns
  return invoker
}

// 更新listeners
export function updateListeners (
  on: Object,
  oldOn: Object,
  add: Function,
  remove: Function,
  vm: Component
) {
  let name, def, cur, old, event
  for (name in on) {
    def = cur = on[name]
    old = oldOn[name]
    event = normalizeEvent(name)
    /* istanbul ignore if */
    if (__WEEX__ && isPlainObject(def)) {
      cur = def.handler
      event.params = def.params
    }
    if (isUndef(cur)) {
      process.env.NODE_ENV !== 'production' && warn(
        `Invalid handler for event "${event.name}": got ` + String(cur),
        vm
      )
    } else if (isUndef(old)) {
      if (isUndef(cur.fns)) {
        cur = on[name] = createFnInvoker(cur)
      }
      // add和remove都是通过name判断的,
      // name又通过前缀的`&~!`来判断是否是passive, once, capture,
      // 每次修改了这三个修饰符, name也会变动, 被当做了另外的
      // 一种event了, 比如`&click`和`~click`虽然都绑定的click事件,
      // 但是修饰符不同, name也就不同, 挂载在on的不同属性上
      add(event.name, cur, event.once, event.capture, event.passive, event.params)
    } else if (cur !== old) {
      // 如果cur和old都存在, 只是不相等的话, 则直接通过修改旧的事件监听器,
      // 设置其fns为新事件监听器的handler
      old.fns = cur
      // WHY 这里为什么要赋值到on[name]上
      on[name] = old
    }
  }
  for (name in oldOn) {
    if (isUndef(on[name])) {
      event = normalizeEvent(name)
      remove(event.name, oldOn[name], event.capture)
    }
  }
}
