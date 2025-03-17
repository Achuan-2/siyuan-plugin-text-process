
## v0.1.9 / 2025.03.20
- 🐛 fix(去除空格): 不去除pdf标注的空格粘贴，造成无法渲染pdf标注
- 🐛 feat(富文本保留颜色): 错误把正常a链接也进行处理


## v0.1.8 / 2025.03.15
- ✨ feat(文本粘贴): 支持富文本粘贴时，保留颜色和背景色

## v0.1.7 / 2025.03.13

- ✨  feat(数学公式转换): 完善 LaTeX 块数学公式在段落内的解析问题 [#18](https://github.com/Achuan-2/siyuan-plugin-text-process/issues/18)
  - 将 LaTeX 块数学公式的替换逻辑修改为在前后添加换行符
- ✨ feat(公式转换): 更新文档描述，明确都转换为行内公式的功能


## v0.1.6 / 2025.03.09
- ✨ feat(复制到小红书): 优化列表复制

## v0.1.5 / 2025.03.09s
- 🐛Fix(拆分块): 拆分块的时候transaction的insert和inserBlock API会冲突，想到了新方法，可以直接前端更新内容，后端更新慢，就让它后端慢慢更新吧
- 🐛 fix(复制到小红书): 之前需要选中列表块才能正确转化，现在只需要选中列表项，就可以正确转化了
- ✨ feat(合并块): 加速合并块速度

--- 

- 🐛 Fix(Split Block): When splitting a block, the insert and inserBlock APIs of the transaction will conflict. I thought of a new method, which can directly update the content on the front end. The back end updates slowly, so let it update slowly
- 🐛 fix(Copy to Xiaohongshu): Previously, you needed to select the list block to convert correctly. Now you only need to select the list item to convert correctly
- ✨ feat(Merge Block): Speed up the merging block speed

## v0.1.4 / 2025.03.05
- 🐛 fix(粘贴)：开启公式自动转化，无法右键粘贴 [#17](https://github.com/Achuan-2/siyuan-plugin-paste-process/issues/17)

---

- 🐛 fix(Paste): When the formula is automatically converted, the right-click paste is invalid


## v0.1.3 / 2025.02.16
- ✨ 支持批量设置图片高度
- ✨ 支持块引转块超链接
- ✨ 块菜单支持去除换行

--- 

- ✨ Support setting image height in bulk
- ✨ Support converting block references to block hyperlinks
- ✨ Block menu supports removing line breaks
- 
## v0.1.2 / 2025.01.17

- ✨ 支持批量设置代码语言
- ✨ 支持批量设置图片宽度

## v0.1.1 / 2025.01.17
- ✨ office列表粘贴适配：支持粘贴ppt任务列表，从而与[我的PPT插件](https://github.com/Achuan-2/my_ppt_plugin)生成的任务列表联动
- ✨ 复制到小红书优化：
    - 只有列表的第一个p标签才添加symbol
    - 去除因为图片而产生的symbol空行
- ✨ 支持公式转换为行内公式

## v0.1.0 / 2025.01.12
- ✨ 块操作支持可撤回 
- ✨ 支持去除空格，智能识别英文空格，不会去除英文单词间的空格
- ✨ 英文符号转中文符号，支持把英文逗号、句号、单引号、双引号等符号转中文符号

## v0.0.9 / 2025.01.02
- ✨复制到小红书：Remove zero-width space character and empty lines

## v0.0.8 / 2025.01.01
- ✨ 「复制到小红书」支持任务列表样式
- ✨多级列表添加空格表示缩进

## v0.0.7 / 2024.12.16
- ✨ 仅复制一级列表仅复制列表项的第一个段落

## v0.0.6 /2024.12.15
- ✨ 块标菜单新增去除上标、去除链接功能

## v0.0.5 /2024.12.15

- ✨ 支持复制到小红书（列表和标题添加符号前缀）
- ✨  粘贴时自动处理：支持去除链接、去除上标

## v0.0.4 / 2024.12.15
- ✨ 修复'去除空格' 导致复制引用块或嵌入块失效 #1

## v0.0.3 / 2024.12.15
- ✨文案优化：「列表转纯文本」→「列表转纯文本带符号」
- ✨README补充介绍「列表转纯文本带符号」的功能和可以在设置里修改默认符号
- 

## v0.0.2 /2024.12.14

- ✨添加列表转纯文本的列表符号设置
- ✨支持列表转纯文本多级列表复制
- ✨ 列表转纯文本支持有序列表符号


## v0.0.1 /2024.12.13

顶栏按钮

* LaTeX行间数学公式（`\[...\]`）转为`$$...$$`格式，行内数学公式（`\(...\)`）转为`$...$`格式
* 去除换行
  * 用途：去除pdf复制的多余换行
* 去除空格
  * 用途：去除pdf复制的多余空格
* 去除空行
  * 用途：让粘贴内容全部都在一个块里
* 添加空行
  * 用途：让粘贴内容一段一个块
* 富文本列表转换
  * 用途：支持将PPT、word的列表样式粘贴思源笔记依然保留列表样式和层级结构，支持将•○▪▫◆◇►▻❖✦✴✿❀⚪☐符号的列表变为思源笔记列表格式）

块菜单

* 合并块（选中两个块及以上出现）
* 拆分块
* 仅复制一级列表内容（选中一个列表块时出现）
* 列表符号转markdown列表
  * 将•○▪▫◆◇►▻❖✦✴✿❀⚪☐符号的列表变为思源笔记列表格式