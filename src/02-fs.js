/* ---- 02-fs: directory model, fingerprints, tree flattening ---- */

async function getInfo(path, force) {
  if (!force && infoCache.has(path)) return infoCache.get(path);
  const result = await api.getFileInfo(path);
  if (!result) {
    infoCache.delete(path);
    return undefined;
  }
  const rawDate = result.modificationDate;
  const time = rawDate instanceof Date ? rawDate.getTime() : new Date(rawDate).getTime();
  const value = {
    isDirectory: !!result.isDirectory,
    modified: isFinite(time) ? time : 0,
  };
  infoCache.set(path, value);
  return value;
}

function shouldShow(name) {
  if (!name || name === '.' || name === '..') return false;
  if (!state.showHidden && name.charAt(0) === '.') return false;
  for (const pattern of cfg.exclude) {
    if (matchGlob(pattern, name)) return false;
  }
  return true;
}

/**
 * MarkEdit.listFiles returns file *names* (not paths). Be defensive in case a
 * future build returns full paths or a recursive listing.
 */
async function readDir(dir, forceInfo) {
  const names = await api.listFiles(dir);
  if (!Array.isArray(names)) return null;

  const seen = new Set();
  const unique = [];
  for (const raw of names) {
    if (typeof raw !== 'string' || raw.length === 0) continue;
    let name = raw;
    if (name.charAt(0) === '/') name = basename(name);
    else if (name.indexOf('/') !== -1) name = name.split('/')[0];
    if (!name || name === '.' || name === '..' || seen.has(name)) continue;
    seen.add(name);
    unique.push(name);
  }

  const limited = unique.slice(0, cfg.maxEntriesPerFolder);
  const entries = await mapLimit(limited, 24, async (name) => {
    const path = join(dir, name);
    const meta = await getInfo(path, !!forceInfo);
    if (!meta) return null;
    return {
      name,
      path,
      isDirectory: meta.isDirectory,
      modified: meta.modified,
    };
  });
  return entries.filter(Boolean);
}

function compareEntries(a, b) {
  if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
  return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
}

function visibleEntries(dir) {
  const cached = dirs.get(dir);
  if (!cached) return [];
  return cached.entries.filter((entry) => shouldShow(entry.name)).sort(compareEntries);
}

function fingerprint(entries) {
  return entries
    .map((entry) => entry.name + ':' + (entry.isDirectory ? 'd' : 'f') + ':' + entry.modified)
    .join('|');
}

async function refreshDir(dir, forceInfo) {
  const entries = await readDir(dir, forceInfo);
  const previous = dirs.get(dir);
  if (entries === null) {
    dirs.set(dir, { entries: [], fingerprint: 'error', error: true });
    return !previous || !previous.error;
  }
  const fp = fingerprint(entries);
  const changed = !previous || previous.error || previous.fingerprint !== fp;
  dirs.set(dir, { entries, fingerprint: fp, error: false });
  return changed;
}

function watchedDirs() {
  const paths = new Set();
  for (const root of state.roots) paths.add(normalizePath(root.path));
  for (const key of Object.keys(state.expanded)) {
    if (!state.expanded[key]) continue;
    if (state.roots.some((root) => isWithin(key, normalizePath(root.path)))) {
      paths.add(normalizePath(key));
    }
  }
  return [...paths];
}

/** Re-reads roots and expanded folders; re-renders only when something changed. */
async function refreshAll(forceInfo) {
  const paths = watchedDirs();
  const results = await mapLimit(paths, 4, (path) => refreshDir(path, forceInfo));
  // Evict collapsed folders so the cache cannot grow forever.
  const watched = new Set(paths);
  for (const key of dirs.keys()) {
    if (!watched.has(key)) dirs.delete(key);
  }
  refreshCount += 1;
  lastRefreshAt = Date.now();
  const changed = results.some(Boolean);
  if (changed) render();
  else updateFooter();
  return changed;
}

function forgetPath(path) {
  const normalized = normalizePath(path);
  for (const key of [...infoCache.keys()]) {
    if (isWithin(key, normalized)) infoCache.delete(key);
  }
  for (const key of [...dirs.keys()]) {
    if (isWithin(key, normalized)) dirs.delete(key);
  }
  for (const key of Object.keys(state.expanded)) {
    if (isWithin(key, normalized)) delete state.expanded[key];
  }
}

function reparentPath(source, destination) {
  const remap = (value) =>
    isWithin(value, source) ? normalizePath(destination) + value.slice(source.length) : value;
  const expanded = {};
  for (const key of Object.keys(state.expanded)) {
    if (state.expanded[key]) expanded[remap(key)] = true;
  }
  state.expanded = expanded;
  if (state.selected) state.selected = remap(state.selected);
  if (activeFile) activeFile = remap(activeFile);
  if (clipboardPath) clipboardPath = remap(clipboardPath);
  forgetPath(source);
  forgetPath(destination);
}

function rootForPath(path) {
  return state.roots.find((root) => isWithin(path, normalizePath(root.path))) || null;
}

function flattenRows() {
  const rows = [];
  const filter = state.filter.trim().toLowerCase();

  if (filter) {
    for (const root of state.roots) {
      const rootPath = normalizePath(root.path);
      for (const [dir, cached] of dirs) {
        if (!isWithin(dir, rootPath)) continue;
        for (const entry of cached.entries) {
          if (!entry.name.toLowerCase().includes(filter)) continue;
          if (!shouldShow(entry.name)) continue;
          rows.push({
            kind: 'entry',
            label: entry.name,
            path: entry.path,
            depth: 0,
            entry,
            hint: root.name + '/' + entry.path.slice(rootPath.length + 1),
          });
          if (rows.length >= cfg.maxRows) return rows;
        }
      }
    }
    if (rows.length === 0) rows.push({ kind: 'empty', label: '没有匹配的文件' });
    return rows;
  }

  for (const root of state.roots) {
    const rootPath = normalizePath(root.path);
    const cached = dirs.get(rootPath);
    rows.push({
      kind: 'root',
      label: root.name,
      path: rootPath,
      root,
      depth: 0,
      expanded: !!state.expanded[rootPath],
      error: !!(cached && cached.error),
    });
    if (state.expanded[rootPath]) walk(rootPath, 1, rows);
    if (rows.length >= cfg.maxRows) break;
  }

  if (state.roots.length === 0) {
    rows.push({
      kind: 'empty',
      label: '还没有工作区文件夹',
      message:
        '添加一个本地文件夹作为工作区根节点，即可在编辑器左侧浏览、打开和管理文件。',
      actionLabel: '添加文件夹…',
      action: 'add-folder',
      extraLabel: '创建示例工作区',
      extraAction: 'create-demo',
    });
  } else if (rows.length === state.roots.length && !state.expanded[normalizePath(state.roots[0].path)]) {
    // Roots are collapsed; nothing else to explain.
  }
  return rows;
}

function walk(dir, depth, rows) {
  const cached = dirs.get(dir);
  if (cached && cached.error) {
    rows.push({
      kind: 'error',
      label: '无法读取此文件夹（可能尚未授权）',
      path: dir,
      depth,
      message: '在 MarkEdit 的 File ▸ Bookmarks ▸ Add Bookmarks… 中授权该文件夹后，点击刷新。',
    });
    return;
  }
  const entries = visibleEntries(dir);
  for (const entry of entries) {
    rows.push({
      kind: 'entry',
      label: entry.name,
      path: entry.path,
      depth,
      entry,
      expanded: entry.isDirectory ? !!state.expanded[entry.path] : false,
    });
    if (rows.length >= cfg.maxRows) return;
    if (entry.isDirectory && state.expanded[entry.path]) walk(entry.path, depth + 1, rows);
  }
  if (entries.length === 0 && cached && !cached.error) {
    rows.push({ kind: 'empty', label: '（空文件夹）', path: dir, depth });
  }
}

function ancestorsOf(path, rootPath) {
  const list = [];
  let current = dirname(path);
  const guard = 64;
  for (let i = 0; i < guard; i++) {
    if (!isWithin(current, rootPath)) break;
    list.unshift(normalizePath(current));
    if (current === rootPath) break;
    current = dirname(current);
  }
  return list;
}

/** Expands every ancestor of a file and selects it (used by auto-reveal). */
async function revealPath(path) {
  const root = rootForPath(path);
  if (!root) return false;
  const rootPath = normalizePath(root.path);
  const chain = ancestorsOf(path, rootPath);
  for (const dir of chain) state.expanded[dir] = true;
  const loaded = await mapLimit(chain, 3, (dir) => refreshDir(dir, true));
  state.selected = path;
  saveState();
  render();
  scrollSelectionIntoView();
  return loaded.some(Boolean);
}

async function ensureDefaultRoot() {
  if (state.roots.length > 0) return;
  const candidate = defaultRootPath();
  if (!candidate) return;
  const probe = await refreshDir(normalizePath(candidate), true);
  if (dirs.get(normalizePath(candidate)) && dirs.get(normalizePath(candidate)).error) {
    // Permission denied: leave the empty state with an actionable hint.
    return;
  }
  state.roots = [{ id: 'root-default', name: 'My Documents', path: normalizePath(candidate) }];
  state.expanded[normalizePath(candidate)] = true;
  saveState();
  void probe;
}
