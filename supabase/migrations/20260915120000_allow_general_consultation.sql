alter table public.buytest_orders
  drop constraint if exists buytest_orders_amount_agorot_check;

alter table public.buytest_orders
  add constraint buytest_orders_amount_agorot_check
  check (amount_agorot = any (array[3900, 4900, 7900, 12000]));

alter table public.buytest_orders
  drop constraint if exists buytest_orders_plan_check;

alter table public.buytest_orders
  add constraint buytest_orders_plan_check
  check (plan = any (array['premium', 'report', 'consultation', 'prebuy', 'bundle']));

alter table public.buytest_orders
  drop constraint if exists buytest_orders_plate_check;

alter table public.buytest_orders
  add constraint buytest_orders_plate_check
  check (
    plate ~ '^[0-9]{5,8}$'
    or (plan = 'prebuy' and plate = 'GENERAL')
  );
