alter table public.buytest_analytics_events
  add column if not exists page_path text not null default '',
  add column if not exists page_title text;

alter table public.buytest_analytics_events
  drop constraint if exists buytest_analytics_events_event_type_check;

alter table public.buytest_analytics_events
  add constraint buytest_analytics_events_event_type_check
  check (event_type in (
    'page_view', 'blog_view', 'blog_to_site',
    'free_started', 'free_completed', 'consultation_opened',
    'click_landing_consultation', 'click_landing_free', 'click_landing_report',
    'click_vehicle_lookup', 'click_copy_questions', 'click_free_next',
    'click_license_next', 'click_external_next', 'click_self_next',
    'click_free_summary', 'click_pdf', 'click_balcar', 'click_balcar_pdf',
    'click_report_plan', 'click_report_upload', 'click_analyze', 'click_report_pdf',
    'click_prebuy_whatsapp', 'click_consultation_plan', 'click_post_report_whatsapp'
  ));

drop index if exists public.buytest_analytics_events_type_session_uidx;
create unique index buytest_analytics_events_type_session_path_uidx
  on public.buytest_analytics_events (event_type, session_id, page_path);

create index if not exists buytest_analytics_events_blog_path_idx
  on public.buytest_analytics_events (page_path, created_at desc)
  where event_type in ('blog_view', 'blog_to_site');

create or replace function public.buytest_blog_analytics_summary(p_range text default 'all')
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
  ), filtered as (
    select e.*
    from public.buytest_analytics_events e, bounds b
    where e.event_type in ('blog_view', 'blog_to_site')
      and (b.since_at is null or e.created_at >= b.since_at)
  )
  select jsonb_build_object(
    'views', count(distinct session_id) filter (where event_type = 'blog_view'),
    'toSite', count(distinct session_id) filter (where event_type = 'blog_to_site'),
    'articles', coalesce((
      select jsonb_agg(jsonb_build_object(
        'path', rows.page_path,
        'title', rows.page_title,
        'views', rows.views,
        'toSite', rows.to_site
      ) order by rows.views desc, rows.page_path)
      from (
        select page_path, max(page_title) as page_title,
          count(distinct session_id) filter (where event_type = 'blog_view') as views,
          count(distinct session_id) filter (where event_type = 'blog_to_site') as to_site
        from filtered
        where page_path <> '/articles/'
        group by page_path
      ) rows
    ), '[]'::jsonb),
    'sources', coalesce((
      select jsonb_agg(jsonb_build_object(
        'source', rows.traffic_source,
        'views', rows.views,
        'toSite', rows.to_site
      ) order by rows.views desc, rows.traffic_source)
      from (
        select traffic_source,
          count(distinct session_id) filter (where event_type = 'blog_view') as views,
          count(distinct session_id) filter (where event_type = 'blog_to_site') as to_site
        from filtered
        group by traffic_source
      ) rows
    ), '[]'::jsonb)
  )
  from filtered;
$$;

revoke all on function public.buytest_blog_analytics_summary(text) from public, anon, authenticated;
grant execute on function public.buytest_blog_analytics_summary(text) to service_role;
