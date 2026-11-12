-- Homepage CMS: public published content, private drafts, administrator-only writes.
create table public.web_home_pages (
 state text primary key check (state in ('draft','published')),
 content jsonb not null default '{}'::jsonb check (jsonb_typeof(content)='object' and octet_length(content::text)<=200000),
 revision integer not null default 0 check (revision>=0),
 updated_at timestamptz not null default now(),
 updated_by uuid references auth.users(id) on delete set null
);
alter table public.web_home_pages enable row level security;
revoke all on public.web_home_pages from public,anon,authenticated;
grant select(state,content,revision,updated_at) on public.web_home_pages to anon,authenticated;
grant select,insert,update on public.web_home_pages to service_role;
create policy "Read published homepage or admin drafts" on public.web_home_pages for select to anon,authenticated
 using (state='published' or public.is_super_admin());
insert into public.web_home_pages(state) values ('draft'),('published');

create or replace function public.save_web_home_draft(p_content jsonb,p_expected_revision integer)
returns integer language plpgsql security definer set search_path='' as $$
declare current_revision integer;
begin
 if auth.uid() is null or not public.is_super_admin() then raise exception 'ADMIN_REQUIRED' using errcode='42501'; end if;
 if p_content is null or jsonb_typeof(p_content)<>'object' or p_content->>'schemaVersion' is distinct from '1'
  or jsonb_typeof(p_content->'sections') is distinct from 'array' then raise exception 'INVALID_CONTENT'; end if;
 if jsonb_array_length(p_content->'sections')>40 or octet_length(p_content::text)>200000 then raise exception 'INVALID_CONTENT'; end if;
 select revision into current_revision from public.web_home_pages where state='draft' for update;
 if p_expected_revision is distinct from current_revision then raise exception 'CONTENT_CONFLICT'; end if;
 update public.web_home_pages set content=p_content,revision=revision+1,updated_at=now(),updated_by=auth.uid() where state='draft' returning revision into current_revision;
 return current_revision;
end $$;
revoke all on function public.save_web_home_draft(jsonb,integer) from public,anon,authenticated;
grant execute on function public.save_web_home_draft(jsonb,integer) to authenticated;

create or replace function public.publish_web_home_draft(p_expected_revision integer)
returns void language plpgsql security definer set search_path='' as $$
declare draft public.web_home_pages%rowtype;
begin
 if auth.uid() is null or not public.is_super_admin() then raise exception 'ADMIN_REQUIRED' using errcode='42501'; end if;
 select * into draft from public.web_home_pages where state='draft' for update;
 if p_expected_revision is distinct from draft.revision then raise exception 'CONTENT_CONFLICT'; end if;
 update public.web_home_pages set content=draft.content,revision=revision+1,updated_at=now(),updated_by=auth.uid() where state='published';
end $$;
revoke all on function public.publish_web_home_draft(integer) from public,anon,authenticated;
grant execute on function public.publish_web_home_draft(integer) to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('web-content','web-content',true,5242880,array['image/jpeg','image/png','image/webp']);
create policy "Homepage images public read" on storage.objects for select to anon,authenticated using(bucket_id='web-content');
create policy "Admin upload homepage images" on storage.objects for insert to authenticated
 with check(bucket_id='web-content' and public.is_super_admin() and (storage.foldername(name))[1]=auth.uid()::text);
-- Objects use unique names. No client UPDATE or DELETE permission is needed.
