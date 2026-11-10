/**
 * Headless smoke tests for the built extension.
 *
 * A single-file MarkEdit script runs inside a WebKit WebView with the global
 * `MarkEdit` bridge. Here we recreate just enough of that environment (DOM,
 * localStorage, timers, native file APIs) to drive the real built bundle —
 * no dependencies, no network, no MarkEdit installation required.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const here = dirname(fileURLToPath(import.meta.url));
const bundle = readFileSync(join(here, '..', 'dist', 'markedit-explorer.js'), 'utf8');
const STORAGE_KEY = 'markedit-explorer:state:v1';
const HOME = '/Users/test';
const CONTAINER = HOME + '/Library/Containers/app.cyan.markedit/Data';

/* ----------------------------- fake DOM ----------------------------- */

class Style {
  constructor() {
    this._custom = {};
  }
  setProperty(key, value) {
    this._custom[key] = String(value);
  }
  getPropertyValue(key) {
    return this._custom[key] || '';
  }
  removeProperty(key) {
    delete this._custom[key];
  }
}

class ClassList {
  constructor() {
    this._set = new Set();
  }
  add(...names) {
    names.forEach((n) => n && this._set.add(n));
  }
  remove(...names) {
    names.forEach((n) => this._set.delete(n));
  }
  contains(name) {
    return this._set.has(name);
  }
  toggle(name, force) {
    const shouldHave = force === undefined ? !this._set.has(name) : !!force;
    if (shouldHave) this._set.add(name);
    else this._set.delete(name);
    return shouldHave;
  }
}

class Element {
  constructor(tag) {
    this.tagName = String(tag).toUpperCase();
    this.children = [];
    this.parentNode = null;
    this.dataset = {};
    this.style = new Style();
    this._classes = new ClassList();
    this._listeners = new Map();
    this._text = '';
    this.attributes = {};
    this.value = '';
    this.type = '';
    this.title = '';
    this.placeholder = '';
    this.spellcheck = true;
    this.scrollTop = 0;
    this.offsetWidth = 240;
    this.draggable = false;
    this.tabIndex = 0;
  }
  get className() {
    return [...this._classes._set].join(' ');
  }
  set className(value) {
    this._classes._set = new Set(String(value || '').split(/\s+/).filter(Boolean));
  }
  get classList() {
    return this._classes;
  }
  get textContent() {
    return this._text;
  }
  set textContent(value) {
    this._text = String(value);
    this.children = [];
  }
  get firstChild() {
    return this.children[0] || null;
  }
  appendChild(child) {
    child.parentNode = this;
    this.children.push(child);
    return child;
  }
  removeChild(child) {
    const index = this.children.indexOf(child);
    if (index >= 0) this.children.splice(index, 1);
    return child;
  }
  replaceChildren(...nodes) {
    this.children = [];
    nodes.forEach((node) => this.appendChild(node));
  }
  setAttribute(key, value) {
    this.attributes[key] = String(value);
  }
  getAttribute(key) {
    return this.attributes[key];
  }
  addEventListener(type, handler) {
    if (!this._listeners.has(type)) this._listeners.set(type, []);
    this._listeners.get(type).push(handler);
  }
  removeEventListener(type, handler) {
    const list = this._listeners.get(type) || [];
    const index = list.indexOf(handler);
    if (index >= 0) list.splice(index, 1);
  }
  dispatch(type, props = {}) {
    const event = {
      type,
      target: this,
      currentTarget: this,
      preventDefault() {},
      stopPropagation() {},
      clientX: 0,
      clientY: 0,
      key: '',
      metaKey: false,
      shiftKey: false,
      altKey: false,
      ctrlKey: false,
      dataTransfer: null,
      ...props,
    };
    for (const handler of this._listeners.get(type) || []) handler(event);
    return event;
  }
  focus() {}
  select() {}
  scrollIntoView() {}
  getBoundingClientRect() {
    return { left: 0, top: 0, right: 240, bottom: 600, width: 240, height: 600 };
  }
}

function walk(node, visit) {
  visit(node);
  for (const child of node.children || []) walk(child, visit);
}

function findAll(node, predicate) {
  const found = [];
  walk(node, (candidate) => {
    if (predicate(candidate)) found.push(candidate);
  });
  return found;
}

/* -------------------------- mock MarkEdit -------------------------- */

function createFS() {
  const entries = new Map();
  let clock = 1700000000000;
  const put = (path, isDirectory, content = '') => {
    clock += 1000;
    entries.set(path, { isDirectory, content, mtime: clock });
  };
  put(HOME, true);
  put(HOME + '/Documents', true);
  put(HOME + '/Documents/Projects', true);
  put(HOME + '/Documents/Documents', true);
  put(HOME + '/Documents/Projects/plan.md', false, '# Plan');
  put(HOME + '/Documents/Projects/architecture.md', false, '# Architecture');
  put(HOME + '/Documents/Documents/README.md', false, '# README');
  put(HOME + '/Documents/notes.md', false, 'notes');
  put(HOME + '/Documents/.hidden', false, 'secret');
  put(HOME + '/.Trash', true);
  put(CONTAINER, true);
  put(CONTAINER + '/Documents', true);

  const dirnameOf = (path) => {
    const clean = path.replace(/\/+$/, '');
    const index = clean.lastIndexOf('/');
    return index <= 0 ? '/' : clean.slice(0, index);
  };

  return {
    entries,
    put,
    remove(path) {
      for (const key of [...entries.keys()]) {
        if (key === path || key.startsWith(path + '/')) entries.delete(key);
      }
    },
    list(path) {
      const clean = path.replace(/\/+$/, '') || '/';
      const item = entries.get(clean);
      if (!item || !item.isDirectory) return undefined;
      const names = [];
      for (const key of entries.keys()) {
        if (key === clean) continue;
        if (dirnameOf(key) === clean) names.push(key.slice(key.lastIndexOf('/') + 1));
      }
      return names;
    },
    info(path) {
      if (!path) return undefined;
      const item = entries.get(path.replace(/\/+$/, '') || '/');
      if (!item) return undefined;
      return {
        filePath: path,
        fileSize: item.content.length,
        creationDate: item.mtime,
        modificationDate: item.mtime,
        parentPath: dirnameOf(path),
        isDirectory: item.isDirectory,
      };
    },
    move(source, destination) {
      if (!entries.has(source)) return false;
      const keys = [...entries.keys()].filter((key) => key === source || key.startsWith(source + '/'));
      const moved = keys.map((key) => [destination + key.slice(source.length), entries.get(key)]);
      keys.forEach((key) => entries.delete(key));
      moved.forEach(([key, value]) => entries.set(key, value));
      return true;
    },
  };
}

function createHarness(options = {}) {
  const storage = options.storage || new Map();
  const fs = options.fs || createFS();
  const calls = {
    openDocument: [],
    openFile: [],
    createFile: [],
    moveFile: [],
    deleteFile: [],
    revealFile: [],
    showTextBox: [],
    showAlert: [],
    showOpenPanel: [],
    showContextMenu: [],
    mainMenu: [],
    appReady: [],
    editorReady: [],
    copied: [],
  };
  let currentFile = undefined;
  const textBoxQueue = [...(options.textBoxResults || [])];
  const alertResults = [...(options.alertResults || [])];
  const timeouts = [];
  const intervals = [];
  const windowListeners = new Map();
  const docListeners = new Map();

  const MarkEdit = {
    userSettings: options.userSettings || {},
    editorView: { requestMeasure() {} },
    runtimeInfo: () => ({ appVersion: '1.37.1', appBuild: '98' }),
    getDirectoryPath(type) {
      return type === 'home' ? CONTAINER : CONTAINER + '/Documents';
    },
    listFiles: async (path) => fs.list(path),
    getFileInfo: async (path) => fs.info(path || currentFile),
    createFile: async (options2) => {
      calls.createFile.push(options2);
      const path = options2.path;
      if (fs.entries.has(path) && !options2.overwrites) return false;
      fs.put(path, !!options2.isDirectory, options2.string || '');
      return true;
    },
    deleteFile: async (path) => {
      calls.deleteFile.push(path);
      if (!fs.entries.has(path)) return false;
      fs.remove(path);
      return true;
    },
    moveFile: async ({ source, destination }) => {
      calls.moveFile.push({ source, destination });
      return fs.move(source, destination);
    },
    openDocument: async (path, opts) => {
      calls.openDocument.push({ path, opts });
      currentFile = path;
      return true;
    },
    openFile: async (path) => {
      calls.openFile.push(path);
      return true;
    },
    revealFile: async (path) => {
      calls.revealFile.push(path);
      return true;
    },
    recentDocumentPaths: async () => (currentFile ? [currentFile] : []),
    showOpenPanel: async (opts) => {
      calls.showOpenPanel.push(opts);
      return options.openPanelResult;
    },
    showTextBox: async (opts) => {
      calls.showTextBox.push(opts);
      return textBoxQueue.length ? textBoxQueue.shift() : undefined;
    },
    showAlert: async (opts) => {
      calls.showAlert.push(opts);
      return alertResults.length ? alertResults.shift() : 1;
    },
    showContextMenu: (items, location, opts) => calls.showContextMenu.push({ items, location, opts }),
    addMainMenuItem: (items) => calls.mainMenu.push(items),
    onAppReady: (fn) => calls.appReady.push(fn),
    onEditorReady: (fn) => calls.editorReady.push(fn),
    onEditorConfigChange: () => {},
  };

  const documentElement = new Element('html');
  const head = new Element('head');
  const body = new Element('body');
  const cmEditor = new Element('div');
  cmEditor.className = 'cm-editor';
  body.appendChild(cmEditor);

  const document = {
    readyState: 'complete',
    hidden: false,
    documentElement,
    head,
    body,
    createElement: (tag) => new Element(tag),
    querySelector(selector) {
      if (selector === '.cm-editor') return cmEditor;
      if (selector === '.meo-sidebar') return options.peerSidebar || null;
      return null;
    },
    addEventListener(type, handler) {
      if (!docListeners.has(type)) docListeners.set(type, []);
      docListeners.get(type).push(handler);
    },
    execCommand: () => true,
  };

  for (const name of options.removeApis || []) delete MarkEdit[name];

  const context = {
    console,
    document,
    MarkEdit,
    localStorage: {
      getItem: (key) => (storage.has(key) ? storage.get(key) : null),
      setItem: (key, value) => storage.set(key, String(value)),
      removeItem: (key) => storage.delete(key),
    },
    navigator: {
      clipboard: {
        writeText: async (text) => {
          calls.copied.push(text);
        },
      },
    },
    getComputedStyle: () => ({ backgroundColor: '#ffffff', color: '#222222' }),
    matchMedia: () => ({ matches: false, addEventListener() {} }),
    setTimeout: (fn, ms) => {
      const id = timeouts.length + 1;
      timeouts.push({ fn, ms, id });
      return id;
    },
    clearTimeout: (id) => {
      const index = timeouts.findIndex((t) => t.id === id);
      if (index >= 0) timeouts.splice(index, 1);
    },
    setInterval: (fn, ms) => {
      const id = intervals.length + 1;
      intervals.push({ fn, ms, id });
      return id;
    },
    clearInterval: (id) => {
      const index = intervals.findIndex((t) => t.id === id);
      if (index >= 0) intervals.splice(index, 1);
    },
    requestAnimationFrame: (fn) => {
      fn();
      return 1;
    },
    addEventListener(type, handler) {
      if (!windowListeners.has(type)) windowListeners.set(type, []);
      windowListeners.get(type).push(handler);
    },
    removeEventListener(type, handler) {
      const list = windowListeners.get(type) || [];
      const index = list.indexOf(handler);
      if (index >= 0) list.splice(index, 1);
    },
  };
  context.window = context;
  context.editor = { requestMeasure() {} };
  vm.createContext(context);
  vm.runInContext(bundle, context, { filename: 'markedit-explorer.js' });

  return {
    context,
    document,
    body,
    head,
    storage,
    fs,
    calls,
    textBoxQueue,
    alertResults,
    intervals,
    flushTimeouts() {
      const pending = timeouts.splice(0);
      pending.forEach((t) => t.fn());
    },
    async runInterval() {
      for (const item of intervals) item.fn();
      await settle();
    },
    dispatchWindow(type, props) {
      for (const handler of windowListeners.get(type) || []) handler({ type, ...props });
    },
    dispatchDocument(type, props) {
      for (const handler of docListeners.get(type) || []) handler({ type, ...props });
    },
  };
}

async function settle(rounds = 10) {
  for (let i = 0; i < rounds; i++) await new Promise((resolve) => setImmediate(resolve));
}

function panel(harness) {
  return harness.body.children.find((node) => node.id === 'markedit-explorer');
}

function tree(harness) {
  return findAll(panel(harness), (node) => node.classList.contains('mex-tree'))[0];
}

function rowLabels(harness) {
  const container = tree(harness);
  const labels = [];
  for (const row of container.children) {
    const label = (row.children || []).find((c) => c.classList.contains('mex-label'));
    if (label) labels.push(label.textContent);
  }
  return labels;
}

function rowByLabel(harness, label) {
  const container = tree(harness);
  return container.children.find((row) =>
    (row.children || []).some((c) => c.classList.contains('mex-label') && c.textContent === label),
  );
}

function buttonByTitle(harness, title) {
  return findAll(panel(harness), (node) => node.title === title)[0];
}

async function boot(harness) {
  await settle();
  harness.flushTimeouts();
  await settle();
}

/* ------------------------------- tests ------------------------------- */

test('bundle is self-contained and syntax-valid', () => {
  assert.ok(bundle.length > 50000);
  assert.ok(bundle.includes('MarkEdit Explorer'));
  assert.ok(!/\bfetch\s*\(/.test(bundle), 'no network calls');
  assert.ok(!bundle.includes('XMLHttpRequest'), 'no XHR');
  assert.ok(!bundle.includes('importScripts'), 'no workers');
  assert.ok(!bundle.includes('<script'), 'no injected script tags');
  assert.ok(!bundle.includes('cdn.'), 'no CDN');
  assert.doesNotThrow(() => new vm.Script(bundle));
});

test('boot injects sidebar, styles, menu and the default workspace', async () => {
  const h = createHarness();
  await boot(h);

  const p = panel(h);
  assert.ok(p, 'sidebar panel is mounted');
  assert.ok(h.head.children.some((n) => n.id === 'markedit-explorer-style'), 'CSS injected');
  assert.equal(h.calls.mainMenu.length, 1, 'Extensions menu registered');
  assert.equal(h.calls.mainMenu[0][0].title, 'Toggle Explorer');
  assert.equal(h.context.MarkEditExplorer.version, '1.0.0');

  const roots = h.context.MarkEditExplorer.roots();
  assert.equal(roots.length, 1);
  assert.equal(roots[0].name, 'My Documents');
  assert.equal(roots[0].path, HOME + '/Documents');

  const labels = rowLabels(h);
  assert.ok(labels.includes('My Documents'));
  assert.ok(labels.includes('Projects'));
  assert.ok(labels.includes('Documents'));
  assert.ok(labels.includes('notes.md'));
  assert.ok(!labels.includes('.hidden'), 'hidden files are filtered by default');
  assert.equal(h.document.body.style.width, 'calc(100vw - 260px)', 'editor area is inset');
  assert.equal(h.document.documentElement.style.getPropertyValue('--mex-left-inset'), '260px');
});

test('clicking a file opens it with MarkEdit.openDocument', async () => {
  const h = createHarness();
  await boot(h);
  rowByLabel(h, 'notes.md').dispatch('click');
  await settle();

  assert.deepEqual(h.calls.openDocument.map((c) => c.path), [HOME + '/Documents/notes.md']);
  assert.equal(h.calls.openFile.length, 0, 'openDocument succeeds, no macOS fallback');
});

test('expanding folders and persisting workspace state across windows', async () => {
  const storage = new Map();
  const h1 = createHarness({ storage });
  await boot(h1);

  rowByLabel(h1, 'Projects').dispatch('click');
  await settle();
  assert.ok(rowLabels(h1).includes('plan.md'));
  assert.ok(rowLabels(h1).includes('architecture.md'));

  const saved = JSON.parse(storage.get(STORAGE_KEY));
  assert.equal(saved.roots[0].path, HOME + '/Documents');
  assert.equal(saved.expanded[HOME + '/Documents/Projects'], true);

  const h2 = createHarness({ storage });
  await boot(h2);
  assert.equal(h2.context.MarkEditExplorer.state().expanded[HOME + '/Documents/Projects'], true);
  assert.ok(rowLabels(h2).includes('plan.md'), 'expanded folders are restored');
});

test('new file, rename and trash use the native file APIs', async () => {
  const h = createHarness({ textBoxResults: ['new-note.md', 'renamed.md'] });
  await boot(h);

  buttonByTitle(h, '新建文件').dispatch('click');
  await settle();
  const created = h.calls.createFile.find((c) => c.path === HOME + '/Documents/new-note.md');
  assert.ok(created, 'createFile called');
  assert.equal(created.string, '');
  assert.ok(h.fs.entries.has(HOME + '/Documents/new-note.md'));
  assert.ok(h.calls.openDocument.some((c) => c.path === HOME + '/Documents/new-note.md'));

  rowByLabel(h, 'new-note.md').dispatch('contextmenu');
  const renameItem = h.calls.showContextMenu.at(-1).items.find((i) => i.title === '重命名…');
  assert.ok(renameItem, 'rename is in the native context menu');
  renameItem.action();
  await settle();
  assert.ok(h.fs.entries.has(HOME + '/Documents/renamed.md'));
  assert.ok(!h.fs.entries.has(HOME + '/Documents/new-note.md'));

  rowByLabel(h, 'renamed.md').dispatch('contextmenu');
  const trashItem = h.calls.showContextMenu.at(-1).items.find((i) => i.title === '移到废纸篓…');
  assert.ok(trashItem);
  trashItem.action();
  await settle();
  assert.ok(!h.fs.entries.has(HOME + '/Documents/renamed.md'));
  assert.ok(h.fs.entries.has(HOME + '/.Trash/renamed.md'), 'file moved to Trash, not erased');
});

test('add folder uses the native open panel and grants a new root', async () => {
  const fs = createFS();
  fs.put(HOME + '/Notes', true);
  fs.put(HOME + '/Notes/todo.md', false, 'todo');
  const h = createHarness({ fs, openPanelResult: [HOME + '/Notes'] });
  await boot(h);

  buttonByTitle(h, '添加工作区文件夹…').dispatch('click');
  await settle();

  assert.equal(h.calls.showOpenPanel[0].selectionType, 'directories');
  const roots = h.context.MarkEditExplorer.roots();
  assert.ok(roots.some((r) => r.path === HOME + '/Notes'));
  assert.ok(rowLabels(h).includes('todo.md'));
});

test('auto refresh detects changes made outside MarkEdit', async () => {
  const h = createHarness();
  await boot(h);
  assert.equal(h.intervals.length, 1, 'polling timer installed');
  assert.equal(h.intervals[0].ms, 3000);

  h.fs.put(HOME + '/Documents/external.md', false, 'external');
  await h.runInterval();
  assert.ok(rowLabels(h).includes('external.md'), 'tree picked up the external change');
});

test('filter, toggle and cross-window state sync', async () => {
  const storage = new Map();
  const h1 = createHarness({ storage });
  await boot(h1);

  const filter = findAll(panel(h1), (n) => n.classList.contains('mex-filter'))[0];
  filter.value = 'notes';
  filter.dispatch('input');
  assert.deepEqual(rowLabels(h1), ['notes.md']);

  filter.value = '';
  filter.dispatch('input');
  assert.ok(rowLabels(h1).length > 2);

  h1.context.MarkEditExplorer.toggle();
  assert.ok(panel(h1).classList.contains('mex-hidden'));
  assert.equal(h1.document.body.style.width, '', 'editor inset released when hidden');

  const h2 = createHarness({ storage });
  await boot(h2);
  h2.dispatchWindow('storage', { key: STORAGE_KEY });
  assert.equal(h2.context.MarkEditExplorer.state().visible, false, 'state synced to other window');
});

test('settings.json overrides layout, polling and hidden files', async () => {
  const h = createHarness({
    userSettings: {
      'extension.markeditExplorer': {
        position: 'right',
        defaultWidth: 320,
        pollInterval: 2000,
        showHiddenFiles: true,
        shortcut: { key: 'b', modifiers: ['Command', 'Option'] },
      },
    },
  });
  await boot(h);

  assert.ok(panel(h).classList.contains('mex-right'));
  assert.equal(h.document.body.style.marginRight, '320px');
  assert.equal(h.document.body.style.marginLeft, '');
  assert.equal(h.document.documentElement.style.getPropertyValue('--markedit-content-inset'), '0 320px 0 0px');
  assert.equal(h.intervals[0].ms, 2000);
  assert.ok(rowLabels(h).includes('.hidden'), 'hidden files shown when configured');
  assert.deepEqual(h.calls.mainMenu[0][0].modifiers, ['Command', 'Option']);
});

test('demo workspace reproduces the requested Explorer / My Documents tree', async () => {
  const h = createHarness();
  await boot(h);

  tree(h).dispatch('contextmenu');
  const demoItem = h.calls.showContextMenu.at(-1).items.find((i) => i.title === '创建示例工作区');
  assert.ok(demoItem);
  demoItem.action();
  await settle();

  const demoRoot = CONTAINER + '/Documents/MarkEdit Explorer/My Documents';
  assert.ok(h.fs.entries.has(demoRoot + '/Projects/plan.md'));
  assert.ok(h.fs.entries.has(demoRoot + '/Projects/architecture.md'));
  assert.ok(h.fs.entries.has(demoRoot + '/Documents/README.md'));
  assert.ok(h.context.MarkEditExplorer.roots().some((r) => r.path === demoRoot));
  const labels = rowLabels(h);
  assert.ok(labels.includes('plan.md') && labels.includes('architecture.md') && labels.includes('README.md'));
});

test('cut / paste, drag & drop, Finder and copy path', async () => {
  const h = createHarness();
  await boot(h);
  rowByLabel(h, 'Projects').dispatch('click');
  await settle();

  // Cut plan.md and paste it into the workspace root.
  rowByLabel(h, 'plan.md').dispatch('contextmenu');
  h.calls.showContextMenu.at(-1).items.find((i) => i.title === '剪切').action();
  rowByLabel(h, 'My Documents').dispatch('contextmenu');
  h.calls.showContextMenu.at(-1).items.find((i) => i.title === '粘贴到此文件夹').action();
  await settle();
  assert.ok(h.fs.entries.has(HOME + '/Documents/plan.md'));
  assert.ok(!h.fs.entries.has(HOME + '/Documents/Projects/plan.md'));

  // Drag architecture.md onto the Documents folder.
  const source = rowByLabel(h, 'architecture.md');
  const target = rowByLabel(h, 'Documents');
  const dataTransfer = { setData() {}, getData() { return ''; }, effectAllowed: '', dropEffect: '' };
  source.dispatch('dragstart', { dataTransfer });
  target.dispatch('dragover', { dataTransfer, currentTarget: target });
  target.dispatch('drop', { dataTransfer, currentTarget: target });
  await settle();
  assert.ok(h.fs.entries.has(HOME + '/Documents/Documents/architecture.md'));

  // Finder + copy path on a file row.
  rowByLabel(h, 'notes.md').dispatch('contextmenu');
  const items = h.calls.showContextMenu.at(-1).items;
  items.find((i) => i.title === '在 Finder 中显示').action();
  items.find((i) => i.title === '复制路径').action();
  await settle();
  assert.deepEqual(h.calls.revealFile, [HOME + '/Documents/notes.md']);
  assert.deepEqual(h.calls.copied, [HOME + '/Documents/notes.md']);
});

test('case-only rename hops through a temporary name', async () => {
  const h = createHarness({ textBoxResults: ['NOTES.md'] });
  await boot(h);
  rowByLabel(h, 'notes.md').dispatch('contextmenu');
  h.calls.showContextMenu.at(-1).items.find((i) => i.title === '重命名…').action();
  await settle();
  assert.equal(h.calls.moveFile.length, 2, 'source → temp → destination');
  assert.ok(h.fs.entries.has(HOME + '/Documents/NOTES.md'));
  assert.ok(!h.fs.entries.has(HOME + '/Documents/notes.md'));
});

test('graceful degradation when a required native API is missing', async () => {
  const h = createHarness({ removeApis: ['listFiles'] });
  for (let i = 0; i < 32; i++) {
    h.flushTimeouts();
    await settle(2);
  }
  assert.ok(panel(h), 'sidebar still mounts');
  const footer = findAll(panel(h), (n) => n.classList.contains('mex-footer'))[0];
  assert.match(footer.textContent, /需要 MarkEdit/);
  assert.equal(h.context.MarkEditExplorer.roots().length, 0, 'no phantom workspace created');
});

test('registry entry matches the built artifact', () => {
  const registry = JSON.parse(readFileSync(join(here, '..', 'registry', 'markedit-explorer.json'), 'utf8'));
  assert.equal(registry.id, 'markedit-explorer');
  assert.equal(registry.versions[0].version, '1.0.0');
  assert.equal(registry.versions[0].minAppVersion, '1.37.0');
  assert.match(registry.versions[0].sha256, /^[a-f0-9]{64}$/);
  assert.equal(registry.versions[0].url.endsWith('/markedit-explorer.js'), true);
});
