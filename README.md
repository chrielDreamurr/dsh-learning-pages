# dsh-learning-pages

把一份素材（PDF / 题目 / 教程 / 一个笼统主题）变成**零基础可读、边读边答题**的单页 HTML。
附带一只 DSH 桌宠，点一下就能翻出你做过的那堆页面。

```
一份内容源 content.js  ──build──▶  一个自包含的 index.html（零外部依赖，可离线，可单独发人）
        ▲
        └── 写作规范在 SPEC.md：术语怎么解释、题目怎么出、坑怎么讲
```

---

## 👉 先打开这个

**[`showcase/index.html`](showcase/index.html)** —— 20 节的能力展示，**用这个页面演示它自己**。

它既是门面，也是活文档：读者在体验每个功能的同时，就学到了它背后的设计道理。
clone 下来直接双击打开就行，不需要装任何东西。

> `demo-skeleton/` 是给**作者**看的最小骨架（3 节，五种卡片各演一遍），写新内容时对着它抄最快。
> `showcase/` 是给**访问者**看的完整示例，推荐从这里开始。

---

## 这个仓库有两部分

| 目录 | 是什么 |
|---|---|
| **`learning-pages/`** | 学习页范式：渲染引擎 + 构建/校验工具 + 写作规范。**不依赖 DSH，单独也能用。** |
| **`dsh-plugin/page-launcher/`** | DSH Web 的桌宠插件：可拖动的浮动形象，点开列出工作区里所有做过的页面。 |
| `showcase/` | 能力展示页（20 节）。用自己演示自己，推荐从这里看起。 |
| `demo-skeleton/` | 3 节最小骨架，写新内容时的模板。 |

---

## 一、学习页范式

### 长什么样

一个页面 = 左侧目录 + 进度条 + 打勾 + 每节末尾一道选择题（选完立刻展开**每个选项**的解释，
包括错的为什么错）+ 分诊跳转（「你现在什么情况」→ 跳到合适的起点）+ 键盘操作
（`1`~`9` 选，`Enter`/`→` 下一题）+ 进度存本地。

五种卡片：**术语卡**（青色，用生活比喻解释专业词）、**划重点**、**小心坑**、**小技巧**、**动手任务**。

### 快速开始

```powershell
# 1) 新建一个页面（工作区根目录下会多一个文件夹）
node learning-pages/tools/new.js my-topic --brand "我的主题" --subtitle "零基础版"

# 2) 编辑 my-topic/content.js —— 你唯一要写的文件

# 3) 构建 + 校验
node learning-pages/tools/build.js    my-topic
node learning-pages/tools/validate.js my-topic

# 4) 打开
Start-Process my-topic\index.html
```

需要 Node（构建和校验无第三方依赖）。只有从 PDF 提文本时才需要 Python——见 `learning-pages/tools/pdf2text.ps1`。

### 用 AI 写内容

`AGENTS.md.example` 是一份「工作区约定」模板。把它改名成工作区根目录的 `AGENTS.md`，
支持自动加载指令文件的 agent（比如 [DSH](https://github.com/)）就会在每次会话自动读到它——
之后你只要说「做一份关于 X 的学习页面」，它就会按 `SPEC.md` 的规范走完全流程，
不需要你再写详细提示词。

`SPEC.md` 里沉淀的不只是数据格式，还有**教学法约定**：术语第一次出现必须用生活比喻解释、
先讲为什么再讲怎么做、错误选项必须是读者真实会犯的错、一节课最多一个「划重点」，
以及两条红线——**作业考试类素材不给可交差的成品答案**、
**数字和判定条件必须实际算过或跑过，推导不出来就如实标注不确定**。

### 校验器不是走过场

`validate.js` 会把 `content.js` 和引擎塞进带 DOM 桩的沙箱，**对每一步、每一个选项真实渲染一遍**，
并检查：id 唯一、章节连续（防止侧栏出现两个同名分组）、每个 quiz 恰好一个正确答案、
每个选项都有解释、`next` 跳转目标存在且**模拟点击验证跳到的地方对不对**、
HTML 标签开合平衡、正确答案位置分布是否失衡。

它在本项目的真实内容上抓到过：

- **83 道题里正确答案几乎全在第 1 项** —— 读者会养成「闭眼选第一个」的习惯。
  于是把「按节 id 确定性打乱选项」做进了引擎（同一份内容每次构建顺序一致）。
- **4 处 `<p>` / `<div>` 没配对** —— 浏览器能容忍，但说明结构写错了。

---

## 二、DSH 桌宠插件

![桌宠](dsh-plugin/page-launcher/assets/pet.png)

在 DSH Web 上放一只可拖动的形象：

- **拖动**挪位置（松手记住，换分辨率自动夹回视口内）
- **点击**弹出页面列表：标题、副标题、节数、大小、修改时间
  - 「打开」→ 在 DSH 的新标签页里打开（走 DSH 服务器转发，不依赖浏览器对 `file://` 的权限）
  - 「系统浏览器」→ 交给系统默认浏览器
- **右键**复位回右下角

### 安装

插件通过 profile 的 `link:` 依赖加载。编辑 `$DSH_HOME/profiles/web/package.json`：

```jsonc
{
  "dependencies": {
    "@dsh-external/dsh-client-ui-page-launcher": "link:<本仓库路径>/dsh-plugin/page-launcher"
  },
  "dsh": {
    "profile": {
      "bundles": [
        "@deepseek-ai/dsh-base",
        "@deepseek-ai/dsh-web-app",
        /* ...其他插件... */
        "@dsh-external/dsh-client-ui-page-launcher"
      ]
    }
  }
}
```

然后在 profile 目录里 `pnpm install`，重启 `dsh web`。

> 两条踩过的坑：`pnpm` 必须真的能写进 profile 目录；而且**如果 `dsh web` 是在受限环境下启动的
> 子进程，它可能写不了 `$DSH_HOME`**，会起不来。在普通终端里重启最稳。

### 换成你自己的形象

把图片丢到 `dsh-plugin/page-launcher/assets/pet.png` 覆盖即可（`gif`/`webp`/`jpg`/`svg` 也认），
**刷新页面就生效，不用重启**。改大小改 `lib/client.js` 顶部的 `PET_SIZE` 和 CSS 里 `.pl-pet` 的宽高。

---

## 目录结构

```
learning-pages/
  SPEC.md            内容规范：数据结构 + 写作规范 + 红线   ← 写内容时读这个
  README.md
  engine/            引擎（与内容无关，改一次全站生效）
    shell.html       HTML 骨架 + 占位符
    theme.css        深色主题、卡片系统
    engine.js        渲染 / 导航 / 答题 / 进度存档 / 选项打乱
  tools/
    new.js           脚手架
    build.js         合成单文件 index.html
    validate.js      结构校验 + 冒烟渲染
    pdf2text.ps1     PDF → 纯文本（按坐标重建阅读顺序，公式不会跑到页尾）
    pdf2text.py
    scaffold/        新页面的 content.js 模板

dsh-plugin/page-launcher/
  lib/index.js       Host 端：扫描工作区、伺服页面和桌宠图
  lib/client.js      客户端：桌宠 + 列表面板
  assets/            桌宠形象
  cordis.patch.yml   插件装载声明

showcase/            能力展示页（20 节）—— 推荐第一眼看这个
  content.js         内容源
  index.html         构建产物，双击即看

demo-skeleton/       3 节最小骨架，写新内容时的模板
```

**页面目录就放在工作区根，和 `learning-pages/` 并列**——工具会扫描工作区根的直接子目录。

---

## 设计上的几个选择

- **单文件产物。** 引擎、样式、内容全部内联进一个 `index.html`（150~200 KB）。
  零外部依赖、可离线、可以直接发给别人，也不会因为某个 CDN 挂掉而白屏。
- **源码与产物分离。** 只有 `content.js` 需要手写，`index.html` 随时可以重新生成，别手改它。
- **选项打乱是确定性的。** 用节的 id 做哈希，所以同一份内容每次构建、每次刷新顺序完全一致——
  既避免「正确答案永远在第一个」，又不会让读者以为自己点错了。
- **`storageKey` 要带版本号。** 内容大改后把它 +1，否则读者旧的答题记录会错位到别的选项上。

---

## 许可

[MIT](LICENSE)。`dsh-plugin/page-launcher/assets/pet.png` 的来源说明见
[assets/SOURCE.md](dsh-plugin/page-launcher/assets/SOURCE.md)。
