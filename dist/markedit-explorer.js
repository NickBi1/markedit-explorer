/**
 * MarkEdit Explorer v1.0.0
 * A VS Code / Codex style file explorer sidebar for MarkEdit.
 *
 * id:             markedit-explorer
 * version:        1.0.0
 * minAppVersion:  1.37.0
 * format:         single injectable script (MarkEdit official extension format)
 * runtime:        offline, no CDN, no external dependencies, no main-app patches
 *
 * Install:  place this file at
 *   ~/Library/Containers/app.cyan.markedit/Data/Documents/scripts/markedit-explorer.js
 * and register it in extensions.json (see install.sh), then relaunch MarkEdit.
 */
(function () {
"use strict";

const CSS_TEXT = "/* MarkEdit Explorer — all selectors are prefixed with mex- to avoid collisions\n   with MarkEdit, MarkEdit-preview (cm-*) and other sidebar extensions. */\n\n.mex {\n  --mex-accent: AccentColor;\n  --mex-hover: rgba(127, 127, 127, 0.14);\n  --mex-selected: rgba(127, 127, 127, 0.22);\n  --mex-active: rgba(127, 127, 127, 0.30);\n  --mex-border: rgba(127, 127, 127, 0.24);\n  --mex-muted: rgba(127, 127, 127, 0.95);\n  position: fixed;\n  top: 0;\n  bottom: 0;\n  left: 0;\n  z-index: 60;\n  display: flex;\n  flex-direction: column;\n  box-sizing: border-box;\n  width: 260px;\n  background: Canvas;\n  color: CanvasText;\n  border-right: 1px solid var(--mex-border);\n  font-family: -apple-system, BlinkMacSystemFont, 'Helvetica Neue', system-ui, sans-serif;\n  font-size: 13px;\n  line-height: 22px;\n  -webkit-user-select: none;\n  user-select: none;\n  cursor: default;\n  outline: none;\n  transition: transform 0.16s ease;\n}\n\n.mex.mex-right {\n  left: auto;\n  right: 0;\n  border-right: none;\n  border-left: 1px solid var(--mex-border);\n}\n\n.mex.mex-hidden {\n  visibility: hidden;\n  transform: translateX(-100%);\n}\n\n.mex.mex-right.mex-hidden {\n  transform: translateX(100%);\n}\n\n/* MarkEdit's active-line layer assumes the editor starts at x=0. */\nhtml.mex-push .cm-md-activeLine {\n  transform: translateX(calc(-1 * var(--mex-left-inset, 0px))) !important;\n}\n\n.mex-sash {\n  position: absolute;\n  top: 0;\n  bottom: 0;\n  width: 6px;\n  right: -3px;\n  z-index: 3;\n  cursor: ew-resize;\n}\n\n.mex.mex-right .mex-sash {\n  right: auto;\n  left: -3px;\n}\n\n.mex-sash:hover,\n.mex-sash.mex-dragging {\n  background: var(--mex-accent);\n  opacity: 0.65;\n}\n\n.mex-header {\n  display: flex;\n  align-items: center;\n  flex: 0 0 34px;\n  height: 34px;\n  padding: 0 8px 0 14px;\n  box-sizing: border-box;\n}\n\n.mex-title {\n  flex: 1 1 auto;\n  font-size: 11px;\n  font-weight: 600;\n  letter-spacing: 0.06em;\n  text-transform: uppercase;\n  opacity: 0.75;\n  white-space: nowrap;\n  overflow: hidden;\n  text-overflow: ellipsis;\n}\n\n.mex-actions {\n  display: flex;\n  align-items: center;\n  gap: 1px;\n  flex: 0 0 auto;\n}\n\n.mex-btn {\n  display: block;\n  width: 22px;\n  height: 22px;\n  padding: 0;\n  border: none;\n  border-radius: 4px;\n  background-color: transparent;\n  background-repeat: no-repeat;\n  background-position: center;\n  background-size: 14px 14px;\n  color: inherit;\n  opacity: 0.72;\n  cursor: default;\n}\n\n.mex-btn:hover {\n  background-color: var(--mex-hover);\n  opacity: 1;\n}\n\n.mex-btn:focus-visible {\n  outline: 1px solid var(--mex-accent);\n  outline-offset: -1px;\n}\n\n.mex-filterbar {\n  display: flex;\n  align-items: center;\n  flex: 0 0 28px;\n  padding: 0 8px 0 12px;\n  box-sizing: border-box;\n}\n\n.mex-filter {\n  flex: 1 1 auto;\n  min-width: 0;\n  height: 21px;\n  padding: 0 6px;\n  box-sizing: border-box;\n  border: 1px solid var(--mex-border);\n  border-radius: 4px;\n  background: transparent;\n  color: inherit;\n  font: inherit;\n  font-size: 11px;\n  outline: none;\n  -webkit-user-select: text;\n  user-select: text;\n}\n\n.mex-filter:focus {\n  border-color: var(--mex-accent);\n}\n\n.mex-tree {\n  position: relative;\n  flex: 1 1 auto;\n  min-height: 0;\n  overflow-x: hidden;\n  overflow-y: auto;\n  overscroll-behavior: contain;\n  outline: none;\n  padding-bottom: 12px;\n}\n\n.mex-tree::-webkit-scrollbar {\n  width: 8px;\n}\n\n.mex-tree::-webkit-scrollbar-thumb {\n  background: var(--mex-border);\n  border-radius: 4px;\n}\n\n.mex-row {\n  position: relative;\n  display: flex;\n  align-items: center;\n  height: var(--mex-row-height, 22px);\n  min-height: var(--mex-row-height, 22px);\n  padding-right: 8px;\n  box-sizing: border-box;\n  white-space: nowrap;\n  overflow: hidden;\n}\n\n.mex-row:hover {\n  background: var(--mex-hover);\n}\n\n.mex-row.mex-selected {\n  background: var(--mex-selected);\n}\n\n.mex-row.mex-open-file {\n  box-shadow: inset 2px 0 0 var(--mex-accent);\n}\n\n.mex-row.mex-open-file .mex-label {\n  font-weight: 600;\n}\n\n.mex-row.mex-cut {\n  opacity: 0.45;\n}\n\n.mex-row.mex-drop-target {\n  background: var(--mex-active);\n}\n\n.mex-row.mex-root {\n  height: 24px;\n  min-height: 24px;\n  font-size: 11px;\n  font-weight: 700;\n  letter-spacing: 0.04em;\n  text-transform: uppercase;\n}\n\n.mex-row.mex-error .mex-label {\n  color: -apple-system-red;\n}\n\n.mex-twistie {\n  flex: 0 0 14px;\n  width: 14px;\n  text-align: center;\n  font-size: 13px;\n  line-height: 1;\n  opacity: 0.75;\n  transition: transform 0.1s ease;\n}\n\n.mex-twistie.mex-expanded {\n  transform: rotate(90deg);\n}\n\n.mex-twistie.mex-blank {\n  visibility: hidden;\n}\n\n.mex-ico {\n  position: relative;\n  flex: 0 0 16px;\n  width: 16px;\n  height: 16px;\n  margin: 0 6px 0 2px;\n  background-repeat: no-repeat;\n  background-position: center;\n  background-size: 14px 14px;\n}\n\n.mex-folder::before {\n  content: '';\n  position: absolute;\n  left: 1px;\n  top: 5px;\n  width: 14px;\n  height: 9px;\n  border: 1.3px solid currentColor;\n  border-radius: 2px;\n  opacity: 0.7;\n}\n\n.mex-folder::after {\n  content: '';\n  position: absolute;\n  left: 1px;\n  top: 2px;\n  width: 7px;\n  height: 4px;\n  border: 1.3px solid currentColor;\n  border-bottom: none;\n  border-radius: 2px 2px 0 0;\n  background: Canvas;\n  opacity: 0.7;\n}\n\n.mex-badge {\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  width: 14px;\n  height: 14px;\n  border-radius: 3px;\n  background: rgba(127, 127, 127, 0.32);\n  color: inherit;\n  font-size: 7px;\n  font-weight: 800;\n  letter-spacing: -0.04em;\n  line-height: 1;\n  text-transform: uppercase;\n}\n\n.mex-badge.mex-md { background: rgba(66, 145, 235, 0.85); color: #fff; }\n.mex-badge.mex-code { background: rgba(224, 165, 60, 0.85); color: #fff; }\n.mex-badge.mex-data { background: rgba(150, 120, 210, 0.85); color: #fff; }\n.mex-badge.mex-text { background: rgba(120, 160, 130, 0.75); color: #fff; }\n\n.mex-label {\n  flex: 1 1 auto;\n  min-width: 0;\n  overflow: hidden;\n  text-overflow: ellipsis;\n}\n\n.mex-hint {\n  flex: 0 0 auto;\n  margin-left: 6px;\n  font-size: 10px;\n  opacity: 0.55;\n}\n\n.mex-empty {\n  padding: 14px 16px;\n  font-size: 12px;\n  line-height: 18px;\n  white-space: normal;\n  opacity: 0.7;\n  -webkit-user-select: none;\n  user-select: none;\n}\n\n.mex-empty .mex-empty-title {\n  font-weight: 600;\n  margin-bottom: 6px;\n}\n\n.mex-empty .mex-link {\n  display: inline-block;\n  margin-top: 8px;\n  padding: 3px 8px;\n  border: 1px solid var(--mex-border);\n  border-radius: 4px;\n  cursor: default;\n}\n\n.mex-empty .mex-link:hover {\n  background: var(--mex-hover);\n}\n\n.mex-footer {\n  display: flex;\n  align-items: center;\n  flex: 0 0 22px;\n  height: 22px;\n  padding: 0 10px;\n  box-sizing: border-box;\n  border-top: 1px solid var(--mex-border);\n  font-size: 10px;\n  opacity: 0.6;\n  overflow: hidden;\n  white-space: nowrap;\n  text-overflow: ellipsis;\n}\n\n.mex-footer span {\n  overflow: hidden;\n  text-overflow: ellipsis;\n}\n\n@media (prefers-reduced-motion: reduce) {\n  .mex { transition: none; }\n  .mex-twistie { transition: none; }\n}\n";

/* ---- src/01-core.js ---- */
/* ---- 01-core: constants, settings, persisted state, native API wrappers ---- */

const ID = 'markedit-explorer';
const VERSION = '1.0.0';
const MIN_APP_VERSION = '1.37.0';
const STORAGE_KEY = 'markedit-explorer:state:v1';
const SETTINGS_KEY = 'extension.markeditExplorer';

let M = null;                 // global MarkEdit object, resolved at boot
let doc = null;               // document
let rootEl = null;            // documentElement
let cfg = null;               // merged, sanitized user settings
let state = null;             // persisted workspace state
let ui = null;                // DOM references, created in 03-ui.js

const dirs = new Map();       // dirPath -> { entries, fingerprint, error }
const infoCache = new Map();   // path -> { isDirectory, modified }
let activeFile = null;
let clipboardPath = null;      // cut source for paste / drag & drop
let pollTimer = null;
let polling = false;
let booted = false;
let refreshCount = 0;
let lastRefreshAt = 0;
let bootRetries = 0;

const DEFAULTS = {
  position: 'left',
  defaultWidth: 260,
  onLaunch: 'remember',
  pollInterval: 3000,
  showHiddenFiles: false,
  exclude: ['.git', '.svn', '.hg', '.DS_Store', 'Thumbs.db', 'node_modules'],
  openMode: 'singleClick',
  autoReveal: true,
  confirmDelete: true,
  confirmMove: true,
  maxEntriesPerFolder: 500,
  maxRows: 4000,
  rowHeight: 22,
  indent: 14,
  fontSize: 13,
  shortcut: { key: 'e', modifiers: ['Command', 'Shift'] },
};

/* ---------- generic helpers ---------- */

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function num(value, fallback) {
  return typeof value === 'number' && isFinite(value) ? value : fallback;
}

function plainObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function join(dir, name) {
  const base = dir === '/' ? '' : String(dir).replace(/\/+$/, '');
  return base + '/' + String(name);
}

function basename(path) {
  const p = String(path || '').replace(/\/+$/, '');
  return p.slice(p.lastIndexOf('/') + 1);
}

function dirname(path) {
  const p = String(path || '').replace(/\/+$/, '');
  const i = p.lastIndexOf('/');
  return i <= 0 ? '/' : p.slice(0, i);
}

function isWithin(path, dir) {
  if (!path || !dir) return false;
  if (path === dir) return true;
  const prefix = dir === '/' ? '/' : dir + '/';
  return path.startsWith(prefix);
}

function normalizePath(path) {
  return String(path || '').replace(/\/+$/, '') || '/';
}

function matchGlob(pattern, name) {
  if (pattern === name) return true;
  if (pattern.indexOf('*') < 0 && pattern.indexOf('?') < 0) return false;
  const escaped = String(pattern).replace(/[.+^${}()|[\]\\]/g, '\\$&');
  const source = '^' + escaped.replace(/\*/g, '.*').replace(/\?/g, '.') + '$';
  try {
    return new RegExp(source).test(name);
  } catch (_) {
    return false;
  }
}

async function mapLimit(items, limit, worker) {
  const results = new Array(items.length);
  let cursor = 0;
  const runners = new Array(Math.min(limit, items.length)).fill(0).map(async () => {
    for (;;) {
      const index = cursor++;
      if (index >= items.length) return;
      results[index] = await worker(items[index], index);
    }
  });
  await Promise.all(runners);
  return results;
}

/* ---------- settings.json (optional, namespace: extension.markeditExplorer) ---------- */

function readSettings() {
  let raw = {};
  try {
    raw = M && M.userSettings ? M.userSettings : {};
  } catch (_) {
    raw = {};
  }
  // Some MarkEdit builds inject userSettings as a JSON string.
  if (typeof raw === 'string') {
    try {
      raw = JSON.parse(raw);
    } catch (_) {
      raw = {};
    }
  }
  const own = plainObject(raw)[SETTINGS_KEY] || plainObject(raw).markeditExplorer || {};
  const s = plainObject(own);
  const merged = { ...DEFAULTS };
  if (typeof s.position === 'string' && (s.position === 'left' || s.position === 'right')) {
    merged.position = s.position;
  }
  if (typeof s.onLaunch === 'string' && ['remember', 'open', 'closed'].includes(s.onLaunch)) {
    merged.onLaunch = s.onLaunch;
  }
  merged.defaultWidth = clamp(num(s.defaultWidth, merged.defaultWidth), 170, 600);
  merged.pollInterval = clamp(num(s.pollInterval, merged.pollInterval), 0, 60000);
  merged.showHiddenFiles = typeof s.showHiddenFiles === 'boolean' ? s.showHiddenFiles : merged.showHiddenFiles;
  merged.openMode = s.openMode === 'doubleClick' ? 'doubleClick' : 'singleClick';
  merged.autoReveal = typeof s.autoReveal === 'boolean' ? s.autoReveal : merged.autoReveal;
  merged.confirmDelete = typeof s.confirmDelete === 'boolean' ? s.confirmDelete : merged.confirmDelete;
  merged.confirmMove = typeof s.confirmMove === 'boolean' ? s.confirmMove : merged.confirmMove;
  merged.maxEntriesPerFolder = clamp(num(s.maxEntriesPerFolder, merged.maxEntriesPerFolder), 20, 2000);
  merged.rowHeight = clamp(num(s.rowHeight, merged.rowHeight), 16, 40);
  merged.indent = clamp(num(s.indent, merged.indent), 4, 32);
  merged.fontSize = clamp(num(s.fontSize, merged.fontSize), 9, 20);
  if (Array.isArray(s.exclude)) merged.exclude = s.exclude.filter((x) => typeof x === 'string');
  const shortcut = plainObject(s.shortcut);
  if (typeof shortcut.key === 'string' && Array.isArray(shortcut.modifiers)) {
    merged.shortcut = { key: shortcut.key, modifiers: shortcut.modifiers.filter((x) => typeof x === 'string') };
  }
  return merged;
}

/* ---------- persisted state (localStorage, shared by all MarkEdit tabs) ---------- */

function lsGet(key) {
  try {
    return window.localStorage.getItem(key);
  } catch (_) {
    return null;
  }
}

function lsSet(key, value) {
  try {
    window.localStorage.setItem(key, value);
    return true;
  } catch (_) {
    return false;
  }
}

function validRoot(r) {
  return r && typeof r.id === 'string' && typeof r.name === 'string' && typeof r.path === 'string' && r.path.length > 0;
}

function loadState() {
  let saved = {};
  try {
    saved = JSON.parse(lsGet(STORAGE_KEY) || '{}') || {};
  } catch (_) {
    saved = {};
  }
  const savedObj = plainObject(saved);
  const visibleDefault = cfg.onLaunch === 'closed' ? false : cfg.onLaunch === 'open' ? true : true;
  return {
    version: 1,
    roots: Array.isArray(savedObj.roots) ? savedObj.roots.filter(validRoot) : [],
    expanded: { ...plainObject(savedObj.expanded) },
    selected: typeof savedObj.selected === 'string' ? savedObj.selected : null,
    width: clamp(num(savedObj.width, cfg.defaultWidth), 170, 600),
    visible: typeof savedObj.visible === 'boolean' ? savedObj.visible : visibleDefault,
    pollMs: typeof savedObj.pollMs === 'number' ? clamp(savedObj.pollMs, 0, 60000) : cfg.pollInterval,
    showHidden: typeof savedObj.showHidden === 'boolean' ? savedObj.showHidden : cfg.showHiddenFiles,
    autoReveal: typeof savedObj.autoReveal === 'boolean' ? savedObj.autoReveal : cfg.autoReveal,
    filter: '',
  };
}

function saveState() {
  const snapshot = {
    version: state.version,
    roots: state.roots,
    expanded: state.expanded,
    selected: state.selected,
    width: state.width,
    visible: state.visible,
    pollMs: state.pollMs,
    showHidden: state.showHidden,
    autoReveal: state.autoReveal,
    stamp: Date.now(),
  };
  lsSet(STORAGE_KEY, JSON.stringify(snapshot));
}

function adoptRemoteState() {
  let saved = {};
  try {
    saved = JSON.parse(lsGet(STORAGE_KEY) || '{}') || {};
  } catch (_) {
    return;
  }
  const s = plainObject(saved);
  const filter = state.filter;
  state.roots = Array.isArray(s.roots) ? s.roots.filter(validRoot) : state.roots;
  state.expanded = { ...plainObject(s.expanded) };
  state.selected = typeof s.selected === 'string' ? s.selected : null;
  state.width = clamp(num(s.width, state.width), 170, 600);
  state.visible = typeof s.visible === 'boolean' ? s.visible : state.visible;
  state.pollMs = typeof s.pollMs === 'number' ? clamp(s.pollMs, 0, 60000) : state.pollMs;
  state.showHidden = typeof s.showHidden === 'boolean' ? s.showHidden : state.showHidden;
  state.autoReveal = typeof s.autoReveal === 'boolean' ? s.autoReveal : state.autoReveal;
  state.filter = filter;
  applyLayout();
  render();
  startPolling();
}

/* ---------- MarkEdit native API wrappers (every call is guarded) ---------- */

function hasApi(name) {
  return !!(M && typeof M[name] === 'function');
}

const api = {
  async listFiles(path) {
    try {
      return hasApi('listFiles') ? await M.listFiles(path) : undefined;
    } catch (_) {
      return undefined;
    }
  },
  async getFileInfo(path) {
    try {
      return hasApi('getFileInfo') ? await M.getFileInfo(path) : undefined;
    } catch (_) {
      return undefined;
    }
  },
  async createFile(options) {
    try {
      return hasApi('createFile') ? await M.createFile(options) : false;
    } catch (_) {
      return false;
    }
  },
  async deleteFile(path) {
    try {
      return hasApi('deleteFile') ? await M.deleteFile(path) : false;
    } catch (_) {
      return false;
    }
  },
  async moveFile(options) {
    try {
      return hasApi('moveFile') ? await M.moveFile(options) : false;
    } catch (_) {
      return false;
    }
  },
  async openDocument(path, target) {
    try {
      if (hasApi('openDocument')) return await M.openDocument(path, target ? { target } : undefined);
    } catch (_) {
      /* fall through */
    }
    return false;
  },
  async openFile(path) {
    try {
      return hasApi('openFile') ? await M.openFile(path) : false;
    } catch (_) {
      return false;
    }
  },
  async revealFile(path) {
    try {
      return hasApi('revealFile') ? await M.revealFile(path) : false;
    } catch (_) {
      return false;
    }
  },
  async recentDocumentPaths() {
    try {
      return hasApi('recentDocumentPaths') ? await M.recentDocumentPaths() : [];
    } catch (_) {
      return [];
    }
  },
  async showOpenPanel(options) {
    try {
      return hasApi('showOpenPanel') ? await M.showOpenPanel(options) : undefined;
    } catch (_) {
      return undefined;
    }
  },
  async showTextBox(options) {
    try {
      return hasApi('showTextBox') ? await M.showTextBox(options) : undefined;
    } catch (_) {
      return undefined;
    }
  },
  async showAlert(options) {
    try {
      return hasApi('showAlert') ? await M.showAlert(options) : undefined;
    } catch (_) {
      return undefined;
    }
  },
  showContextMenu(items, location, options) {
    try {
      if (hasApi('showContextMenu')) M.showContextMenu(items, location, options);
    } catch (_) {
      /* native menu is best-effort */
    }
  },
  addMainMenuItem(items) {
    try {
      if (hasApi('addMainMenuItem')) M.addMainMenuItem(items);
    } catch (_) {
      /* native menu is best-effort */
    }
  },
  getDirectoryPath(type) {
    try {
      return hasApi('getDirectoryPath') ? M.getDirectoryPath(type) : '';
    } catch (_) {
      return '';
    }
  },
};

function notify(title, message) {
  if (hasApi('showAlert')) {
    void api.showAlert({ title, message: message || '', buttons: ['好'] });
  } else {
    console.warn('[MarkEdit Explorer] ' + title + (message ? ' — ' + message : ''));
  }
}

async function confirmAction(title, message, okLabel) {
  const index = await api.showAlert({
    title,
    message: message || '',
    buttons: ['取消', okLabel || '继续'],
  });
  return index === 1;
}

async function promptText(title, placeholder, defaultValue) {
  const value = await api.showTextBox({
    title,
    placeholder: placeholder || '',
    defaultValue: defaultValue || '',
  });
  return typeof value === 'string' ? value.trim() : undefined;
}

/* ---------- environment: sandbox home + default workspace ---------- */

/** `getDirectoryPath('home')` returns the sandbox container; recover the real ~. */
function homePath() {
  const home = api.getDirectoryPath('home') || '';
  const marker = '/Library/Containers/';
  const index = home.indexOf(marker);
  if (index > 0) return home.slice(0, index);
  return home.replace(/\/+$/, '');
}

function containerDocuments() {
  return api.getDirectoryPath('documents') || '';
}

function defaultRootPath() {
  const home = homePath();
  if (home) return join(home, 'Documents');
  return containerDocuments();
}

function fileApiAvailable() {
  const required = ['listFiles', 'getFileInfo', 'createFile', 'moveFile', 'openDocument'];
  const missing = required.filter((name) => !hasApi(name));
  return { ok: missing.length === 0, missing };
}

/* ---- src/02-fs.js ---- */
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

/* ---- src/03-ui.js ---- */
/* ---- 03-ui: DOM injection, layout, theme, tree rendering ---- */

const ICONS = {
  plus: '<path d="M8 3v10M3 8h10"/>',
  folderPlus: '<path d="M1.5 12.5V4.5h4l1.5 1.5h7.5v6.5z"/><path d="M8 7.2v4M6 9.2h4"/>',
  refresh: '<path d="M12.8 8a4.8 4.8 0 1 1-1.4-3.4"/><path d="M12.8 2.5v3h-3"/>',
  collapse: '<path d="M3 4.5h10M5 8h6M3 11.5h10"/>',
  folder: '<path d="M1.5 12.5V4.5h4l1.5 1.5h7.5v6.5z"/>',
  close: '<path d="M4.5 4.5l7 7M11.5 4.5l-7 7"/>',
  search: '<circle cx="7" cy="7" r="3.8"/><path d="M9.9 9.9l3.6 3.6"/>',
};

function iconImage(kind) {
  const body = ICONS[kind] || ICONS.plus;
  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="none" ' +
    'stroke="gray" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">' +
    body +
    '</svg>';
  return 'data:image/svg+xml,' + encodeURIComponent(svg);
}

function el(tag, className, text) {
  const node = doc.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined && text !== null) node.textContent = String(text);
  return node;
}

function iconButton(kind, title, handler) {
  const button = el('button', 'mex-btn');
  button.type = 'button';
  button.title = title;
  button.setAttribute('aria-label', title);
  button.tabIndex = -1;
  button.style.backgroundImage = 'url("' + iconImage(kind) + '")';
  button.addEventListener('mousedown', (event) => {
    if (event && event.preventDefault) event.preventDefault();
  });
  button.addEventListener('click', handler);
  return button;
}

function badgeFor(name) {
  const dot = name.lastIndexOf('.');
  const ext = dot > 0 ? name.slice(dot + 1).toLowerCase() : '';
  const markdown = ['md', 'markdown', 'mdown', 'mkd', 'mdx', 'qmd', 'rmd', 'mmd'];
  const data = ['json', 'yaml', 'yml', 'toml', 'xml', 'csv', 'tsv'];
  const code = ['js', 'ts', 'jsx', 'tsx', 'vue', 'py', 'sh', 'swift', 'java', 'css', 'scss', 'html', 'go', 'rs', 'c', 'h'];
  const text = ['txt', 'text', 'log', 'tex', 'ltx'];
  let kind = '';
  if (markdown.includes(ext)) kind = 'mex-md';
  else if (data.includes(ext)) kind = 'mex-data';
  else if (code.includes(ext)) kind = 'mex-code';
  else if (text.includes(ext)) kind = 'mex-text';
  const label = ext ? ext.slice(0, 2).toUpperCase() : '•';
  return { kind, label };
}

function injectStyle() {
  const style = doc.createElement('style');
  style.id = ID + '-style';
  style.textContent = CSS_TEXT;
  doc.head.appendChild(style);
  return style;
}

function buildUI() {
  ui = {};
  ui.style = injectStyle();

  const panel = el('div', 'mex');
  panel.id = ID;
  panel.tabIndex = -1;
  panel.style.setProperty('--mex-row-height', cfg.rowHeight + 'px');
  panel.style.setProperty('--mex-indent', cfg.indent + 'px');
  ui.panel = panel;

  const sash = el('div', 'mex-sash');
  sash.addEventListener('mousedown', startResize);
  ui.sash = sash;
  panel.appendChild(sash);

  const header = el('div', 'mex-header');
  header.appendChild(el('div', 'mex-title', 'Explorer'));
  const actions = el('div', 'mex-actions');
  actions.appendChild(iconButton('plus', '新建文件', () => void createNew(false)));
  actions.appendChild(iconButton('folderPlus', '新建文件夹', () => void createNew(true)));
  actions.appendChild(iconButton('refresh', '刷新', () => void refreshAll(true)));
  actions.appendChild(iconButton('collapse', '折叠全部', () => collapseAll()));
  actions.appendChild(iconButton('folder', '添加工作区文件夹…', () => void addFolder()));
  actions.appendChild(iconButton('close', '隐藏 Explorer', () => setSidebar(false)));
  header.appendChild(actions);
  panel.appendChild(header);

  const filterbar = el('div', 'mex-filterbar');
  const filter = doc.createElement('input');
  filter.type = 'text';
  filter.className = 'mex-filter';
  filter.placeholder = '过滤文件…';
  filter.spellcheck = false;
  filter.addEventListener('input', () => {
    state.filter = filter.value || '';
    render();
  });
  filter.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      filter.value = '';
      state.filter = '';
      render();
      if (ui.tree.focus) ui.tree.focus();
    }
  });
  ui.filter = filter;
  filterbar.appendChild(filter);
  panel.appendChild(filterbar);

  const tree = el('div', 'mex-tree');
  tree.tabIndex = 0;
  tree.setAttribute('role', 'tree');
  tree.addEventListener('keydown', onTreeKeyDown);
  tree.addEventListener('contextmenu', (event) => {
    if (event.target === tree) onBlankContextMenu(event);
  });
  ui.tree = tree;
  panel.appendChild(tree);

  const footer = el('div', 'mex-footer');
  ui.footer = footer;
  panel.appendChild(footer);

  doc.body.appendChild(panel);
  syncTheme();
  applyLayout();
  render();
}

/** Other sidebar extensions (e.g. Outline Sidebar) also shrink body; coexist. */
function peerPanel() {
  try {
    const node = doc.querySelector ? doc.querySelector('.meo-sidebar') : null;
    if (!node || !node.classList || !node.classList.contains('meo-open')) return null;
    const side = rootEl && rootEl.classList.contains('meo-push-left') ? 'left' : 'right';
    return { side, width: num(node.offsetWidth, 0) };
  } catch (_) {
    return null;
  }
}

let applyingLayout = false;

function applyLayout() {
  if (!ui || !ui.panel || !state || !cfg || applyingLayout) return;
  applyingLayout = true;
  try {
    applyLayoutInner();
  } finally {
    applyingLayout = false;
  }
}

function applyLayoutInner() {
  const side = cfg.position === 'right' ? 'right' : 'left';
  const own = state.visible ? state.width : 0;
  const peer = peerPanel();

  ui.panel.classList.toggle('mex-right', side === 'right');
  ui.panel.classList.toggle('mex-hidden', !state.visible);
  ui.panel.style.width = state.width + 'px';

  let left = side === 'left' ? own : 0;
  let right = side === 'right' ? own : 0;
  if (peer) {
    if (peer.side === 'left') left += peer.width;
    else right += peer.width;
  }
  const total = left + right;

  const widthValue = total > 0 ? 'calc(100vw - ' + total + 'px)' : '';
  const leftValue = left > 0 ? left + 'px' : '';
  const rightValue = right > 0 ? right + 'px' : '';
  if (doc.body && doc.body.style) {
    if (doc.body.style.width !== widthValue) doc.body.style.width = widthValue;
    if (doc.body.style.marginLeft !== leftValue) doc.body.style.marginLeft = leftValue;
    if (doc.body.style.marginRight !== rightValue) doc.body.style.marginRight = rightValue;
  }
  if (rootEl && rootEl.style) {
    const insetValue = '0 ' + right + 'px 0 ' + left + 'px';
    if (total > 0) {
      if (rootEl.style.getPropertyValue('--markedit-content-inset') !== insetValue) {
        rootEl.style.setProperty('--markedit-content-inset', insetValue);
      }
    } else if (rootEl.style.getPropertyValue('--markedit-content-inset')) {
      rootEl.style.removeProperty('--markedit-content-inset');
    }
    if (rootEl.style.getPropertyValue('--mex-left-inset') !== left + 'px') {
      rootEl.style.setProperty('--mex-left-inset', left + 'px');
    }
    rootEl.classList.toggle('mex-push', left > 0);
  }
  const panelLeft = side === 'left' && peer && peer.side === 'left' ? peer.width + 'px' : '';
  const panelRight = side === 'right' && peer && peer.side === 'right' ? peer.width + 'px' : '';
  if (ui.panel.style.left !== panelLeft) ui.panel.style.left = panelLeft;
  if (ui.panel.style.right !== panelRight) ui.panel.style.right = panelRight;

  try {
    if (M && M.editorView && typeof M.editorView.requestMeasure === 'function') {
      M.editorView.requestMeasure();
    }
    if (window.editor && typeof window.editor.requestMeasure === 'function') {
      window.editor.requestMeasure();
    }
  } catch (_) {
    /* best effort */
  }
}

function syncTheme() {
  if (!ui || !ui.panel) return;
  let bg = '';
  let fg = '';
  try {
    const editor = doc.querySelector ? doc.querySelector('.cm-editor') : null;
    const computed = editor && window.getComputedStyle ? window.getComputedStyle(editor) : null;
    if (computed) {
      bg = computed.backgroundColor || '';
      fg = computed.color || '';
    }
  } catch (_) {
    /* fall back to CSS system colors */
  }
  ui.panel.style.backgroundColor = bg && bg !== 'transparent' && bg !== 'rgba(0, 0, 0, 0)' ? bg : '';
  ui.panel.style.color = fg || '';
  ui.panel.style.fontSize = cfg.fontSize + 'px';
  ui.panel.style.setProperty('--mex-row-height', cfg.rowHeight + 'px');
}

function createRowNode(row) {
  const node = el('div', 'mex-row');
  node.dataset.path = row.path || '';
  node.dataset.kind = row.kind;
  node.style.paddingLeft = 6 + (row.depth || 0) * cfg.indent + 'px';

  if (row.kind === 'root') node.classList.add('mex-root');
  if (row.kind === 'error') node.classList.add('mex-error');
  if (row.path && row.path === activeFile) node.classList.add('mex-open-file');
  if (row.path && row.path === state.selected && row.kind !== 'empty') node.classList.add('mex-selected');
  if (row.path && row.path === clipboardPath) node.classList.add('mex-cut');
  if (row.error) node.classList.add('mex-error');

  if (row.kind === 'empty') {
    const box = el('div', 'mex-empty');
    box.appendChild(el('div', 'mex-empty-title', row.label));
    if (row.message) box.appendChild(el('div', null, row.message));
    if (row.actionLabel) {
      const link = el('span', 'mex-link', row.actionLabel);
      link.addEventListener('click', () => dispatchAction(row.action));
      box.appendChild(link);
    }
    if (row.extraLabel) {
      const link = el('span', 'mex-link', row.extraLabel);
      link.addEventListener('click', () => dispatchAction(row.extraAction));
      box.appendChild(link);
    }
    node.appendChild(box);
    node.style.height = 'auto';
    node.style.minHeight = 'auto';
    return node;
  }

  const twistie = el('span', 'mex-twistie', '›');
  if (row.expanded) twistie.classList.add('mex-expanded');
  if (row.kind === 'entry' && !row.entry.isDirectory) twistie.classList.add('mex-blank');
  if (row.kind === 'error') twistie.classList.add('mex-blank');
  node.appendChild(twistie);

  const icon = el('span', 'mex-ico');
  if (row.kind === 'root' || (row.entry && row.entry.isDirectory)) {
    icon.classList.add('mex-folder');
  } else if (row.kind === 'entry') {
    const badge = badgeFor(row.label);
    icon.classList.add('mex-badge');
    if (badge.kind) icon.classList.add(badge.kind);
    icon.textContent = badge.label;
  }
  node.appendChild(icon);

  const label = el('span', 'mex-label', row.label);
  label.title = row.path || row.label;
  node.appendChild(label);
  if (row.hint) node.appendChild(el('span', 'mex-hint', row.hint));

  node.addEventListener('click', (event) => onRowClick(row, event));
  node.addEventListener('dblclick', (event) => onRowDoubleClick(row, event));
  node.addEventListener('contextmenu', (event) => onRowContextMenu(row, event));
  if (row.kind === 'entry' || row.kind === 'root') {
    node.draggable = true;
    node.addEventListener('dragstart', (event) => onDragStart(row, event));
    node.addEventListener('dragover', (event) => onDragOver(row, event));
    node.addEventListener('dragleave', (event) => onDragLeave(row, event));
    node.addEventListener('drop', (event) => onDrop(row, event));
  }
  return node;
}

function dispatchAction(name) {
  if (name === 'add-folder') void addFolder();
  else if (name === 'create-demo') void createDemoWorkspace();
}

function render() {
  if (!ui || !ui.tree) return;
  const scroll = ui.tree.scrollTop || 0;
  const rows = flattenRows();
  const nodes = rows.map(createRowNode);
  if (typeof ui.tree.replaceChildren === 'function') ui.tree.replaceChildren(...nodes);
  else {
    while (ui.tree.firstChild) ui.tree.removeChild(ui.tree.firstChild);
    for (const node of nodes) ui.tree.appendChild(node);
  }
  ui.tree.scrollTop = scroll;
  updateFooter();
}

function updateFooter() {
  if (!ui || !ui.footer) return;
  const capability = fileApiAvailable();
  if (!capability.ok) {
    ui.footer.textContent =
      '需要 MarkEdit ≥ ' + MIN_APP_VERSION + '（缺少 ' + capability.missing.join(', ') + '）';
    return;
  }
  const time = lastRefreshAt
    ? new Date(lastRefreshAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : '—';
  const count = dirs.size;
  ui.footer.textContent =
    state.roots.length +
    ' 个工作区 · ' +
    count +
    ' 个已加载目录 · ' +
    (state.pollMs > 0 ? '自动刷新 ' + Math.round(state.pollMs / 1000) + 's' : '自动刷新关') +
    ' · ' +
    time;
}

function scrollSelectionIntoView() {
  if (!ui || !ui.tree || !state.selected) return;
  const children = ui.tree.children || [];
  for (let i = 0; i < children.length; i++) {
    const node = children[i];
    if (node.dataset && node.dataset.path === state.selected) {
      if (typeof node.scrollIntoView === 'function') node.scrollIntoView({ block: 'nearest' });
      return;
    }
  }
}

function setSidebar(visible) {
  state.visible = !!visible;
  saveState();
  applyLayout();
  render();
  if (state.visible) void refreshAll(true);
  return state.visible;
}

function toggleSidebar() {
  return setSidebar(!state.visible);
}

function startResize(event) {
  if (!event || typeof event.clientX !== 'number') return;
  if (event.preventDefault) event.preventDefault();
  const side = cfg.position === 'right' ? 'right' : 'left';
  const startX = event.clientX;
  const startWidth = state.width;
  ui.sash.classList.add('mex-dragging');

  const onMove = (moveEvent) => {
    if (!moveEvent || typeof moveEvent.clientX !== 'number') return;
    const delta = side === 'left' ? moveEvent.clientX - startX : startX - moveEvent.clientX;
    state.width = clamp(Math.round(startWidth + delta), 170, 600);
    ui.panel.style.width = state.width + 'px';
    applyLayout();
  };
  const onUp = () => {
    ui.sash.classList.remove('mex-dragging');
    window.removeEventListener('mousemove', onMove);
    window.removeEventListener('mouseup', onUp);
    saveState();
  };
  window.addEventListener('mousemove', onMove);
  window.addEventListener('mouseup', onUp);
}

/* ---- src/04-ops.js ---- */
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

/* ---- src/05-boot.js ---- */
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

})();
