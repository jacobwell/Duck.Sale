-- Private query preparation stores account/timing metadata only, never content.
create table public.private_preparations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  finished_at timestamptz
);
create index private_preparations_user_date on public.private_preparations(user_id, created_at desc);
alter table public.private_preparations enable row level security;
revoke all on public.private_preparations from anon,authenticated;
grant all on public.private_preparations to service_role;
create function public.admit_private_preparation(owner uuid)
returns uuid language plpgsql security definer set search_path=public as $$
declare result uuid;
begin
 perform pg_advisory_xact_lock(732020008);
 if (select count(*) from private_preparations where created_at>now()-interval '1 hour')>=30 then
  raise exception 'Preparation capacity reached';
 end if;
 if (select count(*) from private_preparations where user_id=owner and created_at>now()-interval '1 hour')>=5 then
  raise exception 'Preparation hourly limit reached';
 end if;
 if exists(select 1 from private_preparations where user_id=owner and finished_at is null and created_at>now()-interval '2 minutes') then
  raise exception 'Preparation already running';
 end if;
 insert into private_preparations(user_id) values(owner) returning id into result;
 return result;
end $$;
revoke all on function public.admit_private_preparation(uuid) from public,anon,authenticated;
grant execute on function public.admit_private_preparation(uuid) to service_role;
