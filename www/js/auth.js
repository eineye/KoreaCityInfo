// Authentication.
// Test version (local backend): temporary IDs from config.js + accounts created on the sign-up screen (stored in this browser).
//   NOTE: client-side only — fine for a test build, NOT secure for production.
// Supabase backend: Supabase Auth (email + password). Admins are users whose app_metadata.role = 'admin'.
import { CONFIG } from './config.js';
import { store } from './store.js';

const SESSION_KEY = 'kci.session';
const SB_KEY = 'kci.sb.session';
const listeners = new Set();

async function hash(text) {
  if (crypto?.subtle) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('kci:' + text));
    return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
  }
  let h = 0; for (const ch of 'kci:' + text) h = (h * 31 + ch.charCodeAt(0)) | 0; return 'x' + h;
}

const read = (k) => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } };
const write = (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, JSON.stringify(v)); } catch {} };

async function sbAuth(path, body) {
  const res = await fetch(`${CONFIG.supabase.url.replace(/\/$/, '')}/auth/v1/${path}`, {
    method: 'POST', headers: { apikey: CONFIG.supabase.anonKey, 'Content-Type': 'application/json' }, body: JSON.stringify(body)
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error_description || json.msg || 'Login failed');
  return json;
}
const sbUser = (s) => ({
  username: s.user.email, name: s.user.user_metadata?.name || s.user.email,
  role: s.user.app_metadata?.role === 'admin' ? 'admin' : 'member'
});

export const auth = {
  user() { return read(SESSION_KEY); },
  isAdmin() { return this.user()?.role === 'admin'; },
  onChange(fn) { listeners.add(fn); },
  emit() { listeners.forEach((fn) => fn(this.user())); },

  async login(username, password) {
    let user = null;
    if (store.backend === 'supabase') {
      const s = await sbAuth('token?grant_type=password', { email: username, password });
      write(SB_KEY, s); user = sbUser(s);
    } else {
      const test = CONFIG.testAccounts.find((a) => a.username === username && a.password === password);
      if (test) user = { username: test.username, name: test.name, role: test.role };
      else {
        const h = await hash(password);
        const u = store.list('users', { all: true }).find((x) => x.username === username && x.passwordHash === h);
        if (u) user = { username: u.username, name: u.name, role: u.role || 'member' };
      }
      if (!user) throw new Error('loginFailed');
    }
    write(SESSION_KEY, user); this.emit(); return user;
  },

  async signup({ username, password, name }) {
    if (store.backend === 'supabase') {
      const s = await sbAuth('signup', { email: username, password, data: { name } });
      if (s.access_token) { write(SB_KEY, s); write(SESSION_KEY, sbUser(s)); this.emit(); }
      return;
    }
    const taken = CONFIG.testAccounts.some((a) => a.username === username) ||
      store.list('users', { all: true }).some((u) => u.username === username);
    if (taken) throw new Error('userExists');
    await store.put('users', { username, name, role: 'member', passwordHash: await hash(password), createdAt: new Date().toISOString() });
    await this.login(username, password);
  },

  logout() { write(SESSION_KEY, null); write(SB_KEY, null); this.emit(); }
};
