-- One WireGuard identity must not roam between concurrent workers.
create or replace function public.admit_private_search(owner uuid)
returns uuid language plpgsql security definer set search_path=public as $$
declare result uuid;
begin
 perform pg_advisory_xact_lock(732019007);
 if exists(select 1 from search_runs where query='[Private voyage — content not saved]' and status='running' and created_at>now()-interval '6 minutes') then
  raise exception 'A private voyage is already running';
 end if;
 select public.admit_search(owner,'[Private voyage — content not saved]','','buy',null) into result;
 return result;
end $$;
revoke all on function public.admit_private_search(uuid) from public,anon,authenticated;
grant execute on function public.admit_private_search(uuid) to service_role;
