begin;
-- Preserve all existing event types while accepting the new free-flow events.
do $$
declare previous text;
begin
 select pg_get_constraintdef(oid) into previous from pg_constraint
 where conrelid='public.buytest_analytics_events'::regclass and conname='buytest_analytics_events_event_type_check';
 if previous not like '%free_flow_opened%' then
  execute 'alter table public.buytest_analytics_events drop constraint buytest_analytics_events_event_type_check';
  execute 'alter table public.buytest_analytics_events add constraint buytest_analytics_events_event_type_check check (' || substr(previous,8,length(previous)-8) || ' or event_type in (''free_flow_opened'',''free_plate_started'',''free_lookup_submitted'',''free_lookup_loaded'',''free_questions_opened'',''free_license_opened'',''free_flow_completed'',''free_lookup_failed'',''free_lookup_empty''))';
 end if;
end $$;
create or replace function public.buytest_free_funnel_summary(p_range text default 'all')
returns jsonb language sql stable security invoker set search_path=public as $$
with stages(ord,event_type) as (values
 (1,'free_flow_opened'),(2,'free_plate_started'),(3,'free_lookup_submitted'),(4,'free_lookup_loaded'),
 (5,'free_questions_opened'),(6,'free_license_opened')),
bounds as (select case p_range
 when 'today' then date_trunc('day',now() at time zone 'Asia/Jerusalem') at time zone 'Asia/Jerusalem'
 when '7d' then now()-interval '7 days' when '30d' then now()-interval '30 days' else null::timestamptz end since_at),
cohort as (select distinct e.session_id from buytest_analytics_events e,bounds b
 where e.event_type='free_flow_opened' and e.page_path='/free-funnel/v1' and (b.since_at is null or e.created_at>=b.since_at)),
activity as (select e.* from buytest_analytics_events e join cohort c using(session_id)),
progress as (select a.session_id,max(s.ord) last_stage,max(a.created_at) last_at,
 bool_or(a.event_type='free_lookup_empty') had_empty,bool_or(a.event_type='free_lookup_failed') had_failure
 from activity a left join stages s on s.event_type=a.event_type and a.page_path='/free-funnel/v1' group by a.session_id),
counts as (select s.ord,s.event_type,
 (select count(distinct a.session_id) from activity a where a.event_type=s.event_type and a.page_path='/free-funnel/v1') reached,
 (select count(*) from progress p where p.last_stage=s.ord) last_count from stages s)
select jsonb_build_object(
 'total',(select count(*) from cohort),
 'completed',(select count(*) from progress where last_stage=6),
 'idleIncomplete',(select count(*) from progress where last_stage<6 and last_at<now()-interval '30 minutes'),
 'failed',(select count(*) from progress where had_failure),
 'empty',(select count(*) from progress where had_empty),
 'trackingStartedAt',(select min(created_at) from buytest_analytics_events where event_type='free_flow_opened' and page_path='/free-funnel/v1'),
 'stages',(select jsonb_agg(jsonb_build_object('eventType',event_type,'reached',reached,'last',last_count) order by ord) from counts),
 'generatedAt',now());
$$;
revoke all on function public.buytest_free_funnel_summary(text) from public,anon,authenticated;
grant execute on function public.buytest_free_funnel_summary(text) to service_role;
notify pgrst,'reload schema';
commit;
