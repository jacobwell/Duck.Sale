-- Metadata only. DoorDash account data, queries and locations are not persisted.
create table public.food_requests (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 created_at timestamptz not null default now(),
 finished_at timestamptz
);
create index food_requests_created on public.food_requests(created_at);
alter table public.food_requests enable row level security;
revoke all on public.food_requests from public,anon,authenticated;
create or replace function public.admit_food_search(owner uuid)
returns uuid language plpgsql security definer set search_path=public as $$
declare request_id uuid;
begin
 perform pg_advisory_xact_lock(782491034);
 if (select count(*) from food_requests where created_at>now()-interval '1 hour')>=60
 or (select count(*) from food_requests where user_id=owner and created_at>now()-interval '1 hour')>=10 then
  raise exception 'Food search hourly limit reached. Try again later.';
 end if;
 if (select count(*) from food_requests where finished_at is null and created_at>now()-interval '90 seconds')>=3
 or exists(select 1 from food_requests where user_id=owner and finished_at is null and created_at>now()-interval '90 seconds') then
  raise exception 'Food search is busy. Please wait a moment.';
 end if;
 insert into food_requests(user_id) values(owner) returning id into request_id;
 return request_id;
end $$;
revoke all on function public.admit_food_search(uuid) from public,anon,authenticated;
grant execute on function public.admit_food_search(uuid) to service_role;
