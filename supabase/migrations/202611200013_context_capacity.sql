-- Bounded, operator-controlled pool capacity. Keep cooldown and FIFO behavior.
-- Six slots leave headroom relative to the Developer plan configuration recorded
-- during setup; retain 429 backoff and lower this value if the provider throttles.
alter table public.provider_throttle add column max_in_flight integer not null default 3 check(max_in_flight between 1 and 10);
update public.provider_throttle set max_in_flight=6 where provider='context';
create or replace function public.context_permit(search_id uuid, request_owner text, release_permit boolean default false, cooldown_ms integer default 0)
returns jsonb language plpgsql security definer set search_path=public as $$
declare slot provider_throttle%rowtype; current_time_at timestamptz; wait_ms integer;
 active_count integer; queue_position bigint; released_count integer;
begin
 if request_owner is null or length(request_owner)=0 or length(request_owner)>150
  or cooldown_ms is null or cooldown_ms<0 or cooldown_ms>86400000 then raise exception 'Invalid permit'; end if;
 select * into slot from provider_throttle where provider='context' for update;
 if not found then raise exception 'Context queue unavailable'; end if;
 current_time_at=clock_timestamp();
 if release_permit then
  delete from context_leases l where l.request_owner=context_permit.request_owner;
  get diagnostics released_count = row_count;
  -- Only an actual lease holder may extend the provider-wide cooldown.
  if released_count>0 and cooldown_ms>0 then
   update provider_throttle set next_allowed_at=greatest(next_allowed_at,
    current_time_at+make_interval(secs=>cooldown_ms::double precision/1000)) where provider='context';
  end if;
  return jsonb_build_object('granted',false,'waitMs',0);
 end if;
 if not exists(select 1 from search_runs where id=search_id and status='running') then raise exception 'Search is no longer running'; end if;
 delete from context_leases l where l.lease_until<=current_time_at;
 -- An acquisition retry must not consume another slot or extend its lease.
 if exists(select 1 from context_leases l where l.request_owner=context_permit.request_owner) then
  return jsonb_build_object('granted',true,'waitMs',0);
 end if;
 delete from context_waiters w where w.expires_at<=current_time_at
  or not exists(select 1 from search_runs r where r.id=w.search_id and r.status='running');
 insert into context_waiters(request_owner,search_id,queued_at,expires_at)
  values(request_owner,search_id,current_time_at,current_time_at+interval '20 seconds')
  on conflict on constraint context_waiters_pkey do update set expires_at=excluded.expires_at;
 wait_ms=ceil(greatest(0,extract(epoch from (slot.next_allowed_at-current_time_at))*1000));
 if wait_ms>0 then return jsonb_build_object('granted',false,'waitMs',wait_ms); end if;
 select count(*) into active_count from context_leases;
 select q.position into queue_position from (
  select w.request_owner,row_number() over(order by w.queued_at,w.request_owner) as position from context_waiters w
 ) q where q.request_owner=context_permit.request_owner;
 -- Reserve available slots for the oldest waiters even if a newcomer polls first.
 if active_count>=slot.max_in_flight or queue_position>slot.max_in_flight-active_count then
  return jsonb_build_object('granted',false,'waitMs',1000);
 end if;
 delete from context_waiters w where w.request_owner=context_permit.request_owner;
 insert into context_leases(request_owner,lease_until) values(request_owner,current_time_at+interval '55 seconds');
 return jsonb_build_object('granted',true,'waitMs',0);
end $$;
revoke all on function public.context_permit(uuid,text,boolean,integer) from public,anon,authenticated;
grant execute on function public.context_permit(uuid,text,boolean,integer) to service_role;
