/* @flow */

import config from '../config'
import Dep from '../observer/dep'
import Watcher from '../observer/watcher'
import { isUpdatingChildComponent } from './lifecycle'

import {
  set,
  del,
  observe,
  observerState,
  defineReactive
} from '../observer/index'

import {
  warn,
  bind,
  noop,
  hasOwn,
  hyphenate,
  isReserved,
  handleError,
  nativeWatch,
  validateProp,
  isPlainObject,
  isServerRendering,
  isReservedAttribute
} from '../util/index'
// 共享属性定义, 内部的state多个地方是按照这个定义的,
// 即其可枚举可配置
const sharedPropertyDefinition = {
  enumerable: true,
  configurable: true,
  get: noop,
  set: noop
}

// 将sourceKey上的key属性直接代理到proxy上, 可以通过读写key来获取和修改sourceKey上的key
export function proxy (target: Object, sourceKey: string, key: string) {
  sharedPropertyDefinition.get = function proxyGetter () {
    return this[sourceKey][key]
  }
  sharedPropertyDefinition.set = function proxySetter (val) {
    this[sourceKey][key] = val
  }
  Object.defineProperty(target, key, sharedPropertyDefinition)
}

// 初始化state
export function initState (vm: Component) {
  // 初始化watchers
  vm._watchers = []
  const opts = vm.$options
  // 依次初始化props, methods, data, computed, watch
  // props是最早init的, 所以后续的data可以拿到其值
  if (opts.props) initProps(vm, opts.props)
  if (opts.methods) initMethods(vm, opts.methods)
  if (opts.data) {
    initData(vm)
  } else {
    // 如果data不存在, 则观察一个空对象
    observe(vm._data = {}, true /* asRootData */)
  }
  if (opts.computed) initComputed(vm, opts.computed)
  if (opts.watch && opts.watch !== nativeWatch) {
    initWatch(vm, opts.watch)
  }
}

function initProps (vm: Component, propsOptions: Object) {
  // 获取propsData
  const propsData = vm.$options.propsData || {}
  const props = vm._props = {}
  // cache prop keys so that future props updates can iterate using Array
  // instead of dynamic object key enumeration.
  // 缓存prop的key, 后续props更新时, 我们只需要迭代这个数组,
  // 不需要去迭代一个动态对象的key
  const keys = vm.$options._propKeys = []
  // 当$parent不存在时候, 则可以认定其为根节点
  const isRoot = !vm.$parent
  // root instance props should be converted
  // 根实例的props应该被转换
  observerState.shouldConvert = isRoot
  for (const key in propsOptions) {
    keys.push(key)
    const value = validateProp(key, propsOptions, propsData, vm)
    /* istanbul ignore else */
    if (process.env.NODE_ENV !== 'production') {
      const hyphenatedKey = hyphenate(key)
      // 检查Key是否是已存在的属性
      if (isReservedAttribute(hyphenatedKey) ||
          config.isReservedAttr(hyphenatedKey)) {
        warn(
          `"${hyphenatedKey}" is a reserved attribute and cannot be used as component prop.`,
          vm
        )
      }
      // 定义其响应式
      defineReactive(props, key, value, () => {
        if (vm.$parent && !isUpdatingChildComponent) {
          warn(
            `Avoid mutating a prop directly since the value will be ` +
            `overwritten whenever the parent component re-renders. ` +
            `Instead, use a data or computed property based on the prop's ` +
            `value. Prop being mutated: "${key}"`,
            vm
          )
        }
      })
    } else {
      defineReactive(props, key, value)
    }
    // static props are already proxied on the component's prototype
    // during Vue.extend(). We only need to proxy props defined at
    // instantiation here.
    // 静态的props已经通过Vue.extend代理在了组件的prototype上。
    // 我们在实例中只需要代理props
    if (!(key in vm)) {
      proxy(vm, `_props`, key)
    }
  }
  observerState.shouldConvert = true
}
// 初始化Data
function initData (vm: Component) {
  let data = vm.$options.data
  // data可能是函数或者对象
  data = vm._data = typeof data === 'function'
    ? getData(data, vm)
    : data || {}
  // 只能返回纯对象
  if (!isPlainObject(data)) {
    data = {}
    process.env.NODE_ENV !== 'production' && warn(
      'data functions should return an object:\n' +
      'https://vuejs.org/v2/guide/components.html#data-Must-Be-a-Function',
      vm
    )
  }
  // proxy data on instance
  // 在实例上代理data
  const keys = Object.keys(data)
  const props = vm.$options.props
  const methods = vm.$options.methods
  let i = keys.length
  while (i--) {
    const key = keys[i]
    if (process.env.NODE_ENV !== 'production') {
      if (methods && hasOwn(methods, key)) {
        warn(
          `Method "${key}" has already been defined as a data property.`,
          vm
        )
      }
    }
    if (props && hasOwn(props, key)) {
      process.env.NODE_ENV !== 'production' && warn(
        `The data property "${key}" is already declared as a prop. ` +
        `Use prop default value instead.`,
        vm
      )
    } else if (!isReserved(key)) {
      proxy(vm, `_data`, key)
    }
  }
  // observe data
  observe(data, true /* asRootData */)
}

export function getData (data: Function, vm: Component): any {
  try {
    // 这里有点和之前的预期不太一样的地方, vm会被作为参数传给data函数
    return data.call(vm, vm)
  } catch (e) {
    handleError(e, vm, `data()`)
    // 如果出错了返回空对象, 作为data
    return {}
  }
}

const computedWatcherOptions = { lazy: true }

// 初始化计算属性
function initComputed (vm: Component, computed: Object) {
  // $flow-disable-line
  const watchers = vm._computedWatchers = Object.create(null)
  // computed properties are just getters during SSR
  // 在服务器端渲染时, 计算属性仅仅只有getters, 没有setters
  const isSSR = isServerRendering()

  for (const key in computed) {
    const userDef = computed[key]
    // 获取计算属性的getter, 其可能是直接的函数, 也可能是相关对象的getter
    const getter = typeof userDef === 'function' ? userDef : userDef.get
    if (process.env.NODE_ENV !== 'production' && getter == null) {
      warn(
        `Getter is missing for computed property "${key}".`,
        vm
      )
    }

    if (!isSSR) {
      // create internal watcher for the computed property.
      // 为计算属性创建内部的watcher
      // 只有非服务器端渲染的时候会开启, 服务器端渲染的情况下不开启
      watchers[key] = new Watcher(
        vm,
        getter || noop,
        noop,
        computedWatcherOptions
      )
    }

    // component-defined computed properties are already defined on the
    // component prototype. We only need to define computed properties defined
    // at instantiation here.
    // 组件需要用到的属性(如data, props), 
    // 都通过代理的方式挂载在了组件原型上,
    // 在初始化计算属性时候, 直接通过`for in`判断
    // key是否处在于vm及其原型链上即可
    if (!(key in vm)) {
      defineComputed(vm, key, userDef)
    } else if (process.env.NODE_ENV !== 'production') {
      if (key in vm.$data) {
        warn(`The computed property "${key}" is already defined in data.`, vm)
      } else if (vm.$options.props && key in vm.$options.props) {
        warn(`The computed property "${key}" is already defined as a prop.`, vm)
      }
    }
  }
}

// 定义计算属性
export function defineComputed (
  target: any,
  key: string,
  userDef: Object | Function
) {
  // ssr时, 不缓存
  const shouldCache = !isServerRendering()
  if (typeof userDef === 'function') {
    sharedPropertyDefinition.get = shouldCache
      ? createComputedGetter(key)
      : userDef
    sharedPropertyDefinition.set = noop
  } else {
    // 这里判断了一个userDef.cache 根据官网只是做个向后兼容
    // 详见[cache: false](https://cn.vuejs.org/v2/guide/migration.html#cache-false-弃用)
    // WHY 感觉既然已经在V2.0中弃用了, 就应该删除这些"冗余"的逻辑呀
    sharedPropertyDefinition.get = userDef.get
      ? shouldCache && userDef.cache !== false
        ? createComputedGetter(key)
        : userDef.get
      : noop
    sharedPropertyDefinition.set = userDef.set
      ? userDef.set
      : noop
  }
  if (process.env.NODE_ENV !== 'production' &&
      sharedPropertyDefinition.set === noop) {
    // 当set不存在时候, 赋值set, 并在其中加入warn错误信息,
    // 方便通知使用者, 有利于调试
    sharedPropertyDefinition.set = function () {
      warn(
        `Computed property "${key}" was assigned to but it has no setter.`,
        this
      )
    }
  }
  Object.defineProperty(target, key, sharedPropertyDefinition)
}

function createComputedGetter (key) {
  return function computedGetter () {
    const watcher = this._computedWatchers && this._computedWatchers[key]
    // WHY: 什么情况下watcher会不存在呢?
    if (watcher) {
      // 若dirty, 则直接执行计算
      // 这里只有dirty为true, 即其依赖项有改动时候才会重新计算
      // 若依赖项没有改动, 则使用上次的值(即watcher.value)
      // TODO: 完全搞清楚dirty的作用
      if (watcher.dirty) {
        watcher.evaluate()
      }
      // 依赖有改动时, depent事件
      if (Dep.target) {
        watcher.depend()
      }
      return watcher.value
    }
  }
}
// 初始化方法
function initMethods (vm: Component, methods: Object) {
  const props = vm.$options.props
  for (const key in methods) {
    if (process.env.NODE_ENV !== 'production') {
      // 检查相关method是否有值
      if (methods[key] == null) {
        warn(
          `Method "${key}" has an undefined value in the component definition. ` +
          `Did you reference the function correctly?`,
          vm
        )
      }
      // 检查是否有同名prop
      if (props && hasOwn(props, key)) {
        warn(
          `Method "${key}" has already been defined as a prop.`,
          vm
        )
      }
      // 检查是否是Vue保留名(以_或$开头)
      if ((key in vm) && isReserved(key)) {
        warn(
          `Method "${key}" conflicts with an existing Vue instance method. ` +
          `Avoid defining component methods that start with _ or $.`
        )
      }
    }
    // 将method代理到vm上
    vm[key] = methods[key] == null ? noop : bind(methods[key], vm)
  }
}
// 初始化watch
function initWatch (vm: Component, watch: Object) {
  for (const key in watch) {
    const handler = watch[key]
    // watch的handler可以是:
    // 1. 字符串 
    // 2. 对象 
    // 3. 函数 
    // 4. 数组(由以上3种, 即字符串, 对象, 函数组成的数组)
    if (Array.isArray(handler)) {
      for (let i = 0; i < handler.length; i++) {
        createWatcher(vm, key, handler[i])
      }
    } else {
      createWatcher(vm, key, handler)
    }
  }
}

// 这一步主要用于统一参数为keyOrFn, handler(function), options的格式, 传给$watch
function createWatcher (
  vm: Component,
  keyOrFn: string | Function,
  handler: any,
  options?: Object
) {
  // handler为对象时候, 设置options和handler
  if (isPlainObject(handler)) {
    options = handler
    handler = handler.handler
  }
  // handler为字符串时, 直接使用vm实例上的方法(方法名与handler字符串内容相同)
  if (typeof handler === 'string') {
    handler = vm[handler]
  }
  // 设置watch
  return vm.$watch(keyOrFn, handler, options)
}

// 状态混入
export function stateMixin (Vue: Class<Component>) {
  // flow somehow has problems with directly declared definition object
  // when using Object.defineProperty, so we have to procedurally build up
  // the object here.
  // 当我们使用Object.defineProperty时, 直接声明定义对象可能会导致flow的一些问题
  // 为了避免上述问题, 这里我们预先创建对象
  const dataDef = {}
  dataDef.get = function () { return this._data }
  const propsDef = {}
  propsDef.get = function () { return this._props }
  if (process.env.NODE_ENV !== 'production') {
    // 这里拦截了对根data的直接修改, 但是并没有拦截对根data的
    // 相关属性的更改, 比如现在有`data: { test: {} }`,
    // 如果我们直接`data.test = xxx`是会警告的,
    // 但是如果`data.test.attribute = xxx`则不会
    // WHY: 话说这个newData貌似没有用到呀
    dataDef.set = function (newData: Object) {
      warn(
        'Avoid replacing instance root $data. ' +
        'Use nested data properties instead.',
        this
      )
    }
    // 同样只拦截了对props的修改, 但是没有拦截对props的属性的修改
    propsDef.set = function () {
      warn(`$props is readonly.`, this)
    }
  }
  // 将_data, _props代理到vm的$data, $props上
  Object.defineProperty(Vue.prototype, '$data', dataDef)
  Object.defineProperty(Vue.prototype, '$props', propsDef)

  Vue.prototype.$set = set
  Vue.prototype.$delete = del

  Vue.prototype.$watch = function (
    expOrFn: string | Function,
    cb: any,
    options?: Object
  ): Function {
    const vm: Component = this
    // 如果cb是对象, 则代表其包含了handler和options, 
    // 这里通过createWatcher创建watch
    if (isPlainObject(cb)) {
      return createWatcher(vm, expOrFn, cb, options)
    }
    options = options || {}
    options.user = true
    const watcher = new Watcher(vm, expOrFn, cb, options)
    // immediate为真时, 立即执行一次cb
    if (options.immediate) {
      cb.call(vm, watcher.value)
    }
    return function unwatchFn () {
      watcher.teardown()
    }
  }
}
