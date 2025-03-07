## 🤔开发背景

从外部粘贴内容到思源笔记时，需要进行处理，希望这些处理能自动化，省去重复琐碎的操作，节省时间，有更多时间去思考创作。

比如很多ai默认生成的数学公式是LaTeX格式，粘贴到思源笔记不会渲染为公式

比如从PPT、word复制列表到思源，列表结构会丢失，需要自己重新写一个列表

比如从pdf复制的文字有多余的换行和空格，总是要手动删除

比如从维基百科复制到文字总是有很多链接和上标
……

## ✨插件功能

插件主要有两个功能

* 粘贴时自动处理
* 对块进行处理

### 粘贴时自动处理

在思源笔记的顶栏添加一个按钮，可以选择开启或关闭某个处理功能。

![](https://fastly.jsdelivr.net/gh/Achuan-2/PicBed/assets/PixPin_2024-12-15_18-10-59-2024-12-15.png)

目前具有的功能：

* 公式自动转换
  * LaTeX行间数学公式（`\[...\]`）转为`$$...$$`格式，行内数学公式（`\(...\)`）转为`$...$`格式
  * 也支持把所有公式都转为行内公式
* Office列表粘贴适配
  * 用途：支持将PPT、word的列表样式（有序列表、无序列表、[任务列表](https://github.com/Achuan-2/my_ppt_plugin)）粘贴思源笔记依然保留列表样式和层级结构
* 去除上标
  * 用途：去除维基百科等网站多余的上标
* 去除链接
  * 用途：去除维基百科等网站多余的关键词链接
* 去除换行
  * 用途：去除pdf复制的多余换行
* 去除空格
  * 用途：去除pdf复制的多余空格
* 去除空行
  * 用途：让粘贴内容全部都在一个块里
* 添加空行
  * 用途：让粘贴内容一段一个块

![](https://fastly.jsdelivr.net/gh/Achuan-2/PicBed/assets/PixPin_2024-12-14_19-02-01-2024-12-14.png)

> 注意：插件只影响外部纯文本粘贴和部分html粘贴，可能不影响html复制和思源笔记内部的富文本粘贴，如果发现不生效可以用右键菜单的纯文本粘贴来实现自动处理（虽然会丢格式，但暂时没法解决）。

### 对块进行处理

目前插件会给块菜单添加如下按钮

* 合并块【选中两个块及以上出现】
* 拆分块
* 列表符号转markdown列表
  * 用途：将•○▪▫◆◇►▻❖✦✴✿❀⚪☐符号的列表变为思源笔记列表格式
* 仅复制一级列表（带符号）【仅选中一个列表块时出现】
  * 用途：仅需要复制一级列表，分享给别人时使用
- 复制到小红书
  * 用途：发小红书、发微信等纯文本场景，会将列表符号替换为指定符号
  * 备注：有序列表使用数字emoji1️⃣2️⃣3️⃣，无序列表可以在设置里指定符号，默认为■○
   
   ![](https://fastly.jsdelivr.net/gh/Achuan-2/PicBed/assets/PixPin_2024-12-15_18-01-10-2024-12-15.png)
   ![](https://fastly.jsdelivr.net/gh/Achuan-2/PicBed/assets/PixPin_2024-12-15_18-00-28-2024-12-15.png)
* 链接转文本
* 去除上标
* 支持去除空格，智能识别英文空格，不会去除英文单词间的空格
* 英文符号转中文符号，支持把英文逗号、句号、单引号、双引号等符号转中文符号
* 批量设置代码语言
* 批量设置图片宽度


## ❤️ 用爱发电

如果喜欢我的插件，欢迎给GitHub仓库点star和捐赠，这会激励我继续完善此插件和开发新插件。

![](https://fastly.jsdelivr.net/gh/Achuan-2/PicBed/assets/20241118182532-2024-11-18.png)

捐赠者列表见：https://www.yuque.com/achuan-2