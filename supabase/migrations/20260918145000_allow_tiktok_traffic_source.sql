alter table public.buytest_analytics_events
  drop constraint if exists buytest_analytics_events_traffic_source_check;

alter table public.buytest_analytics_events
  add constraint buytest_analytics_events_traffic_source_check
  check (traffic_source in ('google', 'meta', 'tiktok', 'direct', 'other', 'unknown'));
