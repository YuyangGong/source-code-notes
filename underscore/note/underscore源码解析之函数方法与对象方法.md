---
title: Underscore源码分析之函数与对象方法
tag: [JavaScript, Underscore, 源码分析]
---
* 库名: underscore
* 源码地址: [https://github.com/jashkenas/underscore](https://github.com/jashkenas/underscore)
* 源码版本: 1.8.3
* 分析内容: 函数方法与对象方法实现
*****

### 函数方法
#### executeBound
```javascript
  var executeBound = function(sourceFunc, boundFunc, context, callingContext, args) {
    // 这一步判断是不是用 new 实例化构造函数
    // 如果不是, 直接用apply绑定this执行后返回
    if (!(callingContext instanceof boundFunc)) return sourceFunc.apply(context, args);
    // 如果是new实例化构造函数的话, 则模拟new函数内部实现
    var self = baseCreate(sourceFunc.prototype);
    var result = sourceFunc.apply(self, args);
    if (_.isObject(result)) return result;
    return self;
  }; 
```
<!--more-->
#### _.bind
```javascript
  // 模拟原生Array.prototype.bind
  _.bind = restArgs(function(func, context, args) {
    // 只能处理函数, 不是函数直接扔出错误
    if (!_.isFunction(func)) throw new TypeError('Bind must be called on a function');
    var bound = restArgs(function(callArgs) {
      return executeBound(func, bound, context, this, args.concat(callArgs));
    });
    return bound;
  });
 
```

#### _.partial
```javascript
  // 局部应用一个函数填充在任意个数的 arguments，
  // 不改变其动态this值。和bind方法很相近。你可以传递_(用户可以自定义)给arguments列表
  // 来指定一个不预先填充，但在调用时提供的参数。
  _.partial = restArgs(function(func, boundArgs) {
    // 获取参数占位符
    var placeholder = _.partial.placeholder;
    var bound = function() {
      var position = 0, length = boundArgs.length;
      var args = Array(length);
      for (var i = 0; i < length; i++) {
        // 进行占位符的替换
        args[i] = boundArgs[i] === placeholder ? arguments[position++] : boundArgs[i];
      }
      while (position < arguments.length) args.push(arguments[position++]);
      return executeBound(func, bound, this, this, args);
    };
    return bound;
  });

// 可以通过修改_.partial.placeholder来自定义占位符
  _.partial.placeholder = _; 
```

#### _.bindAll
```javascript
  // 将obj上的方法的this绑定在obj上
  _.bindAll = restArgs(function(obj, keys) {
    keys = flatten(keys, false, false);
    var index = keys.length;
    if (index < 1) throw new Error('bindAll must be passed function names');
    while (index--) {
      var key = keys[index];
      obj[key] = _.bind(obj[key], obj);
    }
  }); 
```

#### _.memoize
```javascript
  // 通过 缓存函数结果 来优化函数
  _.memoize = function(func, hasher) {
    var memoize = function(key) {
      // 缓存放在memoize对象上
      var cache = memoize.cache;
      // hasher用来处理传的参数保存在cache中的键名
      var address = '' + (hasher ? hasher.apply(this, arguments) : key);
      if (!_.has(cache, address)) cache[address] = func.apply(this, arguments);
      return cache[address];
    };
    memoize.cache = {};
    return memoize;
  };
```

#### _.delay
```javascript
  // 延迟执行函数
  _.delay = restArgs(function(func, wait, args) {
    return setTimeout(function() {
      return func.apply(null, args);
    }, wait);
  }); 
```

#### _.defer
```javascript
  // 另一个函数异步执行, 在函数调用栈空了以后再执行
  // 比较好奇为什么这里是1不是直接设置为0
  _.defer = _.partial(_.delay, _, 1); 
```

#### _.throttle
```javascript
  // 创建并返回一个像节流阀一样的函数，当重复调用函数的时候，至少每隔 wait毫秒调用一次该函数。
  _.throttle = function(func, wait, options) {
    var timeout, context, args, result;
    // 保留上一次调用时的时间戳
    var previous = 0;
    if (!options) options = {};

    var later = function() {
      // 如果设置options.leading为false的话, 那么第一次调用不会执行
      // 需要过wait秒后的调用才执行
      previous = options.leading === false ? 0 : _.now();
      // 打断timeout对此later的引用, 释放内存
      timeout = null;
      // 执行函数
      result = func.apply(context, args);
      // 如果目前没有timeout, 即没有延迟执行的函数, 则打断context和args的引用
      if (!timeout) context = args = null;
    };

    var throttled = function() {
      // 获取目前的时间
      var now = _.now();
      // 如果是第一次调用或者其options.leading为false, 则让前一次的时间为本次时间
      if (!previous && options.leading === false) previous = now;
      // 计算剩余时间, 如果是第一次或者options.leading为false时, 这里应为wait
      var remaining = wait - (now - previous);
      // 报错上下文和参数的引用
      context = this;
      args = arguments;
      // 如果剩余时间小于0, 
      // 或者大于等待时间
      // (判断大于等待时间是为了在用户代理的本地时间被修改时就立即执行函数)
      if (remaining <= 0 || remaining > wait) {
        // 如果已经有timeout存在, 则清空已存在的timeout
        if (timeout) {
          clearTimeout(timeout);
          timeout = null;
        }
        // 改变上一次的执行时间previous
        previous = now;
        // 执行函数并保存返回值
        result = func.apply(context, args);
        // 如果timeout不存在则打断引用
        if (!timeout) context = args = null;
      // 如果timeout不存在, 且options.trailing不为false, 
      // 则设置remaining剩余时间以后执行函数
      } else if (!timeout && options.trailing !== false) {
        timeout = setTimeout(later, remaining);
      }
      return result;
    };
    // 挂载在throttled上的取消方法, 
    // 用来重置throttled的状态, 打断timeout、context、args的引用
    throttled.cancel = function() {
      clearTimeout(timeout);
      previous = 0;
      timeout = context = args = null;
    };

    // 返回thrttled方法, 每次创建都是一个新的throttled，利用闭包
    // 产生了与new实例化类似的效果
    return throttled;
  }; 
```

#### _.debounce
```javascript
  // 返回func函数的防反跳版本, 将延迟函数的执行(真正的执行)
  // 在函数最后一次调用时刻的 wait 毫秒之后, 如果传入immediate一个真值
  // 则第一次会直接调用(真正的调用)
  _.debounce = function(func, wait, immediate) {
    var timeout, result;

    var later = function(context, args) {
      // 打断timeout对此函数的引用
      timeout = null;
      // 如果args参数存在, 则以context为上下文传入args参数调用
      if (args) result = func.apply(context, args);
    };

    var debounced = restArgs(function(args) {
      // 如果有timeout存在, 则清除
      if (timeout) clearTimeout(timeout);
      // 如果immediate为真, 且是第一次调用则执行函数, 类似节流throttled
      if (immediate) {
        var callNow = !timeout;
        // 不传参, 在later中不会执行
        timeout = setTimeout(later, wait);
        if (callNow) result = func.apply(this, args);
      // 如果不为真, 则照常延迟执行
      } else {
        timeout = _.delay(later, wait, this, args);
      }

      return result;
    });

    // 挂载在debounced上的取消方法, 
    // 用来重置debounced的状态, 打断timeout的引用
    debounced.cancel = function() {
      clearTimeout(timeout);
      timeout = null;
    };
  
    // 返回debounced
    return debounced;
  };
```

#### _.wrap
```javascript
  // 将第一个函数 func 封装到函数 wrapper 里面, 并把函数 func
  // 作为第一个参数传给 wrapper
  _.wrap = function(func, wrapper) {
    return _.partial(wrapper, func);
  }; 
```

#### _.negate
```javascript
  // 返回predicate的逆版本
  _.negate = function(predicate) {
    return function() {
      return !predicate.apply(this, arguments);
    };
  }; 
```

#### _.compose
```javascript
  // 返回一个组合函数, 会依次从右到左调用函数
  _.compose = function() {
    var args = arguments;
    var start = args.length - 1;
    return function() {
      var i = start;
      var result = args[start].apply(this, arguments);
      while (i--) result = args[i].call(this, result);
      return result;
    };
  }; 
```

#### _.after
```javascript
  // 返回一个函数, 其只有在times次调用以后才能被执行
  _.after = function(times, func) {
    return function() {
      // 简单的利用闭包机制保存times, 用times监控调用情况
      if (--times < 1) {
        return func.apply(this, arguments);
      }
    };
  }; 
```

#### _.before
```javascript
  // 返回一个函数, 其只有前times-1次调用会被执行
  _.before = function(times, func) {
    var memo;
    return function() {
      if (--times > 0) {
        memo = func.apply(this, arguments);
      }
      // times-1次后, 打断引用, 清理内存
      if (times <= 1) func = null;
      return memo;
    };
  }; 
```

#### _.once
```javascript
  // 返回一个函数只能在第一次调用时候被执行
  _.once = _.partial(_.before, 2); 
```

### 对象方法
#### _.keys
```javascript
  // 获取对象的键名, 并以数组的形式返回
  // 类似es5中原生的`Object.keys`.
  _.keys = function(obj) {
    // 如果不是对象, 则直接返回空数组
    if (!_.isObject(obj)) return [];
    // 如果原生方法存在则直接使用原生方法
    if (nativeKeys) return nativeKeys(obj);
    var keys = [];
    // 遍历obj上的可枚举属性, 用_.has判断是否是其自身的属性(非原型链上)
    // 如果是的话, 就push进结果数组中
    for (var key in obj) if (_.has(obj, key)) keys.push(key);
    // IE9以下有bug, 需要针对处理
    // (主要是部分原型链上的同名方法如toString等经hasOwnProperty会错误的返回false
    // 以及for in无法枚举constructor，哪怕自身上已经重写, 且设置为可枚举
    if (hasEnumBug) collectNonEnumProps(obj, keys);
    return keys;
  }; 
```

#### 解决_.keys中存在于IE9的bug
```javascript
  // 判断是否有枚举bug
  var hasEnumBug = !{toString: null}.propertyIsEnumerable('toString');
  // 这些属性在有枚举bug时, 哪怕在自身对象上重写, 也不会被枚举
  var nonEnumerableProps = ['valueOf', 'isPrototypeOf', 'toString',
                      'propertyIsEnumerable', 'hasOwnProperty', 'toLocaleString'];

  var collectNonEnumProps = function(obj, keys) {
    var nonEnumIdx = nonEnumerableProps.length;
    var constructor = obj.constructor;
    // 有原型就使用原型, 如果没有则使用Object.prototype
    var proto = _.isFunction(constructor) && constructor.prototype || ObjProto;

    // Constructor不会被for in枚举, 但是可以通过hasOwnProperty判断
    var prop = 'constructor';
    if (_.has(obj, prop) && !_.contains(keys, prop)) keys.push(prop);

    while (nonEnumIdx--) {
      prop = nonEnumerableProps[nonEnumIdx];
      // 判断1、是否是是obj上的可枚举对象, 2、是否不在原型链上, 3、结果中是否已经包含
      if (prop in obj && obj[prop] !== proto[prop] && !_.contains(keys, prop)) {
        keys.push(prop);
      }
    }
  }; 
```

#### _.allKeys
```javascript
  // 返回对象上的所有可枚举键名, 包括自身上的以及原型链上的
  _.allKeys = function(obj) {
    if (!_.isObject(obj)) return [];
    var keys = [];
    for (var key in obj) keys.push(key);
    // IE9以下特殊处理
    if (hasEnumBug) collectNonEnumProps(obj, keys);
    return keys;
  }; 
```

#### _.values
```javascript
  // 返回对象自身上的所有可枚举属性的值
  _.values = function(obj) {
    // 先获取其自身上所有可枚举属性的键名
    var keys = _.keys(obj);
    var length = keys.length;
    var values = Array(length);
    // 根据先前获取的键名去拿属性值
    for (var i = 0; i < length; i++) {
      values[i] = obj[keys[i]];
    }
    return values;
  }; 
```

#### _.mapObject
```javascript
  // 与map相似，但用于对象。转换每个属性的值。
  _.mapObject = function(obj, iteratee, context) {
    iteratee = cb(iteratee, context);
    var keys = _.keys(obj),
        length = keys.length,
        results = {};
    for (var index = 0; index < length; index++) {
      var currentKey = keys[index];
      results[currentKey] = iteratee(obj[currentKey], currentKey, obj);
    }
    return results;
  }; 
```

#### _.pairs 
```javascript
  // 将对象转换为键值对形式的二维数组
  _.pairs = function(obj) {
    var keys = _.keys(obj);
    var length = keys.length;
    var pairs = Array(length);
    for (var i = 0; i < length; i++) {
      pairs[i] = [keys[i], obj[keys[i]]];
    }
    return pairs;  
  }; 
```

#### _.invert
```javascript
  // 反转对象的键值对
  _.invert = function(obj) {
    var result = {};
    var keys = _.keys(obj);
    for (var i = 0, length = keys.length; i < length; i++) {
      result[obj[keys[i]]] = keys[i];
    }
    return result;
  }; 
```

#### _.functions
```javascript
  // 返回对象上(包括原型链)可枚举的函数名, 并且对其排序
  _.functions = _.methods = function(obj) {
    var names = [];
    // 遍历如果是函数, 则将键名push进names
    for (var key in obj) {
      if (_.isFunction(obj[key])) names.push(key);
    }
    // 排序并返回
    return names.sort();
  };
```

#### _.extend与_.extendOwn以及_.defaults
```javascript
  // 内部私有函数, 为了创建extend等方法。
  // 传入的keysFunc是一个用来获取当前对象的键值的函数,
  // defaults判断是否要覆盖目标对象上已存在的属性 
  var createAssigner = function(keysFunc, defaults) {
    return function(obj) {
      var length = arguments.length;
      // 如果defaults为真, 则先将obj转换为对象
      if (defaults) obj = Object(obj);
      // 如果参数长度小于2, 或obj为null、undefined则直接返回obj。
      if (length < 2 || obj == null) return obj;
      // 遍历参数, 依次去拓展源对象
      for (var index = 1; index < length; index++) {
        var source = arguments[index],
            keys = keysFunc(source),
            l = keys.length;
        for (var i = 0; i < l; i++) {
          var key = keys[i];
          // 如果defaults为假, 则无视obj上已存在的同名属性, 直接覆盖
          // 反之, 如果defaults为真, 且obj上已存在同名属性, 则跳过, 不覆盖
          if (!defaults || obj[key] === void 0) obj[key] = source[key];
        }
      }
      return obj;
    };
  };

  // 复制source对象中的所有属性覆盖到destination对象上，并且返回 destination 对象. 
  // 复制是按顺序的, 所以后面的对象属性会把前面的对象属性覆盖掉(如果有重复).
  // 拓展也包括原型链上的属性.
  _.extend = createAssigner(_.allKeys);

  // 与extend类似, 但是不包括原型链上的属性
  _.extendOwn = _.assign = createAssigner(_.keys); 

  // 与_.extend类似, 但是会保留destination对象上已存在的属性
  _.defaults = createAssigner(_.allKeys, true);
```

#### _.findKey
```javascript
  // 返回对象中第一个通过predicate的属性的键名
  _.findKey = function(obj, predicate, context) {
    predicate = cb(predicate, context);
    var keys = _.keys(obj), key;
    for (var i = 0, length = keys.length; i < length; i++) {
      key = keys[i];
      if (predicate(obj[key], key, obj)) return key;
    }
    // 如果遍历完都没有查询到有符合predicate的属性, 则无返回值
    // 等同于返回了undefined
  }; 
```

#### _.pick
```javascript
  // 内部辅助函数, 用来检测obj对象及其原型链上是否有key属性
  var keyInObj = function(value, key, obj) {
    return key in obj;
  };

  // 返回一个obj副本，只过滤出keys(有效的键组成的数组)参数指定的属性值。
  // 或者接受一个判断函数，指定挑选哪个key。
  _.pick = restArgs(function(obj, keys) {
    var result = {}, iteratee = keys[0];
    if (obj == null) return result;
    // 如果iteratee为函数, 则代表第二个传进来的参数是处理函数, 而不是key键
    if (_.isFunction(iteratee)) {
      // 如果keys的长度大于1, 则将其第二索引位的元素当成context传入优化函数中
      if (keys.length > 1) iteratee = optimizeCb(iteratee, keys[1]);
      // 获取obj对象上的所有键名, 包括所有自身及原型链上的可枚举属性
      keys = _.allKeys(obj);
    } else {
      // 如果没有传入iteratee, 则用内置的keyInObj当默认iteratee
      iteratee = keyInObj;
      // 展平传入的keys
      keys = flatten(keys, false, false);
      // 将obj转换为对象
      obj = Object(obj);
    }
    // 遍历keys, 判断相应的属性是否通过predicate, 如果是的话则push进结果数组result 
    for (var i = 0, length = keys.length; i < length; i++) {
      var key = keys[i];
      var value = obj[key];
      if (iteratee(value, key, obj)) result[key] = value;
    }
    return result;
  }); 
```

#### _.omit
```javascript
  // 返回一个obj副本，只过滤出除去keys参数指定的属性值。 
  // 或者接受一个判断函数predicate, 指定忽略哪个key。
  _.omit = restArgs(function(obj, keys) {
    var iteratee = keys[0], context;
    // 如果传入的是判断函数, 则将其转换为否定版本传入_.pick中
    if (_.isFunction(iteratee)) {
      iteratee = _.negate(iteratee);
      if (keys.length > 1) context = keys[1];
    // 如果传入的不是判断函数, 则将其先展平, 再装换为字符串
    } else {
      keys = _.map(flatten(keys, false, false), String);
      iteratee = function(value, key) {
        return !_.contains(keys, key);
      };
    }
    return _.pick(obj, iteratee, context);
  }); 
```

#### _.create
```javascript
  // 创建具有给定原型的新对象， 可选附加props 作为 返回对象 的属性。 
  // 基本上，和Object.create一样， 但是没有所有的属性描述符。
  _.create = function(prototype, props) {
    // 以原型创建对象
    var result = baseCreate(prototype);
    // 如果传入了props, 则将其自身上的可枚举属性添加到result对象上(会
    // 覆盖result上已存在的同名属性)
    if (props) _.extendOwn(result, props);
    return result;
  }; 
```

#### _.clone
```javascript
  // 创建一个对象的浅拷贝, 拷贝所有自身及原型链上的属性, 但是只是连接引用,
  // 并没有对属性也进行拷贝
  _.clone = function(obj) {
    if (!_.isObject(obj)) return obj;
    // 对数组使用简便的slice, 对其他对象使用内置的_.extend方法
    return _.isArray(obj) ? obj.slice() : _.extend({}, obj);
  }; 
```

#### _.tap
```javascript
  // 用 obj 作为参数来调用函数interceptor，然后返回object。
  // 这种方法的主要意图是作为函数链式调用的一环, 
  // 为了对此对象执行操作并返回对象本身。
  _.tap = function(obj, interceptor) {
    // 用interceptor操作obj
    interceptor(obj);
    // 返回obj
    return obj;
  }; 
```

#### _.isMatch
```javascript
  // 判断attrs中的键值对是否包含在object中。
  _.isMatch = function(object, attrs) {
    var keys = _.keys(attrs), length = keys.length;
    // 当object为null或undefined, attrs为空的时候, 返回true
    if (object == null) return !length;
    var obj = Object(object);
    for (var i = 0; i < length; i++) {
      var key = keys[i];
      // 当属性在obj中不存在 或 与attrs中的不相等时, 直接返回false
      if (attrs[key] !== obj[key] || !(key in obj)) return false;
    }
    return true;
  };
```

#### 私有方法eq与deepEq
```javascript
  // 内部的递归比较函数, 用于_.isEqual
  var eq, deepEq;
  eq = function(a, b, aStack, bStack) {
    // 0 === -0 会错误的返回true, 所以需特殊处理
    if (a === b) return a !== 0 || 1 / a === 1 / b;
    // 个人觉得这步多余了, 因为之前就判断了a===b的情况
    if (a == null || b == null) return a === b;
    // 判断NaN, 因为NaN不等于自身, 需特殊处理
    if (a !== a) return b !== b;
    var type = typeof a;
    // 判断其类型, 如果俩个都不是对象类型即返回true。
    if (type !== 'function' && type !== 'object' && typeof b != 'object') return false;
    // a b都是对象, 则深入比较
    return deepEq(a, b, aStack, bStack);
  };

  // Internal recursive comparison function for `isEqual`.
  deepEq = function(a, b, aStack, bStack) {
    // 如果是_的实例, 则使用其_wrapped对象
    if (a instanceof _) a = a._wrapped;
    if (b instanceof _) b = b._wrapped;
    // 比较class名(即构造函数的名字)
    var className = toString.call(a);
    // class名不同, 则直接返回true
    if (className !== toString.call(b)) return false;
    // 根据不同的class名进行相应的判断处理
    switch (className) {
      // Strings, numbers, regular expressions, dates, 和 booleans 直接通过值来比较 
      case '[object RegExp]':
      // RegExps 通过字符串形式比较
      case '[object String]':
        // String 也通过字符串形式比较 
        // 如`"5"`与 `new String("5")`相等.
        return '' + a === '' + b;
      case '[object Number]':
        // 通过对象是否等于自身来 判断NaN
        if (+a !== +a) return +b !== +b;
        // 判断是否为-0与+0, 是的话则通过 1/+a === 1/b来判断
        return +a === 0 ? 1 / +a === 1 / b : +a === +b;
      case '[object Date]':
      case '[object Boolean]':
        // 通过转换为数字来比较
        return +a === +b;
      case '[object Symbol]':
        // 通过其原型链上的valueOf来比较
        return SymbolProto.valueOf.call(a) === SymbolProto.valueOf.call(b);
    }

    var areArrays = className === '[object Array]';
    if (!areArrays) {
      // 如果任一不是对象, 则直接返回false
      if (typeof a != 'object' || typeof b != 'object') return false;

      // 比较构造函数, 如果构造函数不同, 则不相等,
      // 但是不同frame下的Object和Array不相等, 所以需特殊处理
      var aCtor = a.constructor, bCtor = b.constructor;
      if (aCtor !== bCtor && !(_.isFunction(aCtor) && aCtor instanceof aCtor &&
                               _.isFunction(bCtor) && bCtor instanceof bCtor)
                          && ('constructor' in a && 'constructor' in b)) {
        return false;
      }
    }

    // 初始遍历对象的栈
    // 因为只有数组或者对象的判断才需要栈, 所以放这里初始化
    // 栈主要是为了判断数组或对象是否具有循环结构
    aStack = aStack || [];
    bStack = bStack || [];
    var length = aStack.length;
    while (length--) {
      // 线性查找, 这里主要是为了查询是否是循环结构。
      if (aStack[length] === a) return bStack[length] === b;
    }

    // 将第一个对象推入栈中
    aStack.push(a);
    bStack.push(b);

    // 递归比较对象和数组
    if (areArrays) {
      // 先比较长度
      length = a.length;
      if (length !== b.length) return false;
      // 深比较, 忽略键名非数字以外的属性
      while (length--) {
        if (!eq(a[length], b[length], aStack, bStack)) return false;
      }
    } else {
      // 深比较对象
      var keys = _.keys(a), key;
      length = keys.length;
      // 先比较属性的数量
      if (_.keys(b).length !== length) return false;
      while (length--) {
        // 深比较每个属性
        key = keys[length];
        // 如果b不存在此key属性, 或者存在但不与a中的相对, 则返回false
        if (!(_.has(b, key) && eq(a[key], b[key], aStack, bStack))) return false;
      }
    }
    // 出栈
    aStack.pop();
    bStack.pop();
    return true;
  }; 
```

#### _.isEqual 
```javascript
  // 比较a、b是否相等, 利用内部私有的eq方法
  _.isEqual = function(a, b) {
    return eq(a, b);
  }; 
```

#### _.has
```javascript
  // 判断key是否为obj自身的属性, 而非原型链上的属性
  _.has = function(obj, key) {
    return obj != null && hasOwnProperty.call(obj, key);
  }; 
```

#### 类型判断
```javascript
  // 判断一个对象是否为空(即其自身上不存在可枚举属性)
  _.isEmpty = function(obj) {
    // 如果传入的obj为null或undefined, 直接返回true
    if (obj == null) return true;
    // 如果是数组、字符串、 arguments对象, 直接判断其length属性是否为0
    if (isArrayLike(obj) && (_.isArray(obj) || _.isString(obj) || _.isArguments(obj))) return obj.length === 0;
    // 其他情况通过_.keys判断其自身是否有可枚举的属性
    return _.keys(obj).length === 0;
  };

  // 判断传入的对象是否是dom元素
  _.isElement = function(obj) {
    // 通过nodeTyp来判断是否为dom元素
    return !!(obj && obj.nodeType === 1);
  };
  
  // 判断传入的obj是否为数组,
  // es5原生方法Array.isArray存在时则直接使用
  _.isArray = nativeIsArray || function(obj) {
    // 利用Object.prototype.toString来判断
    return toString.call(obj) === '[object Array]';
  };

  // 判断传入的obj是否为对象
  _.isObject = function(obj) {
    var type = typeof obj;
    // 利用type直接判断, 我们知道typeof null也会返回object, 所以通过!!obj来过滤
    return type === 'function' || type === 'object' && !!obj;
  };

  // 添加一些类型判断函数: isArguments, isFunction, isString, isNumber, isDate, 
  // isRegExp, isError, isMap, isWeakMap, isSet, isWeakSet.
  _.each(['Arguments', 'Function', 'String', 'Number', 'Date', 'RegExp', 'Error', 'Symbol', 'Map', 'WeakMap', 'Set', 'WeakSet'], function(name) {
    _['is' + name] = function(obj) {
      // 使用Object.prototype.toString来判断
      return toString.call(obj) === '[object ' + name + ']';
    };
  });

  // 定义一个用于IE9以下的isArguments回退版本, 
  if (!_.isArguments(arguments)) {
    _.isArguments = function(obj) {
      // 通过arguments上的callee来判断
      return _.has(obj, 'callee');
    };
  }

  // 优化isFuncion函数, 并修复一些在浏览器中出现的bug
  var nodelist = root.document && root.document.childNodes;
  if (typeof /./ != 'function' && typeof Int8Array != 'object' && typeof nodelist != 'function') {
    _.isFunction = function(obj) {
      // 个人认为这里的false很多余
      return typeof obj == 'function' || false;
    };
  }

  // 判断传入的obj是否为有限
  _.isFinite = function(obj) {
    return !_.isSymbol(obj) && isFinite(obj) && !isNaN(parseFloat(obj));
  };

  // 判断传入的obj是否为NaN
  _.isNaN = function(obj) {
    // 先用isNumber判断其为数字, 在用isNaN判断
    return _.isNumber(obj) && isNaN(obj);
  };

  // 判断传入的obj是否为布尔类型
  _.isBoolean = function(obj) {
    // 前者判断字面量形式创建的boolean, 后者判断new构造函数形式创建的boolean
    return obj === true || obj === false || toString.call(obj) === '[object Boolean]';
  };

  // 判断传入的obj是否为null
  _.isNull = function(obj) {
    return obj === null;
  };

  // 判断传入的obj是否为undefined
  _.isUndefined = function(obj) {
    // 为防止undefined被重写, 所以用void 0来判断
    return obj === void 0;
  }; 
```