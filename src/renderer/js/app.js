/* ============================================================
   Lasso — renderer shell logic (UI only; backend wired later)

   Everything here degrades gracefully without Electron so the
   shell can be previewed in a plain browser. Real download /
   convert / settings IPC lands in the next phases via
   window.lasso (exposed by preload.js).
   ============================================================ */
'use strict';

const api = window.lasso || null; // preload bridge (null in a plain browser)
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

/* ---------------- View navigation ---------------- */
function showView(name) {
  $$('.view').forEach((v) => v.classList.toggle('is-active', v.id === `view-${name}`));
  $$('.nav__item').forEach((n) => n.classList.toggle('is-active', n.dataset.view === name));
}
$$('.nav__item').forEach((item) =>
  item.addEventListener('click', () => showView(item.dataset.view))
);

/* ---------------- Window controls ---------------- */
$('#win-min')?.addEventListener('click', () => api?.window.minimize());
$('#win-max')?.addEventListener('click', () => api?.window.toggleMaximize());
$('#win-close')?.addEventListener('click', () => api?.window.close());

/* ---------------- Toasts ---------------- */
const ICONS = {
  success: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m5 13 4 4L19 7"/></svg>',
  danger: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 8v5M12 16h.01"/><circle cx="12" cy="12" r="9"/></svg>',
  info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 16v-5M12 8h.01"/><circle cx="12" cy="12" r="9"/></svg>',
};
function toast({ title, msg = '', kind = 'success', action } = {}) {
  const stack = $('#toast-stack');
  const el = document.createElement('div');
  el.className = 'toast';
  el.innerHTML = `
    <div class="toast__icon toast__icon--${kind}">${ICONS[kind] || ICONS.info}</div>
    <div class="toast__body">
      <div class="toast__title">${title}</div>
      ${msg ? `<div class="toast__msg">${msg}</div>` : ''}
    </div>
    ${action ? `<button class="toast__action">${action.label}</button>` : ''}`;
  if (action) $('.toast__action', el).addEventListener('click', () => { action.onClick?.(); dismiss(); });
  stack.appendChild(el);
  const dismiss = () => {
    el.classList.add('is-leaving');
    el.addEventListener('animationend', () => el.remove(), { once: true });
  };
  setTimeout(dismiss, action ? 6000 : 3800);
}

/* ---------------- Download: paste + demo preview ---------------- */
const urlInput = $('#url-input');
const preview = $('#preview');

async function pasteFromClipboard() {
  let text = '';
  try {
    text = api ? await api.clipboard.read() : await navigator.clipboard.readText();
  } catch { /* clipboard blocked — user can type instead */ }
  if (text) {
    urlInput.value = text.trim();
    handleUrl(urlInput.value);
  }
  urlInput.focus();
}
$('#paste-btn')?.addEventListener('click', pasteFromClipboard);

// Auto-detect: as soon as a URL is present, kick off info fetch.
let urlTimer;
urlInput?.addEventListener('input', () => {
  clearTimeout(urlTimer);
  const val = urlInput.value.trim();
  if (!/^https?:\/\//i.test(val)) { preview.hidden = true; return; }
  urlTimer = setTimeout(() => handleUrl(val), 350);
});
urlInput?.addEventListener('paste', () => setTimeout(() => handleUrl(urlInput.value.trim()), 0));

function handleUrl(url) {
  if (!/^https?:\/\//i.test(url)) return;
  // Shell: reveal the mock preview so the fetched-state look is reviewable.
  // Real yt-dlp metadata fetch replaces this in the downloader phase.
  preview.hidden = false;
  preview.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

/* Format segmented (MP4 / MP3) */
$$('#format-seg button').forEach((b) =>
  b.addEventListener('click', () => {
    $$('#format-seg button').forEach((x) => x.classList.remove('is-active'));
    b.classList.add('is-active');
    const isAudio = b.dataset.format === 'mp3';
    const q = $('#quality-select');
    if (q) q.closest('.preview__opt').style.opacity = isAudio ? '0.4' : '1';
    if (q) q.disabled = isAudio;
  })
);

$('#download-btn')?.addEventListener('click', () => {
  toast({ title: 'Added to queue', msg: 'Big Buck Bunny — Blender Open Movie', kind: 'info',
    action: { label: 'View', onClick: () => showView('queue') } });
});

/* ---------------- Convert: dropzone affordance ---------------- */
const dz = $('#dropzone');
['dragenter', 'dragover'].forEach((e) =>
  dz?.addEventListener(e, (ev) => { ev.preventDefault(); dz.classList.add('is-over'); })
);
['dragleave', 'drop'].forEach((e) =>
  dz?.addEventListener(e, (ev) => { ev.preventDefault(); dz.classList.remove('is-over'); })
);
$('#browse-btn')?.addEventListener('click', () =>
  toast({ title: 'File picker', msg: 'Wired up in the converter phase', kind: 'info' })
);

/* ---------------- Theme toggle ---------------- */
$$('#theme-seg button').forEach((b) =>
  b.addEventListener('click', () => {
    $$('#theme-seg button').forEach((x) => x.classList.remove('is-active'));
    b.classList.add('is-active');
    document.documentElement.setAttribute('data-theme', b.dataset.theme);
  })
);

/* ---------------- Keyboard niceties ---------------- */
document.addEventListener('keydown', (e) => {
  const mod = e.metaKey || e.ctrlKey;
  if (mod && e.key.toLowerCase() === 'v' && document.activeElement !== urlInput) {
    // Cmd/Ctrl+V anywhere lands a link straight into the URL bar.
    if ($('#view-download').classList.contains('is-active')) { pasteFromClipboard(); }
  }
  if (e.key >= '1' && e.key <= '4' && mod) {
    const views = ['download', 'convert', 'queue', 'settings'];
    showView(views[+e.key - 1]);
    e.preventDefault();
  }
});

console.log('Lasso shell ready', api ? '(electron)' : '(browser preview)');
