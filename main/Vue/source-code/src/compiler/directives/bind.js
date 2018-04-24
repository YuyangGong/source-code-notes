/* @flow */

export default function bind (el: ASTElement, dir: ASTDirective) {
  // 挂载在语法树元素的wrapData方法, 使其
  // 这里code传入的是一个对象字符串, eg'{key: "value"}'
  el.wrapData = (code: string) => {
    return `_b(${code},'${el.tag}',${dir.value},${
      dir.modifiers && dir.modifiers.prop ? 'true' : 'false'
    }${
      dir.modifiers && dir.modifiers.sync ? ',true' : ''
    })`
  }
}
