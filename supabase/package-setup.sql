-- Production setup applied on 2026-09-24. Keep this script with the package code.
alter table public.buytest_orders drop constraint if exists buytest_orders_plan_check;
alter table public.buytest_orders add constraint buytest_orders_plan_check
  check (plan = any(array['balcar','premium','report','consultation','prebuy','report_consultation','bundle','full149','three250']));
alter table public.buytest_orders drop constraint if exists buytest_orders_amount_agorot_check;
alter table public.buytest_orders add constraint buytest_orders_amount_agorot_check
  check (amount_agorot = any(array[1500,3900,4900,7900,10000,12000,14900,15000,25000]));

create or replace function public.buytest_package_update(p_order_id uuid, p_plate text, p_action text)
returns jsonb language plpgsql security invoker set search_path=public as $$
declare ord public.buytest_orders%rowtype; payload jsonb; vehicles jsonb; completed jsonb; claimed text;
begin
  select * into ord from public.buytest_orders where id=p_order_id for update;
  if not found or ord.status<>'paid' or ord.plan not in ('full149','three250') or ord.expires_at<=now() then
    raise exception 'paid_package_required';
  end if;
  if p_plate !~ '^[0-9]{7,8}$' then raise exception 'invalid_plate'; end if;
  payload:=coalesce(ord.provider_payload,'{}'::jsonb);
  vehicles:=coalesce(payload->'packageVehicles','[]'::jsonb);
  completed:=coalesce(payload->'packageReportsCompleted','[]'::jsonb);
  if p_action='register' then
    if not (vehicles ? p_plate) then
      if jsonb_array_length(vehicles)>=(case when ord.plan='full149' then 1 else 3 end) then raise exception 'package_vehicle_limit'; end if;
      vehicles:=vehicles||to_jsonb(p_plate);
      payload:=jsonb_set(payload,'{packageVehicles}',vehicles,true);
    end if;
  elsif p_action='complete_report' then
    if not (vehicles ? p_plate) then raise exception 'vehicle_not_registered'; end if;
    if not (completed ? p_plate) then payload:=jsonb_set(payload,'{packageReportsCompleted}',completed||to_jsonb(p_plate),true); end if;
  elsif p_action='claim_consultation' then
    if not (vehicles ? p_plate) or not (completed ? p_plate) then raise exception 'report_required'; end if;
    claimed:=payload->>'packageConsultationPlate';
    if claimed is not null and claimed<>p_plate then raise exception 'consultation_already_claimed'; end if;
    if claimed is null then
      payload:=jsonb_set(payload,'{packageConsultationPlate}',to_jsonb(p_plate),true);
      payload:=jsonb_set(payload,'{packageConsultationStartedAt}',to_jsonb(now()),true);
    end if;
  else raise exception 'invalid_action'; end if;
  update public.buytest_orders set provider_payload=payload,updated_at=now() where id=p_order_id;
  return payload;
end $$;
revoke all on function public.buytest_package_update(uuid,text,text) from public,anon,authenticated;
grant execute on function public.buytest_package_update(uuid,text,text) to service_role;

create or replace function public.buytest_package_save_insurance(p_order_id uuid,p_plate text,p_report_id text,p_external_ref text)
returns void language plpgsql security invoker set search_path=public as $$
declare ord public.buytest_orders%rowtype; payload jsonb;
begin
  select * into ord from public.buytest_orders where id=p_order_id for update;
  if not found or ord.status<>'paid' or ord.plan not in ('full149','three250') or ord.expires_at<=now()
    or not (coalesce(ord.provider_payload->'packageVehicles','[]'::jsonb) ? p_plate)
    or length(p_report_id)>120 or length(p_external_ref)>120 then raise exception 'package_report_denied'; end if;
  payload:=ord.provider_payload;
  payload:=jsonb_set(payload,'{packageInsuranceReports}',coalesce(payload->'packageInsuranceReports','{}'::jsonb)||jsonb_build_object(p_plate,jsonb_build_object('reportId',p_report_id,'externalRef',p_external_ref)),true);
  update public.buytest_orders set provider_payload=payload,updated_at=now() where id=p_order_id;
end $$;
revoke all on function public.buytest_package_save_insurance(uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.buytest_package_save_insurance(uuid,text,text,text) to service_role;
