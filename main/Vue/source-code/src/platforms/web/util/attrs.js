/* @flow */

import { makeMap } from 'shared/util'

// these are reserved for web because they are directly compiled away
// during template compilation
// 在模板编译阶段, reserveAttr(在浏览器环境中是style和class),
// 直接编译, 不需要额外操作
export const isReservedAttr = makeMap('style,class')

// attributes that should be using props for binding
// 表单元素的相应属性值(value, selected, checked, muted),
// 其为必须使用的prop, 在后续中会挂载在data.domProps上, 而不是attr,
// 哪怕用户没有显式绑定prop, 我们也会在如下情况进行隐式绑定
const acceptValue = makeMap('input,textarea,option,select,progress')
export const mustUseProp = (tag: string, type: ?string, attr: string): boolean => {
  return (
    (attr === 'value' && acceptValue(tag)) && type !== 'button' ||
    (attr === 'selected' && tag === 'option') ||
    (attr === 'checked' && tag === 'input') ||
    (attr === 'muted' && tag === 'video')
  )
}

// 可枚举属性
export const isEnumeratedAttr = makeMap('contenteditable,draggable,spellcheck')

// 布尔值属性
export const isBooleanAttr = makeMap(
  'allowfullscreen,async,autofocus,autoplay,checked,compact,controls,declare,' +
  'default,defaultchecked,defaultmuted,defaultselected,defer,disabled,' +
  'enabled,formnovalidate,hidden,indeterminate,inert,ismap,itemscope,loop,multiple,' +
  'muted,nohref,noresize,noshade,novalidate,nowrap,open,pauseonexit,readonly,' +
  'required,reversed,scoped,seamless,selected,sortable,translate,' +
  'truespeed,typemustmatch,visible'
)

// xlink命名空间
export const xlinkNS = 'http://www.w3.org/1999/xlink'

// 是否是xlink前缀的属性
export const isXlink = (name: string): boolean => {
  return name.charAt(5) === ':' && name.slice(0, 5) === 'xlink'
}

// 获取xlink前缀的属性名
export const getXlinkProp = (name: string): string => {
  return isXlink(name) ? name.slice(6, name.length) : ''
}

// 属性值是否是假值(null undefined false)
export const isFalsyAttrValue = (val: any): boolean => {
  return val == null || val === false
}
