# ios-emoji-webpng
搜狗iOS系统表情跨平台展示解决文案

   大概在两年前，在项目中遇到了"用户在iPhone手机上输入iOS系统自带表情时，输入的emoji code在windows浏览器等其他平台下会显示为乱码"的问题，对于UGC内容的显示非常不友好，通过进一步分析发现，不同iOS版本下 emoji code编码规则也比较繁杂，为了解决这一问题，问问在实际项目中探索实现了一套比较完整的将iOS自带emoji code转换为web png跨平台展示的方法，最近iOS和macOS相继发布了新版本，因此现在总结开放出来，希望对大家有帮助，目前已经支持iOS12.1.2、macOS Mojave

##获取emoji code与emoji web png图片文件之间的映射关系表
将代码下载至本地：

    git clone https://github.com/mopduan/ios-emoji-webpng.git


进入ios-emoji-webpng目录执行：

    node ./parse.js
    
> emoji_png.zip包中的表情图片文件是基于[github/gemoji](https://github.com/github/gemoji/)，多肤色表情支持基于[s0meone/gemoji](https://github.com/s0meone/gemoji)来导出，非常感谢这两个项目带来的启示！在iOS和macOS后续升级中大家后续可以关注这两个项目。
    
如果执行成功会看到如下结果：

    已成功处理表情文件: 1872个
    
同时会在当前目录下生成一个map.json文件，这个JSON文件包含了emoji code与emoji png格式图片文件名之间的映射关系。

## 对用户输入内容进行解析
   由于某些iOS版本会对部分表情添加```\ufe0f```编码，并且添加的位置不确定，如果不能精确匹配的话，```\ufe0f```会在iOS系统下显示一个奇怪的占位符，影响整体内容的展示，因此需要在后端进行预处理，先将内容中的```\ufe0f```替换为空白字符，再在预处理后的内容中利用map.json生成的映射关系来进行[Trie树](https://zh.wikipedia.org/wiki/Trie)匹配，也就是需要查找最长emoji code字符串，因为肤色表情文件会有多个，并且有相关的前缀，所以必须在生成map.json之前对映射关系进行降序排列，例如：圣诞老人这个表情，不同肤色的圣诞老人拥有相当的前缀```1f385```，![圣诞老人](http://wenwen.gtimg.cn/images/qunapp/emoji/ios/1f385.png?cache=false)![圣诞老人](http://wenwen.gtimg.cn/images/qunapp/emoji/ios/1f385-1f3fb.png)![圣诞老人](http://wenwen.gtimg.cn/images/qunapp/emoji/ios/1f385-1f3fc.png)![圣诞老人](http://wenwen.gtimg.cn/images/qunapp/emoji/ios/1f385-1f3fd.png)![圣诞老人](http://wenwen.gtimg.cn/images/qunapp/emoji/ios/1f385-1f3fe.png)![圣诞老人](http://wenwen.gtimg.cn/images/qunapp/emoji/ios/1f385-1f3ff.png)

## 在线演示
   大家可以使用iPhone手机扫描以下二维码，进入演示页面后点击右下角发布按钮，在提问框内输入iOS系统表情，点击发布后即可看到转换效果。
   
   ![lds](https://cloud.githubusercontent.com/assets/675025/19920022/3ecda7c0-a111-11e6-839a-57fca0368a88.png)


---


如果ios-emoji-webpng对您有帮助，欢迎打赏：）

![欢迎打赏](https://cloud.githubusercontent.com/assets/675025/20477523/f4bc4a56-b010-11e6-9b55-13138ffcf0bb.png)

作者: [mop](https://mopduan.github.io/)  
2016 年 11月 02日
