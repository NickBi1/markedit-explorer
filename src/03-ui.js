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
