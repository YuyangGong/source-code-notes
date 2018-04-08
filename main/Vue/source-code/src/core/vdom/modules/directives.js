/* @flow */

import { emptyNode } from 'core/vdom/patch'
import { resolveAsset, handleError } from 'core/util/index'
import { mergeVNodeHook } from 'core/vdom/helpers/index'

export default {
  create: updateDirectives,
  update: updateDirectives,
  destroy: function unbindDirectives (vnode: VNodeWithData) {
    // destroy, 直接传一个空节点, 
    // 用空节点的指令(空节点没有指令)去替换我们的旧节点指令,
    // 起到删除节点指令的作用
    updateDirectives(vnode, emptyNode)
  }
}

function updateDirectives (oldVnode: VNodeWithData, vnode: VNodeWithData) {
  // 当oldVnode和vnode都不存在指令时, 直接跳过, 不需要处理,
  // 否则进行通过_update函数进行更新
  if (oldVnode.data.directives || vnode.data.directives) {
    _update(oldVnode, vnode)
  }
}

function _update (oldVnode, vnode) {
  // 判断是否处于create阶段(即被更新的oldVnode为空node)
  const isCreate = oldVnode === emptyNode
  // 判断是否处于destroy阶段(即新的vnode为空node)
  const isDestroy = vnode === emptyNode
  // 这里需要注意的是俩个参数 前者传递的是虚拟节点的data.directives,
  // 而后者往往指向一个vm实例, 在虚拟节点中directives都挂载在虚拟节点
  // 的data上, vnode.data.directives, 而后者, 在vm实例中directives
  // 往往挂载在$options上, 即vm.$options.directives。
  const oldDirs = normalizeDirectives(oldVnode.data.directives, oldVnode.context)
  const newDirs = normalizeDirectives(vnode.data.directives, vnode.context)

  const dirsWithInsert = []
  const dirsWithPostpatch = []

  let key, oldDir, dir
  for (key in newDirs) {
    oldDir = oldDirs[key]
    dir = newDirs[key]
    if (!oldDir) {
      // new directive, bind
      // 旧指令不存在, 代表其为第一次绑定, 调用bind钩子
      callHook(dir, 'bind', vnode, oldVnode)
      if (dir.def && dir.def.inserted) {
        dirsWithInsert.push(dir)
      }
    } else {
      // existing directive, update
      // 若已经存在旧指令, 代表不是初次绑定, 调用update钩子
      dir.oldValue = oldDir.value
      callHook(dir, 'update', vnode, oldVnode)
      if (dir.def && dir.def.componentUpdated) {
        dirsWithPostpatch.push(dir)
      }
    }
  }

  if (dirsWithInsert.length) {
    const callInsert = () => {
      for (let i = 0; i < dirsWithInsert.length; i++) {
        callHook(dirsWithInsert[i], 'inserted', vnode, oldVnode)
      }
    }
    if (isCreate) {
      mergeVNodeHook(vnode, 'insert', callInsert)
    } else {
      callInsert()
    }
  }

  if (dirsWithPostpatch.length) {
    mergeVNodeHook(vnode, 'postpatch', () => {
      for (let i = 0; i < dirsWithPostpatch.length; i++) {
        callHook(dirsWithPostpatch[i], 'componentUpdated', vnode, oldVnode)
      }
    })
  }

  if (!isCreate) {
    for (key in oldDirs) {
      if (!newDirs[key]) {
        // no longer present, unbind
        // 新指令中不再存在, 代表已经被destory, 这里对其进行unbind
        callHook(oldDirs[key], 'unbind', oldVnode, oldVnode, isDestroy)
      }
    }
  }
}

const emptyModifiers = Object.create(null)

// normalize指令, 将指令数组转化为指令对象
function normalizeDirectives (
  dirs: ?Array<VNodeDirective>,
  vm: Component
): { [key: string]: VNodeDirective } {
  const res = Object.create(null)
  if (!dirs) {
    // $flow-disable-line
    return res
  }
  let i, dir
  // 每个directive具有以下属性: modifiers name def
  for (i = 0; i < dirs.length; i++) {
    dir = dirs[i]
    if (!dir.modifiers) {
      // $flow-disable-line
      // 都连接到外部的emptyModifiers, WHY 为什么不每次创建空对象呢?
      // 为了优化性能, 所以避免多次创建空对象么？
      dir.modifiers = emptyModifiers
    }
    // getRawDirName返回的字符串包含了修饰符, 所以同名事件,
    // 如果其修饰符不同, 则也属于不同的事件
    res[getRawDirName(dir)] = dir
    dir.def = resolveAsset(vm.$options, 'directives', dir.name, true)
  }
  // $flow-disable-line
  return res
}

// 获取指令名称(如果有修饰符, 则用`.`连接)
function getRawDirName (dir: VNodeDirective): string {
  return dir.rawName || `${dir.name}.${Object.keys(dir.modifiers || {}).join('.')}`
}
// 调用钩子
function callHook (dir, hook, vnode, oldVnode, isDestroy) {
  const fn = dir.def && dir.def[hook]
  if (fn) {
    try {
      fn(vnode.elm, dir, vnode, oldVnode, isDestroy)
    } catch (e) {
      handleError(e, vnode.context, `directive ${dir.name} ${hook} hook`)
    }
  }
}
