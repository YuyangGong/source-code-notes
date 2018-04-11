/* @flow */

import VNode from './vnode'
import { createElement } from './create-element'
import { resolveInject } from '../instance/inject'
import { normalizeChildren } from '../vdom/helpers/normalize-children'
import { resolveSlots } from '../instance/render-helpers/resolve-slots'
import { installRenderHelpers } from '../instance/render-helpers/index'

import {
  isDef,
  isTrue,
  camelize,
  emptyObject,
  validateProp
} from '../util/index'

// 函数渲染上下文的构造函数
function FunctionalRenderContext (
  data,
  props,
  children,
  parent,
  Ctor
) {
  const options = Ctor.options
  this.data = data
  this.props = props
  this.children = children
  this.parent = parent
  this.listeners = data.on || emptyObject
  this.injections = resolveInject(options.inject, parent)
  this.slots = () => resolveSlots(children, parent)

  // ensure the createElement function in functional components
  // gets a unique context - this is necessary for correct named slot check
  // 确保函数组件中的createElement函数可以获得一个唯一的context，
  // 为了正确的进行具名slot的检查, 这是必需的
  const contextVm = Object.create(parent)
  // 是否已经编译过了, 如果已经编译过了就不需要normalization了
  const isCompiled = isTrue(options._compiled)
  const needNormalization = !isCompiled

  // support for compiled functional template
  // 为了支持编译函数式模板
  if (isCompiled) {
    // exposing $options for renderStatic()
    // 暴露$options, 以便渲染静态节点
    this.$options = options
    // pre-resolve slots for renderSlot()
    // 预解析slots, 以便渲染slot
    this.$slots = this.slots()
    this.$scopedSlots = data.scopedSlots || emptyObject
  }

  if (options._scopeId) {
    this._c = (a, b, c, d) => {
      const vnode = createElement(contextVm, a, b, c, d, needNormalization)
      if (vnode && !Array.isArray(vnode)) {
        vnode.fnScopeId = options._scopeId
        vnode.fnContext = parent
      }
      return vnode
    }
  } else {
    this._c = (a, b, c, d) => createElement(contextVm, a, b, c, d, needNormalization)
  }
}

// 把render辅助函数挂载到FunctionalRenderContext的原型上, 方便其实例使用
installRenderHelpers(FunctionalRenderContext.prototype)

export function createFunctionalComponent (
  Ctor: Class<Component>,
  propsData: ?Object,
  data: VNodeData,
  contextVm: Component,
  children: ?Array<VNode>
): VNode | Array<VNode> | void {
  const options = Ctor.options
  const props = {}
  const propOptions = options.props
  if (isDef(propOptions)) {
    for (const key in propOptions) {
      props[key] = validateProp(key, propOptions, propsData || emptyObject)
    }
  } else {
    if (isDef(data.attrs)) mergeProps(props, data.attrs)
    if (isDef(data.props)) mergeProps(props, data.props)
  }

  const renderContext = new FunctionalRenderContext(
    data,
    props,
    children,
    contextVm,
    Ctor
  )

  const vnode = options.render.call(null, renderContext._c, renderContext)

  if (vnode instanceof VNode) {
    setFunctionalContextForVNode(vnode, data, contextVm, options)
    return vnode
  } else if (Array.isArray(vnode)) {
    const vnodes = normalizeChildren(vnode) || []
    for (let i = 0; i < vnodes.length; i++) {
      setFunctionalContextForVNode(vnodes[i], data, contextVm, options)
    }
    return vnodes
  }
}

// 设置VNode的context
function setFunctionalContextForVNode (vnode, data, vm, options) {
  vnode.fnContext = vm
  vnode.fnOptions = options
  if (data.slot) {
    (vnode.data || (vnode.data = {})).slot = data.slot
  }
}

// 合并props, 将from上的属性复制到to上,
// 其属性key需转换为驼峰命名法
function mergeProps (to, from) {
  for (const key in from) {
    to[camelize(key)] = from[key]
  }
}
