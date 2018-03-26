---
title: Underscore源码分析之公共方法与模板引擎的实现
tag: [JavaScript, Underscore, 源码分析]
---
* 库名: underscore
* 源码地址: [https://github.com/jashkenas/underscore](https://github.com/jashkenas/underscore)
* 源码版本: 1.8.3
* 分析内容: 公共方法与模板引擎的实现
*****

#### _.identity
```javascript
  // 直接返回传入的参数, 作为underscore的默认迭代器
  _.identity = function(value) {
    return value;
  }; 
```
<!--more-->
#### _.constant
```javascript
  // 一个二段函数, 第一段调用的时候传入一个value, 利用词法作用域链保存在内存中,
  // 在第二段函数(即内部函数)调用时返回这个value
  _.constant = function(value) {
    return function() {
      return value;
    };
  }; 
```

#### _.noop
```javascript
  // 无论传入什么参数都返回undefined, 在内部做默认可选的迭代器函数
  _.noop = function(){}; 
```

#### _.propertyOf
```javascript
  // 返回对象特定的某个属性
  _.propertyOf = function(obj) {
    // 在obj为null、undefined时返回一个空对象, 避免边界情况报错
    // 如错误的读取了null上的属性
    return obj == null ? function(){} : function(key) {
      return obj[key];
    };
  }; 
```

#### _.matcher
```javascript
  // 检测是否函数上具有相应的键值对
  _.matcher = _.matches = function(attrs) {
    // 拷贝attrs, 这里拷贝的原因是怕原attrs在后续被修改。
    // 因为传的是引用, 所以外部的修改也会影响到内部。
    attrs = _.extendOwn({}, attrs);
    return function(obj) {
      return _.isMatch(obj, attrs);
    };
  }; 
``` 

#### _.times
```javascript
  // 执行一个函数n次, 并将这n次执行的返回值以一个数组的形式一起返回
  _.times = function(n, iteratee, context) {
    // acuum数组, 用以保存函数执行的返回值
    var accum = Array(Math.max(0, n));
    iteratee = optimizeCb(iteratee, context, 1);
    // 一次执行, 并每次分别传入i参数
    for (var i = 0; i < n; i++) accum[i] = iteratee(i);
    return accum;
  }; 
```

#### _.random 
```javascript
  // 返回一个介于min与max(包括max)之间的随机值。
  _.random = function(min, max) {
    if (max == null) {
      max = min;
      min = 0;
    }
    return min + Math.floor(Math.random() * (max - min + 1));
  }; 
```

#### _.now
```javascript
  // 获取目前时间的时间戳
  _.now = Date.now || function() {
    return new Date().getTime();
  }; 
```

#### _.escape与_.unescape
```javascript
  // 转义字符编码表
  var escapeMap = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '`': '&#x60;'
  };
  // 转义字符解码表
  var unescapeMap = _.invert(escapeMap);

  // 解码/编码HTML转义字符的函数
  var createEscaper = function(map) {
    // 返回编码/解码表中属性对应的值
    var escaper = function(match) {
      return map[match];
    };
    // 用于查询需要被替换字符的正则表达式
    var source = '(?:' + _.keys(map).join('|') + ')';
    // 测试正则
    var testRegexp = RegExp(source);
    // 替换正则
    var replaceRegexp = RegExp(source, 'g');
    return function(string) {
      string = string == null ? '' : '' + string;
      return testRegexp.test(string) ? string.replace(replaceRegexp, escaper) : string;
    };
  };
  _.escape = createEscaper(escapeMap);
  _.unescape = createEscaper(unescapeMap); 
```

#### _.result 
```javascript
  // 如果object[prop]是一个函数, 则以object为上下文调用object[prop], 
  // 如果object[prop]不存在, 但是fallback存在且为函数,
  // 则以object为上下文调用fallback,
  // 以上都不是, 则返回object[prop], 不存在时返回fallback
  _.result = function(object, prop, fallback) {
    var value = object == null ? void 0 : object[prop];
    if (value === void 0) {
      value = fallback;
    }
    return _.isFunction(value) ? value.call(object) : value;
  }; 
```

####　_.uniqueId
```javascript
  // // 生成一个独一无二的ID, 仅仅在浏览器session中有效。
  var idCounter = 0;
  _.uniqueId = function(prefix) {
    var id = ++idCounter + '';
    return prefix ? prefix + id : id;
  }; 
```

### 模板引擎
```javascript
  // 用来匹配相应模板的正则, 可以修改来自定义
  _.templateSettings = {
    // 匹配表达式
    evaluate: /<%([\s\S]+?)%>/g,
    // 匹配不需要转义的字符串
    interpolate: /<%=([\s\S]+?)%>/g,
    // 匹配需要转义的字符串
    escape: /<%-([\s\S]+?)%>/g
  }; 
  // 一个永远无法匹配成功的正则, /$(.)/ 也可以达到类似的效果
  // 当在自定义`templateSettings`时
  // 不想定义interpolate或者escape可以这么用
  var noMatch = /(.)^/;

  // 需要转义才能在字符串字面量中使用
  var escapes = {
    "'": "'",
    '\\': '\\',
    '\r': 'r',
    '\n': 'n',
    '\u2028': 'u2028',
    '\u2029': 'u2029'
  };

  var escapeRegExp = /\\|'|\r|\n|\u2028|\u2029/g;

  var escapeChar = function(match) {
    return '\\' + escapes[match];
  };

  // 模板核心代码
  _.template = function(text, settings, oldSettings) {
    // 如果settings不存在而oldSettings存在, 则使用oldSettings
    if (!settings && oldSettings) settings = oldSettings;
    // 创建一个空对象, 并通过defaults使其继承settings和_.templateSettings
    // 优先保留settings中的属性
    settings = _.defaults({}, settings, _.templateSettings);

    // 将模板边界判断转换为正则表达式
    // Ps: 这里也匹配了结束边界$, 以便匹配到末尾的字符串内容
    var matcher = RegExp([
      (settings.escape || noMatch).source,
      (settings.interpolate || noMatch).source,
      (settings.evaluate || noMatch).source
    ].join('|') + '|$', 'g');

    // 编译模板, 转义字符串字面量
    var index = 0;
    // 在模板内部编译时候, 把编译后的字符串保存在内部的__p变量中
    var source = "__p+='";
    //  匹配模板内容
    text.replace(matcher, function(match, escape, interpolate, evaluate, offset) {
      // index到offset之间, 即不包括在任何模板边界当中的内容属于普通字符串, 
      // 只需要转义字符串处理便可添加
      source += text.slice(index, offset).replace(escapeRegExp, escapeChar);
      // 手动调整index位置, 移动到match后面的位置
      index = offset + match.length;
	  // 如果匹配到编码模板边界
      if (escape) {
      	// 在模板内部, 将escape赋值给内部的变量__t, 然后判断其是否存在,
      	// 存在的话就用_.escape来解码后添加, 否则添加空字符串
        source += "'+\n((__t=(" + escape + "))==null?'':_.escape(__t))+\n'";
      } else if (interpolate) {
      	// 同上, 只不过这里的interpolate不解码直接添加
        source += "'+\n((__t=(" + interpolate + "))==null?'':__t)+\n'";
      } else if (evaluate) {
      	// evaluate表达式放在内部的字符串之外
        source += "';\n" + evaluate + "\n__p+='";
      }
      return match;
    });
    source += "';\n";

    // 如果没有指明变量, 则绑定传入的obj(不存在时候绑定{})在其作用域上
    if (!settings.variable) source = 'with(obj||{}){\n' + source + '}\n';

	// 进行内部的变量定义, 定义__t作为一个中间变量,供后续使用,
	// __p则用来保存结果字符串, __j指向数组原型链上的join方法,
	// 并在内部再创建一个print函数, 可连接参数, 供用户使用
    source = "var __t,__p='',__j=Array.prototype.join," +
      "print=function(){__p+=__j.call(arguments,'');};\n" +
      source + 'return __p;\n';

    var render;
    try {
      // 以new Function来创建模板编译后执行的函数, 将setting.variable(不存在时候为obj)
      // 和'_'作为形参, source作为函数体
      render = new Function(settings.variable || 'obj', '_', source);
    } catch (e) {
      // 如果创建时错误, 则抛出e, 并把source挂载在e上,
      // 可以在外部捕获错误并打印其source属性, 以进行错误分析
      e.source = source;
      throw e;
    }
	
	// 包装模板函数, 内部绑定this到目前的上下文, 且传入date和_为实参
    var template = function(data) {
      return render.call(this, data, _);
    };

    // 为了方便预编译提供的一个编译source

    // 这一步确定argument
    var argument = settings.variable || 'obj';
    // 将一个包含函数的字符串挂载在模板函数的source属性上
    template.source = 'function(' + argument + '){\n' + source + '}';

    return template;
  };  
```