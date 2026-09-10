alter table public.buytest_analytics_events
  add column if not exists vehicle_plate text;

alter table public.buytest_analytics_events
  drop constraint if exists buytest_analytics_events_vehicle_plate_check;

alter table public.buytest_analytics_events
  add constraint buytest_analytics_events_vehicle_plate_check
  check (vehicle_plate is null or vehicle_plate ~ '^\d{7,8}$');
