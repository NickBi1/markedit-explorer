/* ---- 01-core: constants, settings, persisted state, native API wrappers ---- */

const ID = 'markedit-explorer';
const VERSION = '__VERSION__';
const MIN_APP_VERSION = '__MIN_APP_VERSION__';
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
