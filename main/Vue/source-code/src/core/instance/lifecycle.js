/* @flow */

import config from '../config'
import Watcher from '../observer/watcher'
import { mark, measure } from '../util/perf'
import { createEmptyVNode } from '../vdom/vnode'
import { observerState } from '../observer/index'
import { updateComponentListeners } from './events'
import { resolveSlots } from './render-helpers/resolve-slots'

import {
  warn,
  noop,
  remove,
  handleError,
  emptyObject,
  validateProp
} from '../util/index'

export let activeInstance: any = null
export let isUpdatingChildComponent: boolean = false

export function initLifecycle (vm: Component) {
  const options = vm.$options

  // locate first non-abstract parent
  // 定位到第一个非abstract父实例(比如类似keep-alive这样的组件就会跳过)
  let parent = options.parent
  if (parent && !options.abstract) {
    while (parent.$options.abstract && parent.$parent) {
      parent = parent.$parent
    }
    parent.$children.push(vm)
  }

  vm.$parent = parent
  vm.$root = parent ? parent.$root : vm

  vm.$children = []
  vm.$refs = {}

  vm._watcher = null
  vm._inactive = null
  vm._directInactive = false
  vm._isMounted = false
  vm._isDestroyed = false
  vm._isBeingDestroyed = false
}

export function lifecycleMixin (Vue: Class<Component>) {
  Vue.prototype._update = function (vnode: VNode, hydrating?: boolean) {
    const vm: Component = this
    // 如果已经挂载了就触发beforeUpdate钩子
    if (vm._isMounted) {
      callHook(vm, 'beforeUpdate')
    }
    // 保留前次节点的数据
    const prevEl = vm.$el
    const prevVnode = vm._vnode
    const prevActiveInstance = activeInstance
    activeInstance = vm
    vm._vnode = vnode
    // Vue.prototype.__patch__ is injected in entry points
    // based on the rendering backend used.
    // __path__方法在入口中注入, 基于渲染后端使用
    if (!prevVnode) {
      // initial render
      // 如果先前不存在Vnode, 代表初次渲染
      vm.$el = vm.__patch__(
        vm.$el, vnode, hydrating, false /* removeOnly */,
        vm.$options._parentElm,
        vm.$options._refElm
      )
      // no need for the ref nodes after initial patch
      // this prevents keeping a detached DOM tree in memory (#5851)
      vm.$options._parentElm = vm.$options._refElm = null
    } else {
      // updates
      // 更新
      vm.$el = vm.__patch__(prevVnode, vnode)
    }
    activeInstance = prevActiveInstance
    // update __vue__ reference
    // 更新__vue__的引用
    if (prevEl) {
      prevEl.__vue__ = null
    }
    if (vm.$el) {
      vm.$el.__vue__ = vm
    }
    // if parent is an HOC, update its $el as well
    if (vm.$vnode && vm.$parent && vm.$vnode === vm.$parent._vnode) {
      vm.$parent.$el = vm.$el
    }
    // updated hook is called by the scheduler to ensure that children are
    // updated in a parent's updated hook.
  }

  // 强制更新, 直接触发watcher
  Vue.prototype.$forceUpdate = function () {
    const vm: Component = this
    if (vm._watcher) {
      vm._watcher.update()
    }
  }

  Vue.prototype.$destroy = function () {
    const vm: Component = this
    // 已销毁的直接跳过
    if (vm._isBeingDestroyed) {
      return
    }
    // 执行beforeDesctroy钩子
    callHook(vm, 'beforeDestroy')
    vm._isBeingDestroyed = true
    // remove self from parent
    // 将自身从父实例的$children对象中除去
    const parent = vm.$parent
    if (parent && !parent._isBeingDestroyed && !vm.$options.abstract) {
      remove(parent.$children, vm)
    }
    // teardown watchers
    // 卸载监听器
    if (vm._watcher) {
      vm._watcher.teardown()
    }
    let i = vm._watchers.length
    while (i--) {
      vm._watchers[i].teardown()
    }
    // remove reference from data ob
    // frozen object may not have observer.
    if (vm._data.__ob__) {
      vm._data.__ob__.vmCount--
    }
    // call the last hook...
    vm._isDestroyed = true
    // invoke destroy hooks on current rendered tree
    // 销毁vnode
    vm.__patch__(vm._vnode, null)
    // fire destroyed hook
    // 触发destroyed钩子
    callHook(vm, 'destroyed')
    // turn off all instance listeners.
    // 解绑所有事件
    vm.$off()
    // remove __vue__ reference
    if (vm.$el) {
      vm.$el.__vue__ = null
    }
    // release circular reference (#6759)
    if (vm.$vnode) {
      vm.$vnode.parent = null
    }
  }
}

// 挂载组件
export function mountComponent (
  vm: Component,
  el: ?Element,
  hydrating?: boolean
): Component {
  // 在mount时, 才挂载具体的el到$el上
  vm.$el = el
  if (!vm.$options.render) {
    // 当render函数不存在时, 则当做空节点渲染
    vm.$options.render = createEmptyVNode
    if (process.env.NODE_ENV !== 'production') {
      /* istanbul ignore if */
      // WHY: 什么时候会以#开头？
      if ((vm.$options.template && vm.$options.template.charAt(0) !== '#') ||
        vm.$options.el || el) {
        warn(
          'You are using the runtime-only build of Vue where the template ' +
          'compiler is not available. Either pre-compile the templates into ' +
          'render functions, or use the compiler-included build.',
          vm
        )
      } else {
        warn(
          'Failed to mount component: template or render function not defined.',
          vm
        )
      }
    }
  }
  // 触发beforeMount钩子, 这里可以知道el在vm之前
  callHook(vm, 'beforeMount')

  let updateComponent
  /* istanbul ignore if */
  if (process.env.NODE_ENV !== 'production' && config.performance && mark) {
    updateComponent = () => {
      const name = vm._name
      const id = vm._uid
      const startTag = `vue-perf-start:${id}`
      const endTag = `vue-perf-end:${id}`

      mark(startTag)
      const vnode = vm._render()
      mark(endTag)
      measure(`vue ${name} render`, startTag, endTag)

      mark(startTag)
      vm._update(vnode, hydrating)
      mark(endTag)
      measure(`vue ${name} patch`, startTag, endTag)
    }
  } else {
    updateComponent = () => {
      vm._update(vm._render(), hydrating)
    }
  }

  // we set this to vm._watcher inside the watcher's constructor
  // since the watcher's initial patch may call $forceUpdate (e.g. inside child
  // component's mounted hook), which relies on vm._watcher being already defined
  new Watcher(vm, updateComponent, noop, null, true /* isRenderWatcher */)
  hydrating = false

  // manually mounted instance, call mounted on self
  // mounted is called for render-created child components in its inserted hook
  // 手动挂载实例, 并调用mount钩子
  if (vm.$vnode == null) {
    vm._isMounted = true
    callHook(vm, 'mounted')
  }
  return vm
}

export function updateChildComponent (
  vm: Component,
  propsData: ?Object,
  listeners: ?Object,
  parentVnode: MountedComponentVNode,
  renderChildren: ?Array<VNode>
) {
  if (process.env.NODE_ENV !== 'production') {
    isUpdatingChildComponent = true
  }

  // determine whether component has slot children
  // we need to do this before overwriting $options._renderChildren
  // 组件是否具有slot children
  // 在重写$options._renderChildren之前调用
  const hasChildren = !!(
    renderChildren ||               // has new static slots
    vm.$options._renderChildren ||  // has old static slots
    parentVnode.data.scopedSlots || // has new scoped slots
    vm.$scopedSlots !== emptyObject // has old scoped slots
  )

  vm.$options._parentVnode = parentVnode
  vm.$vnode = parentVnode // update vm's placeholder node without re-render

  if (vm._vnode) { // update child tree's parent
    vm._vnode.parent = parentVnode
  }
  vm.$options._renderChildren = renderChildren

  // update $attrs and $listeners hash
  // these are also reactive so they may trigger child update if the child
  // used them during render
  // 更新$attra和$listeners哈希
  // 这些同样也是响应式的,  所以如果子组件在render中使用他们, 他们能触发子组件更新
  vm.$attrs = parentVnode.data.attrs || emptyObject
  vm.$listeners = listeners || emptyObject

  // update props
  // 更新props
  if (propsData && vm.$options.props) {
    observerState.shouldConvert = false
    const props = vm._props
    const propKeys = vm.$options._propKeys || []
    for (let i = 0; i < propKeys.length; i++) {
      const key = propKeys[i]
      props[key] = validateProp(key, vm.$options.props, propsData, vm)
    }
    observerState.shouldConvert = true
    // keep a copy of raw propsData
    // 保持纯propsData的引用
    vm.$options.propsData = propsData
  }

  // update listeners
  // 更新监听器
  listeners = listeners || emptyObject
  const oldListeners = vm.$options._parentListeners
  vm.$options._parentListeners = listeners
  updateComponentListeners(vm, listeners, oldListeners)

  // resolve slots + force update if has children
  // 如果有子组件或slot, 则强制其更新, 触发视图的改变, 并解析器slots
  if (hasChildren) {
    vm.$slots = resolveSlots(renderChildren, parentVnode.context)
    vm.$forceUpdate()
  }

  if (process.env.NODE_ENV !== 'production') {
    isUpdatingChildComponent = false
  }
}

// 是否存在于inactive树中
function isInInactiveTree (vm) {
  while (vm && (vm = vm.$parent)) {
    if (vm._inactive) return true
  }
  return false
}

export function activateChildComponent (vm: Component, direct?: boolean) {
  if (direct) {
    vm._directInactive = false
    // 如果存在于inactive树中, 则直接跳过, 不分发activate事件
    if (isInInactiveTree(vm)) {
      return
    }
  } else if (vm._directInactive) {
    return
  }
  if (vm._inactive || vm._inactive === null) {
    vm._inactive = false
    // 递归active后代组件, 触发后代的active钩子,
    // 值得注意的是这里是先执行了子元素的activateChildComponent,
    // 再调用了activated钩子, 换句话说, 子组件的activated钩子在父
    // 组件之前调用
    for (let i = 0; i < vm.$children.length; i++) {
      activateChildComponent(vm.$children[i])
    }
    callHook(vm, 'activated')
  }
}

export function deactivateChildComponent (vm: Component, direct?: boolean) {
  if (direct) {
    vm._directInactive = true
    // 如果已经存在于inactive树中, 则直接跳过
    if (isInInactiveTree(vm)) {
      return
    }
  }
  // 如果已经被inactive了, 也跳过
  if (!vm._inactive) {
    vm._inactive = true
    // 递归inactive后代组件, 触发后代的deactivated钩子
    for (let i = 0; i < vm.$children.length; i++) {
      deactivateChildComponent(vm.$children[i])
    }
    callHook(vm, 'deactivated')
  }
}

export function callHook (vm: Component, hook: string) {
  const handlers = vm.$options[hook]
  if (handlers) {
    for (let i = 0, j = handlers.length; i < j; i++) {
      try {
        handlers[i].call(vm)
      } catch (e) {
        handleError(e, vm, `${hook} hook`)
      }
    }
  }
  if (vm._hasHookEvent) {
    vm.$emit('hook:' + hook)
  }
}
