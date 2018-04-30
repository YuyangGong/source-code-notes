/* @flow */

import { namespaceMap } from 'web/util/index'

export function createElement (tagName: string, vnode: VNode): Element {
  const elm = document.createElement(tagName)
  // 如果不是select类型的节点, 则直接返回(不需要额外处理)
  if (tagName !== 'select') {
    return elm
  }
  // false or null will remove the attribute but undefined will not
  // 当multiple这个属性的值为false或null的时候会移除, 但是undefined时不会,
  // 所以我们这里只需要判断multiple的值是否是undefined, 如果不是, 代表其为
  // 真值(因为false和null之前已经被移除了), 我们这里设置其multiple值为multiple
  if (vnode.data && vnode.data.attrs && vnode.data.attrs.multiple !== undefined) {
    elm.setAttribute('multiple', 'multiple')
  }
  return elm
}

// 详见 [createElementNs](https://developer.mozilla.org/zh-CN/docs/Web/API/Document/createElementNS)
export function createElementNS (namespace: string, tagName: string): Element {
  return document.createElementNS(namespaceMap[namespace], tagName)
}

export function createTextNode (text: string): Text {
  return document.createTextNode(text)
}

export function createComment (text: string): Comment {
  return document.createComment(text)
}

export function insertBefore (parentNode: Node, newNode: Node, referenceNode: Node) {
  parentNode.insertBefore(newNode, referenceNode)
}

export function removeChild (node: Node, child: Node) {
  node.removeChild(child)
}

export function appendChild (node: Node, child: Node) {
  node.appendChild(child)
}

export function parentNode (node: Node): ?Node {
  return node.parentNode
}

export function nextSibling (node: Node): ?Node {
  return node.nextSibling
}

export function tagName (node: Element): string {
  return node.tagName
}

export function setTextContent (node: Node, text: string) {
  node.textContent = text
}

export function setAttribute (node: Element, key: string, val: string) {
  node.setAttribute(key, val)
}
