create table if not exists public.search_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  query text not null check (length(query) between 5 and 1000),
  location text not null default 'Anywhere', intent text not null default 'buy', budget numeric,
  status text not null default 'running' check (status in ('running','complete','partial','failed')),
  listings jsonb not null default '[]', workers jsonb not null default '[]', warning text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists search_runs_user_date on public.search_runs(user_id, created_at desc);
create table if not exists public.generations (
  id uuid primary key, run_id uuid not null references public.search_runs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null, model text not null, status text not null default 'pending',
  output jsonb, usage jsonb, estimated_cost_usd numeric, error text,
  created_at timestamptz not null default now()
);
create table if not exists public.saved_listings (
  user_id uuid not null references auth.users(id) on delete cascade,
  listing_id text not null, listing jsonb not null,
  created_at timestamptz not null default now(), primary key(user_id,listing_id)
);
alter table public.search_runs enable row level security;
alter table public.generations enable row level security;
alter table public.saved_listings enable row level security;
create policy "Read own searches" on public.search_runs for select to authenticated using (auth.uid()=user_id);
create policy "Read own generations" on public.generations for select to authenticated using (auth.uid()=user_id);
create policy "Read own saved listings" on public.saved_listings for select to authenticated using (auth.uid()=user_id);
create policy "Save own listings" on public.saved_listings for insert to authenticated with check (auth.uid()=user_id);
create policy "Update own saved listings" on public.saved_listings for update to authenticated using (auth.uid()=user_id) with check (auth.uid()=user_id);
create policy "Remove own saved listings" on public.saved_listings for delete to authenticated using (auth.uid()=user_id);
-- Only the verified server can admit billable work. Transactional lock enforces
-- limits across concurrent requests and Vercel instances, not just one process.
create or replace function public.admit_search(owner uuid, search_query text, search_location text, search_intent text, search_budget numeric)
returns uuid language plpgsql security definer set search_path = public as $$
declare run_id uuid;
begin
  perform pg_advisory_xact_lock(782491030);
  if (select count(*) from search_runs where created_at > now()-interval '1 hour') >= 30 then
    raise exception 'Fleet hourly capacity reached. Please try again later.';
  end if;
  if (select count(*) from search_runs where user_id=owner and created_at > now()-interval '1 hour') >= 5 then
    raise exception 'Five searches per hour. Please try again later.';
  end if;
  if exists(select 1 from search_runs where user_id=owner and status='running' and created_at > now()-interval '6 minutes') then
    raise exception 'A search is already running. Open it from your search history.';
  end if;
  update search_runs set status='failed',warning='The search exceeded its execution window. Sandbox TTL cleanup applies.' where user_id=owner and status='running' and created_at < now()-interval '6 minutes';
  insert into search_runs(user_id,query,location,intent,budget) values(owner,search_query,search_location,search_intent,search_budget) returning id into run_id;
  return run_id;
end $$;
revoke all on function public.admit_search(uuid,text,text,text,numeric) from public,anon,authenticated;
grant execute on function public.admit_search(uuid,text,text,text,numeric) to service_role;
