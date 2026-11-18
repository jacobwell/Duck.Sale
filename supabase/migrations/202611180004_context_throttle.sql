-- One Context request at a time across all Boatduck runs and Vercel instances.
create table if not exists public.provider_throttle (
 provider text primary key,
 lease_owner text,
 lease_until timestamptz not null default '-infinity',
 next_allowed_at timestamptz not null default '-infinity'
);
alter table public.provider_throttle enable row level security;
insert into public.provider_throttle(provider) values('context') on conflict do nothing;
create or replace function public.context_permit(search_id uuid, request_owner text, release_permit boolean default false, cooldown_ms integer default 0)
returns jsonb language plpgsql security definer set search_path=public as $$
declare slot provider_throttle%rowtype; current_time_at timestamptz; wait_ms integer;
begin
 if length(request_owner)>150 or cooldown_ms<0 or cooldown_ms>86400000 then raise exception 'Invalid permit'; end if;
 select * into slot from provider_throttle where provider='context' for update;
 current_time_at=clock_timestamp();
 if release_permit then
  if slot.lease_owner=request_owner then
   update provider_throttle set lease_owner=null,lease_until=current_time_at,
    next_allowed_at=greatest(next_allowed_at,current_time_at+make_interval(secs=>greatest(4000,cooldown_ms)::double precision/1000))
    where provider='context';
  end if;
  return jsonb_build_object('granted',false,'waitMs',0);
 end if;
 if not exists(select 1 from search_runs where id=search_id and status='running') then raise exception 'Search is no longer running'; end if;
 if slot.lease_owner=request_owner and slot.lease_until>current_time_at then
  return jsonb_build_object('granted',true,'waitMs',0);
 end if;
 wait_ms=ceil(greatest(0,extract(epoch from (greatest(slot.lease_until,slot.next_allowed_at)-current_time_at))*1000));
 if wait_ms>0 then return jsonb_build_object('granted',false,'waitMs',wait_ms); end if;
 -- Crashed workers release automatically; requests have a shorter 42s timeout.
 update provider_throttle set lease_owner=request_owner,lease_until=current_time_at+interval '55 seconds' where provider='context';
 return jsonb_build_object('granted',true,'waitMs',0);
end $$;
revoke all on function public.context_permit(uuid,text,boolean,integer) from public,anon,authenticated;
grant execute on function public.context_permit(uuid,text,boolean,integer) to service_role;
