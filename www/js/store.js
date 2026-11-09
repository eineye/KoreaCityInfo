// Data layer. All content is kept in an in-memory cache (it is small) and persisted through an adapter:
//   LocalAdapter    — test version, browser localStorage, seeded from data/seed.json
//   SupabaseAdapter — free-tier Supabase project, table `content` (see supabase/schema.sql)
import { CONFIG } from './config.js';

export const COLLECTIONS = ['regions', 'mayors', 'festivals', 'investments', 'social', 'settings', 'users'];
const LS_KEY = 'kci.data.v1';

let cache = {};
let adapter;

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const clone = (o) => JSON.parse(JSON.stringify(o));

async function loadSeed() {
  const res = await fetch('data/seed.json', { cache: 'no-cache' });
  const seed = await res.json();
  const out = {};
  for (const c of COLLECTIONS) out[c] = seed[c] || [];
  return out;
}

class LocalAdapter {
  async loadAll() {
    let data = null;
    try { data = JSON.parse(localStorage.getItem(LS_KEY)); } catch {}
    if (!data) { data = await loadSeed(); this.persist(data); }
    for (const c of COLLECTIONS) data[c] ||= [];
    return data;
  }
  persist(data) {
    try { localStorage.setItem(LS_KEY, JSON.stringify(data)); }
    catch (e) { alert('Storage is full. Use smaller images or switch to Supabase.'); throw e; }
  }
  async put() { this.persist(cache); }
  async remove() { this.persist(cache); }
  async replaceAll(data) { this.persist(data); }
}

class SupabaseAdapter {
  constructor({ url, anonKey }) { this.url = url.replace(/\/$/, ''); this.key = anonKey; }
  headers(extra = {}) {
    let token = this.key;
    try { token = JSON.parse(localStorage.getItem('kci.sb.session'))?.access_token || this.key; } catch {}
    return { apikey: this.key, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...extra };
  }
  async req(path, opts = {}) {
    const res = await fetch(`${this.url}/rest/v1/${path}`, { ...opts, headers: this.headers(opts.headers) });
    if (!res.ok) throw new Error(`Supabase ${res.status}: ${await res.text()}`);
    return res.status === 204 ? null : res.json().catch(() => null);
  }
  async loadAll() {
    const rows = await this.req('content?select=collection,id,data&limit=10000');
    const data = Object.fromEntries(COLLECTIONS.map((c) => [c, []]));
    for (const r of rows) (data[r.collection] ||= []).push({ ...r.data, id: r.id });
    if (!rows.length) Object.assign(data, await loadSeed()); // empty project: show defaults (admin can "Reset" to write them)
    return data;
  }
  async put(col, item) {
    await this.req('content', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({ collection: col, id: item.id, data: item, updated_at: new Date().toISOString() })
    });
  }
  async remove(col, id) {
    await this.req(`content?collection=eq.${encodeURIComponent(col)}&id=eq.${encodeURIComponent(id)}`, { method: 'DELETE' });
  }
  async replaceAll(data) {
    for (const c of COLLECTIONS) {
      if (c === 'users') continue;
      await this.req(`content?collection=eq.${c}`, { method: 'DELETE' });
      const rows = data[c].map((item) => ({ collection: c, id: item.id, data: item, updated_at: new Date().toISOString() }));
      if (rows.length) await this.req('content', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(rows) });
    }
  }
}

export const store = {
  get backend() { return CONFIG.backend === 'supabase' && CONFIG.supabase.url ? 'supabase' : 'local'; },

  async init() {
    adapter = this.backend === 'supabase' ? new SupabaseAdapter(CONFIG.supabase) : new LocalAdapter();
    cache = await adapter.loadAll();
  },

  list(col, { all = false } = {}) {
    return (cache[col] || [])
      .filter((i) => all || i.active !== false)
      .sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
  },
  get(col, id) { return (cache[col] || []).find((i) => i.id === id) || null; },
  settings() { return this.get('settings', 'site') || { id: 'site' }; },

  async put(col, item) {
    item = clone(item);
    item.id ||= uid();
    const arr = (cache[col] ||= []);
    const i = arr.findIndex((x) => x.id === item.id);
    if (i >= 0) arr[i] = item; else arr.push(item);
    await adapter.put(col, item);
    return item;
  },
  async remove(col, id) {
    cache[col] = (cache[col] || []).filter((x) => x.id !== id);
    await adapter.remove(col, id);
  },

  exportAll() { const d = clone(cache); delete d.users; return d; },
  async importAll(data) {
    const next = {};
    for (const c of COLLECTIONS) next[c] = Array.isArray(data[c]) ? data[c] : c === 'users' ? cache.users || [] : [];
    await adapter.replaceAll(next);
    cache = next;
  },
  async reset() {
    const seed = await loadSeed();
    seed.users = cache.users || [];
    await adapter.replaceAll(seed);
    cache = seed;
  }
};
