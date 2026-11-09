// Builds data/korea-map.json (pre-projected SVG paths) from KOSTAT 2013 GeoJSON
// (https://github.com/southkorea/southkorea-maps), updated to current boundaries:
//  - general districts (일반구) merged into their parent city (e.g. 수원시 4구 → 수원시)
//  - 청원군 merged into 청주시 (2014), 군위군 moved to 대구광역시 (2023)
//  - renamed: 인천 남구 → 미추홀구, 강원특별자치도, 전북특별자치도
// Usage: npm i d3-geo topojson-server topojson-client && node scripts/build-map.mjs <municipalities_geo.json>
import fs from 'node:fs';
import { geoMercator, geoPath } from 'd3-geo';
import { topology } from 'topojson-server';
import { merge } from 'topojson-client';

const src = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));

const PROVINCES = {
  '11': ['서울특별시', 'Seoul'], '21': ['부산광역시', 'Busan'], '22': ['대구광역시', 'Daegu'],
  '23': ['인천광역시', 'Incheon'], '24': ['광주광역시', 'Gwangju'], '25': ['대전광역시', 'Daejeon'],
  '26': ['울산광역시', 'Ulsan'], '29': ['세종특별자치시', 'Sejong'], '31': ['경기도', 'Gyeonggi-do'],
  '32': ['강원특별자치도', 'Gangwon State'], '33': ['충청북도', 'Chungcheongbuk-do'],
  '34': ['충청남도', 'Chungcheongnam-do'], '35': ['전북특별자치도', 'Jeonbuk State'],
  '36': ['전라남도', 'Jeollanam-do'], '37': ['경상북도', 'Gyeongsangbuk-do'],
  '38': ['경상남도', 'Gyeongsangnam-do'], '39': ['제주특별자치도', 'Jeju']
};

// code remaps: child -> parent municipality code
const remap = (code) => {
  if (code === '33310') return '33010'; // 청원군 → 청주시
  if (/^3[1-8]\d{2}[1-9]$/.test(code)) return code.slice(0, 4) + '0'; // 일반구 → 시
  return code;
};
const provinceOf = (code) => (code === '37310' ? '22' : code.slice(0, 2));

const NAME_OVERRIDES = {
  '31010': ['수원시', 'Suwon-si'], '31020': ['성남시', 'Seongnam-si'], '31040': ['안양시', 'Anyang-si'],
  '31050': ['부천시', 'Bucheon-si'], '31090': ['안산시', 'Ansan-si'], '31100': ['고양시', 'Goyang-si'],
  '31190': ['용인시', 'Yongin-si'], '33010': ['청주시', 'Cheongju-si'], '34010': ['천안시', 'Cheonan-si'],
  '35010': ['전주시', 'Jeonju-si'], '37010': ['포항시', 'Pohang-si'], '38110': ['창원시', 'Changwon-si'],
  '23030': ['미추홀구', 'Michuhol-gu'], '32360': ['철원군', 'Cheorwon-gun'],
  '34080': ['당진시', 'Dangjin-si'], '34070': ['계룡시', 'Gyeryong-si'], '33390': ['증평군', 'Jeungpyeong-gun'],
  '31270': ['포천시', 'Pocheon-si'], '31260': ['양주시', 'Yangju-si'], '31250': ['광주시', 'Gwangju-si'],
  '31240': ['화성시', 'Hwaseong-si'], '29010': ['세종특별자치시', 'Sejong'],
  '37310': ['군위군', 'Gunwi-gun']
};

const features = src.features.map((f) => {
  const code = remap(f.properties.code);
  const [ko, en] = NAME_OVERRIDES[code] || [f.properties.name, f.properties.name_eng];
  return { ...f, properties: { code, province: provinceOf(code), ko, en } };
});

const W = 800, H = 1000;
const projection = geoMercator().fitExtent([[20, 20], [W - 20, H - 20]], { type: 'FeatureCollection', features });
const path = geoPath(projection);

const topo = topology({ m: { type: 'FeatureCollection', features } }, 1e5);
const geoms = topo.objects.m.geometries;
const group = (keyFn) => {
  const g = new Map();
  geoms.forEach((geom, i) => {
    const k = keyFn(features[i].properties);
    if (!g.has(k)) g.set(k, []);
    g.get(k).push(geom);
  });
  return g;
};

const r = (n) => Math.round(n * 10) / 10;
const compact = (d) => d.replace(/-?\d+\.\d+/g, (n) => String(r(+n)));
const shape = (geo) => {
  const [[x0, y0], [x1, y1]] = path.bounds(geo);
  const [cx, cy] = path.centroid(geo);
  return { d: compact(path(geo)), bbox: [r(x0), r(y0), r(x1 - x0), r(y1 - y0)], c: [r(cx), r(cy)] };
};

const municipalities = [];
for (const [code, gs] of group((p) => p.code)) {
  const p = features[geoms.indexOf(gs[0])].properties;
  municipalities.push({ code, province: p.province, ko: p.ko, en: p.en, ...shape(merge(topo, gs)) });
}
municipalities.sort((a, b) => a.code.localeCompare(b.code));

const provinces = [];
for (const [code, gs] of group((p) => p.province)) {
  provinces.push({ code, ko: PROVINCES[code][0], en: PROVINCES[code][1], ...shape(merge(topo, gs)) });
}
provinces.sort((a, b) => a.code.localeCompare(b.code));

const out = { width: W, height: H, source: 'KOSTAT 2013 via southkorea-maps (adjusted to current boundaries)', provinces, municipalities };
fs.writeFileSync(new URL('../www/data/korea-map.json', import.meta.url), JSON.stringify(out));
const counts = Object.fromEntries(provinces.map((p) => [p.en, municipalities.filter((m) => m.province === p.code).length]));
console.log('provinces', provinces.length, 'municipalities', municipalities.length, counts);
