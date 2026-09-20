create or replace function public.buytest_track_analytics_event(
  p_event_type text,
  p_visitor_id text,
  p_session_id text,
  p_vehicle_plate text default null,
  p_page_path text default '',
  p_page_title text default null,
  p_attribution jsonb default '{}'::jsonb
)
returns void
language sql
security invoker
set search_path = public
as $$
  insert into public.buytest_analytics_events (
    event_type, visitor_id, session_id, vehicle_plate, page_path, page_title,
    traffic_source, utm_source, utm_medium, utm_campaign
  ) values (
    p_event_type, p_visitor_id, p_session_id, p_vehicle_plate, p_page_path, p_page_title,
    coalesce(nullif(p_attribution->>'traffic_source', ''), 'unknown'),
    nullif(p_attribution->>'utm_source', ''),
    nullif(p_attribution->>'utm_medium', ''),
    nullif(p_attribution->>'utm_campaign', '')
  )
  on conflict (event_type, session_id, page_path)
  do update set
    visitor_id = excluded.visitor_id,
    vehicle_plate = coalesce(excluded.vehicle_plate, buytest_analytics_events.vehicle_plate),
    page_title = coalesce(excluded.page_title, buytest_analytics_events.page_title),
    traffic_source = excluded.traffic_source,
    utm_source = excluded.utm_source,
    utm_medium = excluded.utm_medium,
    utm_campaign = excluded.utm_campaign;
$$;

revoke all on function public.buytest_track_analytics_event(text,text,text,text,text,text,jsonb) from public, anon, authenticated;
grant execute on function public.buytest_track_analytics_event(text,text,text,text,text,text,jsonb) to service_role;

notify pgrst, 'reload schema';
