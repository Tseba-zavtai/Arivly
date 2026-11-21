begin;
create table public.push_devices (
 token text primary key, user_id uuid not null references auth.users(id) on delete cascade,
 updated_at timestamptz not null default now()
);
alter table public.push_devices enable row level security;
revoke all on public.push_devices from public,anon,authenticated;
grant select,insert,update,delete on public.push_devices to service_role;

create function public.register_push_device(p_token text) returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'authentication_required'; end if;
 if p_token !~ '^(ExponentPushToken|ExpoPushToken)\[[^]]+\]$' or length(p_token)>256 then raise exception 'invalid_token'; end if;
 insert into public.push_devices(token,user_id) values(p_token,auth.uid())
 on conflict(token) do update set user_id=excluded.user_id,updated_at=now();
 -- Clear the legacy association when this device switches accounts.
 update public.users set expo_push_token=null where expo_push_token=p_token and id<>auth.uid();
 update public.users set expo_push_token=p_token where id=auth.uid();
end $$;
revoke all on function public.register_push_device(text) from public,anon,authenticated;
grant execute on function public.register_push_device(text) to authenticated,service_role;
create function public.unregister_push_device(p_token text) returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'authentication_required'; end if;
 delete from public.push_devices where token=p_token and user_id=auth.uid();
 update public.users set expo_push_token=null where id=auth.uid() and expo_push_token=p_token;
end $$;
revoke all on function public.unregister_push_device(text) from public,anon,authenticated;
grant execute on function public.unregister_push_device(text) to authenticated,service_role;

create table public.rental_push_queue (
 id uuid primary key default gen_random_uuid(), notification_id uuid not null references public.notifications(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade, token text not null,
 title text not null, body text not null, url text not null,
 state text not null default 'pending' check(state in ('pending','ticket','receipt_ok','dead','failed')),
 attempts integer not null default 0, ticket_id text, last_error text,
 next_attempt_at timestamptz not null default now(), leased_until timestamptz,
 created_at timestamptz not null default now(), unique(notification_id,token)
);
alter table public.rental_push_queue enable row level security;
revoke all on public.rental_push_queue from public,anon,authenticated;
grant select,insert,update,delete on public.rental_push_queue to service_role;
create index rental_push_queue_due on public.rental_push_queue(next_attempt_at) where state in ('pending','ticket');

create function public.enqueue_rental_push() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.type not in ('rental_request','rental_status') or new.related_id is null then return new; end if;
 if exists(select 1 from public.notifications n where n.id<>new.id and n.related_id=new.related_id and n.user_id=new.user_id and n.title=new.title and n.type=new.type and n.created_at<=new.created_at) then return new; end if;
 -- Only actual rental participants can receive these queued messages.
 if not exists(select 1 from public.rental_requests r where r.id=new.related_id and new.user_id in (r.owner_id,r.requester_id)) then return new; end if;
 insert into public.rental_push_queue(notification_id,user_id,token,title,body,url)
 select new.id,new.user_id,t.token,new.title,left(new.body,500),'/rental-requests?requestId='||new.related_id::text
 from (
 select token from public.push_devices where user_id=new.user_id
 union select expo_push_token from public.users where id=new.user_id and not exists(select 1 from public.push_devices where user_id=new.user_id)
 ) t where t.token ~ '^(ExponentPushToken|ExpoPushToken)\[[^]]+\]$' on conflict do nothing;
 -- Async wakeup runs after commit. Cron retries if the worker/network is unavailable.
 begin
 perform net.http_post(url:='https://wrekrjaitokrqydkwgtg.supabase.co/functions/v1/rental-push-worker',headers:='{"Content-Type":"application/json"}'::jsonb,body:='{}'::jsonb,timeout_milliseconds:=5000);
 exception when others then null; -- durable queue + cron remain; never fail a rental for HTTP wakeup
 end;
 return new;
end $$;
revoke all on function public.enqueue_rental_push() from public,anon,authenticated;
create trigger enqueue_rental_push after insert on public.notifications for each row execute function public.enqueue_rental_push();

create function public.notify_rental_status() returns trigger language plpgsql security definer set search_path='' as $$
declare recipient uuid; headline text;
begin
 if tg_op='INSERT' then
   if lower(new.status)<>'pending' or (coalesce(new.insurance_premium,0)>0 and new.insurance_status='not_requested') then return new; end if;
   insert into public.notifications(user_id,title,body,is_read,type,related_id)
   values(new.owner_id,'Шинэ түрээсийн хүсэлт','Таны зарыг түрээслэх хүсэлт ирлээ. Дэлгэрэнгүйг нээж шалгана уу.',false,'rental_request',new.id);
   return new;
 end if;
 if new.status is not distinct from old.status then return new; end if;
 if lower(new.status)='approved' then recipient:=new.requester_id; headline:='Түрээсийн хүсэлтийг зөвшөөрлөө';
 elsif lower(new.status)='rejected' then recipient:=new.requester_id; headline:='Түрээсийн хүсэлтийг татгалзлаа';
 elsif lower(new.status) in ('cancelled','canceled') then
   recipient:=case when auth.uid()=new.owner_id then new.requester_id else new.owner_id end; headline:='Түрээсийн хүсэлт цуцлагдлаа';
 elsif lower(new.status) in ('completed','returned') then recipient:=new.requester_id; headline:='Түрээс дууслаа';
 else return new; end if;
 insert into public.notifications(user_id,title,body,is_read,type,related_id)
 values(recipient,headline,'Хүсэлтийн дэлгэрэнгүйг нээж шалгана уу.',false,'rental_status',new.id);
 return new;
end $$;
revoke all on function public.notify_rental_status() from public,anon,authenticated;
create trigger notify_rental_status after insert or update of status on public.rental_requests for each row execute function public.notify_rental_status();

create function public.claim_rental_push() returns setof public.rental_push_queue language sql security definer set search_path='' as $$
 update public.rental_push_queue set leased_until=now()+interval '2 minutes',attempts=attempts+1
 where id in(select id from public.rental_push_queue where state in ('pending','ticket') and next_attempt_at<=now()
 and (leased_until is null or leased_until<now()) and attempts<8 and created_at>now()-interval '1 day'
 order by created_at limit 30 for update skip locked) returning *;
$$;
revoke all on function public.claim_rental_push() from public,anon,authenticated;
grant execute on function public.claim_rental_push() to service_role;
select cron.schedule('arivly-rental-push-retry','* * * * *',
 $$select net.http_post(url:='https://wrekrjaitokrqydkwgtg.supabase.co/functions/v1/rental-push-worker',headers:='{"Content-Type":"application/json"}'::jsonb,body:='{}'::jsonb,timeout_milliseconds:=5000);$$);
commit;
