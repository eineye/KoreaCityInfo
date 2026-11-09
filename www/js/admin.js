// Administrator screen: create / edit / delete / link every piece of content shown in the app.
import { CONFIG } from './config.js';
import { store } from './store.js';
import { SCHEMAS } from './schemas.js';
import { t, L, regionName } from './i18n.js';
import { h, modal, toast, safeUrl } from './ui.js';

const TABS = [
  ['homeBanners', 'homeBanners'], ['mayors', 'mayors'], ['festivals', 'festivals'], ['investments', 'investment'],
  ['social', 'social'], ['regions', 'regions'], ['settings', 'settings'], ['users', 'users'], ['data', 'data']
];

let ctx;

export function renderAdmin(view, tab = 'homeBanners', context) {
  ctx = context;
  if (!TABS.some(([k]) => k === tab)) tab = 'homeBanners';
  document.title = `${t('adminTitle')} · ${CONFIG.appName}`;
  const body = h('div', { class: 'admin-body' });
  view.replaceChildren(h('section', { class: 'page admin' },
    h('div', { class: 'page-head' }, h('h1', {}, '⚙️ ', t('adminTitle')),
      h('span', { class: 'chip ' + (store.backend === 'local' ? 'chip-badge' : '') }, t(store.backend === 'local' ? 'storageLocal' : 'storageSupabase'))),
    h('nav', { class: 'tabs', role: 'tablist' }, TABS.map(([k, label]) =>
      h('a', { href: `#/admin/${k}`, role: 'tab', class: k === tab ? 'on' : '', 'aria-selected': k === tab }, t(label)))),
    body));
  const r = { settings: settingsTab, regions: regionsTab, users: usersTab, data: dataTab }[tab];
  (r || listTab)(body, tab);
}

/* ---------- generic list (banners, mayors, festivals, investments, social) ---------- */
function listTab(body, col) {
  const schema = SCHEMAS[col];
  const items = store.list(col, { all: true });
  const draw = () => renderAdmin(document.getElementById('view'), col, ctx);
  body.replaceChildren(
    h('div', { class: 'admin-actions' }, h('button', { class: 'btn primary', onclick: () => editItem(col, null, draw) }, '＋ ', t('add'))),
    items.length ? h('div', { class: 'table-wrap' }, h('table', { class: 'table' },
      h('thead', {}, h('tr', {}, h('th', {}, ''), h('th', {}, 'Title'), schema.fields.some((f) => f.key === 'region') ? h('th', {}, t('filter')) : null,
        col === 'social' ? h('th', {}, 'Platform') : null, h('th', {}, t('order')), h('th', {}, t('active')), h('th', {}, ''))),
      h('tbody', {}, items.map((item) => h('tr', {},
        h('td', {}, safeUrl(item.image) ? h('img', { class: 'thumb', src: item.image, alt: '' }) : h('span', { class: 'thumb' })),
        h('td', {}, h('strong', {}, L(item[schema.titleKey]) || '—'), item.sample ? h('span', { class: 'chip chip-badge' }, t('sample')) : null),
        schema.fields.some((f) => f.key === 'region') ? h('td', {}, item.region ? ctx.regions.label(item.region) : '—') : null,
        col === 'social' ? h('td', {}, item.platform) : null,
        h('td', {}, item.order ?? ''),
        h('td', {}, item.active === false ? '—' : '✓'),
        h('td', { class: 'row-actions' },
          h('button', { class: 'btn small', onclick: () => editItem(col, item, draw) }, t('edit')),
          h('button', { class: 'btn small danger', onclick: async () => {
            if (!confirm(t('confirmDelete'))) return;
            await store.remove(col, item.id); toast(t('deleted')); draw();
          } }, t('delete')))))))) : h('p', { class: 'empty' }, t('noItems')));
}

function editItem(col, item, done, { idFixed, title } = {}) {
  const schema = SCHEMAS[col];
  const data = item ? JSON.parse(JSON.stringify(item)) : {};
  if (!item) for (const f of schema.fields) if (f.default !== undefined) data[f.key] = f.default;
  if (idFixed) data.id = idFixed;
  let close;
  const form = h('form', { class: 'edit-form', onsubmit: async (e) => {
    e.preventDefault();
    for (const f of schema.fields) {
      if (f.required && !(f.i18n ? Object.values(data[f.key] || {}).some(Boolean) : data[f.key])) { toast(`${f.label} *`); return; }
    }
    if (item?.sample && JSON.stringify(item) !== JSON.stringify({ ...data, sample: item.sample })) delete data.sample;
    await store.put(col, data);
    toast(t('saved')); close(); done?.();
  } },
  h('h2', {}, title || (item ? t('edit') : t('add')) + ' · ' + t(SCHEMAS[col].label)),
  schema.fields.map((f) => field(f, data)),
  h('div', { class: 'form-actions' },
    h('button', { type: 'button', class: 'btn', onclick: () => close() }, t('cancel')),
    h('button', { type: 'submit', class: 'btn primary' }, t('save'))));
  close = modal(form, { wide: true });
}

function field(f, data) {
  const label = f.label + (f.required ? ' *' : '');
  if (f.i18n) {
    data[f.key] = typeof data[f.key] === 'string' ? { en: data[f.key] } : data[f.key] || {};
    return h('fieldset', { class: 'field' }, h('legend', {}, label),
      CONFIG.contentLanguages.map((lang) => h('label', { class: 'i18n-row' }, h('span', { class: 'lang-tag' }, lang.toUpperCase()),
        input(f.type, data[f.key][lang] || '', (v) => (data[f.key][lang] = v)))));
  }
  if (f.type === 'bool') {
    return h('label', { class: 'field check' }, h('input', { type: 'checkbox', checked: data[f.key] !== false, onchange: (e) => (data[f.key] = e.target.checked) }), label);
  }
  if (f.type === 'region') return h('label', { class: 'field' }, label, regionSelect(data[f.key] || '', (v) => (data[f.key] = v), !f.required));
  if (f.type === 'select') {
    return h('label', { class: 'field' }, label, h('select', { class: 'input', onchange: (e) => (data[f.key] = e.target.value) },
      h('option', { value: '' }, '—'), f.options.map((o) => h('option', { value: o, selected: data[f.key] === o }, o))));
  }
  if (f.type === 'image') return imageField(label, data, f.key);
  return h('label', { class: 'field' }, label, input(f.type, data[f.key] ?? '', (v) => (data[f.key] = f.type === 'number' ? (v === '' ? undefined : +v) : v)));
}

function input(type, value, set) {
  if (type === 'textarea') return h('textarea', { class: 'input', rows: 4, oninput: (e) => set(e.target.value) }, value);
  return h('input', { class: 'input', type: { url: 'url', number: 'number', color: 'color' }[type] || 'text', value, oninput: (e) => set(e.target.value), placeholder: type === 'url' ? 'https://' : '' });
}

function regionSelect(value, set, allowEmpty = true) {
  return h('select', { class: 'input', onchange: (e) => set(e.target.value) },
    allowEmpty || !value ? h('option', { value: '' }, '—') : null,
    ctx.regions.provinces().map((p) => h('optgroup', { label: regionName(p) },
      h('option', { value: p.code, selected: value === p.code }, `${regionName(p)} (${t('allRegions')})`),
      ctx.regions.municipalities(p.code).map((m) => h('option', { value: m.code, selected: value === m.code }, regionName(m))))));
}

function imageField(label, data, key) {
  const preview = h('img', { class: 'preview', alt: '', hidden: !safeUrl(data[key]), src: safeUrl(data[key]) || '' });
  const url = h('input', { class: 'input', type: 'text', placeholder: 'https://… or upload', value: data[key]?.startsWith('data:') ? '(uploaded image)' : data[key] || '',
    oninput: (e) => { data[key] = e.target.value; preview.src = e.target.value; preview.hidden = !safeUrl(e.target.value); } });
  const file = h('input', { type: 'file', accept: 'image/*', hidden: true, onchange: async (e) => {
    const f = e.target.files[0]; if (!f) return;
    data[key] = await resizeImage(f);
    preview.src = data[key]; preview.hidden = false; url.value = '(uploaded image)';
  } });
  return h('div', { class: 'field' }, h('span', {}, label),
    h('div', { class: 'image-row' }, url,
      h('button', { type: 'button', class: 'btn small', onclick: () => file.click() }, t('uploadImage')),
      h('button', { type: 'button', class: 'btn small', onclick: () => { data[key] = ''; url.value = ''; preview.hidden = true; } }, '✕')),
    file, preview);
}

// Downscale uploads so they fit comfortably in localStorage / a jsonb row
function resizeImage(file, max = 1200) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(img.src);
      resolve(c.toDataURL('image/jpeg', 0.8));
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

/* ---------- regions (16+1 provinces, 226 local governments) ---------- */
function regionsTab(body) {
  const sel = h('select', { class: 'input' }, ctx.regions.provinces().map((p) => h('option', { value: p.code }, regionName(p))));
  const filter = h('input', { class: 'input', type: 'search', placeholder: t('search') });
  const list = h('div', { class: 'table-wrap' });
  const draw = () => {
    const code = sel.value, q = filter.value.trim().toLowerCase();
    const rows = [ctx.regions.get(code), ...ctx.regions.municipalities(code)].filter((r) => !q || `${r.ko} ${r.en}`.toLowerCase().includes(q));
    list.replaceChildren(h('table', { class: 'table' },
      h('thead', {}, h('tr', {}, h('th', {}, t('filter')), h('th', {}, t('officialSite')), h('th', {}, 'Intro'), h('th', {}, ''))),
      h('tbody', {}, rows.map((r) => {
        const info = store.get('regions', r.code) || {};
        return h('tr', { class: r.code.length === 2 ? 'prov-row' : '' },
          h('td', {}, h('strong', {}, r.ko), ' ', h('small', { class: 'muted' }, r.en)),
          h('td', {}, info.url ? h('a', { href: info.url, target: '_blank', rel: 'noopener' }, info.url.replace(/^https?:\/\//, '')) : h('span', { class: 'muted' }, t('notRegistered'))),
          h('td', {}, L(info.intro) ? '✓' : '—'),
          h('td', { class: 'row-actions' }, h('button', { class: 'btn small', onclick: () =>
            editItem('regions', store.get('regions', r.code), draw, { idFixed: r.code, title: `${r.ko} · ${r.en}` }) }, t('edit'))));
      }))));
  };
  sel.onchange = draw; filter.oninput = draw;
  body.replaceChildren(h('div', { class: 'admin-actions' }, sel, filter), list);
  draw();
}

/* ---------- site settings (SNS accounts) ---------- */
function settingsTab(body) {
  const data = { ...store.settings(), id: 'site' };
  body.replaceChildren(h('form', { class: 'edit-form panel', onsubmit: async (e) => {
    e.preventDefault(); await store.put('settings', data); toast(t('saved'));
  } }, SCHEMAS.settings.fields.map((f) => field(f, data)),
  h('div', { class: 'form-actions' }, h('button', { class: 'btn primary', type: 'submit' }, t('save')))));
}

/* ---------- members ---------- */
function usersTab(body) {
  if (store.backend === 'supabase') {
    body.replaceChildren(h('p', { class: 'notice' }, 'Members are managed in Supabase → Authentication → Users. To make someone an administrator, set app_metadata.role = "admin" (see supabase/schema.sql).'));
    return;
  }
  const users = store.list('users', { all: true });
  body.replaceChildren(
    h('p', { class: 'notice' }, t('testNotice'), ' Test IDs: ', CONFIG.testAccounts.map((a) => `${a.username} / ${a.password} (${a.role})`).join(', ')),
    users.length ? h('div', { class: 'table-wrap' }, h('table', { class: 'table' },
      h('thead', {}, h('tr', {}, h('th', {}, t('username')), h('th', {}, t('name')), h('th', {}, 'Role'), h('th', {}, 'Joined'), h('th', {}, ''))),
      h('tbody', {}, users.map((u) => h('tr', {},
        h('td', {}, u.username), h('td', {}, u.name), h('td', {}, u.role), h('td', {}, (u.createdAt || '').slice(0, 10)),
        h('td', { class: 'row-actions' },
          h('button', { class: 'btn small', onclick: async () => { await store.put('users', { ...u, role: u.role === 'admin' ? 'member' : 'admin' }); usersTab(body); } }, u.role === 'admin' ? '→ member' : '→ admin'),
          h('button', { class: 'btn small danger', onclick: async () => { if (confirm(t('confirmDelete'))) { await store.remove('users', u.id); usersTab(body); } } }, t('delete')))))))) : h('p', { class: 'empty' }, t('noItems')));
}

/* ---------- export / import / reset ---------- */
function dataTab(body) {
  const file = h('input', { type: 'file', accept: 'application/json', hidden: true, onchange: async (e) => {
    const f = e.target.files[0]; if (!f) return;
    try { await store.importAll(JSON.parse(await f.text())); toast(t('imported')); }
    catch (ex) { alert(ex.message); }
  } });
  body.replaceChildren(h('div', { class: 'panel' },
    h('p', {}, t(store.backend === 'local' ? 'storageLocal' : 'storageSupabase')),
    store.backend === 'local' ? h('p', { class: 'notice' },
      'Test mode stores edits in this browser only. To publish them to every visitor, export the JSON and replace www/data/seed.json, or switch to Supabase (js/config.js).') : null,
    h('div', { class: 'admin-actions' },
      h('button', { class: 'btn primary', onclick: () => {
        const blob = new Blob([JSON.stringify(store.exportAll(), null, 2)], { type: 'application/json' });
        const a = h('a', { href: URL.createObjectURL(blob), download: `koreacity-data-${new Date().toISOString().slice(0, 10)}.json` });
        a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      } }, '⬇ ', t('exportData')),
      h('button', { class: 'btn', onclick: () => file.click() }, '⬆ ', t('importData')),
      h('button', { class: 'btn danger', onclick: async () => { if (confirm(t('confirmReset'))) { await store.reset(); toast(t('saved')); } } }, t('resetData'))),
    file));
}
