alter table public.buytest_analytics_events
  drop constraint if exists buytest_analytics_events_event_type_check;

alter table public.buytest_analytics_events
  add constraint buytest_analytics_events_event_type_check
  check (event_type in (
    'page_view',
    'free_started',
    'free_completed',
    'consultation_opened',
    'click_landing_consultation',
    'click_landing_free',
    'click_landing_report',
    'click_vehicle_lookup',
    'click_copy_questions',
    'click_free_next',
    'click_license_next',
    'click_external_next',
    'click_self_next',
    'click_free_summary',
    'click_pdf',
    'click_balcar',
    'click_balcar_pdf',
    'click_report_plan',
    'click_report_upload',
    'click_analyze',
    'click_report_pdf',
    'click_prebuy_whatsapp',
    'click_consultation_plan',
    'click_post_report_whatsapp'
  ));

create or replace function public.buytest_analytics_click_summary(p_range text default 'all')
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
  ),
  click_rows as (
    select
      e.traffic_source as source,
      e.event_type,
      nullif(e.utm_source, '') as utm_source,
      nullif(e.utm_medium, '') as utm_medium,
      nullif(e.utm_campaign, '') as utm_campaign,
      count(distinct e.session_id) as clicks
    from public.buytest_analytics_events e, bounds b
    where e.event_type like 'click_%'
      and (b.since_at is null or e.created_at >= b.since_at)
    group by e.traffic_source, e.event_type, e.utm_source, e.utm_medium, e.utm_campaign
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'source', source,
        'eventType', event_type,
        'clicks', clicks,
        'utmSource', utm_source,
        'utmMedium', utm_medium,
        'utmCampaign', utm_campaign
      )
      order by clicks desc, source, event_type
    ),
    '[]'::jsonb
  )
  from click_rows;
$$;

revoke all on function public.buytest_analytics_click_summary(text) from public, anon, authenticated;
grant execute on function public.buytest_analytics_click_summary(text) to service_role;
