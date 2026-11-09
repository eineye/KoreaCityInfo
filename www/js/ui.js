// Small DOM helpers shared by the public app and the admin screen.
import { L, t, regionName } from './i18n.js';

export const $ = (sel, root = document) => root.querySelector(sel);

export function h(tag, attrs = {}, ...children) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
    else if (k === 'class') n.className = v;
    else if (k === 'html') n.innerHTML = v;
    else if (k === 'style' && typeof v === 'object') {
      for (const [sk, sv] of Object.entries(v)) if (sv != null) sk.startsWith('--') ? n.style.setProperty(sk, sv) : (n.style[sk] = sv);
    }
    else n.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat()) if (c != null && c !== false) n.append(c instanceof Node ? c : String(c));
  return n;
}

export function toast(msg) {
  const n = h('div', { class: 'toast', role: 'status' }, msg);
  document.body.append(n);
  setTimeout(() => n.classList.add('show'));
  setTimeout(() => { n.classList.remove('show'); setTimeout(() => n.remove(), 300); }, 2200);
}

export function modal(content, { wide = false } = {}) {
  const close = () => { wrap.remove(); document.removeEventListener('keydown', onKey); };
  const onKey = (e) => e.key === 'Escape' && close();
  const wrap = h('div', { class: 'modal-wrap', onclick: (e) => e.target === wrap && close() },
    h('div', { class: 'modal' + (wide ? ' wide' : ''), role: 'dialog', 'aria-modal': 'true' },
      h('button', { class: 'icon-btn modal-close', 'aria-label': t('close'), onclick: close }, '✕'),
      content));
  document.addEventListener('keydown', onKey);
  document.body.append(wrap);
  return close;
}

export const initial = (s = '') => (s.match(/[\p{L}\p{N}]/u) || ['?'])[0];

export const safeUrl = (u) => (u && /^(https?:|mailto:|data:image\/)/i.test(u) ? u : null);

export const youtubeId = (url = '') =>
  (url.match(/(?:youtu\.be\/|v=|\/embed\/|\/shorts\/)([\w-]{11})/) || [])[1] || null;

// Consistent colour per region so banners without images still look intentional
export function regionColor(code = '') {
  const list = ['11', '21', '22', '23', '24', '25', '26', '29', '31', '32', '33', '34', '35', '36', '37', '38', '39'];
  const i = list.indexOf(code.slice(0, 2));
  const hue = Math.round(((i < 0 ? 3 : i) * 360 * 7) / 17) % 360;
  return `hsl(${hue} 55% 42%)`;
}

/** A banner card: image (or coloured gradient) + region chip + title/subtitle/body. */
export function bannerCard({ title, subtitle, body, image, color, region, regionLabel, badge, onclick, href }) {
  const bg = safeUrl(image);
  const tag = href ? 'a' : 'button';
  return h(tag, {
    class: 'banner-card', onclick, href, target: href ? '_blank' : null, rel: href ? 'noopener' : null,
    style: { '--c': color || regionColor(region) }
  },
  h('div', { class: 'banner-media' + (bg ? '' : ' no-img') },
    bg ? h('img', { src: bg, alt: '', loading: 'lazy' }) : h('span', { class: 'banner-initial' }, initial(title)),
    regionLabel ? h('span', { class: 'chip' }, regionLabel) : null,
    badge ? h('span', { class: 'chip chip-badge' }, badge) : null),
  h('div', { class: 'banner-body' },
    h('strong', { class: 'banner-title' }, title),
    subtitle ? h('span', { class: 'banner-sub' }, subtitle) : null,
    body ? h('p', { class: 'banner-text' }, body) : null));
}

export { L, t, regionName };
