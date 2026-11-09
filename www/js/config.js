// Global configuration. Edit this file to switch from the test (local) backend to Supabase.
export const CONFIG = {
  appName: 'Korea City Info',

  // 'local'    : test version — everything is stored in the browser (localStorage), seeded from data/seed.json
  // 'supabase' : production — content is stored in a Supabase (free tier) project, see supabase/schema.sql
  backend: 'local',

  supabase: {
    url: '',      // e.g. 'https://xxxx.supabase.co'
    anonKey: ''   // public anon key (safe to expose; writes are protected by RLS)
  },

  // UI languages offered in the menu. Content fields are translated for CONTENT_LANGS, others fall back to English.
  languages: [
    { code: 'en', label: 'English' },
    { code: 'ko', label: '한국어' },
    { code: 'ja', label: '日本語' },
    { code: 'zh', label: '中文' }
  ],
  contentLanguages: ['en', 'ko'],
  defaultLanguage: 'en',

  // Temporary accounts for the test version (local backend only).
  // Replace with Supabase Auth / social login before going public.
  testAccounts: [
    { username: 'admin', password: 'admin1234', role: 'admin', name: 'Administrator' },
    { username: 'guest', password: 'guest1234', role: 'member', name: 'Guest' }
  ],

  // Set to false in the Android build if the admin screen should only be available on the web.
  showAdminInApp: true
};
