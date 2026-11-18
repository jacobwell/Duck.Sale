create table if not exists public.source_evidence (
 id uuid primary key default gen_random_uuid(),
 run_id uuid not null references public.search_runs(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 worker_id text not null, evidence jsonb not null,
 created_at timestamptz not null default now()
);
alter table public.source_evidence enable row level security;
create policy "Read own evidence" on public.source_evidence for select to authenticated using(auth.uid()=user_id);
