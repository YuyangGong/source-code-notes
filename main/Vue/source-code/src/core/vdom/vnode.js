/* @flow */

export default class VNode {
  tag: string | void;
  data: VNodeData | void;
  children: ?Array<VNode>;
  text: string | void;
  elm: Node | void;
  ns: string | void;
  // rendered in this component's scope
  // context指定虚拟节点所处于的组件
  context: Component | void;
  key: string | number | void;
  componentOptions: VNodeComponentOptions | void;
  // component instance
  // 组件实例(WHY: 这个具体与context有何不同？)
  componentInstance: Component | void;
  // component placeholder node
  // 组件占位节点(WHY: 这个与componentInstance和context又有何不同)
  parent: VNode | void;

  // strictly internal
  // 严格局限于内部(WHY: 还是应该翻译成内部私有变量？)
  // contains raw HTML? (server only)
  // 原始html(仅仅在server中用到)
  raw: boolean;
  // hoisted static node
  // 提升静态节点(WHY: 为什么要hoisted?)
  isStatic: boolean;
  // necessary for enter transition check
  // 必须存在此属性, 进入transition时会检查其
  isRootInsert: boolean;
  // empty comment placeholder?
  // 空的注释占位符
  isComment: boolean;
  // is a cloned node?
  // 是否是克隆的节点
  isCloned: boolean;
  // is a v-once node?
  // 是否是v-once节点
  isOnce: boolean;
  // async component factory function
  // 异步组件的工厂函数
  asyncFactory: Function | void;
  asyncMeta: Object | void;
  isAsyncPlaceholder: boolean;
  ssrContext: Object | void;
  // real context vm for functional nodes
  // 用于函数式节点的真实的上下文vm实例
  fnContext: Component | void;
  // for SSR caching
  // 用于SSR检查
  fnOptions: ?ComponentOptions;
  // functioanl scope id support
  // 函数式作用域id支持
  fnScopeId: ?string;

  constructor (
    tag?: string,
    data?: VNodeData,
    children?: ?Array<VNode>,
    text?: string,
    elm?: Node,
    context?: Component,
    componentOptions?: VNodeComponentOptions,
    asyncFactory?: Function
  ) {
    this.tag = tag
    this.data = data
    this.children = children
    this.text = text
    this.elm = elm
    this.ns = undefined
    this.context = context
    this.fnContext = undefined
    this.fnOptions = undefined
    this.fnScopeId = undefined
    this.key = data && data.key
    this.componentOptions = componentOptions
    this.componentInstance = undefined
    this.parent = undefined
    this.raw = false
    this.isStatic = false
    this.isRootInsert = true
    this.isComment = false
    this.isCloned = false
    this.isOnce = false
    this.asyncFactory = asyncFactory
    this.asyncMeta = undefined
    this.isAsyncPlaceholder = false
  }

  // DEPRECATED: alias for componentInstance for backwards compat.
  /* istanbul ignore next */
  get child (): Component | void {
    return this.componentInstance
  }
}

export const createEmptyVNode = (text: string = '') => {
  const node = new VNode()
  node.text = text
  node.isComment = true
  return node
}

export function createTextVNode (val: string | number) {
  return new VNode(undefined, undefined, undefined, String(val))
}

// optimized shallow clone
// used for static nodes and slot nodes because they may be reused across
// multiple renders, cloning them avoids errors when DOM manipulations rely
// on their elm reference.
export function cloneVNode (vnode: VNode): VNode {
  const cloned = new VNode(
    vnode.tag,
    vnode.data,
    vnode.children,
    vnode.text,
    vnode.elm,
    vnode.context,
    vnode.componentOptions,
    vnode.asyncFactory
  )
  cloned.ns = vnode.ns
  cloned.isStatic = vnode.isStatic
  cloned.key = vnode.key
  cloned.isComment = vnode.isComment
  cloned.fnContext = vnode.fnContext
  cloned.fnOptions = vnode.fnOptions
  cloned.fnScopeId = vnode.fnScopeId
  cloned.isCloned = true
  return cloned
}
