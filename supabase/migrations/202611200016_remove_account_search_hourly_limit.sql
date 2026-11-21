-- Remove only the per-account five-search quota. Keep fleet capacity,
-- active-search serialization, stale-run recovery, privileges and RLS.
do $$
declare function_name regprocedure; definition text; updated text;
begin
  foreach function_name in array array[
    'public.admit_search(uuid,text,text,text,numeric)'::regprocedure,
    'public.admit_continuation(uuid,uuid,text)'::regprocedure
  ] loop
    select pg_get_functiondef(function_name) into definition;
    updated := regexp_replace(definition,
      $pattern$if \(select count\(\*\) from search_runs where user_id=owner and created_at\s*>\s*now\(\)-interval '1 hour'\)\s*>=\s*5 then\s*raise exception 'Five searches per hour\. Please try again later\.';\s*end if;$pattern$,
      '');
    if updated = definition then
      raise exception 'Expected account search quota was not found in %', function_name;
    end if;
    execute updated;
  end loop;
end $$;
