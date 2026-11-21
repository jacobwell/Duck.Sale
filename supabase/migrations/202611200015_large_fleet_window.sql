-- Large searches have a ten-minute server budget. Do not expire them at six minutes.
-- Preserve the existing admission checks, grants and security-definer definitions.
do $$
declare function_name regprocedure; definition text;
begin
  foreach function_name in array array[
    'public.admit_search(uuid,text,text,text,numeric)'::regprocedure,
    'public.admit_continuation(uuid,uuid,text)'::regprocedure
  ] loop
    select pg_get_functiondef(function_name) into definition;
    execute replace(definition, 'interval ''6 minutes''', 'interval ''12 minutes''');
  end loop;
end $$;
