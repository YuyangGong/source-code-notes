/* @flow */

import VNode from './vnode'
import { resolveConstructorOptions } from 'core/instance/init'
import { queueActivatedComponent } from 'core/observer/scheduler'
import { createFunctionalComponent } from './create-functional-component'

import {
  warn,
  isDef,
  isUndef,
  isTrue,
  isObject
} from '../util/index'

import {
  resolveAsyncComponent,
  createAsyncPlaceholder,
  extractPropsFromVNodeData
} from './helpers/index'

import {
  callHook,
  activeInstance,
  updateChildComponent,
  activateChildComponent,
  deactivateChildComponent
} from '../instance/lifecycle'

import {
  isRecyclableComponent,
  renderRecyclableComponentTemplate
} from 'weex/runtime/recycle-list/render-component-template'

// hooks to be invoked on component VNodes during patch
// patch时, 用于组件虚拟节点调用的钩子
const componentVNodeHooks = {
  init (
    vnode: VNodeWithData,
    hydrating: boolean,
    parentElm: ?Node,
    refElm: ?Node
  ): ?boolean {
    if (
      vnode.componentInstance &&
      !vnode.componentInstance._isDestroyed &&
      vnode.data.keepAlive
    ) {
      // kept-alive components, treat as a patch
      // 将keep-alive的组件当做patch处理
      const mountedNode: any = vnode // work around flow
      // 这里要给keep-alive的组件prepatch相同的mountedNode的原因是,
      // WHY: 使其调用相应的生命周期钩子(看了下实现，好像钩子调用的逻辑不在这里)
      componentVNodeHooks.prepatch(mountedNode, mountedNode)
    } else {
      const child = vnode.componentInstance = createComponentInstanceForVnode(
        vnode,
        activeInstance,
        parentElm,
        refElm
      )
      child.$mount(hydrating ? vnode.elm : undefined, hydrating)
    }
  },

  prepatch (oldVnode: MountedComponentVNode, vnode: MountedComponentVNode) {
    const options = vnode.componentOptions
    const child = vnode.componentInstance = oldVnode.componentInstance
    updateChildComponent(
      child,
      // 分别更新child(即我们的组件实例)的propsData, listeners,
      // parent(这里是当前虚拟节点vnode), 以及children
      options.propsData,
      options.listeners,
      vnode,
      options.children
    )
  },

  insert (vnode: MountedComponentVNode) {
    const { context, componentInstance } = vnode
    // 组件实例如果没有挂载则挂载, 并调用相应的钩子
    if (!componentInstance._isMounted) {
      componentInstance._isMounted = true
      callHook(componentInstance, 'mounted')
    }
    if (vnode.data.keepAlive) {
      if (context._isMounted) {
        // vue-router#1212
        // During updates, a kept-alive component's child components may
        // change, so directly walking the tree here may call activated hooks
        // on incorrect children. Instead we push them into a queue which will
        // be processed after the whole patch process ended.
        // 在已挂载的组件的更新过程中, 一个keep-alive组件的子组件可能发生
        // 改变, 因此如果直接遍历在这里遍历组件树可能在不正确的组件上调用了
        // activated钩子。因此我们将其push进队列中, 在整个patch过程结束后
        // 再统一处理, 调用相关钩子。
        queueActivatedComponent(componentInstance)
      } else {
        // 若存在于没有挂载的上下文中, 就直接对其进行activate操作
        // WHY 这里是指没有触发mouted的时候也能触发activated么
        activateChildComponent(componentInstance, true /* direct */)
      }
    }
  },

  destroy (vnode: MountedComponentVNode) {
    const { componentInstance } = vnode
    // 当其没有destroyed时候才进行destroy, 避免重复destroy
    if (!componentInstance._isDestroyed) {
      // 根据是否是keep-alive组件, 来决定是执行destory还是deactivate
      if (!vnode.data.keepAlive) {
        componentInstance.$destroy()
      } else {
        deactivateChildComponent(componentInstance, true /* direct */)
      }
    }
  }
}
// 需要被合并的VNode钩子, 包括init,prepatch,insert,destroy
const hooksToMerge = Object.keys(componentVNodeHooks)

export function createComponent (
  Ctor: Class<Component> | Function | Object | void,
  data: ?VNodeData,
  context: Component,
  children: ?Array<VNode>,
  tag?: string
): VNode | Array<VNode> | void {
  if (isUndef(Ctor)) {
    return
  }

  const baseCtor = context.$options._base

  // plain options object: turn it into a constructor
  // 若是options对象, 则通过baseCtor.extend将其转换为构造函数
  if (isObject(Ctor)) {
    Ctor = baseCtor.extend(Ctor)
  }

  // if at this stage it's not a constructor or an async component factory,
  // reject.
  // 如果这时候不是构造函数或者异步组件工厂函数, 则报错并直接返回
  if (typeof Ctor !== 'function') {
    if (process.env.NODE_ENV !== 'production') {
      warn(`Invalid Component definition: ${String(Ctor)}`, context)
    }
    return
  }

  // async component
  // 异步组件
  let asyncFactory
  if (isUndef(Ctor.cid)) {
    asyncFactory = Ctor
    Ctor = resolveAsyncComponent(asyncFactory, baseCtor, context)
    if (Ctor === undefined) {
      // return a placeholder node for async component, which is rendered
      // as a comment node but preserves all the raw information for the node.
      // the information will be used for async server-rendering and hydration.
      // 为异步组件返回一个占位符节点, 此占位符节点作为注释节点渲染, 但是
      // 保留了所有的节点源信息, 在异步的服务器端渲染和hydration中将用到这些信息
      return createAsyncPlaceholder(
        asyncFactory,
        data,
        context,
        children,
        tag
      )
    }
  }

  data = data || {}

  // resolve constructor options in case global mixins are applied after
  // component constructor creation
  // 解析构造函数选项, 避免全局混入mixins在组件构造函数创建之后添加
  resolveConstructorOptions(Ctor)

  // transform component v-model data into props & events
  // 转换组件的v-model数据为props和events
  if (isDef(data.model)) {
    transformModel(Ctor.options, data)
  }

  // extract props
  // 获取props
  const propsData = extractPropsFromVNodeData(data, Ctor, tag)

  // functional component
  if (isTrue(Ctor.options.functional)) {
    return createFunctionalComponent(Ctor, propsData, data, context, children)
  }

  // extract listeners, since these needs to be treated as
  // child component listeners instead of DOM listeners
  const listeners = data.on
  // replace with listeners with .native modifier
  // so it gets processed during parent component patch.
  data.on = data.nativeOn

  if (isTrue(Ctor.options.abstract)) {
    // abstract components do not keep anything
    // other than props & listeners & slot

    // work around flow
    const slot = data.slot
    data = {}
    if (slot) {
      data.slot = slot
    }
  }

  // merge component management hooks onto the placeholder node
  // 将组件管理钩子合并到我们的占位符节点上去
  mergeHooks(data)

  // return a placeholder vnode
  // 返回一个占位符节点
  const name = Ctor.options.name || tag
  const vnode = new VNode(
    `vue-component-${Ctor.cid}${name ? `-${name}` : ''}`,
    data, undefined, undefined, undefined, context,
    { Ctor, propsData, listeners, tag, children },
    asyncFactory
  )

  // Weex specific: invoke recycle-list optimized @render function for
  // extracting cell-slot template.
  // https://github.com/Hanks10100/weex-native-directive/tree/master/component
  // Weex特性: 调用循环列表优化渲染函数, 其作用于获取cell0-slot模板
  // https://github.com/Hanks10100/weex-native-directive/tree/master/component
  /* istanbul ignore if */
  if (__WEEX__ && isRecyclableComponent(vnode)) {
    return renderRecyclableComponentTemplate(vnode)
  }

  return vnode
}

export function createComponentInstanceForVnode (
  vnode: any, // we know it's MountedComponentVNode but flow doesn't 用于flow类型判断
  parent: any, // activeInstance in lifecycle state
  parentElm?: ?Node,
  refElm?: ?Node
): Component {
  const options: InternalComponentOptions = {
    _isComponent: true,
    parent,
    _parentVnode: vnode,
    _parentElm: parentElm || null,
    _refElm: refElm || null
  }
  // check inline-template render functions
  // 检查内联模板渲染函数, 内联模板详见[这里](https://cn.vuejs.org/v2/guide/components.html#内联模板)
  const inlineTemplate = vnode.data.inlineTemplate
  if (isDef(inlineTemplate)) {
    options.render = inlineTemplate.render
    options.staticRenderFns = inlineTemplate.staticRenderFns
  }
  return new vnode.componentOptions.Ctor(options)
}

function mergeHooks (data: VNodeData) {
  if (!data.hook) {
    data.hook = {}
  }
  for (let i = 0; i < hooksToMerge.length; i++) {
    const key = hooksToMerge[i]
    const fromParent = data.hook[key]
    const ours = componentVNodeHooks[key]
    // 先执行自身虚拟节点VNode的钩子，再执行vm实例钩子
    data.hook[key] = fromParent ? mergeHook(ours, fromParent) : ours
  }
}

// 合并钩子, 按顺序执行one, two钩子
function mergeHook (one: Function, two: Function): Function {
  return function (a, b, c, d) {
    one(a, b, c, d)
    two(a, b, c, d)
  }
}

// transform component v-model info (value and callback) into
// prop and event handler respectively.
// 转换组件的v-model信息(值和回调函数)为
// 相应的prop和event hanlder
function transformModel (options, data: any) {
  const prop = (options.model && options.model.prop) || 'value' // 默认为value
  const event = (options.model && options.model.event) || 'input' // 默认为input
  // 给data的props
  ;(data.props || (data.props = {}))[prop] = data.model.value
  const on = data.on || (data.on = {})
  if (isDef(on[event])) {
    // 这里需要注意的是model.callback在首位, 先执行
    on[event] = [data.model.callback].concat(on[event])
  } else {
    on[event] = data.model.callback
  }
}
