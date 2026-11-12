begin;

-- Public home page gets only milestone floors. Below 100 members it gets no data.
create or replace function public.get_web_home_milestones()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  members bigint;
  listings bigint;
  rentals bigint;
begin
  select count(*) into members
  from public.users u
  join auth.users a on a.id = u.id
  where u.is_super_admin is not true;

  if members < 100 then
    return null;
  end if;

  select count(*) into listings
  from public.jobs j
  where j.is_active is true and j.deleted_at is null
    and j.listing_expires_at > now() and j.post_type = 'job';

  select count(*) into rentals
  from public.rental_requests r
  where r.status = 'completed';

  return (
    select jsonb_object_agg(metric, amount / step * step)
    from (values ('members', members), ('listings', listings), ('rentals', rentals)) as totals(metric, amount)
    cross join lateral (select case
      when amount >= 1000 then 1000
      when amount >= 100 then 100
      else 10
    end as step) as bucket
    where amount >= 10
  );
end;
$$;

revoke all on function public.get_web_home_milestones() from public, anon, authenticated;
grant execute on function public.get_web_home_milestones() to anon, authenticated;

commit;
