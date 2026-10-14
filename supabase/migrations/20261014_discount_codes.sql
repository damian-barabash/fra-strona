-- Kody rabatowe (2026-10-14).
-- Two kinds of single-use codes:
--   amount  — X zł off the GROSS amount of any purchase (a product cheaper than the code is covered entirely)
--   product — bound to one product / package / car (target), worth the whole item, a % or an amount
-- A code is reserved for the pending order that uses it (reserved_*) and spent when that order is paid
-- (used_*). Only the edge functions read or write this table.

create table if not exists public.discount_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,                       -- upper case, A–Z 0–9 and dashes
  kind text not null default 'amount' check (kind in ('amount', 'product')),
  value_type text not null default 'amount' check (value_type in ('amount', 'percent', 'full')),
  value numeric(12,2) not null default 0,          -- zł (amount) or % (percent); ignored for full
  target jsonb,                                    -- product codes: { kind: track|ice|product|trip, car_id, sessions, package_id, slug, variant }
  valid_from date,
  valid_to date,
  active boolean not null default true,
  batch text,                                      -- name of the series it was generated / imported in
  note text,
  created_at timestamptz not null default now(),
  created_by text,
  reserved_booking uuid,
  reserved_email text,
  reserved_until timestamptz,
  used_at timestamptz,
  used_booking uuid,
  used_email text
);
create index if not exists discount_codes_batch on public.discount_codes (batch);
create index if not exists discount_codes_created on public.discount_codes (created_at desc);
alter table public.discount_codes enable row level security;   -- no policies: service role only

-- failed look-ups per IP (brute-force guard of the public check)
create table if not exists public.discount_attempts (
  id bigint generated always as identity primary key,
  ip text,
  at timestamptz not null default now()
);
create index if not exists discount_attempts_ip_at on public.discount_attempts (ip, at desc);
alter table public.discount_attempts enable row level security;

alter table public.bookings
  add column if not exists discount_id uuid,
  add column if not exists discount_code text,
  add column if not exists discount_pln numeric(12,2);      -- how much the code took off the PLN amount to pay

-- Atomic reservation: free (never used, active, no live reservation — or a reservation of the same
-- customer, who came back from the gateway and tries again) → reserved for this order.
create or replace function public.discount_reserve(p_id uuid, p_booking uuid, p_email text, p_minutes int default 60)
returns boolean language sql security definer set search_path = public as $$
  with r as (
    update public.discount_codes
       set reserved_booking = p_booking, reserved_email = lower(p_email), reserved_until = now() + make_interval(mins => p_minutes)
     where id = p_id and used_at is null and active
       and (reserved_until is null or reserved_until < now() or reserved_email = lower(p_email))
    returning 1)
  select exists (select 1 from r);
$$;

-- Spent by a paid order. false = someone else's order spent it first (logged on the order).
create or replace function public.discount_use(p_id uuid, p_booking uuid, p_email text)
returns boolean language sql security definer set search_path = public as $$
  with r as (
    update public.discount_codes
       set used_at = now(), used_booking = p_booking, used_email = lower(p_email), reserved_until = null
     where id = p_id and (used_at is null or used_booking = p_booking)
    returning 1)
  select exists (select 1 from r);
$$;

revoke all on function public.discount_reserve(uuid, uuid, text, int) from public, anon, authenticated;
revoke all on function public.discount_use(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.discount_reserve(uuid, uuid, text, int) to service_role;
grant execute on function public.discount_use(uuid, uuid, text) to service_role;
