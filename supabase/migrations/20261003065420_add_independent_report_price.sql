-- Add independent inspection analysis at NIS 29 while preserving legacy prices.
ALTER TABLE public.buytest_orders DROP CONSTRAINT buytest_orders_amount_agorot_check;
ALTER TABLE public.buytest_orders ADD CONSTRAINT buytest_orders_amount_agorot_check CHECK (amount_agorot = ANY (ARRAY[1500,2900,3900,4900,7900,10000,11000,12000,12900,14900,15000,25000]));
