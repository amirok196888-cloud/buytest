begin;
-- Preserve all existing event types while accepting the new report-flow events.
do $$
declare previous text;
begin
 select pg_get_constraintdef(oid) into previous from pg_constraint
 where conrelid='public.buytest_analytics_events'::regclass and conname='buytest_analytics_events_event_type_check';
 if previous not like '%report_opened%' then
  execute 'alter table public.buytest_analytics_events drop constraint buytest_analytics_events_event_type_check';
  execute 'alter table public.buytest_analytics_events add constraint buytest_analytics_events_event_type_check check (' || substr(previous,8,length(previous)-8) || ' or event_type in (''report_opened'',''report_file_selected'',''report_read_ready'',''report_analyze_clicked'',''report_analysis_started'',''report_result_received'',''report_result_displayed'',''report_read_failed'',''report_validation_blocked'',''report_analysis_failed'',''report_result_discarded''))';
 end if;
end $$;
create or replace function public.buytest_report_funnel_summary(p_range text default 'all')
returns jsonb language sql stable security invoker set search_path=public as $$
with stages(ord,event_type) as (values
 (1,'report_opened'),(2,'report_file_selected'),(3,'report_read_ready'),(4,'report_analyze_clicked'),
 (5,'report_analysis_started'),(6,'report_result_received'),(7,'report_result_displayed')),
bounds as (select case p_range when 'today' then date_trunc('day',now() at time zone 'Asia/Jerusalem') at time zone 'Asia/Jerusalem'
 when '7d' then now()-interval '7 days' when '30d' then now()-interval '30 days' else null::timestamptz end since_at),
cohort as (select distinct session_id from buytest_analytics_events,bounds where event_type='report_opened' and page_path='/report-funnel/v1' and (since_at is null or created_at>=since_at)),
activity as (select e.* from buytest_analytics_events e join cohort using(session_id) where e.page_path='/report-funnel/v1'),
progress as (select a.session_id,max(s.ord) last_stage,
 bool_or(a.event_type='report_read_failed') read_failed,bool_or(a.event_type='report_validation_blocked') blocked,
 bool_or(a.event_type='report_analysis_failed') failed,bool_or(a.event_type='report_result_discarded') discarded
 from activity a left join stages s using(event_type) group by a.session_id)
select jsonb_build_object(
 'total',(select count(*) from cohort),'completed',(select count(*) from progress where last_stage=7),
 'incomplete',(select count(*) from progress where last_stage<7),
 'readFailed',(select count(*) from progress where read_failed),'blocked',(select count(*) from progress where blocked),
 'failed',(select count(*) from progress where failed),'discarded',(select count(*) from progress where discarded),
 'trackingStartedAt',(select min(created_at) from buytest_analytics_events where event_type='report_opened' and page_path='/report-funnel/v1'),
 'stages',(select jsonb_agg(jsonb_build_object('eventType',s.event_type,'reached',(select count(distinct session_id) from activity where event_type=s.event_type),'last',(select count(*) from progress where last_stage=s.ord)) order by s.ord) from stages s));
$$;
revoke all on function public.buytest_report_funnel_summary(text) from public,anon,authenticated;
grant execute on function public.buytest_report_funnel_summary(text) to service_role;
commit;
