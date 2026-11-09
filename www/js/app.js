import { CONFIG } from './config.js';
import { store } from './store.js';
import { auth } from './auth.js';
import { KoreaMap } from './map.js';
import { t, L, getLang, setLang, regionName } from './i18n.js';
import { $, h, modal, toast, safeUrl, youtubeId, bannerCard, regionColor, initial } from './ui.js';

const view = $('#view');
let mapData, map, mapHost, bannerTimer;

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

const SECTIONS = {
  mayors: { col: 'mayors', title: (i) => L(i.name), sub: (i) => L(i.position), body: (i) => L(i.message) },
  festivals: { col: 'festivals', title: (i) => L(i.title), sub: (i) => L(i.period), body: (i) => L(i.description) },
  investment: { col: 'investments', title: (i) => L(i.title), sub: (i) => L(i.sector), body: (i) => L(i.description) }
};

/* ---------- boot ---------- */
async function boot() {
  setLang(getLang());
  [mapData] = await Promise.all([fetch('data/korea-map.json').then((r) => r.json()), store.init()]);
  mapHost = h('div', { class: 'map-host' });
  map = new KoreaMap(mapHost, mapData, {
    onProvince: (code) => (location.hash = `#/map/${code}`),
    onMunicipality: (p, m) => (location.hash = `#/map/${p}/${m}`)
  });
  buildChrome();
  auth.onChange(() => { buildDrawer(); });
  addEventListener('hashchange', route);
  route();
}

/* ---------- header + hamburger drawer ---------- */
function buildChrome() {
  $('#menu-btn').onclick = () => toggleDrawer(true);
  $('#drawer-backdrop').onclick = () => toggleDrawer(false);
  $('#brand').onclick = (e) => { e.preventDefault(); location.hash = '#/'; };
  buildDrawer();
}

function toggleDrawer(open) {
  document.body.classList.toggle('drawer-open', open);
  $('#menu-btn').setAttribute('aria-expanded', open);
}

function buildDrawer() {
  const user = auth.user();
  const link = (hash, icon, label) => h('a', { href: hash, class: 'drawer-link', onclick: () => toggleDrawer(false) }, h('span', { class: 'ico', 'aria-hidden': 'true' }, icon), label);
  const nav = $('#drawer');
  nav.replaceChildren(...[
    h('div', { class: 'drawer-head' },
      h('strong', {}, CONFIG.appName),
      h('button', { class: 'icon-btn', 'aria-label': t('close'), onclick: () => toggleDrawer(false) }, '✕')),
    user ? h('div', { class: 'drawer-user' }, '👤 ', user.name, user.role === 'admin' ? h('span', { class: 'chip chip-badge' }, 'admin') : null) : null,
    link('#/', '🗺️', t('home')),
    link('#/mayors', '🏛️', t('mayors')),
    link('#/festivals', '🎉', t('festivals')),
    link('#/investment', '📈', t('investment')),
    h('div', { class: 'drawer-sep' }),
    link('#/youtube', '▶️', t('youtube')),
    link('#/facebook', 'ⓕ', t('facebook')),
    link('#/x', '𝕏', t('x')),
    h('div', { class: 'drawer-sep' }),
    h('label', { class: 'drawer-lang' }, h('span', {}, '🌐 ', t('language')),
      h('select', { onchange: (e) => { setLang(e.target.value); buildDrawer(); map.relabel(); route(); } },
        CONFIG.languages.map((l) => h('option', { value: l.code, selected: l.code === getLang() }, l.label)))),
    h('div', { class: 'drawer-sep' }),
    user
      ? [user.role === 'admin' && (CONFIG.showAdminInApp || !window.Capacitor) ? link('#/admin', '⚙️', t('admin')) : null,
         h('button', { class: 'drawer-link', onclick: () => { auth.logout(); toggleDrawer(false); toast(t('logout')); route(); } }, h('span', { class: 'ico' }, '↩'), t('logout'))]
      : [link('#/login', '🔑', t('login')), link('#/signup', '✍️', t('signup'))]
  ].flat().filter(Boolean));
  $('#lang-btn').textContent = getLang().toUpperCase();
  $('#lang-btn').onclick = () => {
    const langs = CONFIG.languages.map((l) => l.code);
    setLang(langs[(langs.indexOf(getLang()) + 1) % langs.length]);
    buildDrawer(); map.relabel(); route();
  };
  $('#tagline').textContent = t('tagline');
}

/* ---------- router ---------- */
function route() {
  clearInterval(bannerTimer);
  toggleDrawer(false);
  const [path, query] = location.hash.replace(/^#\/?/, '').split('?');
  const parts = path.split('/').filter(Boolean);
  const params = new URLSearchParams(query || '');
  const [page] = parts;
  document.querySelectorAll('.drawer-link').forEach((a) => a.classList.toggle('current', a.getAttribute('href') === '#/' + (page === 'map' ? '' : page || '')));
  window.scrollTo(0, 0);

  if (!page) return renderHome();
  if (page === 'map') return renderRegion(parts[1], parts[2]);
  if (SECTIONS[page]) return renderSection(page, params.get('r') || '');
  if (['youtube', 'facebook', 'x'].includes(page)) return renderSocial(page);
  if (page === 'login') return renderLogin();
  if (page === 'signup') return renderSignup();
  if (page === 'admin') return renderAdmin(parts[1]);
  location.hash = '#/';
}

/* ---------- home: map + bottom banners ---------- */
function renderHome() {
  document.title = CONFIG.appName;
  map.showKorea();
  const banners = store.list('homeBanners');
  view.replaceChildren(
    h('section', { class: 'map-layout home' },
      h('div', { class: 'map-card' }, mapHost, h('p', { class: 'map-hint' }, t('mapHint'))),
      h('aside', { class: 'side' },
        h('h2', { class: 'side-title' }, t('allKorea')),
        h('div', { class: 'prov-list' }, regions.provinces().map((p) =>
          h('a', { href: `#/map/${p.code}`, class: 'prov-chip', style: { '--c': regionColor(p.code) } }, regionName(p)))),
        quickLinks())),
    banners.length ? bannerStrip(banners) : null
  );
}

function quickLinks() {
  return h('div', { class: 'quick' },
    [['mayors', '🏛️'], ['festivals', '🎉'], ['investment', '📈']].map(([k, i]) =>
      h('a', { href: `#/${k}`, class: 'quick-link' }, h('span', { 'aria-hidden': 'true' }, i), t(k))));
}

function bannerStrip(banners) {
  const track = h('div', { class: 'strip-track' }, banners.map((b) =>
    h('a', {
      class: 'strip-banner', href: safeUrl(b.link) || (b.link?.startsWith('#') ? b.link : null),
      target: b.link?.startsWith('http') ? '_blank' : null, rel: 'noopener',
      style: { '--c': b.color || '#1d4ed8', backgroundImage: safeUrl(b.image) ? `linear-gradient(90deg, rgb(0 0 0 / .55), rgb(0 0 0 / .1)), url("${b.image}")` : null }
    }, h('strong', {}, L(b.title)), b.text ? h('span', {}, L(b.text)) : null)));
  const dots = h('div', { class: 'strip-dots' }, banners.map((_, i) => h('button', { 'aria-label': `Banner ${i + 1}`, onclick: () => go(i) })));
  let idx = 0;
  const go = (i) => {
    idx = (i + banners.length) % banners.length;
    track.scrollTo({ left: track.clientWidth * idx, behavior: 'smooth' });
    [...dots.children].forEach((d, j) => d.classList.toggle('on', j === idx));
  };
  track.addEventListener('scroll', () => {
    const i = Math.round(track.scrollLeft / track.clientWidth);
    if (i !== idx) { idx = i; [...dots.children].forEach((d, j) => d.classList.toggle('on', j === idx)); }
  }, { passive: true });
  setTimeout(() => go(0));
  if (banners.length > 1) bannerTimer = setInterval(() => go(idx + 1), 5000);
  return h('section', { class: 'strip', 'aria-label': 'Banners' }, track, banners.length > 1 ? dots : null);
}

/* ---------- province / municipality ---------- */
function renderRegion(provCode, muniCode) {
  const prov = regions.get(provCode);
  if (!prov) return (location.hash = '#/');
  const muni = muniCode ? regions.get(muniCode) : null;
  map.showProvince(provCode, muni?.code || null);
  const code = muni ? muni.code : provCode;
  document.title = `${regionName(muni || prov)} · ${CONFIG.appName}`;

  const back = h('a', { class: 'back', href: muni ? `#/map/${provCode}` : '#/' }, '← ', muni ? regionName(prov) : t('allKorea'));
  const crumbs = h('nav', { class: 'crumbs' }, h('a', { href: '#/' }, t('allKorea')), ' › ',
    muni ? [h('a', { href: `#/map/${provCode}` }, regionName(prov)), ' › ', h('span', {}, regionName(muni))] : h('span', {}, regionName(prov)));

  const munis = regions.municipalities(provCode).sort((a, b) => regionName(a).localeCompare(regionName(b), getLang()));
  const search = h('input', { type: 'search', class: 'input', placeholder: t('search'), 'aria-label': t('search') });
  const chips = h('div', { class: 'muni-list' }, munis.map((m) =>
    h('a', { href: `#/map/${provCode}/${m.code}`, class: 'muni-chip' + (m.code === muniCode ? ' on' : ''), 'data-name': `${m.ko} ${m.en}`.toLowerCase() }, regionName(m))));
  search.oninput = () => {
    const q = search.value.trim().toLowerCase();
    [...chips.children].forEach((c) => (c.hidden = q && !c.dataset.name.includes(q)));
  };

  view.replaceChildren(h('section', { class: 'map-layout' },
    h('div', { class: 'map-card' }, h('div', { class: 'map-toolbar' }, back), mapHost),
    h('aside', { class: 'side' },
      crumbs,
      regionBanner(code),
      relatedItems(code),
      munis.length > 1 || !muni ? h('div', { class: 'panel' }, h('h3', {}, t('localGovs'), h('small', {}, ` (${munis.length})`)), munis.length > 8 ? search : null, chips) : null)));
}

function regionBanner(code) {
  const r = regions.get(code);
  const info = store.get('regions', code) || {};
  const prov = code.length === 5 ? regions.get(r.province) : null;
  const url = safeUrl(info.url);
  const img = safeUrl(info.image);
  const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(`${r.ko} ${prov && r.province !== '29' ? prov.ko : ''} 공식 홈페이지`)}`;
  return h('article', { class: 'region-banner', style: { '--c': regionColor(code) } },
    h('div', { class: 'region-hero' + (img ? '' : ' no-img') }, img ? h('img', { src: img, alt: '' }) : null,
      h('div', { class: 'region-hero-text' },
        h('h2', {}, regionName(r)),
        h('span', {}, getLang() === 'ko' ? r.en : r.ko, prov ? ` · ${regionName(prov)}` : ''))),
    h('div', { class: 'region-body' },
      L(info.intro) ? h('p', {}, L(info.intro)) : null,
      h('div', { class: 'region-actions' },
        url
          ? h('a', { class: 'btn primary', href: url, target: '_blank', rel: 'noopener' }, '🌐 ', t('officialSite'))
          : h('a', { class: 'btn', href: searchUrl, target: '_blank', rel: 'noopener' }, '🔎 ', t('findSite')),
        safeUrl(info.link) ? h('a', { class: 'btn', href: info.link, target: '_blank', rel: 'noopener' }, t('more'), ' →') : null),
      url ? h('a', { class: 'region-url', href: url, target: '_blank', rel: 'noopener' }, url.replace(/^https?:\/\//, '').replace(/\/$/, '')) : null));
}

function itemsFor(col, code) {
  return store.list(col).filter((i) => i.region && (code.length === 2 ? i.region.startsWith(code) : i.region === code));
}

function relatedItems(code) {
  const groups = Object.entries(SECTIONS).map(([k, s]) => [k, s, itemsFor(s.col, code)]).filter(([, , items]) => items.length);
  if (!groups.length) return null;
  return h('div', { class: 'panel' }, h('h3', {}, t('related')),
    groups.map(([k, s, items]) => h('div', { class: 'related-group' },
      h('a', { class: 'related-head', href: `#/${k}?r=${code}` }, t(k), h('small', {}, ` ${items.length} →`)),
      h('div', { class: 'card-row' }, items.map((i) => card(k, i))))));
}

/* ---------- Mayor's Greetings / Festivals / Investment ---------- */
function card(section, item) {
  const s = SECTIONS[section];
  return bannerCard({
    title: s.title(item), subtitle: s.sub(item), body: s.body(item), image: item.image, region: item.region,
    regionLabel: regions.label(item.region), badge: item.sample ? t('sample') : null,
    onclick: () => openItem(section, item)
  });
}

function openItem(section, item) {
  const s = SECTIONS[section];
  const info = store.get('regions', item.region) || {};
  const link = safeUrl(item.link) || safeUrl(info.url);
  const img = safeUrl(item.image);
  const prov = item.region.slice(0, 2);
  modal(h('div', { class: 'item-detail' },
    h('div', { class: 'item-hero' + (img ? '' : ' no-img'), style: { '--c': regionColor(item.region) } }, img ? h('img', { src: img, alt: '' }) : h('span', {}, initial(s.title(item)))),
    h('span', { class: 'chip' }, regions.label(item.region)),
    item.sample ? h('span', { class: 'chip chip-badge' }, t('sample')) : null,
    h('h2', {}, s.title(item)),
    s.sub(item) ? h('p', { class: 'muted' }, s.sub(item)) : null,
    h('p', { class: 'pre' }, s.body(item)),
    h('div', { class: 'region-actions' },
      link ? h('a', { class: 'btn primary', href: link, target: '_blank', rel: 'noopener' }, t('visit'), ' ↗') : null,
      h('a', { class: 'btn', href: item.region.length === 5 ? `#/map/${prov}/${item.region}` : `#/map/${prov}`, onclick: () => $('.modal-close')?.click() }, '🗺️ ', regions.label(item.region)))));
}

function regionFilter(selected, onchange) {
  return h('select', { class: 'input', 'aria-label': t('filter'), onchange: (e) => onchange(e.target.value) },
    h('option', { value: '' }, t('allRegions')),
    regions.provinces().map((p) => [
      h('option', { value: p.code, selected: selected === p.code }, regionName(p)),
      ...(selected.length === 5 && regions.get(selected)?.province === p.code
        ? [h('option', { value: selected, selected: true }, '　· ' + regionName(regions.get(selected)))] : [])
    ]));
}

function renderSection(section, filter) {
  const s = SECTIONS[section];
  document.title = `${t(section)} · ${CONFIG.appName}`;
  const items = filter ? itemsFor(s.col, filter) : store.list(s.col);
  view.replaceChildren(h('section', { class: 'page' },
    h('div', { class: 'page-head' },
      h('h1', {}, t(section)),
      regionFilter(filter, (v) => (location.hash = `#/${section}${v ? '?r=' + v : ''}`))),
    items.length ? h('div', { class: 'card-grid' }, items.map((i) => card(section, i))) : h('p', { class: 'empty' }, t('noItems'))));
}

/* ---------- YouTube / Facebook / X ---------- */
function renderSocial(platform) {
  const st = store.settings();
  const profile = safeUrl({ youtube: st.youtubeUrl, facebook: st.facebookUrl, x: st.xUrl }[platform]);
  const name = t(platform);
  document.title = `${name} · ${CONFIG.appName}`;
  const posts = store.list('social').filter((p) => p.platform === platform);

  let embed = null;
  if (platform === 'youtube' && /^UC[\w-]{22}$/.test(st.youtubeChannelId || '')) {
    embed = h('div', { class: 'panel' }, h('h3', {}, t('latest')),
      h('div', { class: 'video' }, h('iframe', { src: `https://www.youtube-nocookie.com/embed/videoseries?list=UU${st.youtubeChannelId.slice(2)}`, title: 'YouTube', allow: 'encrypted-media; picture-in-picture', allowfullscreen: true, loading: 'lazy' })));
  }
  if (platform === 'facebook' && profile) {
    embed = h('div', { class: 'panel fb' }, h('iframe', {
      src: `https://www.facebook.com/plugins/page.php?href=${encodeURIComponent(profile)}&tabs=timeline&width=500&height=600&small_header=true&hide_cover=false`,
      width: 500, height: 600, title: 'Facebook', loading: 'lazy', style: { border: 0, maxWidth: '100%' }
    }));
  }

  view.replaceChildren(h('section', { class: 'page' },
    h('div', { class: 'social-head ' + platform },
      h('div', {}, h('h1', {}, name, ' · koreacity'), h('p', {}, t('tagline'))),
      profile ? h('a', { class: 'btn light', href: profile, target: '_blank', rel: 'noopener' }, t('openProfile', { p: name }), ' ↗') : null),
    embed,
    h('h2', { class: 'section-sub' }, t('posts')),
    posts.length ? h('div', { class: 'card-grid' }, posts.map((p) => socialCard(p))) : h('p', { class: 'empty' }, t('noItems'))));
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
