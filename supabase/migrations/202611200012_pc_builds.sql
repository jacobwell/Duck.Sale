create table public.pc_builds (
 id uuid primary key references public.search_runs(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 payload jsonb not null,
 updated_at timestamptz not null default now()
);
alter table public.pc_builds enable row level security;
create policy "Read own PC builds" on public.pc_builds for select to authenticated using(auth.uid()=user_id);
revoke all on public.pc_builds from public,anon,authenticated;
grant select on public.pc_builds to authenticated;
