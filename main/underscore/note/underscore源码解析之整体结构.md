---
title: Underscore源码分析之整体结构
tag: [JavaScript, Underscore, 源码分析]
---
* 库名: underscore
* 源码地址: [https://github.com/jashkenas/underscore](https://github.com/jashkenas/underscore)
* 源码版本: 1.8.3
* 分析内容: 整体结构
*****

### 环境兼容
```javascript
(function() {
  // 通过IIFE避免变量全局污染

  // 统一根对象，在`webWorker`中指向`self`, 在服务器(nodeJS)上指向`global`,
  // 在其他情况下指向this(在浏览器中, 因函数调用, this将指向window);
  var root = typeof self == 'object' && self.self === self && self ||
      typeof global == 'object' && global.global === global && global ||
      this;

  // 在nodeJS(或者其他支持commonJS的环境)中暴露Underscore对象, 且向后兼容其旧API。 
  // 如果不是nodeJS环境, 则把Underscore对象挂载在根对象root上。
  // ('nodeType' 用来检测module和exports不是HTML元素
  // 因HTML5中, 具有ID的HTML元素, 其引用会被直接挂载在全局的同名[id名]变量上)
  if (typeof exports != 'undefined' && !exports.nodeType) {
  if (typeof module != 'undefined' && !module.nodeType && module.exports) {
    exports = module.exports = _;
  }
  exports._ = _;
  } else {
  root._ = _;
  }

  // 在支持AMD的环境中, 暴露Underscore对象
  if (typeof define == 'function' && define.amd) {
  define('underscore', [], function() {
    return _;
  });
  } 
}());
```
对环境做了判断, 用root引用全局对象, 在相应的环境中指向相应的全局变量, 使表现一致。且支持CommonJS, AMD等模块化规范, 兼容了各种环境。
<!--more-->
### 避免变量名'_'冲突
```javascript
  // 保留之前全局上挂载的'_'的值
  var previousUnderscore = root._;

  // 将之前全局上挂载的'_'的值, 重新赋值给'_', '_'不再指向Underscore
  // 此方法执行后返回this(当其调用者为Underscore的时候, 其this也就指向Underscore对象)
  _.noConflict = function() {
    root._ = previousUnderscore;
    return this;
  };
```

### Underscore构造函数
```javascript
  // 创建Underscore的安全引用, 当不用new调用构造函数时, 也会正确的实例化
  // 创造出来的实例对象, 目前只有一个_wrapped属性, 指向之前传的参数obj
  var _ = function(obj) {
  if (obj instanceof _) return obj;
  if (!(this instanceof _)) return new _(obj);
  this._wrapped = obj;  
  }; 
```

### 创建原型链及其上方法的快速引用
```javascript
  // 将原型链赋值给变量, 有利于代码压缩
  var ArrayProto = Array.prototype, ObjProto = Object.prototype;
  var SymbolProto = typeof Symbol !== 'undefined' ? Symbol.prototype : null;

  // 创建Array原型上的push,slice和Object原型上的toString,hasOwnProperty方法的快速引用。
  var push = ArrayProto.push,
      slice = ArrayProto.slice,
      toString = ObjProto.toString,
      hasOwnProperty = ObjProto.hasOwnProperty;

  // 创建 ES5 中的isArray, keys, create的原生函数的快速引用
  var nativeIsArray = Array.isArray,
      nativeKeys = Object.keys,
      nativeCreate = Object.create; 
```
将原型链或链上方法的引用给变量, 其好处有如下:

* 减少有利于代码压缩, 为生产环境中的代码量减重。
* 减少对象上属性的查询次数, 优化性能。
* <del>少打一些字</del>(但考虑到这些都是私有方法及对象, 所以并不算)。

### 链式调用的实现
```javascript
    // 一个挂载在Underscore上的方法, 用于创建可以链式调用的对象。
    // 其以obj为参数, 创建一个Underscore实例, 并将实例上的_chain属性设置为true。
    _.chain = function(obj) {
      var instance = _(obj);
      instance._chain = true;
      return instance;
    };

    // 一个私有的辅助函数, 如果传入的实例已经经过_.chain处理了(即instance._chain为真)
    // 则返回再次的链式调用, 否则返回第二个参数obj
    var chainResult = function(instance, obj) {
      return instance._chain ? _(obj).chain() : obj;
    };

    // 给Underscore对象添加自定义方法。
    _.mixin = function(obj) {
      // 遍历obj对象上方法, 在Underscore对象上创建同名方法, 连接引用。
      _.each(_.functions(obj), function(name) {
        var func = _[name] = obj[name];
        // 在原型链上也创建同名方法, 此方法内部处理的对象是挂载在实例上的_wrapped对象
        _.prototype[name] = function() {
          // 将实例上的_wrapped对象, 以及传入的参数都保存进args数组
          var args = [this._wrapped];
          push.apply(args, arguments);
          // 调用私有方法chainResult, 传入实例作为第一参数
          // 传入 经过Underscore对象上相关方法处理后的对象作为第二参数
          return chainResult(this, func.apply(_, args));
        };
      });
      return _;
    };

  // 将Underscore对象上所有的方法添加到其原型上。
    _.mixin(_);

    // 将数组原型链中会改变原数组的方法添加到Underscore中。
    _.each(['pop', 'push', 'reverse', 'shift', 'sort', 'splice', 'unshift'], function(name) {
      var method = ArrayProto[name];
      // 同样也稍作修改添加到原型上。
      _.prototype[name] = function() {
        var obj = this._wrapped;
        method.apply(obj, arguments);
        if ((name === 'shift' || name === 'splice') && obj.length === 0) delete obj[0];
        return chainResult(this, obj);
      };
    });

    // 将数组原型链中不会改变原数组的方法添加到Underscore中。
    // 与上面的差别主要是, 这里返回的都是新对象, 而上面是原本的对象
    _.each(['concat', 'join', 'slice'], function(name) {
      var method = ArrayProto[name];
      _.prototype[name] = function() {
        return chainResult(this, method.apply(this._wrapped, arguments));
      };
    });

    // 获取链式调用的结果对象, 即this._wrapped
    _.prototype.value = function() {
      return this._wrapped;
    };

    // 将原型链上的value方法的引用给原型链上的valueOf和toJSON
    // 以便JS引擎内部取值或者JSON字符串化时, 处理的对象是this._wrapped
    // 而不是实例对象
    _.prototype.valueOf = _.prototype.toJSON = _.prototype.value;
    
    // 写原型链上的toString方法
    // 以便JS引擎内部调用Underscore实例的toString方法(如instance + 'string')时,
    // 返回的是其this._wrapped的字符串形式
    // 而不是实例的字符串形式
    _.prototype.toString = function() {
      return String(this._wrapped);
    }
```
将Underscore构造函数作为对象的包装器，在实例化时接受一个对象为参数，并将此对象作为实例的_wrapped属性保存, 然后将Underscore的方法稍作修改放置在其原型上(修改主要是为了原型链上的方法操作的是_wrapped对象)，以便实例可以通过原型链来查询到相关方法并使用, 巧妙的实现了链式调用。内部也通过_chain属性来判断是否链式调用，如果是的话则返回包装后的对象(即Underscore实例,具有_wrapped和_chain属性及Underscore原型链)，否则直接返回源对象(非Underscore实例)。