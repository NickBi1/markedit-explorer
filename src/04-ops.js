/* ---- 04-ops: file opening, file management, native menus, keyboard, DnD ---- */

let rootCounter = 0;
let dragSource = null;

function nextRootId() {
  rootCounter += 1;
  return 'root-' + Date.now().toString(36) + '-' + rootCounter;
}

function invalidateCaches(path) {
  const normalized = normalizePath(path);
  for (const key of [...infoCache.keys()]) if (isWithin(key, normalized)) infoCache.delete(key);
  for (const key of [...dirs.keys()]) if (isWithin(key, normalized)) dirs.delete(key);
}

function validateName(name) {
  if (!name) return '名称不能为空';
  if (name === '.' || name === '..') return '名称无效';
  if (name.indexOf('/') !== -1 || name.indexOf(':') !== -1 || name.indexOf('\\') !== -1) {
    return '名称不能包含 / \\ : 等字符';
  }
  if (/[\u0000-\u001f]/.test(name)) return '名称包含非法字符';
  if (name.length > 200) return '名称过长';
  return '';
}

function suffixName(name, suffix) {
  const dot = name.lastIndexOf('.');
  return dot > 0 ? name.slice(0, dot) + suffix + name.slice(dot) : name + suffix;
}

function currentDir() {
  if (state.selected) {
    const info = infoCache.get(state.selected);
    if (dirs.has(state.selected) || (info && info.isDirectory)) return normalizePath(state.selected);
    return normalizePath(dirname(state.selected));
  }
  if (activeFile) return normalizePath(dirname(activeFile));
  const first = state.roots[0];
  return first ? normalizePath(first.path) : null;
}

async function movePath(source, destination) {
  if (source === destination) return true;
  // The macOS filesystem is usually case-insensitive; hop through a temp name.
  if (source.toLowerCase() === destination.toLowerCase()) {
    const temp = join(dirname(source), '.' + basename(source) + '.' + Date.now() + '.tmp');
    if (!(await movePath(source, temp))) return false;
    return movePath(temp, destination);
  }
  const ok = await api.moveFile({ source, destination });
  // moveFile occasionally reports failure even when the move succeeded.
  const destExists = !!(await getInfo(destination, true));
  const srcExists = !!(await getInfo(source, true));
  const moved = !!ok || (destExists && !srcExists);
  if (moved) {
    infoCache.delete(source);
    infoCache.delete(destination);
  }
  return moved;
}

async function openEntry(entry, target) {
  if (entry.isDirectory) {
    await toggleDir(entry.path);
    return;
  }
  state.selected = entry.path;
  saveState();
  render();
  let ok = await api.openDocument(entry.path, target);
  if (!ok) ok = await api.openFile(entry.path);
  if (!ok) {
    notify('无法打开文件', entry.path + '\n请确认该文件可由 MarkEdit 打开，或已授予文件夹访问权限。');
    return;
  }
  activeFile = entry.path;
  render();
}

async function toggleDir(path) {
  const normalized = normalizePath(path);
  state.selected = normalized;
  if (state.expanded[normalized]) {
    delete state.expanded[normalized];
  } else {
    state.expanded[normalized] = true;
    await refreshDir(normalized, true);
  }
  saveState();
  render();
}

async function createNew(isDirectory) {
  let dir = currentDir();
  if (!dir) {
    await addFolder();
    return;
  }
  const name = await promptText(
    isDirectory ? '新建文件夹' : '新建文件',
    isDirectory ? '输入文件夹名称' : '例如 notes.md',
    isDirectory ? '' : 'untitled.md',
  );
  if (!name) return;
  const invalid = validateName(name);
  if (invalid) {
    notify('名称无效', invalid);
    return;
  }
  const path = join(dir, name);
  if (await getInfo(path, true)) {
    notify('无法创建', '同名文件已存在：' + path);
    return;
  }
  const ok = await api.createFile(
    isDirectory ? { path, isDirectory: true } : { path, string: '' },
  );
  if (!ok) {
    notify('创建失败', '请确认 MarkEdit 已获得该文件夹的访问权限（File ▸ Bookmarks ▸ Add Bookmarks…）。');
    return;
  }
  state.expanded[normalizePath(dir)] = true;
  invalidateCaches(dir);
  await refreshDir(normalizePath(dir), true);
  state.selected = path;
  saveState();
  render();
  if (!isDirectory) await openEntry({ name, path, isDirectory: false });
}

async function renameEntry(row) {
  const path = normalizePath(row.path);
  const name = await promptText('重命名', '输入新名称', basename(path));
  if (!name || name === basename(path)) return;
  const invalid = validateName(name);
  if (invalid) {
    notify('名称无效', invalid);
    return;
  }
  const destination = join(dirname(path), name);
  if (await getInfo(destination, true)) {
    notify('无法重命名', '同名文件已存在：' + destination);
    return;
  }
  const moved = await movePath(path, destination);
  if (!moved) {
    notify('重命名失败', path);
    return;
  }
  reparentPath(path, destination);
  invalidateCaches(dirname(path));
  saveState();
  await refreshAll(true);
  render();
}

async function trashEntry(row) {
  const path = normalizePath(row.path);
  if (cfg.confirmDelete) {
    const ok = await confirmAction(
      '移到废纸篓',
      '将 “' + basename(path) + '” 移到废纸篓？\n' + path,
      '移到废纸篓',
    );
    if (!ok) return;
  }
  const home = homePath();
  if (!home) {
    notify('无法移到废纸篓', '未能确定用户目录。');
    return;
  }
  const trashDir = join(home, '.Trash');
  let destination = join(trashDir, basename(path));
  for (let i = 2; await getInfo(destination, true); i++) {
    destination = join(trashDir, suffixName(basename(path), ' ' + i));
  }
  const moved = await movePath(path, destination);
  if (!moved) {
    notify('操作失败', '无法移动到废纸篓。该文件夹可能未授权，请在 File ▸ Bookmarks 中添加后再试。');
    return;
  }
  if (state.selected === path) state.selected = null;
  if (activeFile === path) activeFile = null;
  if (clipboardPath === path) clipboardPath = null;
  forgetPath(path);
  invalidateCaches(dirname(path));
  saveState();
  await refreshAll(true);
  render();
}

async function copyPathToClipboard(path) {
  try {
    if (window.navigator && window.navigator.clipboard && window.navigator.clipboard.writeText) {
      await window.navigator.clipboard.writeText(path);
      return;
    }
  } catch (_) {
    /* fall through to legacy copy */
  }
  try {
    const area = doc.createElement('textarea');
    area.value = path;
    area.style.position = 'fixed';
    area.style.opacity = '0';
    doc.body.appendChild(area);
    area.select();
    if (doc.execCommand) doc.execCommand('copy');
    doc.body.removeChild(area);
  } catch (_) {
    notify('路径', path);
  }
}

async function moveInto(source, targetDir) {
  if (!source) return;
  const destDir = normalizePath(targetDir);
  if (isWithin(destDir, source)) {
    notify('无法移动', '不能把文件夹移动到它自身内部。');
    return;
  }
  const destination = join(destDir, basename(source));
  if (destination === source || dirname(source) === destDir) return;
  if (await getInfo(destination, true)) {
    notify('无法移动', '目标位置已有同名文件：' + destination);
    return;
  }
  if (cfg.confirmMove) {
    const ok = await confirmAction('移动文件', source + '\n→ ' + destination, '移动');
    if (!ok) return;
  }
  const moved = await movePath(source, destination);
  if (!moved) {
    notify('移动失败', '请检查文件夹访问权限。');
    return;
  }
  clipboardPath = null;
  dragSource = null;
  reparentPath(source, destination);
  invalidateCaches(dirname(source));
  invalidateCaches(destDir);
  saveState();
  await refreshAll(true);
  render();
}

async function addFolder() {
  const paths = await api.showOpenPanel({
    title: '添加工作区文件夹',
    message: '选择要在 Explorer 中显示的文件夹（可多选）。通过此面板选择后，MarkEdit 会自动获得沙盒访问授权。',
    prompt: '添加',
    selectionType: 'directories',
    allowsMultipleSelection: true,
  });
  if (!Array.isArray(paths) || paths.length === 0) return;
  let added = 0;
  for (const raw of paths) {
    const path = normalizePath(raw);
    if (!path || state.roots.some((r) => normalizePath(r.path) === path)) continue;
    state.roots.push({ id: nextRootId(), name: basename(path), path });
    state.expanded[path] = true;
    added += 1;
  }
  if (!added) return;
  saveState();
  setSidebar(true);
  await refreshAll(true);
  render();
}

async function renameRoot(row) {
  const root = row.root || state.roots.find((r) => normalizePath(r.path) === normalizePath(row.path));
  if (!root) return;
  const name = await promptText('重命名工作区', '仅修改 Explorer 中的显示名称', root.name);
  if (!name || name === root.name) return;
  root.name = name;
  saveState();
  render();
}

async function removeRoot(rootRow) {
  const root = rootRow.root || state.roots.find((r) => normalizePath(r.path) === normalizePath(rootRow.path));
  if (!root) return;
  const ok = await confirmAction(
    '从工作区移除',
    '仅从 Explorer 移除 “' + root.name + '”，不会删除磁盘上的任何文件。',
    '移除',
  );
  if (!ok) return;
  state.roots = state.roots.filter((r) => r.id !== root.id);
  forgetPath(root.path);
  if (state.selected && isWithin(state.selected, root.path)) state.selected = null;
  saveState();
  render();
}

async function createDemoWorkspace() {
  const base = containerDocuments();
  if (!base) {
    notify('无法创建示例工作区', '未能定位 MarkEdit 的 Documents 目录。');
    return;
  }
  const container = join(base, 'MarkEdit Explorer');
  const rootDir = join(container, 'My Documents');
  const projects = join(rootDir, 'Projects');
  const documents = join(rootDir, 'Documents');

  await api.createFile({ path: container, isDirectory: true });
  await api.createFile({ path: rootDir, isDirectory: true });
  await api.createFile({ path: projects, isDirectory: true });
  await api.createFile({ path: documents, isDirectory: true });
  const samples = [
    {
      path: join(projects, 'plan.md'),
      content: '# Plan\n\n- [x] 搭建 Explorer 侧边栏\n- [ ] 文件打开与管理\n- [ ] 工作区记忆与自动刷新\n',
    },
    {
      path: join(projects, 'architecture.md'),
      content: '# Architecture\n\nMarkEdit Explorer 是一个单文件注入脚本，通过 MarkEdit 原生文件 API 读写目录，不修改主程序。\n',
    },
    {
      path: join(documents, 'README.md'),
      content: '# README\n\n这是 MarkEdit Explorer 的示例工作区，位于 MarkEdit 应用容器内。\n',
    },
  ];
  for (const sample of samples) {
    if (!(await getInfo(sample.path, true))) {
      await api.createFile({ path: sample.path, string: sample.content });
    }
  }
  if (!state.roots.some((r) => normalizePath(r.path) === normalizePath(rootDir))) {
    state.roots.push({ id: nextRootId(), name: 'My Documents', path: rootDir, demo: true });
  }
  state.expanded[normalizePath(rootDir)] = true;
  state.expanded[normalizePath(projects)] = true;
  state.expanded[normalizePath(documents)] = true;
  invalidateCaches(rootDir);
  saveState();
  setSidebar(true);
  await refreshAll(true);
  render();
}

function collapseAll() {
  state.expanded = {};
  saveState();
  render();
}

function toggleHiddenFiles() {
  state.showHidden = !state.showHidden;
  saveState();
  render();
}

function toggleAutoReveal() {
  state.autoReveal = !state.autoReveal;
  saveState();
  render();
}

function setPollInterval(ms) {
  state.pollMs = ms;
  saveState();
  startPolling();
  render();
}

function resetWidth() {
  state.width = cfg.defaultWidth;
  saveState();
  applyLayout();
}

function showAbout() {
  void api.showAlert({
    title: 'MarkEdit Explorer v' + VERSION,
    message:
      'VS Code / Codex 风格文件树侧边栏。\n\n' +
      '· 多工作区、懒加载目录、自动刷新\n' +
      '· 打开 / 新建 / 重命名 / 移动 / 废纸篓 / Finder\n' +
      '· 状态通过 localStorage 在所有标签页间共享\n\n' +
      '最低版本 MarkEdit ' + MIN_APP_VERSION + '，无需修改主程序、无网络依赖。',
    buttons: ['好'],
  });
}

/* ---------- native menus ---------- */

function menuItem(title, action, extra) {
  return Object.assign({ title, action }, extra || {});
}

function separator() {
  return { separator: true };
}

function entryMenuItems(row) {
  const isDir = row.kind === 'root' || (row.entry && row.entry.isDirectory);
  const path = normalizePath(row.path);
  const items = [];
  if (isDir) {
    items.push(menuItem(state.expanded[path] ? '折叠' : '展开', () => void toggleDir(path)));
    items.push(menuItem('在此新建文件…', () => void createNew(false), { icon: 'doc.badge.plus' }));
    items.push(menuItem('在此新建文件夹…', () => void createNew(true), { icon: 'folder.badge.plus' }));
    if (clipboardPath) items.push(menuItem('粘贴到此文件夹', () => void moveInto(clipboardPath, path)));
  } else {
    items.push(menuItem('打开', () => void openEntry(row.entry), { icon: 'doc.text' }));
    items.push(menuItem('在新窗口打开', () => void openEntry(row.entry, 'window')));
    items.push(separator());
  }
  if (row.kind === 'root') {
    items.push(menuItem('重命名工作区…', () => void renameRoot(row), { icon: 'pencil' }));
  } else {
    items.push(menuItem('重命名…', () => void renameEntry(row), { icon: 'pencil' }));
    items.push(menuItem('剪切', () => {
      clipboardPath = path;
      dragSource = null;
      render();
    }, { icon: 'scissors' }));
  }
  items.push(menuItem('复制路径', () => void copyPathToClipboard(path), { icon: 'link' }));
  items.push(menuItem('在 Finder 中显示', () => void api.revealFile(path), { icon: 'finder' }));
  items.push(separator());
  if (row.kind === 'root') {
    items.push(menuItem('从工作区移除…', () => void removeRoot(row), { icon: 'minus.circle' }));
  } else {
    items.push(menuItem('移到废纸篓…', () => void trashEntry(row), { icon: 'trash' }));
  }
  return items;
}

function blankMenuItems() {
  return [
    menuItem('添加工作区文件夹…', () => void addFolder(), { icon: 'folder.badge.plus' }),
    menuItem('刷新', () => void refreshAll(true), { icon: 'arrow.clockwise' }),
    separator(),
    menuItem(state.showHidden ? '隐藏隐藏文件' : '显示隐藏文件', toggleHiddenFiles, {
      icon: state.showHidden ? 'eye.slash' : 'eye',
    }),
    menuItem('折叠全部', collapseAll, { icon: 'chevron.up' }),
    menuItem('创建示例工作区', () => void createDemoWorkspace(), { icon: 'sparkles' }),
  ];
}

function installMenu() {
  const shortcut = cfg.shortcut || DEFAULTS.shortcut;
  api.addMainMenuItem([
    menuItem('Toggle Explorer', toggleSidebar, {
      icon: 'sidebar.left',
      key: shortcut.key,
      modifiers: shortcut.modifiers,
      state: () => ({ isSelected: state.visible }),
    }),
    separator(),
    menuItem('Add Folder to Explorer…', () => void addFolder(), { icon: 'folder.badge.plus' }),
    menuItem('Refresh Explorer', () => void refreshAll(true), { icon: 'arrow.clockwise' }),
    menuItem('Reveal Active File', () => void revealActive(), { icon: 'doc.text.magnifyingglass' }),
    separator(),
    {
      title: 'Explorer Options',
      children: [
        menuItem('Show Hidden Files', toggleHiddenFiles, {
          state: () => ({ isSelected: state.showHidden }),
        }),
        menuItem('Auto Reveal Active File', toggleAutoReveal, {
          state: () => ({ isSelected: state.autoReveal }),
        }),
        {
          title: 'Auto Refresh',
          children: [
            menuItem('关闭', () => setPollInterval(0), { state: () => ({ isSelected: state.pollMs === 0 }) }),
            menuItem('每 2 秒', () => setPollInterval(2000), { state: () => ({ isSelected: state.pollMs === 2000 }) }),
            menuItem('每 3 秒', () => setPollInterval(3000), { state: () => ({ isSelected: state.pollMs === 3000 }) }),
            menuItem('每 5 秒', () => setPollInterval(5000), { state: () => ({ isSelected: state.pollMs === 5000 }) }),
            menuItem('每 10 秒', () => setPollInterval(10000), { state: () => ({ isSelected: state.pollMs === 10000 }) }),
          ],
        },
        separator(),
        menuItem('Reset Sidebar Width', resetWidth),
        menuItem('Create Demo Workspace', () => void createDemoWorkspace()),
        separator(),
        menuItem('About MarkEdit Explorer', showAbout),
      ],
    },
  ]);
}

/* ---------- row events ---------- */

function onRowClick(row, event) {
  if (event && event.preventDefault && row.kind === 'root') event.preventDefault();
  if (row.kind === 'empty' || row.kind === 'error') {
    if (row.kind === 'error') void refreshAll(true);
    return;
  }
  const path = normalizePath(row.path);
  state.selected = path;
  saveState();
  if (row.kind === 'root' || (row.entry && row.entry.isDirectory)) {
    void toggleDir(path);
    return;
  }
  render();
  if (row.kind === 'entry' && cfg.openMode === 'singleClick') void openEntry(row.entry);
}

function onRowDoubleClick(row, event) {
  if (row.kind !== 'entry' || row.entry.isDirectory) return;
  if (cfg.openMode !== 'doubleClick') return;
  if (event && event.preventDefault) event.preventDefault();
  void openEntry(row.entry);
}

function menuLocation(event) {
  if (event && typeof event.clientX === 'number' && typeof event.clientY === 'number') {
    return { x: event.clientX, y: event.clientY };
  }
  return undefined;
}

function onRowContextMenu(row, event) {
  if (event && event.preventDefault) event.preventDefault();
  state.selected = row.path || null;
  saveState();
  render();
  const items = row.kind === 'empty' || row.kind === 'error' ? blankMenuItems() : entryMenuItems(row);
  api.showContextMenu(items, menuLocation(event), { highlightedIndex: 0 });
}

function onBlankContextMenu(event) {
  if (event && event.preventDefault) event.preventDefault();
  api.showContextMenu(blankMenuItems(), menuLocation(event));
}

function onTreeKeyDown(event) {
  if (!event || !event.key) return;
  const rows = flattenRows().filter((r) => r.kind === 'entry' || r.kind === 'root');
  if (rows.length === 0) return;
  let index = rows.findIndex((r) => r.path === state.selected);
  if (index < 0) index = 0;
  const row = rows[index];

  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    if (event.preventDefault) event.preventDefault();
    const next = clamp(index + (event.key === 'ArrowDown' ? 1 : -1), 0, rows.length - 1);
    state.selected = rows[next].path;
    saveState();
    render();
    scrollSelectionIntoView();
    return;
  }
  if (event.key === 'ArrowRight') {
    if (event.preventDefault) event.preventDefault();
    const isDir = row.kind === 'root' || (row.entry && row.entry.isDirectory);
    if (isDir && !state.expanded[row.path]) void toggleDir(row.path);
    return;
  }
  if (event.key === 'ArrowLeft') {
    if (event.preventDefault) event.preventDefault();
    if (state.expanded[row.path]) void toggleDir(row.path);
    else {
      state.selected = normalizePath(dirname(row.path));
      saveState();
      render();
    }
    return;
  }
  if (event.key === 'Enter' || event.key === 'Return') {
    if (event.preventDefault) event.preventDefault();
    if (row.kind === 'root' || (row.entry && row.entry.isDirectory)) void toggleDir(row.path);
    else if (row.entry) void openEntry(row.entry);
    return;
  }
  if (event.key === 'Delete' || event.key === 'Backspace') {
    if (row.kind === 'entry' && event.preventDefault) event.preventDefault();
    if (row.kind === 'entry') void trashEntry(row);
    return;
  }
  if (event.key === 'Escape') {
    if (ui.filter) ui.filter.value = '';
    state.filter = '';
    render();
  }
}

function onDragStart(row, event) {
  dragSource = row.path;
  try {
    if (event.dataTransfer && event.dataTransfer.setData) {
      event.dataTransfer.setData('text/plain', row.path);
      event.dataTransfer.effectAllowed = 'move';
    }
  } catch (_) {
    /* unsupported */
  }
}

function isDropTarget(row) {
  return row.kind === 'root' || (row.kind === 'entry' && row.entry && row.entry.isDirectory);
}

function onDragOver(row, event) {
  if (!isDropTarget(row) || !dragSource) return;
  if (event && event.preventDefault) event.preventDefault();
  const node = event && event.currentTarget;
  if (node && node.classList) node.classList.add('mex-drop-target');
  try {
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
  } catch (_) {
    /* unsupported */
  }
}

function onDragLeave(row, event) {
  const node = event && event.currentTarget;
  if (node && node.classList) node.classList.remove('mex-drop-target');
}

function onDrop(row, event) {
  if (!isDropTarget(row)) return;
  if (event && event.preventDefault) event.preventDefault();
  let source = dragSource;
  try {
    if (!source && event.dataTransfer && event.dataTransfer.getData) {
      source = event.dataTransfer.getData('text/plain');
    }
  } catch (_) {
    /* unsupported */
  }
  const node = event && event.currentTarget;
  if (node && node.classList) node.classList.remove('mex-drop-target');
  if (source) void moveInto(source, row.path);
}
