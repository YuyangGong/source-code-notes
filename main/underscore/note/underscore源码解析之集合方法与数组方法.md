---
title: Underscore源码分析之集合与数组方法
tag: [JavaScript, Underscore, 源码分析]
---
* 库名: underscore
* 源码地址: [https://github.com/jashkenas/underscore](https://github.com/jashkenas/underscore)
* 源码版本: 1.8.3
* 分析内容: 集合方法与数组方法实现
*****

### 集合方法
#### baseCreate
```javascript
  // 先创建一个没有任何方法、属性的"空"构造函数
  var Ctor = function(){};

  // 以prototype为原型创建新对象, 与Object.create方法相同
  var baseCreate = function(prototype) {
    // 如果传入的原型不是对象, 则返回空对象。
    if (!_.isObject(prototype)) return {};
    // 如果原生的Object.create存在, 则返回原生方法
    if (nativeCreate) return nativeCreate(prototype);
	// 以上都不是的话, 则手动连接原型链, 模拟效果相同效果
	// 利用__proto__也可以实现等同效果, 但考虑到__proto__不在ES语言规范中, 故不推荐使用
    Ctor.prototype = prototype;
    var result = new Ctor;
    Ctor.prototype = null;
    return result;
  }; 
```
为兼容低版本浏览器不支持Object.create而实现的一个兼容性函数。
<!--more-->
#### optimizeCb
```javascript
  // 优化回调函数
  var optimizeCb = function(func, context, argCount) {
  	// 如果未传入上下文context则直接返回函数func
    if (context === void 0) return func;
    // 省却时默认argCount为3, 因为Underscore内部argCount为3的情况比较多,为了后续的简写少些
    switch (argCount == null ? 3 : argCount) {
      // 用实际参数替代arguments, 且优先使用call而不是apply。
      case 1: return function(value) {
        return func.call(context, value);
      };
      case 3: return function(value, index, collection) {
        return func.call(context, value, index, collection);
      };
      case 4: return function(accumulator, value, index, collection) {
        return func.call(context, accumulator, value, index, collection);
      };
    }
    return function() {
      return func.apply(context, arguments);
    };
  }; 
```
优化的原由：


*  arguments的性能较差, 能不用就尽量少用
*  call和apply有一定的性能开销, 所以当没有需要绑定的上下文时, 则直接调用
*  call的速度又比apply的速度要快, 当需要绑定上下文调用函数时尽量用call

#### cb
```javascript
  var builtinIteratee;
  // 内置回调函数, 返回可供Underscore内置迭代使用的函数
  var cb = function(value, context, argCount) {
  	// 当挂载在_实例上的iteratee迭代函数不等于内置builtinIteratee函数时候
  	// 即说明用户自定义了iteratee方法, 此时返回用户自定义的迭代方法。
    if (_.iteratee !== builtinIteratee) return _.iteratee(value, context);
    // 如果value为null或者undefined时候, 返回_.identity作为迭代函数
    // identity函数返回传入的第一个参数。
    if (value == null) return _.identity; 
    // 如果是函数, 则返回优化后的回调
    if (_.isFunction(value)) return optimizeCb(value, context, argCount);
    // 如果是对象则通过matcher方法判断后续对象是否与此前对象所有属性相同
    if (_.isObject(value)) return _.matcher(value);
    // 如果是值类型, 则通过property函数返回对象相关属性的值
    return _.property(value);
  };
  // 用户可以通过修改_.iteratee来改变每次迭代的行为方式
  _.iteratee = builtinIteratee = function(value, context) {
    return cb(value, context, Infinity);
  };
```
内置了一个builtinInteratee函数并将其引用与_.iteratee方法连接起来, 每次执行cb时判定builtinInteratee与_.iteratee是否相等, 如果不相等的话, 则代表用户修改了_.iteratee, 则cb优先使用用户修改的iteratee方法。

#### resArgs
```javascript 
  // 包装函数func, 使其从startIndex位置以后传入的参数都为一个统一的数组
  var restArgs = function(func, startIndex) {
  	// startIndex在未被传参的时候默认为最后一位
    startIndex = startIndex == null ? func.length - 1 : +startIndex;
    return function() {
      var length = Math.max(arguments.length - startIndex, 0);
      var rest = Array(length);
      for (var index = 0; index < length; index++) {
        rest[index] = arguments[index + startIndex];
      }
      // 此处同optimizeCb函数一样, 是为了优化性能, 尽量使用call代替apply
      switch (startIndex) {
        case 0: return func.call(this, rest);
        case 1: return func.call(this, arguments[0], rest);
        case 2: return func.call(this, arguments[0], arguments[1], rest);
      }
      var args = Array(startIndex + 1);
      for (index = 0; index < startIndex; index++) {
        args[index] = arguments[index];
      }
      args[startIndex] = rest;
      return func.apply(this, args);
    };
  };
```
类似与es6中的rest param, 但是这里只能另处在末尾的参数为数组, 不能另中间的也为数组。
eg: 可以做到这样：```func(a, ...b)```, 但是不能做到这样：```func(a, ...b, c)```
#### property
```javascript
  // 先接收key, 然后可以依次调用在每个对象上以获取其相应的key属性
  var property = function(key) {
    return function(obj) {
      // 如果obj为null或者undefined, 则直接返回void 0(等同于undefined)
      return obj == null ? void 0 : obj[key];
    };
  }; 
```
这里用void 0 代替undefined的原因有:

* 防止undefined被覆盖, 在非严格模式下, undefined可以被重命名, 导致指向其他值, 如
```javascript
  undefined = 1;
  console.log(undefined); // 1
  console.log(void 0); // undefined
```
* void 0 性能稍微比undefined快一些

其返回的函数对与null相等(这里不是严格相等, 所以也包括undefined)的输入做了判断, 如果为真, 则直接返回void 0, 这一步是为了防止直接读取null或undefined上面的属性而报错。
```javascript
  console.log(property('length')(null)); // undefined
  console.log(property('length')(undefined)); // undefined 
  console.log(null.length); // TypeError
```

#### getLength
```javascript
  // 获取对象的长度
  var getLength = property('length'); 
```
这里使用property去获取length, 而不是直接使用obj.length, 在功能方面, 避免了后续传入的obj为undefined或null时候报错。 
例子如下
```javascript
  console.log(getLength(null)); // undefined
  console.log(null.length); // TypeError 
```

#### isArrayLike
```javascript
  // 判断是否是类数组, 根据其是否有length这个属性
  // 且其类型为number, 大于等于0且小于最大安全索引数
  var MAX_ARRAY_INDEX = Math.pow(2, 53) - 1;
  var isArrayLike = function(collection) {
    var length = getLength(collection);
    return typeof length == 'number' && length >= 0 && length <= MAX_ARRAY_INDEX;
  }; 
```

#### _.each
```javascript
  // 遍历数组成员, 并用iteratee进行处理
  // (ps: 与原生相比,有几点不同,原生的forEach没有返回值,且会跳过数组稀疏位)
  _.each = _.forEach = function(obj, iteratee, context) {
    iteratee = optimizeCb(iteratee, context);
    var i, length;
    // 如果是类数组, 则按照其索引, 以length为界限进行遍历
    if (isArrayLike(obj)) {
      for (i = 0, length = obj.length; i < length; i++) {
        iteratee(obj[i], i, obj);
      }
    } else {
      // 非类数组的情况, 就根据其key-value对 进行遍历
      var keys = _.keys(obj);
      for (i = 0, length = keys.length; i < length; i++) {
        iteratee(obj[keys[i]], keys[i], obj);
      }
    }
    return obj;
  }; 
```

#### _.map
```javascript
  // 用iteratee迭代处理每个obj中的元素并返回, 以返回值组成新的对象
  _.map = _.collect = function(obj, iteratee, context) {
    iteratee = cb(iteratee, context);
    // 如果不是类数组则将其键数组赋值给keys, 否则直接将false赋值给keys。
    var keys = !isArrayLike(obj) && _.keys(obj),
    	// 获取内容长度, 如果keys存在则代表是非类数组, 即其length不合法
    	// 优先使用keys的长度
        length = (keys || obj).length,
        // 预定义一个给定length的稀疏数组
        results = Array(length);
    // 遍历数组元素, 处理后将返回值赋值给results上相应index位置元素
    for (var index = 0; index < length; index++) {
      var currentKey = keys ? keys[index] : index;
      results[index] = iteratee(obj[currentKey], currentKey, obj);
    }
    return results;
  }; 
```
这里没有先定义一个length长度为0的空数组, 而是预定义了一个给定length的稀疏数组, 因为后者性能比前者佳, 速度更快。

#### createReduce
```javascript
  // 创造一个reduce辅助函数, 根据dir来判断其是从左向右遍历还是从右向左。
  var createReduce = function(dir) {
    var reducer = function(obj, iteratee, memo, initial) {
      // 这一部分与_.map中分析的相同
      var keys = !isArrayLike(obj) && _.keys(obj),
          length = (keys || obj).length,
          index = dir > 0 ? 0 : length - 1;
      // 如果没有初始值, 则将对象中的第一个元素设为初始值, 并设置遍历从对象的第二个元素开始
      if (!initial) {
        memo = obj[keys ? keys[index] : index];
        index += dir;
      }
      // 循环需要满足俩个条件才会进入, index >= 0是用来限制dir为-1的情况, index < length是用来限制dir为1的情况
      for (; index >= 0 && index < length; index += dir) {
        var currentKey = keys ? keys[index] : index;
        memo = iteratee(memo, obj[currentKey], currentKey, obj);
      }
      return memo;
    };

    return function(obj, iteratee, memo, context) {
      var initial = arguments.length >= 3;
      return reducer(obj, optimizeCb(iteratee, context, 4), memo, initial);
    };
  }; 
```

#### _.reduce
```javascript
  // 利用createReduce函数创建一个reduce函数来累计值, 以计算总值
  _.reduce = _.foldl = _.inject = createReduce(1);

  // reduce的从左到右累计版本
  _.reduceRight = _.foldr = createReduce(-1); 
```
createReduce将共同逻辑封装了, 这里创建函数就显得很优雅, 简单易懂

#### _.find
```javascript
  // 返回数组或对象中第一个经predicate检查为真的元素
  _.find = _.detect = function(obj, predicate, context) {
  	// 类数组对象借助_.findIndex实现, 非类数组对象借助_.findKey实现
    var keyFinder = isArrayLike(obj) ? _.findIndex : _.findKey;
    var key = keyFinder(obj, predicate, context);
    if (key !== void 0 && key !== -1) return obj[key];
  }; 
```

#### _.filter
```javascript
  // 返回数组或对象中所有经predicate检查为真的元素
  _.filter = _.select = function(obj, predicate, context) {
    var results = [];
    predicate = cb(predicate, context);
    _.each(obj, function(value, index, list) {
      if (predicate(value, index, list)) results.push(value);
    });
    return results;
  }; 
```

#### _.reject
```javascript
  // 返回数组或对象中所有经predicate检查为假值的元素
  _.reject = function(obj, predicate, context) {
    // 借助_.negate实现predicate的取反
    // 又因为_.negate只能接受函数为参数, 所以需要用cb函数转换一遍
    return _.filter(obj, _.negate(cb(predicate)), context);
  }; 
```

#### _.every
```javascript
  // 是否数组或对象中的所有元素值都经predicate函数返回true
  _.every = _.all = function(obj, predicate, context) {
    predicate = cb(predicate, context);
    var keys = !isArrayLike(obj) && _.keys(obj),
        length = (keys || obj).length;
    for (var index = 0; index < length; index++) {
      var currentKey = keys ? keys[index] : index;
      if (!predicate(obj[currentKey], currentKey, obj)) return false;
    }
    return true;
  }; 
```

#### _.some
```javascript
  // 是否数组或对象中的某一元素值经predicate函数返回true
  _.some = _.any = function(obj, predicate, context) {
    predicate = cb(predicate, context);
    var keys = !isArrayLike(obj) && _.keys(obj),
        length = (keys || obj).length;
    for (var index = 0; index < length; index++) {
      var currentKey = keys ? keys[index] : index;
      if (predicate(obj[currentKey], currentKey, obj)) return true;
    }
    return false;
  }; 
```

#### _.contains
```javascript
  // 从fromIndex开始查找(如果省缺或者传入了第四个参数guard且其为真,就从头开始), 如果obj包括item元素就返回true, 用===严格相等比较, 
  _.contains = _.includes = _.include = function(obj, item, fromIndex, guard) {
    if (!isArrayLike(obj)) obj = _.values(obj);
    if (typeof fromIndex != 'number' || guard) fromIndex = 0;
    // 内部借助_.indexOf实现
    return _.indexOf(obj, item, fromIndex) >= 0;
  }; 
```

#### _.invoke
```javascript
  // 以obj上的每个元素为上下文, 依次传入args参数来调用method函数
  _.invoke = restArgs(function(obj, method, args) {
    var isFunc = _.isFunction(method);
    return _.map(obj, function(value) {
      // 如果传入的func不是函数, 则在集合元素上取其键名等同于method的值
      var func = isFunc ? method : value[method];
      // 如果func存在则调用, 否则就返回func
      // 当func存在但不为函数时会报错
      return func == null ? func : func.apply(value, args);
    });
  }); 
```

#### _.pluck
```javascript
  // 获取集合中每个元素key相应的值
  _.pluck = function(obj, key) {
    return _.map(obj, _.property(key));
  }; 
```

#### _.where
```javascript
  // 返回集合中所有包含特定`key:value`对的元素
  _.where = function(obj, attrs) {
    return _.filter(obj, _.matcher(attrs));
  }; 
```

#### _.findWhere
```javascript
  // 返回集合中第一个出现的包含特定`key:value`对的元素
  _.findWhere = function(obj, attrs) {
    return _.find(obj, _.matcher(attrs));
  }; 
```

#### _.max
```javascript
  // 返回集合中最大的元素 (如果存在iteratee, 则其大小的评估将基于iteratee计算).
  _.max = function(obj, iteratee, context) {
    var result = -Infinity, lastComputed = -Infinity,
        value, computed;
    if (iteratee == null || (typeof iteratee == 'number' && typeof obj[0] != 'object') && obj != null) {
      obj = isArrayLike(obj) ? obj : _.values(obj);
      for (var i = 0, length = obj.length; i < length; i++) {
        value = obj[i];
        // 如果目前的值value大于最大值result, 且不等于null或undefined
        // 则将value赋值给result
        if (value != null && value > result) {
          result = value;
        }
      }
    // 如果存在interatee, 则每次用回调函数处理元素以得到计算值。
    // 比较计算值, 获取最大值时候的元素, 并在最后一步返回
    } else {
      iteratee = cb(iteratee, context);
      _.each(obj, function(v, index, list) {
        computed = iteratee(v, index, list);
        // 如果计算值大于最大计算值 或者目前计算值和最大值result都为无限小
        // 则将最大值result设置为目前值v, 最大计算值lastComputed设置为目前计算值computed
        // 这里判断computed === -Infinity && result === -Infinity是为了防止只有一个元素的数组错误的返回-Infinity
        if (computed > lastComputed || computed === -Infinity && result === -Infinity) {
          result = v;
          lastComputed = computed;
        }
      });
    }
    // 当obj为空时候将默认返回初始值, -Infinity
    return result;
  };
```
判断 ```value != null``` 的原因是防止null与数值比较发生隐式转换产生未知的结果, 如:
```javascript
  null > -1 // true 因为null被隐式转换为数字0
```
具体比较规则有：

* 如果两个操作数都是数值，则执行数值比较。
* 如果两个操作数都是字符串，则比较两个字符串对应的字符编码值。
* 如果一个操作数是数值，则将另一个操作数转换为一个数值，然后执行数值比较。
* 如果一个操作数是对象，则调用这个对象的 ```valueOf()```方法，用得到的结果按照前面的规则执行比较。如果对象没有 ```valueOf()```方法，则调用 ```toString()```方法，并用得到的结果根据前面的规则执行比
* 如果一个操作数是布尔值，则先将其转换为数值，然后再执行比较。

#### _.min
```javascript
  // 返回集合中最小的元素 (如果存在iteratee, 则其大小的评估将基于iteratee计算).
  _.min = function(obj, iteratee, context) {
    var result = Infinity, lastComputed = Infinity,
        value, computed;
    if (iteratee == null || (typeof iteratee == 'number' && typeof obj[0] != 'object') && obj != null) {
      obj = isArrayLike(obj) ? obj : _.values(obj);
      for (var i = 0, length = obj.length; i < length; i++) {
        value = obj[i];
        if (value != null && value < result) {
          result = value;
        }
      }
    } else {
      iteratee = cb(iteratee, context);
      _.each(obj, function(v, index, list) {
        computed = iteratee(v, index, list);
        if (computed < lastComputed || computed === Infinity && result === Infinity) {
          result = v;
          lastComputed = computed;
        }
      });
    }
    return result;
  }; 
```
思路类似_.max
#### _.sample
```javascript
  // 一个随机打乱的洗牌算法
  _.sample = function(obj, n, guard) {
    // 如果n为null、undefined 或者 guard值为真, 则返回obj中的一个随机元素
    if (n == null || guard) {
      if (!isArrayLike(obj)) obj = _.values(obj);
      return obj[_.random(obj.length - 1)];
    }
    // 如果是类数组则直接克隆一个副本, 如果不是则取其值为数组
    var sample = isArrayLike(obj) ? _.clone(obj) : _.values(obj);
    var length = getLength(sample);
    // Math.min(n, length) 设定给出的n最大为length, Math.max(n, 0) 设定n最小为0
    n = Math.max(Math.min(n, length), 0);
    var last = length - 1;
    for (var index = 0; index < n; index++) {
      // 随机算法, 每次将index位的元素与后面随机位的元素交换
      var rand = _.random(index, last);
      var temp = sample[index];
      sample[index] = sample[rand];
      sample[rand] = temp;
    }
    // 截取给定的长度
    return sample.slice(0, n);
  };
```
利用[Fisher-Yates shuffle](http://en.wikipedia.org/wiki/Fisher–Yates_shuffle)算法进行随机取样。

####  _.shuffle
```javascript
  // 利用之前的_.sample方法打乱一个集合的内部排序
  _.shuffle = function(obj) {
    return _.sample(obj, Infinity);
  }; 
```

#### _.sortBy
```javascript
  // 依据iteratee, 对集合中的每个元素进行处理后进行排序
  _.sortBy = function(obj, iteratee, context) {
    var index = 0;
    iteratee = cb(iteratee, context);
    // 返回一个新对象, 包含value, index, criteria三个属性, 后续会用这三属性进行排序
    // 并通过_.pluck将排序后集合中的每个对象的value值提取出来组成新数组。    
    return _.pluck(_.map(obj, function(value, key, list) {
      return {
        value: value,
        index: index++,
        criteria: iteratee(value, key, list)
      };
    // 利用原生的Array.prototype.sort 进行排序
    }).sort(function(left, right) {
      var a = left.criteria;
      var b = right.criteria;
      // 当a不等于b时, 可直接进行返回
      if (a !== b) {
        // 比较a, b是否是void 0, 以将undefined排序至集合末尾
        if (a > b || a === void 0) return 1;
        if (a < b || b === void 0) return -1;
      }
      // 如果a与b相等, 则比较其索引
      return left.index - right.index;
    }), 'value');
  }; 
```

#### group
```javascript
  // 为后续的_.groupBy方法而预先定义的一个内部私有方法
  // behavior用来处理最终需要返回的结果, partition用来判定是否简单分割
  var group = function(behavior, partition) {
    return function(obj, iteratee, context) {
      // 如果partition为真值则做简单分割, 以二维数组为容器, 否则以空对象为容器
      var result = partition ? [[], []] : {};
      iteratee = cb(iteratee, context);
      _.each(obj, function(value, index) {
        // 获取相应的键值
        var key = iteratee(value, index, obj);
        // 用behavior处理result
        behavior(result, value, key);
      });
      // 返回最终结果
      return result;
    };
  }; 
```

#### _.groupBy
```javascript
  // 利用之前的group方法进行分组
  _.groupBy = group(function(result, value, key) {
    // 如果已经存在此键值数组, 则push进去 
    if (_.has(result, key)) result[key].push(value); 
    // 否则为此键值新建一个仅包含目前value的数组
    else result[key] = [value];
  }); 
```

#### _.indexBy
```javascript
  // 以传入的集合为样本, 生成相应的 `key-value` 对象
  // 如果有同key的键值对, 则后者会覆盖前者
  _.indexBy = group(function(result, value, key) {
    result[key] = value;
  }); 
```

#### _.countBy
```javascript
  // 返回集合中的对象的数量的计数。类似groupBy，但是不是返回列表的值，而是返回在该组中值的数目。
  _.countBy = group(function(result, value, key) {
    if (_.has(result, key)) result[key]++; else result[key] = 1;
  }); 
```

#### _.toArray
```javascript
  // 根据utf-16对任意字符进行处理, 来创建数组
  // [^\ud800-\udfff] 表示不包含代理对代码点的所有字符
  // [\ud800-\udbff][\udc00-\udfff] 表示合法的代理对的所有字符
  // [\ud800-\udfff] 表示代理对的代码点（本身不是合法的Unicode字符）
  // 来自[知乎](https://www.zhihu.com/question/38324041)
  var reStrSymbol = /[^\ud800-\udfff]|[\ud800-\udbff][\udc00-\udfff]|[\ud800-\udfff]/g;
  // 将传入的obj转化为数组
  _.toArray = function(obj) {
    // 如果obj为假值, 则直接返回空数组
    if (!obj) return [];
    // 如果obj本身就是数组, 则返回其拷贝
    if (_.isArray(obj)) return slice.call(obj);
    // 如果obj是字符串, 则按字符分割成数组
    if (_.isString(obj)) {
      // 保持代理对字符被解析为一个字符
      return obj.match(reStrSymbol);
    }
    // 如果是类数组, 则返回其数组形式的映射
    if (isArrayLike(obj)) return _.map(obj, _.identity);
    // 其他情况返回其values数组
    return _.values(obj);
  }; 
```

#### _.size
```javascript
  // 返回对象的元素数量
  _.size = function(obj) {
    if (obj == null) return 0;
    return isArrayLike(obj) ? obj.length : _.keys(obj).length;
  }; 
```

#### _.partition
```javascript
  // 将集合分割为俩部分, 前者通过predicate为真值, 后者为假值
  _.partition = group(function(result, value, pass) {
    result[pass ? 0 : 1].push(value);
  }, true); 
```

### 数组方法
#### _.initial
```javascript
  // 返回数组中除了最后n个以外的其他所有元素。
  _.initial = function(array, n, guard) {
    return slice.call(array, 0, Math.max(0, array.length - (n == null || guard ? 1 : n)));
  }; 
```
个人认为initial也可以这样重写
```javascript
  _.initial = function(array, n, guard) {
    return slice.call(array, 0, -(Math.max(n == null || guard ? 1 : n, 0)));
  };
```

#### _.first
```javascript
  // 返回数组中的前n个元素
  _.first = _.head = _.take = function(array, n, guard) {
    // 如果数组不存在, 或者数组的长度小于1, 则返回undefined
    if (array == null || array.length < 1) return void 0;
    // 如果n不存在或者guard为真值, 则返回数组的第一个元素
    if (n == null || guard) return array[0];
    // 以上情况都不是就利用_.initial返回数组的前n个元素
    return _.initial(array, array.length - n);
  }; 
```

#### _.rest
```javascript
  // 返回数组中除了前面n个元素以外的所有元素
  _.rest = _.tail = _.drop = function(array, n, guard) {
    return slice.call(array, n == null || guard ? 1 : n);
  }; 
```

#### _.last 
```javascript
  // 返回数组中最后的n个元素
  _.last = function(array, n, guard) {
    if (array == null || array.length < 1) return void 0;
    if (n == null || guard) return array[array.length - 1];
    return _.rest(array, Math.max(0, array.length - n));
  }; 
```

#### _.compact
```javascript
  // 去除数组中的所有假值元素
  _.compact = function(array) {
    return _.filter(array, Boolean);
  }; 
```

#### _.flatten
```javascript
  // 递归实现的内部`flatten`函数
  var flatten = function(input, shallow, strict, output) {
    // 通过output来保存结果
    output = output || [];
    // 用idx追踪目前的索引位, 以便后续赋值, 这样比直接push性能要好
    var idx = output.length;
    // 遍历input数组
    for (var i = 0, length = getLength(input); i < length; i++) {
      var value = input[i];
      // 如果目前的value是类数组, 并且是数组或arguments, 则根据shallow参数进行展平
      if (isArrayLike(value) && (_.isArray(value) || _.isArguments(value))) {
        // 如果shallow为真值, 则仅展平一层
        if (shallow) {
          var j = 0, len = value.length;
          while (j < len) output[idx++] = value[j++];
        // 其他情况递归展平
        } else {
          flatten(value, shallow, strict, output);
          idx = output.length;
        }
      // 其他情况, 且非严格情况, 则添加到output的末尾
      // 严格模式下就跳过
      } else if (!strict) {
        output[idx++] = value;
      }
    }
    return output;
  };

  // 展平一个数组, 可以通过传入shallow来决定是否只展平一层, 还是递归展平全部
  _.flatten = function(array, shallow) {
    return flatten(array, shallow, false);
  };   
```

#### _.difference
```javascript
  // 返回仅在第一个数组中出现的元素
  _.difference = restArgs(function(array, rest) {
    // 注意这里第三个参数传入的是true, 代表其为严格模式, 如果rest中的直接子元素是非类数组会被忽略
    rest = flatten(rest, true, true);
    return _.filter(array, function(value){
      // 过滤掉同时出现在其他数组中的元素
      return !_.contains(rest, value);
    });
  }); 
```

#### _.without
```javascript
  // 返回仅在第一个数组中出现的元素, 与_.difference不同的是otherArrays中的直接子元素
  // 为非类数组时不会被忽略, 因为经restArgs再包装, 
  // 所有array后的参数都被并入了otherArrays,
  // otherArrays作为单一数组又在_.difference中被再包装
  _.without = restArgs(function(array, otherArrays) {
    return _.difference(array, otherArrays);
  }); 
```

#### _.uniq
```javascript
  // 数组去重, 如果数组已经排序, 可以传入isSorted参数来使用更快的算法
  _.uniq = _.unique = function(array, isSorted, iteratee, context) {
    // 通过这一步, 当数组没有排序或不想使用更快算法时, 可以省缺isSorted
    if (!_.isBoolean(isSorted)) {
      context = iteratee;
      iteratee = isSorted;
      isSorted = false;
    }
    if (iteratee != null) iteratee = cb(iteratee, context);
    var result = [];
    // 当数组array已被排序时, 用来保存上一次的结果,
    // 当其未被排序时候, 用来保存之前计算值 
    var seen = [];
    // 遍历数组
    for (var i = 0, length = getLength(array); i < length; i++) {
      var value = array[i],
          // 如果iteratee存在, 则求其计算值, 否则用原值作为计算值
          computed = iteratee ? iteratee(value, i, array) : value;
      // 如果数组已经排序了, 则直接比较是否与上一值相同, 不相同就push
      // 当索引为第一位时也push
      if (isSorted) {
        if (!i || seen !== computed) result.push(value);
        seen = computed;
      // 如果iteratee存在, 则查询其计算值数组, 
      // 如果目前的计算值不与计算值数组中有重复则push
      } else if (iteratee) {
        if (!_.contains(seen, computed)) {
          seen.push(computed);
          result.push(value);
        }
      // 如果iteratee不存在, 则直接在结果数组中查找目前元素是否已存在
      } else if (!_.contains(result, value)) {
        result.push(value);
      }
    }
    return result;
  }; 
```

#### _.union
```javascript
  // 返回传入数组的并集, 并去重
  _.union = restArgs(function(arrays) {
    return _.uniq(flatten(arrays, true, true));
  }); 
```

#### _.intersection
```javascript
  // 返回传入数组的交集(即在所有数组中都出现过)
  _.intersection = function(array) {
    var result = [];
    var argsLength = arguments.length;
    for (var i = 0, length = getLength(array); i < length; i++) {
      var item = array[i];
      if (_.contains(result, item)) continue;
      var j;
      for (j = 1; j < argsLength; j++) {
        if (!_.contains(arguments[j], item)) break;
      }
      if (j === argsLength) result.push(item);
    }
    return result;
  }; 
```
比较好奇的是这里为什么不能像之前一样用restArgs, 而要使用arguments?
当然, 如果用restArgs, 可以这样重写
```javascript
  _.intersection = restArgs(function(array, args) {
    var result = [];
    var argsLength = args.length;
    for (var i = 0, length = getLength(array); i < length; i++) {
      var item = array[i];
      if (_.contains(result, item)) continue;
      var j;
      for (j = 0; j < argsLength; j++) {
        if (!_.contains(arguments[j], item)) break;
      }
      if (j === argsLength) result.push(item);
    }
    return result;
  }); 
```

#### _.unzip
```javascript
  // 接受一个二维数组, 并将其子数组的元素以索引值打包
  _.unzip = function(array) {
    // 获取数组中长度最大的子数组的长度
    var length = array && _.max(array, getLength).length || 0;
    // 预先定义一定长度的稀疏数组, 相比与新建空数组后push, 性能要更好
    var result = Array(length);
    // 遍历取值
    for (var index = 0; index < length; index++) {
      result[index] = _.pluck(array, index);
    }
    return result;
  }; 
```

#### _.zip
```javascript
  // 利用restArgs 与 _.unzip实现的zip函数
  // 除了传入的参数不是唯一的一个二维数组, 而是多个参数,
  // 其他效果相同
  _.zip = restArgs(_.unzip); 
```

#### _.object
```javascript
  // 将列表转化为对象, 传递任何一个单独[key, value]对的列表，
  // 或者一个键的列表和一个值的列表。 
  // 如果存在重复键，最后一个值将被返回。
  _.object = function(list, values) {
    var result = {};
    for (var i = 0, length = getLength(list); i < length; i++) {
      // 如果values存在, 则代表传入的是一个key列表, 和一个value列表
      if (values) {
        result[list[i]] = values[i];
      // 如果values不存在, 则代表传入的是一个单独的[key, value]对的列表
      } else {
        result[list[i][0]] = list[i][1];
      }
    }
    return result;
  }; 
```

#### \_.findIndex 与 \_.findLastIndex
```javascript
  // 为了创建findIndex和findLastIndex的内部私有函数, 封装了共有逻辑
  var createPredicateIndexFinder = function(dir) {
    return function(array, predicate, context) {
      predicate = cb(predicate, context);
      var length = getLength(array);
      var index = dir > 0 ? 0 : length - 1;
      for (; index >= 0 && index < length; index += dir) {
        if (predicate(array[index], index, array)) return index;
      }
      return -1;
    };
  };

  // 返回匹配predicate的第一个值的索引
  _.findIndex = createPredicateIndexFinder(1);
  // 返回匹配predicate的最后一个值的索引
  _.findLastIndex = createPredicateIndexFinder(-1); 
```

#### _.sortedIndex
```javascript
  // 利用二分查找法去查询能够插入元素且保持其排序不变的位置
  _.sortedIndex = function(array, obj, iteratee, context) {
    iteratee = cb(iteratee, context, 1);
    var value = iteratee(obj);
    var low = 0, high = getLength(array);
    while (low < high) {
      var mid = Math.floor((low + high) / 2);
      if (iteratee(array[mid]) < value) low = mid + 1; else high = mid;
    }
    return low;
  }; 
```

#### \_.indexOf 与 \_.lastIndexOf
```javascript
  // 为了创建indexOf和lastIndexOf的内部私有函数, 封装了共有逻辑
  var createIndexFinder = function(dir, predicateFind, sortedIndex) {
    return function(array, item, idx) {
      var i = 0, length = getLength(array);
      if (typeof idx == 'number') {
        if (dir > 0) {
          // 如果传入的idx为负, 则会取其倒数第idx绝对值的位置开始查询
          i = idx >= 0 ? idx : Math.max(idx + length, i);
        } else {
          length = idx >= 0 ? Math.min(idx + 1, length) : idx + length + 1;
        }
      // 如果sortedIndex存在, idx存在且不为数字, length存在, 
      // 则用sortedIndex方法去查找索引
      } else if (sortedIndex && idx && length) {
        idx = sortedIndex(array, item);
        return array[idx] === item ? idx : -1;
      }
      // 如果item不等于自身, 则代表其为NaN, 需要用特定的方法去比较
      if (item !== item) {
        idx = predicateFind(slice.call(array, i, length), _.isNaN);
        return idx >= 0 ? idx + i : -1;
      }
      // 遍历查找
      for (idx = dir > 0 ? i : length - 1; idx >= 0 && idx < length; idx += dir) {
        if (array[idx] === item) return idx;
      }
      return -1;
    };
  };

  // 返回数组中特定元素第一次出现的索引, 如果一次都没有出现则返回-1, 
  // 如果数组已经排序, 可以传入isSorted为true, 使其用效率更高的二分查找算法
  _.indexOf = createIndexFinder(1, _.findIndex, _.sortedIndex);
  _.lastIndexOf = createIndexFinder(-1, _.findLastIndex); 
```

#### _.range
```javascript
  // 根据传入的参数生成数组, 类似等差数列
  _.range = function(start, stop, step) {
    // 如果stop不存在, 即另传入的第一个参数为stop
    if (stop == null) {
      stop = start || 0;
      start = 0;
    }
    // 如果步数step不存在, 则根据其start与stop的大小比较来判断其是1或者-1
    if (!step) {
      step = stop < start ? -1 : 1;
    }

    var length = Math.max(Math.ceil((stop - start) / step), 0);
    var range = Array(length);

    for (var idx = 0; idx < length; idx++, start += step) {
      range[idx] = start;
    }

    return range;
  }; 
```

#### _.chunk
```javascript
  // 将数组array分成多个小数组, 每个小数组包含count个元素
  // of initial array.
  _.chunk = function(array, count) {
    if (count == null || count < 1) return [];

    var result = [];
    var i = 0, length = array.length;
    while (i < length) {
      result.push(slice.call(array, i, i += count));
    }
    return result;
  }; 
```