alter table public.generations add column if not exists listing_id text;
create unique index if not exists one_listing_illustration on public.generations(run_id,listing_id) where kind='image' and status in ('pending','complete');
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('boatduck-illustrations','boatduck-illustrations',false,10485760,array['image/png','image/jpeg','image/webp']) on conflict(id) do nothing;
create policy "Read own illustrations" on storage.objects for select to authenticated using(bucket_id='boatduck-illustrations' and (storage.foldername(name))[1]=auth.uid()::text);
create or replace function public.admit_illustration(owner uuid, search_id uuid, item_id text, image_model text)
returns uuid language plpgsql security definer set search_path = public as $$
declare generation_id uuid;
begin
 perform pg_advisory_xact_lock(782491031);
 if not exists(select 1 from search_runs where id=search_id and user_id=owner) then raise exception 'Search not found'; end if;
 if (select count(*) from generations where user_id=owner and kind='image' and created_at>now()-interval '1 hour')>=6 then raise exception 'Six illustrations per hour. Please try again later.'; end if;
 if (select count(*) from generations where kind='image' and created_at>now()-interval '1 hour')>=40 then raise exception 'Illustration capacity reached. Please try again later.'; end if;
 update generations set status='failed',error='Image generation exceeded its execution window.' where run_id=search_id and listing_id=item_id and kind='image' and status='pending' and created_at<now()-interval '3 minutes';
 generation_id=gen_random_uuid();
 insert into generations(id,run_id,user_id,kind,model,listing_id)values(generation_id,search_id,owner,'image',image_model,item_id);
 return generation_id;
end $$;
revoke all on function public.admit_illustration(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.admit_illustration(uuid,uuid,text,text) to service_role;
create or replace function public.attach_illustration(owner uuid,search_id uuid,item_id text,storage_path text)
returns void language plpgsql security definer set search_path=public as $$
begin
 update search_runs set listings=(select jsonb_agg(case when item->>'id'=item_id then item||jsonb_build_object('imageUrl',null,'imageKind','generated','imageStoragePath',storage_path,'caveats',coalesce(item->'caveats','[]'::jsonb)||'["AI illustration: not a photo of this item; appearance and condition are not verified."]'::jsonb) else item end) from jsonb_array_elements(listings) item),updated_at=now() where id=search_id and user_id=owner;
 update saved_listings set listing=listing||jsonb_build_object('imageUrl',null,'imageKind','generated','imageStoragePath',storage_path,'caveats',coalesce(listing->'caveats','[]'::jsonb)||'["AI illustration: not a photo of this item; appearance and condition are not verified."]'::jsonb) where user_id=owner and listing_id=item_id;
end $$;
revoke all on function public.attach_illustration(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.attach_illustration(uuid,uuid,text,text) to service_role;
