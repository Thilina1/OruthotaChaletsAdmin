create table if not exists public.chalet_coupons (
    id uuid primary key default gen_random_uuid(),
    code text not null unique,
    name text,
    description text,
    discount_type text not null default 'fixed' check (discount_type in ('fixed', 'percentage')),
    discount_value numeric not null default 0 check (discount_value >= 0),
    max_discount_amount numeric,
    min_bill_amount numeric not null default 0,
    max_bill_amount numeric,
    valid_from date,
    valid_to date,
    max_usage integer,
    is_active boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

alter table public.chalet_bookings
    add column if not exists coupon_id uuid references public.chalet_coupons(id) on delete set null,
    add column if not exists coupon_code text,
    add column if not exists coupon_discount_amount numeric not null default 0;
