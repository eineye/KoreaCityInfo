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
// Remote islands left out of the province framing (still reachable by panning / selecting them)
const REMOTE = new Set(['37430']); // 울릉군 (Ulleungdo + Dokdo)

const union = (boxes) => {
  const x0 = Math.min(...boxes.map((b) => b[0])), y0 = Math.min(...boxes.map((b) => b[1]));
  const x1 = Math.max(...boxes.map((b) => b[0] + b[2])), y1 = Math.max(...boxes.map((b) => b[1] + b[3]));
  return [x0, y0, x1 - x0, y1 - y0];
};
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
    this.bounds = [...this.full];
    this.vb = [...this.full];
    this.svg = el('svg', { viewBox: this.full.join(' '), class: 'korea-map', role: 'img', 'aria-label': 'Map of Korea', tabindex: -1 });
    this.gProv = el('g', { class: 'g-prov' });
    this.gMuni = el('g', { class: 'g-muni' });
    this.gLabel = el('g', { class: 'g-label' });
    this.gMarker = el('g', { class: 'g-marker' });
    this.svg.append(this.gProv, this.gMuni, this.gLabel, this.gMarker);
    this.controls = this.buildControls();
    container.replaceChildren(this.svg, this.controls);
    container.style.aspectRatio = `${data.width} / ${data.height}`;

    for (const p of data.provinces) {
      const path = el('path', { d: p.d, class: 'prov', 'data-code': p.code, tabindex: 0, style: `--hue:${hue(p.code)}` });
      path.append(el('title'));
      path.addEventListener('click', () => this.onProvince?.(p.code));
      path.addEventListener('keydown', (e) => e.key === 'Enter' && this.onProvince?.(p.code));
      this.gProv.append(path);
    }
    // Islands too small to see at map scale (Dokdo): a dot + name that stays the same size on screen
    for (const m of data.markers || []) {
      const g = el('g', { class: 'marker', 'data-code': m.municipality, tabindex: 0, role: 'link' });
      g.append(el('title'), el('circle', { cx: m.c[0], cy: m.c[1], class: 'marker-hit' }), el('circle', { cx: m.c[0], cy: m.c[1], class: 'marker-dot' }), el('text', { class: 'marker-label' }));
      const go = (e) => { e.stopPropagation(); this.onMunicipality?.(m.province, m.municipality); };
      g.addEventListener('click', go);
      g.addEventListener('keydown', (e) => e.key === 'Enter' && go(e));
      g.marker = m;
      this.gMarker.append(g);
    }
    this.province = null;
    this.selected = null;
    this.bindGestures();
    this.updateMarkers();
    addEventListener('resize', () => this.updateMarkers());
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
    this.setBase(this.full, this.full);
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
      const main = munis.filter((m) => !REMOTE.has(m.code));
      const base = this.frame(union((main.length ? main : munis).map((m) => m.bbox)));
      // panning may reach the whole province (e.g. Ulleungdo and Dokdo east of Gyeongsangbuk-do)
      const all = union([...munis.map((m) => m.bbox), ...(this.data.markers || []).filter((k) => k.province === code).map((k) => [k.c[0], k.c[1], 0, 0])]);
      // margin of a quarter view around the outermost islands so they can be centred, not stuck to an edge
      const bounds = union([base, this.pad(all, base[3] * 0.25)]);
      this.drawLabels(munis, Math.max(1.6, base[2] / 58), false);
      this.setBase(base, bounds, muniCode ? this.reveal(base, muniCode, base, bounds) : base);
      this.refreshTitles();
    } else if (muniCode) {
      const target = this.reveal(this.vb, muniCode);
      if (target !== this.vb) this.animateTo(target);
    }
    this.selected = muniCode;
    this.gMuni.querySelectorAll('.muni').forEach((p) => p.classList.toggle('selected', p.dataset.code === muniCode));
    this.gLabel.querySelectorAll('text').forEach((t) => t.classList.toggle('selected', t.dataset.code === muniCode));
    this.updateMarkers();
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

  updateMarkers() {
    // map units per screen pixel, so the marker keeps the same on-screen size at any zoom / screen width
    const { s } = this.metrics();
    const u = s > 0 ? 1 / s : this.vb[2] / 900;
    for (const g of this.gMarker.children) {
      const [x, y] = g.marker.c;
      const [hit, dot, text] = g.querySelectorAll('circle, text');
      hit.setAttribute('r', 16 * u);
      dot.setAttribute('r', 5 * u);
      dot.style.strokeWidth = 1.6 * u;
      text.setAttribute('x', x - 8 * u);
      text.setAttribute('y', y + 1 * u);
      text.setAttribute('font-size', 12 * u);
      text.style.strokeWidth = 12 * u * 0.22;
      text.textContent = regionName(g.marker);
      g.querySelector('title').textContent = regionName(g.marker);
      g.classList.toggle('selected', this.selected === g.marker.municipality);
    }
  }

  relabel() {
    const regions = this.province ? this.data.municipalities.filter((m) => m.province === this.province) : this.data.provinces;
    this.gLabel.querySelectorAll('text').forEach((t, i) => { t.textContent = shortName(regions[i], !!this.province); });
    this.updateLabels();
    this.updateMarkers();
    this.refreshTitles();
  }

  /* ---------- view handling ---------- */
  pad([x, y, w, h], p) { return [x - p, y - p, w + p * 2, h + p * 2]; }

  // padded box grown to the map's aspect ratio, so a province fills the frame
  frame(box) {
    const [x, y, w, h] = box;
    const pad = Math.max(w, h) * 0.08 + 4;
    const ar = this.full[2] / this.full[3];
    let W = w + pad * 2, H = h + pad * 2;
    if (W / H > ar) H = W / ar; else W = H * ar;
    return [x + w / 2 - W / 2, y + h / 2 - H / 2, W, H];
  }

  // view that shows a municipality, or the given view if it is already fully visible
  reveal(view, code, base = this.base, bounds = this.bounds) {
    const m = this.region(code);
    if (!m) return view;
    const [x, y, w, h] = view, [mx, my, mw, mh] = m.bbox;
    if (mx >= x && my >= y && mx + mw <= x + w && my + mh <= y + h) return view;
    // frame the municipality (zooming in if it is small), never zooming out beyond the current view
    const fw = clamp(this.frame(m.bbox)[2] * 1.5, base[2] / MAX_ZOOM, w);
    const fh = fw * (h / w);
    return this.clampView([mx + mw / 2 - fw / 2, my + mh / 2 - fh / 2, fw], base, bounds);
  }

  setBase(base, bounds = base, view = base) {
    this.base = base;
    this.bounds = bounds;
    this.animateTo(view, false);
  }

  // Clamp a [x, y, w, h] view to the zoom limits and to the base view
  // zoom limits come from the base view, pan limits from the bounds (base view plus any remote islands)
  clampView([x, y, w], base = this.base, bounds = this.bounds) {
    const [, , bw, bh] = base;
    const [lx, ly, lw, lh] = bounds;
    w = clamp(w, bw / MAX_ZOOM, bw);
    const h = w * (bh / bw);
    return [clamp(x, lx, lx + lw - w), clamp(y, ly, ly + lh - h), w, h];
  }

  setView(v) {
    this.vb = this.clampView(v);
    this.svg.setAttribute('viewBox', this.vb.join(' '));
    this.updateLabels();
    this.updateMarkers();
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
      this.updateMarkers();
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
    const atBase = z <= 1.01 && this.vb.every((v, i) => Math.abs(v - this.base[i]) < this.base[2] * 0.01);
    const pannable = z > 1.01 || this.bounds[2] > this.base[2] + 1 || this.bounds[3] > this.base[3] + 1;
    this.btnIn.disabled = z >= MAX_ZOOM - 0.01;
    this.btnOut.disabled = z <= 1.01;
    this.btnReset.disabled = atBase;
    // at the base view let one-finger swipes scroll the page; once zoomed, the map owns touch gestures
    this.svg.style.touchAction = z > 1.01 ? 'none' : 'pan-y';
    this.svg.classList.toggle('zoomed', pannable);
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
