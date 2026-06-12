-- Add dispatched/delivered tracking columns and update status constraint

alter table public.orders
  add column if not exists dispatched_at timestamptz,
  add column if not exists delivered_at timestamptz;

-- Update the status check constraint to include 'dispatched'
alter table public.orders
  drop constraint if exists orders_status_check;

alter table public.orders
  add constraint orders_status_check
    check (status in ('pending','paid','processing','dispatched','delivered','cancelled','refunded'));
