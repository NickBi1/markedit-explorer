/* ---- 05-boot: lifecycle, auto refresh, active document, scripting API ---- */

async function updateActiveFile() {
  let path = null;
  try {
    // No argument: MarkEdit reports the current document.
    const info = await api.getFileInfo();
    if (info && info.filePath) path = info.filePath;
  } catch (_) {
    /* ignore */
  }
  if (!path) {
    const recent = await api.recentDocumentPaths();
    if (Array.isArray(recent) && recent.length > 0 && typeof recent[0] === 'string') path = recent[0];
  }
  path = path ? normalizePath(path) : null;
  if (path === activeFile) return false;
  activeFile = path;
  if (path && state.autoReveal && rootForPath(path)) await revealPath(path);
  else render();
  return true;
}

async function revealActive() {
  await updateActiveFile();
  if (!activeFile) {
    notify('未找到当前文档', 'Explorer 中没有与当前文档匹配的工作区。');
    return;
  }
  if (!rootForPath(activeFile)) {
    notify('当前文档不在工作区内', activeFile);
    return;
  }
  setSidebar(true);
  await revealPath(activeFile);
}

async function pollTick() {
  if (!state.visible || (doc && doc.hidden)) return;
  if (polling) return;
  polling = true;
  try {
    await refreshAll(true);
    if (refreshCount % 2 === 0) await updateActiveFile();
  } finally {
    polling = false;
  }
}

function startPolling() {
  if (pollTimer && typeof window.clearInterval === 'function') window.clearInterval(pollTimer);
  pollTimer = null;
  if (!state || state.pollMs <= 0 || typeof window.setInterval !== 'function') return;
  pollTimer = window.setInterval(() => {
    void pollTick();
  }, state.pollMs);
}

function bindGlobalEvents() {
  window.addEventListener('storage', (event) => {
    if (event && event.key === STORAGE_KEY) adoptRemoteState();
  });
  window.addEventListener('focus', () => {
    void refreshAll(true);
    void updateActiveFile();
  });
  window.addEventListener('resize', applyLayout);

  doc.addEventListener('visibilitychange', () => {
    if (!doc.hidden) void refreshAll(true);
  });
  doc.addEventListener('keydown', (event) => {
    const shortcut = cfg.shortcut || DEFAULTS.shortcut;
    if (!event || !event.metaKey || !event.shiftKey || event.altKey || event.ctrlKey) return;
    if ((event.key || '').toLowerCase() !== String(shortcut.key).toLowerCase()) return;
    if (event.preventDefault) event.preventDefault();
    toggleSidebar();
  });

  try {
    if (hasApi('onAppReady')) M.onAppReady(() => void refreshAll(true));
    if (hasApi('onEditorReady')) {
      M.onEditorReady(() => {
        syncTheme();
        void updateActiveFile();
      });
    }
    if (hasApi('onEditorConfigChange')) M.onEditorConfigChange(() => syncTheme());
  } catch (_) {
    /* listeners are best-effort */
  }

  try {
    const scheme = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
    if (scheme && scheme.addEventListener) scheme.addEventListener('change', syncTheme);
  } catch (_) {
    /* ignore */
  }

  // Re-apply our inset when another sidebar extension rewrites body styles.
  try {
    if (typeof window.MutationObserver === 'function') {
      let pending = false;
      const observer = new window.MutationObserver(() => {
        if (pending) return;
        pending = true;
        window.setTimeout(() => {
          pending = false;
          applyLayout();
        }, 0);
      });
      observer.observe(doc.body, { attributes: true, attributeFilter: ['style'] });
      observer.observe(rootEl, { attributes: true, attributeFilter: ['style', 'class'] });
    }
  } catch (_) {
    /* ignore */
  }
}

async function openFolderProgrammatically(path) {
  if (!path || typeof path !== 'string') return false;
  const normalized = normalizePath(path);
  if (!state.roots.some((r) => normalizePath(r.path) === normalized)) {
    state.roots.push({ id: nextRootId(), name: basename(normalized), path: normalized });
  }
  state.expanded[normalized] = true;
  saveState();
  setSidebar(true);
  await refreshAll(true);
  render();
  return true;
}

function exposeAPI() {
  window.MarkEditExplorer = {
    version: VERSION,
    minAppVersion: MIN_APP_VERSION,
    toggle: () => toggleSidebar(),
    open: () => setSidebar(true),
    close: () => setSidebar(false),
    refresh: () => refreshAll(true),
    addFolder: () => addFolder(),
    openFolder: (path) => openFolderProgrammatically(path),
    removeRoot: (id) => {
      state.roots = state.roots.filter((r) => r.id !== id);
      saveState();
      render();
    },
    roots: () => state.roots.map((r) => ({ ...r })),
    state: () => ({ ...state, expanded: { ...state.expanded } }),
  };
}

function scheduleRetry() {
  if (typeof window.setTimeout !== 'function') return;
  window.setTimeout(boot, 100);
}

function boot() {
  if (booted) return;
  if (!window || !window.document) return;
  doc = window.document;
  rootEl = doc.documentElement;
  M = window.MarkEdit || (typeof globalThis !== 'undefined' ? globalThis.MarkEdit : null) || M;

  if (!doc.body || !doc.head) {
    bootRetries += 1;
    if (bootRetries < 30) scheduleRetry();
    return;
  }
  if (!M || typeof M.listFiles !== 'function') {
    bootRetries += 1;
    if (bootRetries < 30) {
      scheduleRetry();
      return;
    }
    // Boot anyway: fileApiAvailable() will surface the missing capabilities.
  }

  booted = true;
  cfg = readSettings();
  state = loadState();

  try {
    buildUI();
    installMenu();
    bindGlobalEvents();
    exposeAPI();
    startPolling();
  } catch (error) {
    console.error('[MarkEdit Explorer] 初始化失败:', error);
    return;
  }

  void (async () => {
    try {
      await ensureDefaultRoot();
      await refreshAll(true);
      render();
      await updateActiveFile();
    } catch (error) {
      console.warn('[MarkEdit Explorer] 首次加载失败:', error);
    }
  })();
}

/* Scripts are injected at an unpredictable point in the WebView lifecycle, so
   boot immediately, and also on app/editor ready as idempotent second chances. */
try {
  if (doc && doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', boot);
  else boot();
} catch (_) {
  boot();
}

try {
  const initialApi = window.MarkEdit || (typeof globalThis !== 'undefined' ? globalThis.MarkEdit : null);
  if (initialApi && typeof initialApi.onAppReady === 'function') initialApi.onAppReady(boot);
} catch (_) {
  /* ignore */
}
