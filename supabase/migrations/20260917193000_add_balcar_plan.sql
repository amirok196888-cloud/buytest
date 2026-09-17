alter table public.buytest_orders
  drop constraint if exists buytest_orders_amount_agorot_check;

alter table public.buytest_orders
  add constraint buytest_orders_amount_agorot_check
  check (amount_agorot = any (array[1500, 3900, 4900, 7900, 12000]));

alter table public.buytest_orders
  drop constraint if exists buytest_orders_plan_check;

alter table public.buytest_orders
  add constraint buytest_orders_plan_check
  check (plan = any (array['balcar', 'premium', 'report', 'consultation', 'prebuy', 'bundle']));

create or replace function public.buytest_analytics_summary(p_range text default 'all')
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  with bounds as (
    select case p_range
      when 'today' then date_trunc('day', now() at time zone 'Asia/Jerusalem') at time zone 'Asia/Jerusalem'
      when '7d' then now() - interval '7 days'
      when '30d' then now() - interval '30 days'
      else null::timestamptz
    end as since_at
  )
  select jsonb_build_object(
    'range', case when p_range in ('today', '7d', '30d', 'all') then p_range else 'all' end,
    'visits', (
      select count(distinct e.session_id)
      from public.buytest_analytics_events e, bounds b
      where e.event_type = 'page_view' and (b.since_at is null or e.created_at >= b.since_at)
    ),
    'freeStarts', (
      select count(distinct e.session_id)
      from public.buytest_analytics_events e, bounds b
      where e.event_type = 'free_started' and (b.since_at is null or e.created_at >= b.since_at)
    ),
    'freeCompleted', (
      select count(distinct e.session_id)
      from public.buytest_analytics_events e, bounds b
      where e.event_type = 'free_completed' and (b.since_at is null or e.created_at >= b.since_at)
    ),
    'consultationOpened', (
      select count(distinct e.session_id)
      from public.buytest_analytics_events e, bounds b
      where e.event_type = 'consultation_opened' and (b.since_at is null or e.created_at >= b.since_at)
    ),
    'paidEntries', (
      select count(*)
      from public.buytest_orders o, bounds b
      where o.status = 'paid'
        and (b.since_at is null or coalesce(o.paid_at, o.updated_at, o.created_at) >= b.since_at)
    ),
    'trackingStartedAt', (
      select min(e.created_at) from public.buytest_analytics_events e
    ),
    'generatedAt', now()
  );
$$;

revoke all on function public.buytest_analytics_summary(text) from public, anon, authenticated;
grant execute on function public.buytest_analytics_summary(text) to service_role;
