-- Scrapper AI: saved analyses per user (history).
-- Screenshots are not stored; users re-crawl a site to see them again.

create table if not exists public.analyses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  url text not null,
  host text not null,
  created_at timestamptz not null default now(),
  duration_s real,
  pages_count int,
  security_score int,
  seo_score int,
  favicon text,          -- small data URL of the site icon
  summary jsonb not null, -- colours, fonts, design tokens, SEO, security, performance
  ai jsonb,               -- suggestions + design.md
  site jsonb,             -- headers, SSL, robots, hosting
  pages jsonb not null    -- per-page data without screenshots
);

create index if not exists analyses_user_created_idx on public.analyses (user_id, created_at desc);

alter table public.analyses enable row level security;

create policy "Users read own analyses" on public.analyses
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users insert own analyses" on public.analyses
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users update own analyses" on public.analyses
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users delete own analyses" on public.analyses
  for delete to authenticated using ((select auth.uid()) = user_id);
