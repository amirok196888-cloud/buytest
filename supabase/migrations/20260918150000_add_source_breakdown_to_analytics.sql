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
    'sources', (
      with source_events as (
        select
          e.traffic_source as source,
          count(distinct e.session_id) filter (where e.event_type = 'page_view') as visits,
          count(distinct e.session_id) filter (where e.event_type = 'free_started') as free_starts,
          count(distinct e.session_id) filter (where e.event_type = 'free_completed') as free_completed
        from public.buytest_analytics_events e, bounds b
        where b.since_at is null or e.created_at >= b.since_at
        group by e.traffic_source
      ),
      source_orders as (
        select
          coalesce(nullif(o.traffic_source, ''), 'unknown') as source,
          count(*) as payments
        from public.buytest_orders o, bounds b
        where o.status = 'paid'
          and (b.since_at is null or coalesce(o.paid_at, o.updated_at, o.created_at) >= b.since_at)
        group by coalesce(nullif(o.traffic_source, ''), 'unknown')
      ),
      source_rows as (
        select
          coalesce(e.source, o.source) as source,
          coalesce(e.visits, 0) as visits,
          coalesce(e.free_starts, 0) as free_starts,
          coalesce(e.free_completed, 0) as free_completed,
          coalesce(o.payments, 0) as payments
        from source_events e
        full join source_orders o using (source)
      )
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'source', source,
            'visits', visits,
            'freeStarts', free_starts,
            'freeCompleted', free_completed,
            'payments', payments
          )
          order by visits desc, free_starts desc, payments desc, source
        ),
        '[]'::jsonb
      )
      from source_rows
    ),
    'trackingStartedAt', (
      select min(e.created_at) from public.buytest_analytics_events e
    ),
    'generatedAt', now()
  );
$$;

revoke all on function public.buytest_analytics_summary(text) from public, anon, authenticated;
grant execute on function public.buytest_analytics_summary(text) to service_role;
