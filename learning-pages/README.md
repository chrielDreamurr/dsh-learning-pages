# learning-pages —— 交互式学习页范式

把一份素材（PDF / 题目 / 教程 / 一个笼统主题）变成**零基础可读、边读边答题**的单页 HTML。

仓库里的 `../demo-skeleton/` 是一个 3 节的最小示例，展示了内容格式和五种卡片的用法——
想快速了解「一个页面长什么样」，打开它就行。

---

## 怎么用

你不用记任何命令。**在会话里直接说需求就行**：

> 做一份关于 Kafka 的零基础学习页面
> 把 C:\...\xxx.pdf 做成上次那种页面
> 用之前那个交互模式讲一下正则表达式

工作区根目录的 `AGENTS.md` 会在每个会话自动加载，我会按既定范式走完整个流程。

想自己动手时：

```powershell
node learning-pages/tools/new.js my-topic --brand "我的主题" --subtitle "零基础版"
# 编辑 my-topic/content.js
node learning-pages/tools/build.js    my-topic
node learning-pages/tools/validate.js my-topic
Start-Process my-topic\index.html
```

---

## 结构

```
learning-pages/
├─ SPEC.md                 内容规范：数据结构 + 写作规范 + 红线   ← 写作时读这个
├─ README.md               本文件
├─ engine/                 引擎（与内容无关，改了全文通用）
│   ├─ shell.html          HTML 骨架 + 占位符
│   ├─ theme.css           样式（深色主题、卡片系统）
│   └─ engine.js           渲染 / 导航 / 答题 / 进度存档
└─ tools/
    ├─ new.js              脚手架：新建页面
    ├─ build.js            合成单文件 index.html
    ├─ validate.js         结构校验 + 冒烟渲染
    ├─ pdf2text.ps1        PDF → 纯文本（自动准备 Python 环境）
    ├─ pdf2text.py         ↑ 的实现（按坐标重建阅读顺序）
    └─ scaffold/           新页面的 content.js 模板

<工作区>/<页面目录>/
├─ content.js              ← 唯一的内容源，你只写这个
└─ index.html              ← 构建产物，自包含、可离线、可单独发人
```

**一个页面 = 一个目录 = 两份文件**：源（`content.js`）+ 产物（`index.html`）。

---

## 页面能做什么

- **左侧目录 + 进度条 + 打勾**，进度存在浏览器本地，关掉再开还在
- **每节末尾一道选择题**：选完立刻展开每个选项的解释（包括错的为什么错）
- **分诊跳转**：第 0 章问「你现在什么情况」，按选择直接跳到合适的起点
- **术语卡 / 划重点 / 小心坑 / 小技巧 / 动手任务** 五种卡片
- **键盘操作**：`1`~`9` 选选项，`Enter` / `→` 下一题，`←` 上一题
- **正确答案位置自动打乱**（按节 id 确定性打乱，不会两次构建不一样），
  避免读者养成「闭眼选第一个」的习惯
- 响应式：手机上侧栏收成抽屉

---

## 校验器会查什么

`validate.js` 不是走过场，它真的把 `content.js` 和引擎塞进带 DOM 桩的沙箱里，
**对每一步、每一个选项都真实渲染一遍**，并检查：

- id 唯一、章节连续（防止侧栏出现两个同名分组）
- 每个 quiz 恰好一个正确答案；每个 quiz 选项都有 `why`
- `next` 跳转目标真实存在，并**模拟点击验证跳到的地方对不对**
- HTML 标签开合平衡（**这条抓到过 4 处真实缺陷**）
- 正确答案位置分布是否失衡
- 禁用标签、空段落、过短的 `why`

它抓出过的真实问题：

- 40 多道题里正确答案几乎全在第 1 项 → 于是把打乱做进了引擎
- 4 处 `<p>` / `<div>` 没配对 → 已修

**错误必须清零；提示要么修掉，要么能说出为什么保留。**

---

## 环境说明

- 本机的 `python` 是 Microsoft Store 的占位符，不可用。PDF 提取走 `uv` 临时环境，
  缓存写在 `%TEMP%`（脚本已处理）——**不要让它写进工作区**，工作区在 OneDrive 下会被同步。
  代价是每次提取要重新下载约 40MB；要连着提取多份时加 `-CacheDir learning-pages\.uvcache`，
  用完记得删（那个目录约 170MB）。
- 构建和校验只需要 Node，无第三方依赖。
- 产物零外部依赖，不联网也能用。

**PowerShell 5.1 的坑**（这台机器的 `pwsh` 实际是 5.1）：`.ps1` 必须带 UTF-8 BOM，
否则中文注释会被按 ANSI 解码、脚本直接语法报错；调用原生命令的脚本不要设
`$ErrorActionPreference='Stop'`。细节见 `../AGENTS.md`。

---

## 改引擎

`engine/` 下的三个文件是全文通用的。改完之后：

```powershell
node learning-pages/tools/build.js --all
node learning-pages/tools/validate.js --all
```

两个已有页面会一起重建并校验——这是改引擎的安全网，别绕过。
