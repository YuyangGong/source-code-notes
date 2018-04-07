/* @flow */

import {
  warn,
  once,
  isDef,
  isUndef,
  isTrue,
  isObject,
  hasSymbol
} from 'core/util/index'

import { createEmptyVNode } from 'core/vdom/vnode'

// 获取组件确切的构造函数对象
function ensureCtor (comp: any, base) {
  // 如果是通过esModule导出的, 则去拿其default获取确切的对象,
  // 因为在esModule中我们都是通过`export default { ... }`这种
  // 形式来导出组件对象的, 获取的话也需要通过导出对象的default
  // 去拿到我们实际需要的组件对象
  if (
    comp.__esModule ||
    // 如果环境支持Symbol类型的话, 我们会通过设置
    // 其Symbol.toStringTag(内置的symbol)为Module来区分是否是esModule
    // 给对象增添Symbol.toStringTag属性, 可以使得Object.prototype.toString
    // 返回自定义的`[object 定义的toStringTag值]`, 如
    // ```javascript
    //   const obj = {}
    //   obj[Symbol.toStringTag] = 'Test'
    //   Object.prototype.toString.call(obj) // [object Test]
    // ```
    // TODO: wrte post for it
    (hasSymbol && comp[Symbol.toStringTag] === 'Module')
  ) {
    comp = comp.default
  }
  return isObject(comp)
    ? base.extend(comp)
    : comp
}

// 创建异步组件的占位符
export function createAsyncPlaceholder (
  factory: Function,
  data: ?VNodeData,
  context: Component,
  children: ?Array<VNode>,
  tag: ?string
): VNode {
  const node = createEmptyVNode()
  // 工厂函数挂载在asyncFactory上, 元数据挂载在asyncMeta上
  node.asyncFactory = factory
  node.asyncMeta = { data, context, children, tag }
  return node
}

// 解析异步组件
// 实际用法可见[高级异步组件](https://cn.vuejs.org/v2/guide/components.html#高级异步组件)
export function resolveAsyncComponent (
  factory: Function,
  baseCtor: Class<Component>,
  context: Component
): Class<Component> | void {
  if (isTrue(factory.error) && isDef(factory.errorComp)) {
    return factory.errorComp
  }

  if (isDef(factory.resolved)) {
    return factory.resolved
  }

  if (isTrue(factory.loading) && isDef(factory.loadingComp)) {
    return factory.loadingComp
  }

  if (isDef(factory.contexts)) {
    // already pending
    // 已经挂起时
    factory.contexts.push(context)
  } else {
    const contexts = factory.contexts = [context]
    // 一个用来判断是不是处于同步代码的flag
    let sync = true
    // 函数, 用于强制所有context(上下文组件?感觉我这样翻译的不太恰当)
    // 重新渲染
    const forceRender = () => {
      for (let i = 0, l = contexts.length; i < l; i++) {
        contexts[i].$forceUpdate()
      }
    }

    // 这里的resolve,reject虽然和promise中的命名相同, 但其
    // 严格来讲并不是promise, 其没有state, 没有then和catch等原型方法,
    // 只是一个接受resolve,reject俩个回调的普通函数, 在resolve或reject
    // 执行时候, 强制触发视图的更新

    // 通过once函数, 确保resolve和reject只执行一次
    const resolve = once((res: Object | Class<Component>) => {
      // cache resolved
      // 缓存resolved, 后面的error loading timeout等逻辑中都会用到
      // WHY 这里是如何更新视图的呢？对factory设置了setter么？
      // 下面的error也是，强制更新的时候会去查询factory上的resolved
      // 以及error么？
      factory.resolved = ensureCtor(res, baseCtor)
      // invoke callbacks only if this is not a synchronous resolve
      // (async resolves are shimmed as synchronous during SSR)
      // 异步resolve时强制更新(同步时无需强制更新, 其会自动触发视图渲染)
      // (在SSR中, 异步resolve是基于同步实现的)
      if (!sync) {
        forceRender()
      }
    })

    const reject = once(reason => {
      process.env.NODE_ENV !== 'production' && warn(
        `Failed to resolve async component: ${String(factory)}` +
        (reason ? `\nReason: ${reason}` : '')
      )
      if (isDef(factory.errorComp)) {
        factory.error = true
        forceRender()
      }
    })

    const res = factory(resolve, reject)

    if (isObject(res)) {
      if (typeof res.then === 'function') {
        // () => Promise
        // 当factory为`() => Promise`这种情况, 
        // res拿到的则是一个Promise, 
        // 我们将resolve,reject作为回调传入其then中
        if (isUndef(factory.resolved)) {
          res.then(resolve, reject)
        }
      // 处理`() => ({component: import('xxxx')/* 返回一个promise */, loading: xxx})`这种情况
      } else if (isDef(res.component) && typeof res.component.then === 'function') {
        res.component.then(resolve, reject)

        if (isDef(res.error)) {
          factory.errorComp = ensureCtor(res.error, baseCtor)
        }

        if (isDef(res.loading)) {
          factory.loadingComp = ensureCtor(res.loading, baseCtor)
          if (res.delay === 0) {
            factory.loading = true
          } else {
            setTimeout(() => {
              // 如果delay的时间内已经resolved或throw error了, 则不会显示loading icon
              if (isUndef(factory.resolved) && isUndef(factory.error)) {
                factory.loading = true
                forceRender()
              }
            }, res.delay || 200)
          }
        }

        if (isDef(res.timeout)) {
          setTimeout(() => {
            if (isUndef(factory.resolved)) {
              reject(
                process.env.NODE_ENV !== 'production'
                  ? `timeout (${res.timeout}ms)`
                  : null
              )
            }
          }, res.timeout)
        }
      }
    }

    sync = false
    // return in case resolved synchronously
    // 用于同步resolved
    return factory.loading
      ? factory.loadingComp
      : factory.resolved
  }
}
