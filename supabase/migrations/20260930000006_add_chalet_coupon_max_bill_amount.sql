alter table public.chalet_coupons
    add column if not exists max_bill_amount numeric;
