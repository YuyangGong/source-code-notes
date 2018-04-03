/* @flow */

import {
  warn,
  nextTick,
  emptyObject,
  handleError,
  defineReactive
} from '../util/index'

import { createElement } from '../vdom/create-element'
import { installRenderHelpers } from './render-helpers/index'
import { resolveSlots } from './render-helpers/resolve-slots'
import VNode, { createEmptyVNode } from '../vdom/vnode'

import { isUpdatingChildComponent } from './lifecycle'

export function initRender (vm: Component) {
  // 子树的根节点
  vm._vnode = null // the root of the child tree
  // 用于v-once的缓存静态树
  vm._staticTrees = null // v-once cached trees
  const options = vm.$options
  // 在父树中的占位节点
  const parentVnode = vm.$vnode = options._parentVnode // the placeholder node in parent tree
  // 获取渲染上下文
  const renderContext = parentVnode && parentVnode.context
  // 解析插槽slots, 并挂载在实例的$slots属性上
  vm.$slots = resolveSlots(options._renderChildren, renderContext)
  vm.$scopedSlots = emptyObject
  // bind the createElement fn to this instance
  // so that we get proper render context inside it.
  // args order: tag, data, children, normalizationType, alwaysNormalize
  // internal version is used by render functions compiled from templates
  // 绑定createElement函数到实例上
  // 这使我们能得到合适的渲染上下文
  // 参数顺序: tag, data, children, normalizationType, alwaysNormalize
  // 内部的版本是在模板被编译成render函数时使用
  vm._c = (a, b, c, d) => createElement(vm, a, b, c, d, false)
  // normalization is always applied for the public version, used in
  // user-written render functions.
  // normoalization版本的createElement函数通常适用于public版本
  // 与上面的_c的区别只是，这里的第五个参数(alwaysNormalize)传的是true
  vm.$createElement = (a, b, c, d) => createElement(vm, a, b, c, d, true)

  // $attrs & $listeners are exposed for easier HOC creation.
  // they need to be reactive so that HOCs using them are always updated
  // 为了更容易的创建高阶组件, 将$attrs和$listeners暴露出来
  // 同时为了高阶组件使用其时通常可以, 其也需要被定义为可响应式
  const parentData = parentVnode && parentVnode.data

  /* istanbul ignore else */
  if (process.env.NODE_ENV !== 'production') {
    defineReactive(vm, '$attrs', parentData && parentData.attrs || emptyObject, () => {
      !isUpdatingChildComponent && warn(`$attrs is readonly.`, vm)
    }, true)
    defineReactive(vm, '$listeners', options._parentListeners || emptyObject, () => {
      !isUpdatingChildComponent && warn(`$listeners is readonly.`, vm)
    }, true)
  } else {
    defineReactive(vm, '$attrs', parentData && parentData.attrs || emptyObject, null, true)
    defineReactive(vm, '$listeners', options._parentListeners || emptyObject, null, true)
  }
}

export function renderMixin (Vue: Class<Component>) {
  // install runtime convenience helpers
  // 装载运行时的辅助函数
  installRenderHelpers(Vue.prototype)
  // 装载$nextTick
  Vue.prototype.$nextTick = function (fn: Function) {
    return nextTick(fn, this)
  }
  // 装载_render函数
  Vue.prototype._render = function (): VNode {
    const vm: Component = this
    const { render, _parentVnode } = vm.$options

    // reset _rendered flag on slots for duplicate slot check
    // 重置slot对象上的_rendered标记, 此标记用于检查是否重复的slot
    if (process.env.NODE_ENV !== 'production') {
      for (const key in vm.$slots) {
        // $flow-disable-line
        vm.$slots[key]._rendered = false
      }
    }
    // TODO: 搞清楚scopedSlots的内部机制
    if (_parentVnode) {
      // 这里只是把_parentVnode.data的scopedSlots直接挂载到了vm.$scopedSlots上
      vm.$scopedSlots = _parentVnode.data.scopedSlots || emptyObject
    }

    // set parent vnode. this allows render functions to have access
    // to the data on the placeholder node.
    // 将父节点挂载在实例的$vnode上. 这允许render函数可以使用父节点上的数据
    vm.$vnode = _parentVnode
    // render self
    // 渲染自身
    let vnode
    try {
      // 通过代理去调用vm上属性, 使得当不存在内容的时候可以追踪错误
      vnode = render.call(vm._renderProxy, vm.$createElement)
    } catch (e) {
      handleError(e, vm, `render`)
      // return error render result,
      // or previous vnode to prevent render error causing blank component
      // 返回错误渲染结果 或者 先前的vnode以避免错误造成空白的组件
      /* istanbul ignore else */
      if (process.env.NODE_ENV !== 'production') {
        if (vm.$options.renderError) {
          try {
            vnode = vm.$options.renderError.call(vm._renderProxy, vm.$createElement, e)
          } catch (e) {
            handleError(e, vm, `renderError`)
            vnode = vm._vnode
          }
        } else {
          vnode = vm._vnode
        }
      } else {
        vnode = vm._vnode
      }
    }
    // return empty vnode in case the render function errored out
    // 返回空节点, 避免渲染函数抛出错误
    if (!(vnode instanceof VNode)) {
      if (process.env.NODE_ENV !== 'production' && Array.isArray(vnode)) {
        warn(
          'Multiple root nodes returned from render function. Render function ' +
          'should return a single root node.',
          vm
        )
      }
      vnode = createEmptyVNode()
    }
    // set parent
    // 设置父节点
    vnode.parent = _parentVnode
    return vnode
}
