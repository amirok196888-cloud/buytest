-- Allow the separate 100 NIS consultation alongside earlier paid plans.
alter table public.buytest_orders
  drop constraint if exists buytest_orders_amount_agorot_check;

alter table public.buytest_orders
  add constraint buytest_orders_amount_agorot_check
  check (amount_agorot = any (array[1500, 3900, 4900, 7900, 10000, 12000, 15000]));
