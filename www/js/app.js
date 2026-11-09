import { CONFIG } from './config.js';
import { store } from './store.js';
import { auth } from './auth.js';
import { KoreaMap } from './map.js';
import { t, L, getLang, setLang, regionName } from './i18n.js';
import { $, h, modal, toast, safeUrl, youtubeId, bannerCard, regionColor, initial } from './ui.js';

const view = $('#view');
let mapData, map, mapHost;
let current = { prov: null, muni: null, section: 'overview' };
let keepDrawer = false;

export const regions = {
  get: (code) => (code?.length === 2 ? mapData.provinces : mapData.municipalities).find((r) => r.code === code) || null,
  provinces: () => mapData.provinces,
  municipalities: (prov) => mapData.municipalities.filter((m) => !prov || m.province === prov),
  label(code) {
    const r = this.get(code);
    if (!r) return '';
    if (code.length === 2) return regionName(r);
    const p = this.get(r.province);
    return r.province === '29' ? regionName(r) : `${regionName(r)}, ${regionName(p)}`.replace(/ State$|-do$/, '');
  }
};

/* Detail menu shown for a selected region (province or municipality) */
const SECTIONS = [
  { key: 'overview', icon: 'ℹ️' },
  { key: 'mayors', icon: '🏛️', col: 'mayors', title: (i) => L(i.name), sub: (i) => L(i.position), body: (i) => L(i.message) },
  { key: 'festivals', icon: '🎉', col: 'festivals', title: (i) => L(i.title), sub: (i) => L(i.period), body: (i) => L(i.description) },
  { key: 'investment', icon: '📈', col: 'investments', title: (i) => L(i.title), sub: (i) => L(i.sector), body: (i) => L(i.description) },
  { key: 'youtube', icon: '▶️', platform: 'youtube' },
  { key: 'facebook', icon: 'ⓕ', platform: 'facebook' },
  { key: 'x', icon: '𝕏', platform: 'x' }
];
const section = (key) => SECTIONS.find((s) => s.key === key) || SECTIONS[0];

const regionHash = (prov, muni, sec) => `#/map/${prov}${muni ? '/' + muni : ''}${sec && sec !== 'overview' ? '?s=' + sec : ''}`;

/* ---------- boot ---------- */
async function boot() {
  setLang(getLang());
  [mapData] = await Promise.all([fetch('data/korea-map.json').then((r) => r.json()), store.init()]);
  mapHost = h('div', { class: 'map-host' });
  map = new KoreaMap(mapHost, mapData, {
    onProvince: (code) => (location.hash = regionHash(code)),
    onMunicipality: (p, m) => (location.hash = regionHash(p, m, current.section))
  });
  $('#menu-btn').onclick = () => toggleDrawer(true);
  $('#drawer-backdrop').onclick = () => toggleDrawer(false);
  $('#brand').onclick = (e) => { e.preventDefault(); location.hash = '#/'; };
  $('#lang-btn').onclick = () => {
    const langs = CONFIG.languages.map((l) => l.code);
    changeLang(langs[(langs.indexOf(getLang()) + 1) % langs.length]);
  };
  auth.onChange(() => buildDrawer());
  addEventListener('hashchange', route);
  route();
}

function changeLang(code) {
  setLang(code);
  map.relabel();
  keepDrawer = document.body.classList.contains('drawer-open');
  route();
}

function toggleDrawer(open) {
  document.body.classList.toggle('drawer-open', open);
  $('#menu-btn').setAttribute('aria-expanded', open);
}

/* ---------- hamburger drawer ----------
   top:    language · log in / sign up (or user · admin · log out)
   middle: region selection (provinces → cities/counties/districts)
   bottom: detail menu of the selected region */
function buildDrawer() {
  const user = auth.user();
  const { prov, muni, section: sec } = current;
  const close = () => toggleDrawer(false);
  const stay = () => { keepDrawer = true; };

  const top = h('div', { class: 'drawer-top' },
    h('label', { class: 'drawer-lang' }, h('span', { 'aria-hidden': 'true' }, '🌐'),
      h('select', { 'aria-label': t('language'), onchange: (e) => changeLang(e.target.value) },
        CONFIG.languages.map((l) => h('option', { value: l.code, selected: l.code === getLang() }, l.label)))),
    user
      ? h('div', { class: 'drawer-auth' },
          h('span', { class: 'drawer-user' }, '👤 ', user.name),
          user.role === 'admin' && (CONFIG.showAdminInApp || !window.Capacitor) ? h('a', { class: 'btn small', href: '#/admin', onclick: close }, '⚙️ ', t('admin')) : null,
          h('button', { class: 'btn small', onclick: () => { auth.logout(); close(); toast(t('logout')); route(); } }, t('logout')))
      : h('div', { class: 'drawer-auth' },
          h('a', { class: 'btn small primary', href: '#/login', onclick: close }, t('login')),
          h('a', { class: 'btn small', href: '#/signup', onclick: close }, t('signup'))));

  const provGrid = h('div', { class: 'drawer-provs' }, regions.provinces().map((p) =>
    h('a', { href: regionHash(p.code), class: 'drawer-prov' + (p.code === prov ? ' on' : ''), style: { '--c': regionColor(p.code) }, onclick: stay }, regionName(p))));

  const muniSelect = prov && regions.municipalities(prov).length > 1
    ? h('label', { class: 'drawer-muni' }, h('span', {}, t('localGovs')),
        h('select', { class: 'input', onchange: (e) => { stay(); location.hash = regionHash(prov, e.target.value || null, sec); } },
          h('option', { value: '' }, t('allOf', { r: regionName(regions.get(prov)) })),
          sortedMunis(prov).map((m) => h('option', { value: m.code, selected: m.code === muni }, regionName(m)))))
    : null;

  const selected = muni || prov;
  const detail = selected
    ? h('div', { class: 'drawer-detail' },
        h('div', { class: 'drawer-label' }, '📍 ', regions.label(selected)),
        SECTIONS.map((s) => h('a', { href: regionHash(prov, muni, s.key), class: 'drawer-link' + (s.key === sec ? ' current' : ''), onclick: close },
          h('span', { class: 'ico', 'aria-hidden': 'true' }, s.icon), t(s.key), countBadge(s, selected))))
    : null;

  $('#drawer').replaceChildren(...[
    h('div', { class: 'drawer-head' },
      h('a', { href: '#/', class: 'drawer-home', onclick: close }, '🗺️ ', CONFIG.appName),
      h('button', { class: 'icon-btn', 'aria-label': t('close'), onclick: close }, '✕')),
    top,
    h('div', { class: 'drawer-sep' }),
    h('div', { class: 'drawer-label' }, t('selectRegion')),
    provGrid,
    muniSelect,
    detail ? h('div', { class: 'drawer-sep' }) : null,
    detail
  ].filter(Boolean));
  $('#lang-btn').textContent = getLang().toUpperCase();
  $('#tagline').textContent = t('tagline');
}

/* ---------- router ---------- */
function route() {
  if (!keepDrawer) toggleDrawer(false);
  keepDrawer = false;
  const [path, query] = location.hash.replace(/^#\/?/, '').split('?');
  const parts = path.split('/').filter(Boolean);
  const params = new URLSearchParams(query || '');
  const [page] = parts;

  if (page === 'map' && regions.get(parts[1])) {
    const prov = parts[1];
    const muni = parts[2] && regions.get(parts[2])?.province === prov ? parts[2] : null;
    current = { prov, muni, section: section(params.get('s')).key };
  } else {
    current = { prov: null, muni: null, section: 'overview' };
  }
  buildDrawer();
  if (!document.body.classList.contains('drawer-open')) window.scrollTo(0, 0);

  if (!page) return renderHome();
  if (page === 'map' && current.prov) return renderRegion();
  if (page === 'login') return renderLogin();
  if (page === 'signup') return renderSignup();
  if (page === 'admin') return renderAdmin(parts[1]);
  location.hash = '#/';
}

/* ---------- home: map + region selection only ---------- */
function renderHome() {
  document.title = CONFIG.appName;
  map.showKorea();
  view.replaceChildren(
    h('section', { class: 'map-layout home' },
      h('div', { class: 'map-card' }, mapHost, h('p', { class: 'map-hint' }, t('mapHint'))),
      h('aside', { class: 'side' },
        h('h2', { class: 'side-title' }, t('selectRegion')),
        h('div', { class: 'prov-list' }, regions.provinces().map((p) =>
          h('a', { href: regionHash(p.code), class: 'prov-chip', style: { '--c': regionColor(p.code) } }, regionName(p)))))));
}

/* ---------- selected region: header + detail menu + content ---------- */
function sortedMunis(prov) {
  return regions.municipalities(prov).sort((a, b) => regionName(a).localeCompare(regionName(b), getLang()));
}

function itemsFor(col, code) {
  return store.list(col).filter((i) => i.region && (code.length === 2 ? i.region.startsWith(code) : i.region === code));
}

function sectionItems(s, code) {
  if (s.col) return itemsFor(s.col, code);
  if (s.platform) return itemsFor('social', code).filter((p) => p.platform === s.platform);
  return [];
}

function countBadge(s, code) {
  const n = sectionItems(s, code).length;
  return n ? h('span', { class: 'count' }, n) : null;
}

function renderRegion() {
  const { prov: provCode, muni: muniCode, section: sec } = current;
  const prov = regions.get(provCode);
  const muni = muniCode ? regions.get(muniCode) : null;
  const code = muniCode || provCode;
  map.showProvince(provCode, muniCode);
  document.title = `${regionName(muni || prov)} · ${CONFIG.appName}`;

  const back = h('a', { class: 'back', href: muni ? regionHash(provCode, null, sec) : '#/' }, '← ', muni ? regionName(prov) : t('allKorea'));
  const crumbs = h('nav', { class: 'crumbs' }, h('a', { href: '#/' }, t('allKorea')), ' › ',
    muni ? [h('a', { href: regionHash(provCode, null, sec) }, regionName(prov)), ' › ', h('span', {}, regionName(muni))] : h('span', {}, regionName(prov)));

  const menu = h('nav', { class: 'section-menu', 'aria-label': t('regionMenu') }, SECTIONS.map((s) =>
    h('a', { href: regionHash(provCode, muniCode, s.key), class: s.key === sec ? 'on' : '', 'aria-current': s.key === sec ? 'page' : null },
      h('span', { class: 'ico', 'aria-hidden': 'true' }, s.icon), h('span', {}, t(s.key)), countBadge(s, code))));

  const munis = sortedMunis(provCode);
  const muniPanel = munis.length > 1 ? muniChooser(provCode, munis, muniCode, sec) : null;

  view.replaceChildren(h('section', { class: 'map-layout' },
    h('div', { class: 'map-card' }, h('div', { class: 'map-toolbar' }, back), mapHost),
    h('aside', { class: 'side' },
      crumbs,
      regionHeader(code),
      menu,
      h('div', { class: 'section-body' }, sectionContent(section(sec), code)),
      muniPanel)));
}

function muniChooser(provCode, munis, muniCode, sec) {
  const search = h('input', { type: 'search', class: 'input', placeholder: t('search'), 'aria-label': t('search') });
  const chips = h('div', { class: 'muni-list' }, munis.map((m) =>
    h('a', { href: regionHash(provCode, m.code, sec), class: 'muni-chip' + (m.code === muniCode ? ' on' : ''), 'data-name': `${m.ko} ${m.en}`.toLowerCase() }, regionName(m))));
  search.oninput = () => {
    const q = search.value.trim().toLowerCase();
    [...chips.children].forEach((c) => (c.hidden = q && !c.dataset.name.includes(q)));
  };
  return h('div', { class: 'panel' }, h('h3', {}, t('localGovs'), h('small', {}, ` (${munis.length})`)), munis.length > 8 ? search : null, chips);
}

function regionHeader(code) {
  const r = regions.get(code);
  const prov = code.length === 5 ? regions.get(r.province) : null;
  const img = safeUrl((store.get('regions', code) || {}).image);
  return h('div', { class: 'region-hero' + (img ? '' : ' no-img'), style: { '--c': regionColor(code) } },
    img ? h('img', { src: img, alt: '' }) : null,
    h('div', { class: 'region-hero-text' },
      h('h2', {}, regionName(r)),
      h('span', {}, getLang() === 'ko' ? r.en : r.ko, prov && r.province !== '29' ? ` · ${regionName(prov)}` : '')));
}

function sectionContent(s, code) {
  if (s.key === 'overview') return overview(code);
  if (s.platform) return socialSection(s, code);
  const items = sectionItems(s, code);
  return items.length ? h('div', { class: 'card-grid compact' }, items.map((i) => card(s, i))) : empty();
}

function empty() {
  return h('p', { class: 'empty' }, t('noItems'));
}

function overview(code) {
  const r = regions.get(code);
  const info = store.get('regions', code) || {};
  const prov = code.length === 5 ? regions.get(r.province) : null;
  const url = safeUrl(info.url);
  const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(`${r.ko} ${prov && r.province !== '29' ? prov.ko : ''} 공식 홈페이지`)}`;
  return h('div', { class: 'panel region-body' },
    L(info.intro) ? h('p', {}, L(info.intro)) : null,
    h('div', { class: 'region-actions' },
      url
        ? h('a', { class: 'btn primary', href: url, target: '_blank', rel: 'noopener' }, '🌐 ', t('officialSite'))
        : h('a', { class: 'btn', href: searchUrl, target: '_blank', rel: 'noopener' }, '🔎 ', t('findSite')),
      safeUrl(info.link) ? h('a', { class: 'btn', href: info.link, target: '_blank', rel: 'noopener' }, t('more'), ' →') : null),
    url ? h('a', { class: 'region-url', href: url, target: '_blank', rel: 'noopener' }, url.replace(/^https?:\/\//, '').replace(/\/$/, '')) : null);
}

function card(s, item) {
  return bannerCard({
    title: s.title(item), subtitle: s.sub(item), body: s.body(item), image: item.image, region: item.region,
    regionLabel: regions.label(item.region), badge: item.sample ? t('sample') : null,
    onclick: () => openItem(s, item)
  });
}

function openItem(s, item) {
  const info = store.get('regions', item.region) || {};
  const link = safeUrl(item.link) || safeUrl(info.url);
  const img = safeUrl(item.image);
  modal(h('div', { class: 'item-detail' },
    h('div', { class: 'item-hero' + (img ? '' : ' no-img'), style: { '--c': regionColor(item.region) } }, img ? h('img', { src: img, alt: '' }) : h('span', {}, initial(s.title(item)))),
    h('span', { class: 'chip' }, regions.label(item.region)),
    item.sample ? h('span', { class: 'chip chip-badge' }, t('sample')) : null,
    h('h2', {}, s.title(item)),
    s.sub(item) ? h('p', { class: 'muted' }, s.sub(item)) : null,
    h('p', { class: 'pre' }, s.body(item)),
    link ? h('div', { class: 'region-actions' }, h('a', { class: 'btn primary', href: link, target: '_blank', rel: 'noopener' }, t('visit'), ' ↗')) : null));
}

/* ---------- YouTube / Facebook / X for the selected region ---------- */
function socialSection(s, code) {
  const st = store.settings();
  const profile = safeUrl({ youtube: st.youtubeUrl, facebook: st.facebookUrl, x: st.xUrl }[s.platform]);
  const posts = sectionItems(s, code);
  return h('div', { class: 'social-section' },
    h('div', { class: 'social-head ' + s.platform },
      h('strong', {}, t(s.key), ' · koreacity'),
      profile ? h('a', { class: 'btn small light', href: profile, target: '_blank', rel: 'noopener' }, t('openProfile', { p: t(s.key) }), ' ↗') : null),
    posts.length ? h('div', { class: 'card-grid compact' }, posts.map(socialCard)) : empty());
}

function socialCard(p) {
  const vid = p.platform === 'youtube' ? youtubeId(p.url) : null;
  const image = safeUrl(p.image) || (vid ? `https://i.ytimg.com/vi/${vid}/hqdefault.jpg` : null);
  return bannerCard({
    title: L(p.title), image, region: p.region || '', regionLabel: p.region ? regions.label(p.region) : null,
    badge: vid ? '▶' : null,
    onclick: vid ? () => modal(h('div', { class: 'video' }, h('iframe', { src: `https://www.youtube-nocookie.com/embed/${vid}?autoplay=1`, title: L(p.title), allow: 'autoplay; encrypted-media; picture-in-picture', allowfullscreen: true })), { wide: true }) : null,
    href: vid ? null : safeUrl(p.url)
  });
}

/* ---------- login / signup ---------- */
function authForm(title, fields, submit, footer) {
  const err = h('p', { class: 'error', role: 'alert' });
  const form = h('form', { class: 'auth-form', onsubmit: async (e) => {
    e.preventDefault();
    err.textContent = '';
    const data = Object.fromEntries(new FormData(form));
    try { await submit(data); } catch (ex) { err.textContent = t(ex.message); }
  } },
  h('h1', {}, title),
  store.backend === 'local' ? h('p', { class: 'notice' }, t('testNotice')) : null,
  fields.map(([name, type]) => h('label', {}, t(name), h('input', { class: 'input', name, type, required: true, autocomplete: type === 'password' ? 'current-password' : 'username' }))),
  err, h('button', { class: 'btn primary block', type: 'submit' }, t('submit')), footer);
  view.replaceChildren(h('section', { class: 'page narrow' }, form));
}

function renderLogin() {
  const next = new URLSearchParams(location.hash.split('?')[1] || '').get('next');
  authForm(t('loginTitle'), [['username', store.backend === 'supabase' ? 'email' : 'text'], ['password', 'password']], async ({ username, password }) => {
    const u = await auth.login(username.trim(), password);
    toast(`${t('login')}: ${u.name}`);
    location.hash = next || (u.role === 'admin' ? '#/admin' : '#/');
  }, h('p', { class: 'muted center' }, t('noAccount'), ' ', h('a', { href: '#/signup' }, t('signup'))));
}

function renderSignup() {
  authForm(t('signupTitle'), [['name', 'text'], ['username', store.backend === 'supabase' ? 'email' : 'text'], ['password', 'password']], async (d) => {
    await auth.signup({ username: d.username.trim(), password: d.password, name: d.name.trim() });
    toast(t('signupDone'));
    location.hash = '#/';
  }, h('p', { class: 'muted center' }, t('haveAccount'), ' ', h('a', { href: '#/login' }, t('login'))));
}

/* ---------- admin (loaded on demand) ---------- */
async function renderAdmin(tab) {
  if (!auth.isAdmin()) {
    toast(t('adminOnly'));
    location.hash = '#/login?next=' + encodeURIComponent('#/admin');
    return;
  }
  const { renderAdmin } = await import('./admin.js');
  renderAdmin(view, tab, { regions, mapData });
}

boot().catch((e) => {
  console.error(e);
  view.replaceChildren(h('p', { class: 'error page' }, 'Failed to load: ', e.message));
});
