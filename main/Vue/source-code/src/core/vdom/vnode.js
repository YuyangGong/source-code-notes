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
  // 已废弃: 现在用componentInstance代替,
  // 为向后兼容, 所以这里仍然保留了child的getter
  /* istanbul ignore next */
  get child (): Component | void {
    return this.componentInstance
  }
}

// 创建空的虚拟节点, 使用者可以传一个字符串作为其text
export const createEmptyVNode = (text: string = '') => {
  const node = new VNode()
  node.text = text
  node.isComment = true
  return node
}

// 与上面不同的是这里没有设置node.isComment为true
// WHY: 为什么不和上面的createEmptyVNode统一风格
// 写成这种:
// ```
// const node = new VNode()
// node.text = String(val)
// return node
// ```
export function createTextVNode (val: string | number) {
  return new VNode(undefined, undefined, undefined, String(val))
}

// optimized shallow clone
// used for static nodes and slot nodes because they may be reused across
// multiple renders, cloning them avoids errors when DOM manipulations rely
// on their elm reference.
// 优化后的浅克隆, 其只克隆一层, 并设置isClone为true,
// 用于静态节点和slot节点, 因为他们可能在多个renders中被复用,
// 克隆其可以避免他们elm引用的DOM在进行操作时候发生的errors,
// 譬如俩个地方都用到了节点a, 第一个地方需要修改a的属性elm,
// 如果不进行这一层克隆的话, 第二个用到节点a的地方也会因为第一个
// 地方对a.elm的修改而修改(因为传的是引用), 这里不需要考虑更
// 深的层级, 这种情况只会修改VNode上的属性, 而不会修改其属性的属性
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
