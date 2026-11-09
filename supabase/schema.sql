-- Korea City Info — Supabase (free tier) schema
-- Run in Supabase Dashboard → SQL Editor, then set backend: 'supabase' + url/anonKey in www/js/config.js.

create table if not exists public.content (
  collection  text        not null,          -- regions | homeBanners | mayors | festivals | investments | social | settings
  id          text        not null,
  data        jsonb       not null default '{}'::jsonb,
  updated_at  timestamptz not null default now(),
  primary key (collection, id)
);

alter table public.content enable row level security;

-- Everyone (including anonymous app users) can read content
drop policy if exists "content read" on public.content;
create policy "content read" on public.content for select using (true);

-- Only administrators can write. An administrator is a Supabase Auth user whose app_metadata.role = 'admin'.
drop policy if exists "content admin write" on public.content;
create policy "content admin write" on public.content for all
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- Make a user an administrator (sign up in the app first, then run):
-- update auth.users set raw_app_meta_data = raw_app_meta_data || '{"role":"admin"}' where email = 'you@example.com';
