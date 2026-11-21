-- Scrapper AI: saved analyses per user (history) + private screenshot storage.

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
  summary jsonb not null,
  ai jsonb,
  site jsonb,
  pages jsonb not null,
  thumbnail_path text
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

-- Private bucket; each user can only touch files in the folder named after their user id.
insert into storage.buckets (id, name, public)
values ('screenshots', 'screenshots', false)
on conflict (id) do nothing;

create policy "Users read own screenshots" on storage.objects
  for select to authenticated using (bucket_id = 'screenshots' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Users upload own screenshots" on storage.objects
  for insert to authenticated with check (bucket_id = 'screenshots' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Users delete own screenshots" on storage.objects
  for delete to authenticated using (bucket_id = 'screenshots' and (storage.foldername(name))[1] = (select auth.uid())::text);
