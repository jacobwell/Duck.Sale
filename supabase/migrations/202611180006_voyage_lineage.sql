alter table public.search_runs
 add column if not exists parent_run_id uuid references public.search_runs(id) on delete set null,
 add column if not exists root_run_id uuid references public.search_runs(id) on delete set null,
 add column if not exists voyage_number integer not null default 1 check (voyage_number > 0),
 add column if not exists continuation_note text;

update public.search_runs set root_run_id=id where root_run_id is null;
create index if not exists search_runs_root_voyage on public.search_runs(user_id,root_run_id,voyage_number);

create or replace function public.admit_continuation(owner uuid, parent uuid, note text default null)
returns uuid language plpgsql security definer set search_path=public as $$
declare parent_run search_runs%rowtype; new_id uuid; root_id uuid;
begin
 perform pg_advisory_xact_lock(782491030);
 select * into parent_run from search_runs where id=parent and user_id=owner for update;
 if not found then raise exception 'Parent search not found'; end if;
 if parent_run.status='running' then raise exception 'This voyage is still running'; end if;
 if (select count(*) from search_runs where created_at>now()-interval '1 hour')>=30 then raise exception 'Fleet hourly capacity reached. Please try again later.'; end if;
 if (select count(*) from search_runs where user_id=owner and created_at>now()-interval '1 hour')>=5 then raise exception 'Five searches per hour. Please try again later.'; end if;
 if exists(select 1 from search_runs where user_id=owner and status='running' and created_at>now()-interval '6 minutes') then raise exception 'A search is already running. Open it from your search history.'; end if;
 update search_runs set status='failed',warning='The search exceeded its execution window. Sandbox TTL cleanup applies.' where user_id=owner and status='running' and created_at<now()-interval '6 minutes';
 root_id=coalesce(parent_run.root_run_id,parent_run.id);
 insert into search_runs(user_id,query,location,intent,budget,parent_run_id,root_run_id,voyage_number,continuation_note)
 values(owner,parent_run.query,parent_run.location,parent_run.intent,parent_run.budget,parent_run.id,root_id,parent_run.voyage_number+1,left(note,500)) returning id into new_id;
 return new_id;
end $$;
revoke all on function public.admit_continuation(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.admit_continuation(uuid,uuid,text) to service_role;
