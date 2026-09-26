# 页面速览桌宠 · dsh-client-ui-page-launcher

在 DSH Web 上放一只**可拖动的桌宠**：点一下弹出面板，列出工作区里做过的所有页面，
可以一键在新标签页打开，或者丢给系统默认浏览器。

## 效果

- 屏幕上浮着一个形象（默认在右下角，`assets/pet.png`），带页面数量角标
- **拖动**：按住左键拖到任意位置，松手记住；换分辨率或换显示器会自动夹回视口内
- **点击**（不拖动）：弹出页面列表面板
- **右键**：复位回右下角
- 面板里有搜索框，每行显示标题、副标题、节数/大小、目录名、修改时间
  - 「打开」→ 在 DSH 的新标签页里打开（走 DSH 服务器转发，不依赖浏览器对 `file://` 的权限）
  - 「系统浏览器」→ 交给 Windows 默认浏览器
- `Esc` 或点遮罩关闭面板

桌宠位置存在浏览器 `localStorage` 的 `dsh-page-launcher:pos` 键里。

## 换形象 / 改大小

- **换图**：把 `assets/pet.png` 换掉即可（`pet.gif` / `pet.webp` / `pet.jpg` / `pet.svg` 也认，
  按这个顺序优先匹配）。刷新页面就生效，不用重启。
- **改大小**：`lib/client.js` 顶部的 `PET_SIZE`（当前 160，即原来 16px 图标的 1000%）。
  注意同时改一下 CSS 里 `.pl-pet` 的 `width`/`height`，两处保持一致。

> 图片必须放在本插件的 `assets/` 下。浏览器读不到工作区外的路径（比如 `Downloads`），
> 所以图是由 Host 端路由伺服出去的。

## 它怎么找到页面的

Host 端从插件自身的路径往上找带 `.plugin-tools` 或 `learning-pages` 的目录，那就是工作区根
（后者是公开仓库里的布局）；都不命中就退回 `dsh web` 的启动目录。
然后扫描工作区根的**直接子目录**，凡是含 `index.html` 的都列为可打开页面。
含 `content.js` 的会被认成「learning-pages 范式」产出的页面，额外显示节数。

## 接口

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/dsh/pages` | 列出页面（标题、slug、目录、大小、修改时间、节数） |
| GET | `/api/dsh/pages/view?slug=<名>` | 原样返回该页面的 `index.html` |
| GET | `/api/dsh/pages/icon` | 桌宠图片 |
| POST | `/api/dsh/pages/open` | `{ slug }` → 用系统默认浏览器打开 |

四个路由都做了同源校验；`slug` 只允许工作区的直接子目录名（挡住 `../` 路径穿越）。

## 挂载点

只用一个插槽：**`shell.overlay`**（由 `@deepseek-ai/dsh-client-ui-layout` 声明的 list 插槽，
浮在整个应用之上）。桌宠和面板各占一条 entry。

- 桌宠：`order: 10`
- 面板：`order: 20`
- 注意 `shell.overlay` 默认是**点击穿透**的，所以 `.pl-pet` / `.pl-mask` 上必须写 `pointer-events:auto`

早期版本挂在 `sidebar.footer.action`（侧栏底部固定按钮），已移除。

## 安装

在 web profile 的 `package.json` 里加依赖与 bundle 条目，然后 `pnpm install`，
最后重启 `dsh web`。改动 Host 端（`lib/index.js`）后必须重启；只改图片不用。
