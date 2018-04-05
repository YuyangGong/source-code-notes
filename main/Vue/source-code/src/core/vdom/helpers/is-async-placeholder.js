/* @flow */
// 判断是否是异步组件占位符
// 判断依据是vnode的isComment和asyncFactory都为真 
export function isAsyncPlaceholder (node: VNode): boolean {
  return node.isComment && node.asyncFactory
}
