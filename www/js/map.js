// Korea administrative map drawn as inline SVG (no external map service).
// Paths are pre-projected by scripts/build-map.mjs into data/korea-map.json.
import { regionName } from './i18n.js';

const NS = 'http://www.w3.org/2000/svg';
const el = (tag, attrs = {}) => {
  const n = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  return n;
};

// Hand-tuned label positions for crowded areas (map units, 800×1000 canvas)
const LABEL_OFFSET = { '11': [0, -2], '23': [-34, 6], '31': [24, -40], '29': [-6, -4], '25': [8, 8], '24': [-4, 4], '26': [10, 4], '22': [0, 4] };

export class KoreaMap {
  constructor(container, data, { onProvince, onMunicipality } = {}) {
    this.data = data;
    this.onProvince = onProvince;
    this.onMunicipality = onMunicipality;
    this.full = [0, 0, data.width, data.height];
    this.vb = [...this.full];
    this.svg = el('svg', { viewBox: this.full.join(' '), class: 'korea-map', role: 'img', 'aria-label': 'Map of Korea' });
    this.gProv = el('g', { class: 'g-prov' });
    this.gMuni = el('g', { class: 'g-muni' });
    this.gLabel = el('g', { class: 'g-label' });
    this.svg.append(this.gProv, this.gMuni, this.gLabel);
    container.replaceChildren(this.svg);

    for (const p of data.provinces) {
      const path = el('path', { d: p.d, class: 'prov', 'data-code': p.code, tabindex: 0, style: `--hue:${hue(p.code)}` });
      path.append(el('title'));
      path.addEventListener('click', () => this.onProvince?.(p.code));
      path.addEventListener('keydown', (e) => e.key === 'Enter' && this.onProvince?.(p.code));
      this.gProv.append(path);
    }
    this.province = null;
    this.selected = null;
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
    this.zoomTo(this.full);
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
      const target = [x + w / 2 - W / 2, y + h / 2 - H / 2, W, H];
      this.zoomTo(target);
      this.drawLabels(munis, Math.max(1.6, W / 58), false);
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
      const label = shortName(r, !isProvince);
      // skip labels that would not fit inside small districts (still reachable via tooltip / list)
      const fits = isProvince || Math.max(r.bbox[2], r.bbox[3] * 1.4) > size * label.length * 0.55;
      const text = el('text', { x: r.c[0] + dx, y: r.c[1] + dy, 'font-size': isProvince && r.code.length === 2 && ['11', '29', '24', '25', '26'].includes(r.code) ? size * 0.75 : size, 'data-code': r.code });
      text.textContent = label;
      if (!fits) text.classList.add('small');
      this.gLabel.append(text);
    }
  }

  relabel() {
    const regions = this.province ? this.data.municipalities.filter((m) => m.province === this.province) : this.data.provinces;
    this.gLabel.querySelectorAll('text').forEach((t, i) => { t.textContent = shortName(regions[i], !!this.province); });
    this.refreshTitles();
  }

  zoomTo(target) {
    const from = [...this.vb];
    const t0 = performance.now(), dur = matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 450;
    cancelAnimationFrame(this.raf);
    const step = (now) => {
      const k = dur ? Math.min(1, (now - t0) / dur) : 1;
      const e = 1 - Math.pow(1 - k, 3);
      this.vb = from.map((v, i) => v + (target[i] - v) * e);
      this.svg.setAttribute('viewBox', this.vb.join(' '));
      if (k < 1) this.raf = requestAnimationFrame(step);
    };
    this.raf = requestAnimationFrame(step);
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
