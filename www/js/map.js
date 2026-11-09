// Korea administrative map drawn as inline SVG (no external map service).
// Paths are pre-projected by scripts/build-map.mjs into data/korea-map.json.
//
// Zoom & pan are bounded:
//  - the "base view" is the whole country, or the selected province;
//  - zooming out stops at the base view, zooming in stops at MAX_ZOOM× the base view;
//  - panning is clamped so the view never leaves the base view (the map can't be dragged off screen).
// Inputs: mouse wheel, drag, two-finger pinch, + / − / reset buttons, keyboard (+, −, 0) when the map has focus.
import { regionName } from './i18n.js';

const NS = 'http://www.w3.org/2000/svg';
const el = (tag, attrs = {}) => {
  const n = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  return n;
};
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

const MAX_ZOOM = 6;
const DRAG_THRESHOLD = 6; // px before a press becomes a drag (so taps still select regions)

// Hand-tuned label positions for crowded areas (map units, 800×1000 canvas)
const LABEL_OFFSET = { '11': [0, -2], '23': [-34, 6], '31': [24, -40], '29': [-6, -4], '25': [8, 8], '24': [-4, 4], '26': [10, 4], '22': [0, 4] };

export class KoreaMap {
  constructor(container, data, { onProvince, onMunicipality } = {}) {
    this.data = data;
    this.onProvince = onProvince;
    this.onMunicipality = onMunicipality;
    this.full = [0, 0, data.width, data.height];
    this.base = [...this.full];
    this.vb = [...this.full];
    this.svg = el('svg', { viewBox: this.full.join(' '), class: 'korea-map', role: 'img', 'aria-label': 'Map of Korea', tabindex: -1 });
    this.gProv = el('g', { class: 'g-prov' });
    this.gMuni = el('g', { class: 'g-muni' });
    this.gLabel = el('g', { class: 'g-label' });
    this.svg.append(this.gProv, this.gMuni, this.gLabel);
    this.controls = this.buildControls();
    container.replaceChildren(this.svg, this.controls);

    for (const p of data.provinces) {
      const path = el('path', { d: p.d, class: 'prov', 'data-code': p.code, tabindex: 0, style: `--hue:${hue(p.code)}` });
      path.append(el('title'));
      path.addEventListener('click', () => this.onProvince?.(p.code));
      path.addEventListener('keydown', (e) => e.key === 'Enter' && this.onProvince?.(p.code));
      this.gProv.append(path);
    }
    this.province = null;
    this.selected = null;
    this.bindGestures();
  }

  refreshTitles() {
    for (const path of this.svg.querySelectorAll('path[data-code]')) {
      const r = this.region(path.dataset.code);
      path.querySelector('title').textContent = regionName(r);
    }
  }
  region(code) {
    return code.length === 2 ? this.data.provinces.find((p) => p.code === code) : this.data.municipalities.find((m) => m.code === code);
  }

  showKorea() {
    this.province = null; this.selected = null;
    this.gProv.querySelectorAll('.prov').forEach((p) => p.classList.remove('dim', 'active'));
    this.gMuni.replaceChildren();
    this.drawLabels(this.data.provinces, 15, true);
    this.setBase(this.full);
    this.refreshTitles();
  }

  showProvince(code, muniCode = null) {
    const prov = this.region(code);
    if (!prov) return;
    if (this.province !== code) {
      this.province = code;
      this.gProv.querySelectorAll('.prov').forEach((p) => {
        p.classList.toggle('dim', p.dataset.code !== code);
        p.classList.toggle('active', p.dataset.code === code);
      });
      this.gMuni.replaceChildren();
      const munis = this.data.municipalities.filter((m) => m.province === code);
      munis.forEach((m, i) => {
        const path = el('path', { d: m.d, class: 'muni', 'data-code': m.code, tabindex: 0, style: `--hue:${hue(code)};--l:${78 - (i % 4) * 5}%` });
        path.append(el('title'));
        path.addEventListener('click', (e) => { e.stopPropagation(); this.onMunicipality?.(code, m.code); });
        path.addEventListener('keydown', (e) => e.key === 'Enter' && this.onMunicipality?.(code, m.code));
        this.gMuni.append(path);
      });
      const [x, y, w, h] = prov.bbox;
      const pad = Math.max(w, h) * 0.08 + 4;
      // keep the map's aspect ratio so the province fills the frame
      const ar = this.full[2] / this.full[3];
      let W = w + pad * 2, H = h + pad * 2;
      if (W / H > ar) H = W / ar; else W = H * ar;
      this.drawLabels(munis, Math.max(1.6, W / 58), false);
      this.setBase([x + w / 2 - W / 2, y + h / 2 - H / 2, W, H]);
      this.refreshTitles();
    }
    this.selected = muniCode;
    this.gMuni.querySelectorAll('.muni').forEach((p) => p.classList.toggle('selected', p.dataset.code === muniCode));
    this.gLabel.querySelectorAll('text').forEach((t) => t.classList.toggle('selected', t.dataset.code === muniCode));
  }

  drawLabels(regions, size, isProvince) {
    this.gLabel.replaceChildren();
    for (const r of regions) {
      const [dx, dy] = (isProvince && LABEL_OFFSET[r.code]) || [0, 0];
      const s = isProvince && ['11', '29', '24', '25', '26'].includes(r.code) ? size * 0.75 : size;
      const text = el('text', { x: r.c[0] + dx, y: r.c[1] + dy, 'data-code': r.code, 'data-size': s, 'data-fit': isProvince ? 0 : Math.max(r.bbox[2], r.bbox[3] * 1.4) });
      text.textContent = shortName(r, !isProvince);
      this.gLabel.append(text);
    }
    this.updateLabels(1);
  }

  // Keep labels the same size on screen while zoomed, and reveal small-district labels once they fit
  updateLabels(k = this.vb[2] / this.base[2]) {
    for (const t of this.gLabel.children) {
      const size = +t.dataset.size * k;
      t.setAttribute('font-size', size);
      t.style.strokeWidth = size * 0.22; // halo scales with the text so it stays a thin outline when zoomed
      const fit = +t.dataset.fit;
      t.classList.toggle('small', fit > 0 && fit <= size * t.textContent.length * 0.55);
    }
  }

  relabel() {
    const regions = this.province ? this.data.municipalities.filter((m) => m.province === this.province) : this.data.provinces;
    this.gLabel.querySelectorAll('text').forEach((t, i) => { t.textContent = shortName(regions[i], !!this.province); });
    this.updateLabels();
    this.refreshTitles();
  }

  /* ---------- view handling ---------- */
  setBase(base) {
    this.base = base;
    this.animateTo(base, false);
  }

  // Clamp a [x, y, w, h] view to the zoom limits and to the base view
  clampView([x, y, w]) {
    const [bx, by, bw, bh] = this.base;
    w = clamp(w, bw / MAX_ZOOM, bw);
    const h = w * (bh / bw);
    return [clamp(x, bx, bx + bw - w), clamp(y, by, by + bh - h), w, h];
  }

  setView(v) {
    this.vb = this.clampView(v);
    this.svg.setAttribute('viewBox', this.vb.join(' '));
    this.updateLabels();
    this.updateControls();
  }

  // scaleLabels=false keeps label sizes fixed during navigation between country/province views
  animateTo(target, scaleLabels = true) {
    const from = [...this.vb];
    const t0 = performance.now(), dur = matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 400;
    cancelAnimationFrame(this.raf);
    if (!scaleLabels) this.updateLabels(target[2] / this.base[2]);
    const step = (now) => {
      const k = dur ? Math.min(1, (now - t0) / dur) : 1;
      const e = 1 - Math.pow(1 - k, 3);
      this.vb = from.map((v, i) => v + (target[i] - v) * e);
      this.svg.setAttribute('viewBox', this.vb.join(' '));
      if (scaleLabels) this.updateLabels();
      if (k < 1) this.raf = requestAnimationFrame(step);
      else this.updateControls();
    };
    this.raf = requestAnimationFrame(step);
  }

  zoomBy(factor, anchor) {
    const [x, y, w, h] = this.vb;
    const [ax, ay] = anchor || [x + w / 2, y + h / 2];
    const nw = clamp(w / factor, this.base[2] / MAX_ZOOM, this.base[2]);
    const r = nw / w;
    return this.clampView([ax - (ax - x) * r, ay - (ay - y) * r, nw]);
  }

  reset() { this.animateTo(this.base); }
  get zoom() { return this.base[2] / this.vb[2]; }

  /* ---------- screen <-> map coordinates (viewBox is letterboxed with xMidYMid meet) ---------- */
  metrics(vb = this.vb) {
    const r = this.svg.getBoundingClientRect();
    const s = Math.min(r.width / vb[2], r.height / vb[3]);
    return { r, s, ox: (r.width - vb[2] * s) / 2, oy: (r.height - vb[3] * s) / 2 };
  }
  toMap(cx, cy, vb = this.vb) {
    const { r, s, ox, oy } = this.metrics(vb);
    return [vb[0] + (cx - r.left - ox) / s, vb[1] + (cy - r.top - oy) / s];
  }
  // view of width w in which map point P sits under screen point (cx, cy)
  viewWithAnchor([px, py], cx, cy, w) {
    const h = w * (this.base[3] / this.base[2]);
    const { r, s, ox, oy } = this.metrics([0, 0, w, h]);
    return [px - (cx - r.left - ox) / s, py - (cy - r.top - oy) / s, w];
  }

  /* ---------- controls & gestures ---------- */
  buildControls() {
    const btn = (label, title, fn) => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'map-btn'; b.textContent = label; b.title = title; b.setAttribute('aria-label', title);
      b.addEventListener('click', (e) => { e.stopPropagation(); fn(); });
      return b;
    };
    const box = document.createElement('div');
    box.className = 'map-controls';
    this.btnIn = btn('+', 'Zoom in', () => this.animateTo(this.zoomBy(1.6)));
    this.btnOut = btn('−', 'Zoom out', () => this.animateTo(this.zoomBy(1 / 1.6)));
    this.btnReset = btn('⟲', 'Reset view', () => this.reset());
    box.append(this.btnIn, this.btnOut, this.btnReset);
    return box;
  }

  updateControls() {
    const z = this.zoom;
    this.btnIn.disabled = z >= MAX_ZOOM - 0.01;
    this.btnOut.disabled = this.btnReset.disabled = z <= 1.01;
    // at the base view let one-finger swipes scroll the page; once zoomed, the map owns touch gestures
    this.svg.style.touchAction = z > 1.01 ? 'none' : 'pan-y';
    this.svg.classList.toggle('zoomed', z > 1.01);
  }

  bindGestures() {
    const svg = this.svg;
    const pts = new Map();
    let start = null;
    this.dragged = false;

    const snapshot = () => {
      const list = [...pts.values()];
      const mid = list.reduce((a, p) => [a[0] + p[0] / list.length, a[1] + p[1] / list.length], [0, 0]);
      const dist = list.length > 1 ? Math.hypot(list[0][0] - list[1][0], list[0][1] - list[1][1]) : 0;
      return { vb: [...this.vb], mid, dist, anchor: this.toMap(mid[0], mid[1]), n: list.length };
    };

    function end(e) {
      if (!pts.delete(e.pointerId)) return;
      start = pts.size ? snapshot() : null;
      if (!pts.size) svg.classList.remove('dragging');
    }

    svg.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      cancelAnimationFrame(this.raf);
      pts.set(e.pointerId, [e.clientX, e.clientY]);
      start = snapshot();
      if (pts.size === 1) this.dragged = false;
    });

    // move/up are tracked on window so a release outside the map (or the window) always ends the gesture
    addEventListener('pointermove', (e) => {
      if (!pts.has(e.pointerId)) return;
      if (e.pointerType === 'mouse' && e.buttons === 0) return end(e);
      pts.set(e.pointerId, [e.clientX, e.clientY]);
      const cur = snapshot();
      if (cur.n !== start.n) { start = cur; return; }
      const moved = Math.hypot(cur.mid[0] - start.mid[0], cur.mid[1] - start.mid[1]);
      if (!this.dragged && moved < DRAG_THRESHOLD && cur.n === 1) return;
      if (!this.dragged) {
        this.dragged = true;
        svg.classList.add('dragging');
      }
      const w = cur.n > 1 && start.dist > 0 ? start.vb[2] * (start.dist / cur.dist) : start.vb[2];
      this.setView(this.viewWithAnchor(start.anchor, cur.mid[0], cur.mid[1], clamp(w, this.base[2] / MAX_ZOOM, this.base[2])));
      e.preventDefault();
    });

    addEventListener('pointerup', end);
    addEventListener('pointercancel', end);

    // a drag must not count as a click on a region
    svg.addEventListener('click', (e) => {
      if (this.dragged) { e.stopPropagation(); e.preventDefault(); this.dragged = false; }
    }, true);

    svg.addEventListener('wheel', (e) => {
      e.preventDefault();
      cancelAnimationFrame(this.raf);
      const dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
      this.setView(this.zoomBy(Math.exp(-dy * 0.0015), this.toMap(e.clientX, e.clientY)));
    }, { passive: false });

    svg.addEventListener('dblclick', (e) => {
      e.preventDefault();
      this.animateTo(this.zoomBy(2, this.toMap(e.clientX, e.clientY)));
    });

    svg.addEventListener('keydown', (e) => this.onKey(e));
  }

  onKey(e) {
    const step = this.vb[2] * 0.15;
    const moves = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    if (e.key === '+' || e.key === '=') this.animateTo(this.zoomBy(1.6));
    else if (e.key === '-' || e.key === '_') this.animateTo(this.zoomBy(1 / 1.6));
    else if (e.key === '0') this.reset();
    else if (moves[e.key] && this.zoom > 1.01) this.animateTo(this.clampView([this.vb[0] + moves[e.key][0], this.vb[1] + moves[e.key][1], this.vb[2]]));
    else return;
    e.preventDefault();
  }
}

function hue(code) {
  const list = ['11', '21', '22', '23', '24', '25', '26', '29', '31', '32', '33', '34', '35', '36', '37', '38', '39'];
  return Math.round((list.indexOf(code) * 360 * 7) / 17) % 360;
}

function shortName(r, muni = false) {
  const n = regionName(r);
  if (muni) return n.replace(/-(si|gun|gu)$/, '');
  // drop long suffixes in English to keep labels compact
  return n.replace(/-do$/, '').replace(/ State$/, '').replace(/^Chungcheong(buk|nam)$/, (m, s) => 'Chung' + s).replace(/^Gyeongsang(buk|nam)$/, (m, s) => 'Gyeong' + s).replace(/^Jeolla(nam)$/, 'Jeon$1');
}
