# MarkEdit Explorer

[中文](#zh) · [English](#en)

> 给 [MarkEdit](https://github.com/MarkEdit-app/MarkEdit) 增加一个 VS Code / Codex 风格的文件树侧边栏。纯原生扩展，不改主程序、不联网、零依赖。
> A VS Code / Codex style file explorer sidebar for MarkEdit — a single injectable script, no app patches, no network, no dependencies.

**版本 1.0.0** · 最低要求 MarkEdit **1.37.0** · 已在 macOS / MarkEdit 1.37.1 (98) 上开发与验证

---

<a id="zh"></a>

## 中文

### 这是什么

MarkEdit 是 macOS 上一款极简的 Markdown 编辑器，本身没有文件树。MarkEdit Explorer 通过 MarkEdit 官方的**用户脚本 / 扩展机制**，在编辑器左侧注入一个文件树侧边栏，让你不离开编辑器就能浏览、打开和管理本地文件。

- 只调用 MarkEdit 公开的 `MarkEdit.*` 原生 API（`listFiles`、`getFileInfo`、`openDocument`、`createFile`、`moveFile`、`showOpenPanel` 等）
- 产物是**一个 `.js` 文件**，CSS 内嵌其中；不引入 CDN、不请求网络、不打包任何第三方库
- 不修改 `MarkEdit.app`，不需要重签名；卸载只需删掉一个文件
- 状态存在 `localStorage`，所有标签页 / 窗口共享

### 功能一览

| 能力 | 说明 |
|---|---|
| 文件树 | 多工作区根节点、懒加载目录、展开折叠、文件类型徽标、过滤框、当前文件高亮 |
| 打开文件 | 单击在 MarkEdit 内打开（`openDocument`），失败才回落系统默认应用 |
| 文件管理 | 新建文件 / 文件夹、重命名、剪切粘贴、拖拽移动、移到废纸篓、Finder 显示、复制路径 |
| 原生菜单 | `Extensions` 主菜单 + 右键上下文菜单（MarkEdit 原生控件，不是网页弹层） |
| 工作区记忆 | 记住工作区、展开状态、宽度、显隐与偏好；跨标签页同步 |
| 自动刷新 | 默认每 3 秒比对目录指纹，外部改动自动反映；聚焦窗口 / 切换文档时也会刷新 |
| 外观 | 跟随编辑器主题，支持明暗模式；宽度可拖拽；可停靠左 / 右；与预览扩展共存 |

### 环境要求

- macOS + **MarkEdit ≥ 1.37.0**（本机验证版本 1.37.1，build 98）
- 使用**不需要** Node.js；只有开发 / 构建才需要 Node ≥ 18
- 扩展文件位于应用沙盒容器：`~/Library/Containers/app.cyan.markedit/Data/Documents/`

### 安装

#### 方式 A：一键脚本（推荐）

```bash
git clone https://github.com/NickBi1/markedit-explorer.git
cd markedit-explorer
npm run install:local
```

脚本会：复制 `dist/markedit-explorer.js` 到 `scripts/`、计算 sha256、在 `extensions.json` 的 `installed` 数组注册，并把原清单备份为 `extensions.json.bak`。

> ⚠️ 运行前请先 **⌘Q 退出 MarkEdit**。应用运行时会持有清单，退出时可能覆盖你的修改。

仓库已自带构建好的 `dist/`，源码有改动时才需要 `npm run build`。

#### 方式 B：手动安装

1. 把 `dist/markedit-explorer.js` 复制到
   `~/Library/Containers/app.cyan.markedit/Data/Documents/scripts/markedit-explorer.js`
2. 在 `~/Library/Containers/app.cyan.markedit/Data/Documents/extensions.json` 的 `installed` 数组加入：

```json
{
  "enabled": true,
  "file": "markedit-explorer.js",
  "id": "markedit-explorer",
  "sha256": "见 registry/markedit-explorer.json",
  "version": "1.0.0"
}
```

3. 启动 / 重启 MarkEdit。

#### 方式 C：URL Scheme

已发布 Release 后可用 `markedit://install-extension?url=<js 文件地址>` 由 MarkEdit 的扩展管理器安装。

**验证**：`Extensions` 菜单出现 `Toggle Explorer` / `Explorer Options`；按 **⇧⌘E** 能开关侧栏。

### 使用

界面结构（Codex / VS Code 风格）：

```text
EXPLORER                    +  □  ↻  ⌄  ⧉  ×
[ 过滤文件… ]
▸ MY DOCUMENTS
  ▸ Projects
      plan.md
      architecture.md
  ▸ Documents
      README.md
    notes.md
──────────────────────────────────────
1 个工作区 · 自动刷新 3s · 17:39:21
```

| 操作 | 效果 |
|---|---|
| 单击文件 | 在 MarkEdit 内打开；也可在右键菜单选「在新窗口打开」 |
| 单击文件夹 / 根节点 | 展开或折叠 |
| 顶部按钮 | 新建文件、新建文件夹、刷新、折叠全部、添加工作区文件夹、隐藏侧栏 |
| 右键 | 原生菜单：打开、重命名、剪切、粘贴、复制路径、在 Finder 中显示、移到废纸篓等 |
| 拖动右侧边缘 | 调整宽度（170–600 px，自动记忆） |
| 拖动文件行到文件夹 | 移动文件，移动前会二次确认 |
| 键盘 | `↑` `↓` 选择、`→` 展开、`←` 折叠 / 回到父级、`Enter` 打开、`Delete` 移到废纸篓、`Esc` 清空过滤 |

**工作区与刷新**

- 首次运行会把真实的 `~/Documents` 挂为 `My Documents`；用「添加工作区文件夹…」可添加更多根目录（支持多选），通过系统打开面板选择会**自动获得沙盒授权**。
- 想快速看到示意结构，可在空白处右键选「创建示例工作区」：它只在**应用容器内**生成 `My Documents/Projects/plan.md`、`architecture.md`、`Documents/README.md`，不会碰你的个人文件。
- 工作区、展开状态、宽度、显隐、隐藏文件开关等写入 `localStorage` 的 `markedit-explorer:state:v1`，所有标签页共享。
- 自动刷新通过比对「文件名 + 类型 + 修改时间」指纹实现，只在有变化时重绘；可在 `Extensions ▸ Explorer Options ▸ Auto Refresh` 里改为关闭 / 2s / 3s / 5s / 10s。
- 打开文档时会自动展开其祖先目录并定位到该文件（`autoReveal`）。

**删除语义**：「移到废纸篓」通过 `moveFile` 移到 `~/.Trash`，**可恢复**；扩展不会对用户文件调用永久删除。

### 配置（可选）

写入 `~/Library/Containers/app.cyan.markedit/Data/Documents/settings.json`，全部可省略：

```json
{
  "extension.markeditExplorer": {
    "position": "left",
    "defaultWidth": 260,
    "pollInterval": 3000,
    "showHiddenFiles": false,
    "openMode": "singleClick",
    "autoReveal": true,
    "shortcut": { "key": "e", "modifiers": ["Command", "Shift"] }
  }
}
```

| 键 | 默认值 | 说明 |
|---|---|---|
| `position` | `"left"` | `"left"` / `"right"` |
| `defaultWidth` | `260` | 初始宽度（170–600） |
| `onLaunch` | `"remember"` | `"remember"` / `"open"` / `"closed"` |
| `pollInterval` | `3000` | 自动刷新间隔（ms），`0` 关闭 |
| `showHiddenFiles` | `false` | 是否显示以 `.` 开头的文件 |
| `exclude` | `.git`、`.svn`、`.hg`、`.DS_Store`、`Thumbs.db`、`node_modules` | 名称过滤，支持 `*` / `?` |
| `openMode` | `"singleClick"` | `"singleClick"` / `"doubleClick"` |
| `autoReveal` | `true` | 切换文档时自动定位到当前文件 |
| `confirmDelete` | `true` | 移到废纸篓前确认 |
| `confirmMove` | `true` | 移动 / 拖拽前确认 |
| `maxEntriesPerFolder` | `500` | 单个目录最多读取的条目数 |
| `rowHeight` / `indent` / `fontSize` | `22` / `14` / `13` | 行高、每层缩进、字号 |
| `shortcut` | `{ key: "e", modifiers: ["Command", "Shift"] }` | 开关侧栏的快捷键 |

> `settings.json` 会被 MarkEdit 严格校验：请只使用上表中的键，写错类型会让整个文件失效。菜单里的选项会即时生效并覆盖这里的默认值。

### 权限与沙盒

- MarkEdit 是沙盒应用（`app-sandbox`），但具有 home 目录读写例外，`~` 下的目录通常可直接读取。
- 容器外或受系统隐私保护的目录：用「添加工作区文件夹…」或 `File ▸ Bookmarks ▸ Add Bookmarks…` 授权。
- 读取失败时侧栏会显示提示行，不会崩溃；授权后点「刷新」即可。
- 扩展只作用于主 app，不影响 Quick Look 扩展。

### 开发

```bash
npm run build          # 拼接为单文件 + 生成 registry 条目与 sha256
npm run check          # node --check 语法检查
npm test               # 14 项 headless 冒烟测试
npm run install:local  # 安装到本机 MarkEdit 容器
```

| 路径 | 作用 |
|---|---|
| `src/01-core.js` | 设置读取、持久化状态、原生 API 封装 |
| `src/02-fs.js` | 目录模型、变更指纹、树扁平化 |
| `src/03-ui.js` | DOM 注入、布局、主题、渲染 |
| `src/04-ops.js` | 文件操作、原生菜单、键盘与拖拽 |
| `src/05-boot.js` | 启动、轮询、当前文档、脚本 API |
| `src/styles.css` | 全部 `mex-` 前缀样式，构建时内嵌进 JS |
| `build.mjs` | 把以上文件包进一个 IIFE，产出 `dist/` 与 `registry/` |
| `test/smoke.test.mjs` | 自建 fake DOM + mock MarkEdit API，无需真实 MarkEdit |

**官方扩展格式**：MarkEdit 扩展就是一个可注入的 `.js` 文件，放在 `scripts/` 下，并在 `extensions.json` 的 `installed` 数组注册（`enabled` / `file` / `id` / `sha256` / `version`）。没有 manifest、没有依赖解析、没有生命周期清单。`registry/markedit-explorer.json` 则是提交到 [官方扩展注册表](https://github.com/MarkEdit-app/extensions) 的条目模板。

开发时也可通过 AppleScript `evaluate` 调用脚本 API：`window.MarkEditExplorer` 提供 `toggle()` / `open()` / `close()` / `refresh()` / `addFolder()` / `openFolder(path)` / `roots()` / `state()`。

### 发布到官方注册表

1. 在 GitHub 发一个 `v1.0.0` Release，上传 `dist/markedit-explorer.js`。
2. 确认 `registry/markedit-explorer.json` 的 `url` 指向该资源、`sha256` 与实际字节一致（`shasum -a 256 dist/markedit-explorer.js`）、`minAppVersion` 正确。
3. 按官方 registry 的 PR 流程把该 JSON 放进 `extensions/` 目录。

### 已知限制

- 没有文件系统事件监听，靠轮询；超大目录可调大 `pollInterval` 或调小 `maxEntriesPerFolder`。
- 官方 `markedit-file-explorer` 扩展默认也用 ⇧⌘E，两者同装会冲突 —— 用 `shortcut` 改掉其中一个。
- 与 Outline Sidebar 等侧栏扩展共存时会合并左右留白，第三方布局实现差异可能造成轻微跳动。
- 图片、PDF 等二进制文件 MarkEdit 无法打开，会交给 macOS 默认应用。
- 沙盒下 `~/.Trash` 不可列举，但单路径访问可用，因此废纸篓操作按「检查同名 + 自动加序号」实现。

---

<a id="en"></a>

## English

### What it is

[MarkEdit](https://github.com/MarkEdit-app/MarkEdit) is a deliberately minimal Markdown editor for macOS with no built-in file tree. MarkEdit Explorer uses MarkEdit's official **user script / extension mechanism** to inject a file explorer sidebar next to the editor, so you can browse, open and manage local files without leaving the app.

- Uses only MarkEdit's public `MarkEdit.*` bridge (`listFiles`, `getFileInfo`, `openDocument`, `createFile`, `moveFile`, `showOpenPanel`, …)
- Ships as **one `.js` file** with the CSS embedded — no CDN, no network requests, no bundled dependencies
- Does not patch `MarkEdit.app`, no re-signing; uninstalling means deleting one file
- State lives in `localStorage` and is shared across tabs and windows

### Features

| Capability | Details |
|---|---|
| File tree | Multi-root workspaces, lazy folders, expand/collapse, file-type badges, filter box, active-file highlight |
| Open files | Single click opens inside MarkEdit via `openDocument`; falls back to the default macOS app |
| File management | New file / folder, rename, cut & paste, drag & drop move, move to Trash, reveal in Finder, copy path |
| Native menus | `Extensions` main menu plus native context menus (not HTML overlays) |
| Workspace memory | Remembers roots, expanded folders, width, visibility and preferences; synced across tabs |
| Auto refresh | Polls a directory fingerprint every 3s by default; also refreshes on focus and document switch |
| Appearance | Follows the editor theme, light/dark aware, resizable, dock left or right, coexists with preview extensions |

### Requirements

- macOS with **MarkEdit ≥ 1.37.0** (developed and verified on 1.37.1, build 98)
- Node.js ≥ 18 is needed **only for development**; running the extension needs nothing else
- Files live in the app container: `~/Library/Containers/app.cyan.markedit/Data/Documents/`

### Installation

#### Option A — install script (recommended)

```bash
git clone https://github.com/NickBi1/markedit-explorer.git
cd markedit-explorer
npm run install:local
```

The script copies `dist/markedit-explorer.js` into `scripts/`, computes its sha256, registers it in `extensions.json` (`installed` array) and backs up the manifest as `extensions.json.bak`.

> ⚠️ **Quit MarkEdit (⌘Q) first.** A running MarkEdit holds the manifest and may overwrite your changes on exit.

A prebuilt `dist/` is committed, so `npm run build` is only needed after editing sources.

#### Option B — manual

1. Copy `dist/markedit-explorer.js` to
   `~/Library/Containers/app.cyan.markedit/Data/Documents/scripts/markedit-explorer.js`
2. Add this entry to `~/Library/Containers/app.cyan.markedit/Data/Documents/extensions.json` under `installed`:

```json
{
  "enabled": true,
  "file": "markedit-explorer.js",
  "id": "markedit-explorer",
  "sha256": "see registry/markedit-explorer.json",
  "version": "1.0.0"
}
```

3. Launch or relaunch MarkEdit.

#### Option C — URL scheme

Once a Release exists, `markedit://install-extension?url=<js-url>` lets MarkEdit's extension manager install it.

**Verify**: the `Extensions` menu contains `Toggle Explorer` / `Explorer Options`, and **⇧⌘E** toggles the sidebar.

### Usage

```text
EXPLORER                    +  □  ↻  ⌄  ⧉  ×
[ Filter files… ]
▸ MY DOCUMENTS
  ▸ Projects
      plan.md
      architecture.md
  ▸ Documents
      README.md
    notes.md
──────────────────────────────────────
1 workspace · auto refresh 3s · 17:39:21
```

| Action | Result |
|---|---|
| Click a file | Opens it in MarkEdit; the context menu also offers "open in a new window" |
| Click a folder / root | Expand or collapse |
| Header buttons | New file, new folder, refresh, collapse all, add workspace folder, hide |
| Right-click | Native menu: open, rename, cut, paste, copy path, reveal in Finder, move to Trash, … |
| Drag the right edge | Resize (170–600 px, remembered) |
| Drag a row onto a folder | Move the file, with a confirmation prompt |
| Keyboard | `↑` `↓` select, `→` expand, `←` collapse / parent, `Enter` open, `Delete` move to Trash, `Esc` clear filter |

**Workspaces and refresh**

- On first run the real `~/Documents` is mounted as `My Documents`. Use "Add Folder to Explorer…" to add more roots (multi-select is supported); choosing a folder through the native open panel **grants sandbox access automatically**.
- Right-click empty space → "Create Demo Workspace" builds `My Documents/Projects/plan.md`, `architecture.md`, `Documents/README.md` **inside the app container only** — no personal files are touched.
- Roots, expanded folders, width, visibility and preferences are stored in `localStorage` under `markedit-explorer:state:v1` and shared by all tabs.
- Auto refresh compares a fingerprint of `name + type + modification date`; the tree is redrawn only when it changes. Choose Off / 2s / 3s / 5s / 10s under `Extensions ▸ Explorer Options ▸ Auto Refresh`.
- Switching documents expands their ancestor folders and selects the file (`autoReveal`).

**Deletion**: "Move to Trash" uses `moveFile` into `~/.Trash` and is **recoverable**. The extension never permanently deletes user files.

### Configuration (optional)

Add to `~/Library/Containers/app.cyan.markedit/Data/Documents/settings.json`; every key is optional:

```json
{
  "extension.markeditExplorer": {
    "position": "left",
    "defaultWidth": 260,
    "pollInterval": 3000,
    "showHiddenFiles": false,
    "openMode": "singleClick",
    "autoReveal": true,
    "shortcut": { "key": "e", "modifiers": ["Command", "Shift"] }
  }
}
```

| Key | Default | Description |
|---|---|---|
| `position` | `"left"` | `"left"` / `"right"` |
| `defaultWidth` | `260` | Initial width (170–600) |
| `onLaunch` | `"remember"` | `"remember"` / `"open"` / `"closed"` |
| `pollInterval` | `3000` | Refresh interval in ms; `0` disables it |
| `showHiddenFiles` | `false` | Show dotfiles |
| `exclude` | `.git`, `.svn`, `.hg`, `.DS_Store`, `Thumbs.db`, `node_modules` | Name filters, `*` / `?` wildcards |
| `openMode` | `"singleClick"` | `"singleClick"` / `"doubleClick"` |
| `autoReveal` | `true` | Reveal the active document in the tree |
| `confirmDelete` | `true` | Confirm before moving to Trash |
| `confirmMove` | `true` | Confirm moves and drag & drop |
| `maxEntriesPerFolder` | `500` | Maximum entries read per directory |
| `rowHeight` / `indent` / `fontSize` | `22` / `14` / `13` | Row height, indent per level, font size |
| `shortcut` | `{ key: "e", modifiers: ["Command", "Shift"] }` | Sidebar toggle shortcut |

> MarkEdit validates `settings.json` strictly. Use only the keys above; a wrong value type invalidates the whole file. Menu toggles take effect immediately and override these defaults.

### Sandbox and permissions

- MarkEdit is sandboxed (`app-sandbox`) but holds a read-write exception for the home folder, so paths under `~` normally work.
- For folders outside the container or protected by macOS privacy settings, grant access via "Add Folder to Explorer…" or `File ▸ Bookmarks ▸ Add Bookmarks…`.
- A failed read shows an inline hint instead of crashing; click Refresh after granting access.
- Only the main app is affected; the Quick Look extension is untouched.

### Development

```bash
npm run build          # single-file bundle + registry entry + sha256
npm run check          # node --check
npm test               # 14 headless smoke tests
npm run install:local  # install into the local MarkEdit container
```

| Path | Purpose |
|---|---|
| `src/01-core.js` | Settings, persisted state, native API wrappers |
| `src/02-fs.js` | Directory model, change fingerprints, tree flattening |
| `src/03-ui.js` | DOM injection, layout, theme, rendering |
| `src/04-ops.js` | File operations, native menus, keyboard, drag & drop |
| `src/05-boot.js` | Startup, polling, active document, scripting API |
| `src/styles.css` | All `mex-` prefixed styles, embedded into JS at build time |
| `build.mjs` | Wraps the sources in one IIFE and writes `dist/` and `registry/` |
| `test/smoke.test.mjs` | Fake DOM + mock MarkEdit API; no real MarkEdit required |

**Official extension format**: a MarkEdit extension is a single injectable `.js` file placed in `scripts/` and registered in the `installed` array of `extensions.json` (`enabled` / `file` / `id` / `sha256` / `version`). There is no manifest, no dependency resolution and no lifecycle declaration. `registry/markedit-explorer.json` is the entry template for the [official extension registry](https://github.com/MarkEdit-app/extensions).

For automation, `window.MarkEditExplorer` exposes `toggle()` / `open()` / `close()` / `refresh()` / `addFolder()` / `openFolder(path)` / `roots()` / `state()`, callable through MarkEdit's AppleScript `evaluate` command.

### Publishing

1. Create a `v1.0.0` GitHub Release and upload `dist/markedit-explorer.js`.
2. Make sure `registry/markedit-explorer.json` `url` points at that asset, `sha256` matches the bytes (`shasum -a 256 dist/markedit-explorer.js`), and `minAppVersion` is right.
3. Submit the JSON under `extensions/` in the official registry following its PR process.

### Known limitations

- There is no filesystem watcher; refresh is polling-based. For very large folders, raise `pollInterval` or lower `maxEntriesPerFolder`.
- The official `markedit-file-explorer` extension also defaults to ⇧⌘E — change `shortcut` if both are installed.
- Left/right insets are merged with other sidebar extensions (e.g. Outline Sidebar); differing third-party layouts may cause a slight jump.
- Binary files (images, PDFs) cannot be opened by MarkEdit and are handed to the default macOS app.
- `~/.Trash` cannot be listed from the sandbox, so Trash operations use single-path lookups with automatic name suffixing.
