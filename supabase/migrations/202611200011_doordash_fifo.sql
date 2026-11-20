-- Global FIFO for every DoorDash CLI call, across all deployment instances.
create table public.doordash_queue (
 request_id uuid primary key,
 sequence bigint generated always as identity,
 expires_at timestamptz not null
);
create table public.doordash_slot (
 singleton boolean primary key default true check(singleton),
 lease_owner uuid, lease_until timestamptz not null default now(),
 next_allowed_at timestamptz not null default now()
);
insert into public.doordash_slot(singleton) values(true);
alter table public.doordash_queue enable row level security;
alter table public.doordash_slot enable row level security;
revoke all on public.doordash_queue,public.doordash_slot from public,anon,authenticated;
create or replace function public.doordash_permit(request_id uuid, release_permit boolean default false, cooldown_ms integer default 0)
returns jsonb language plpgsql security definer set search_path=public as $$
declare slot doordash_slot%rowtype; t timestamptz; first_id uuid; position integer;
begin
 if cooldown_ms<0 or cooldown_ms>60000 then raise exception 'Invalid cooldown'; end if;
 select * into slot from doordash_slot where singleton=true for update;
 t=clock_timestamp();
 delete from doordash_queue q where q.expires_at<=t;
 if release_permit then
  delete from doordash_queue q where q.request_id=doordash_permit.request_id;
  if slot.lease_owner=request_id then
   update doordash_slot set lease_owner=null,lease_until=t,
    next_allowed_at=greatest(next_allowed_at,t+make_interval(secs=>greatest(500,cooldown_ms)::double precision/1000)) where singleton=true;
  end if;
  return jsonb_build_object('granted',false,'position',0,'waitMs',0);
 end if;
 if slot.lease_owner=request_id and slot.lease_until>t then return jsonb_build_object('granted',true,'position',0,'waitMs',0); end if;
 if (select count(*) from doordash_queue)>100 then raise exception 'DoorDash queue full'; end if;
 insert into doordash_queue(request_id,expires_at) values(request_id,t+interval '20 seconds')
 on conflict on constraint doordash_queue_pkey do update set expires_at=excluded.expires_at;
 select q.request_id into first_id from doordash_queue q order by sequence limit 1;
 select count(*) into position from doordash_queue q where q.sequence<=(select q2.sequence from doordash_queue q2 where q2.request_id=doordash_permit.request_id);
 if first_id is distinct from request_id or greatest(slot.lease_until,slot.next_allowed_at)>t then
  return jsonb_build_object('granted',false,'position',position,'waitMs',1000);
 end if;
 delete from doordash_queue q where q.request_id=doordash_permit.request_id;
 update doordash_slot set lease_owner=request_id,lease_until=t+interval '20 seconds' where singleton=true;
 return jsonb_build_object('granted',true,'position',0,'waitMs',0);
end $$;
revoke all on function public.doordash_permit(uuid,boolean,integer) from public,anon,authenticated;
grant execute on function public.doordash_permit(uuid,boolean,integer) to service_role;
