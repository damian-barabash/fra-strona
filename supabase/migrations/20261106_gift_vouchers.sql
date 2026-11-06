-- Vouchery świąteczne (/swieta-2026): a gift voucher for any product sold online.
-- The order stays a bookings row (kind = 'voucher'); what the voucher is for, the delivery and
-- the shipping state live in the columns below. When it is paid, fulfillOrder creates a matching
-- discount_codes row (code = voucher_code, "the whole product") — that is how the recipient
-- redeems it online; the panel marks it used for an offline redemption.

alter table public.bookings
  add column if not exists voucher_campaign text,          -- 'swieta-2026' — the holiday page
  add column if not exists voucher_target jsonb,           -- {kind, car_id, sessions, track, package_id, slug, variant, term_id, date_from, label}
  add column if not exists voucher_valid_to date,
  add column if not exists delivery text,                  -- 'email' | 'inpost'
  add column if not exists delivery_fee numeric(12,2) not null default 0,   -- net PLN (gross is added to amount_pln)
  add column if not exists delivery_data jsonb,            -- {locker, name, phone}
  add column if not exists shipped_at timestamptz,
  add column if not exists shipping_no text;

create index if not exists bookings_voucher_campaign_idx on public.bookings (voucher_campaign) where voucher_campaign is not null;

alter table public.discount_codes
  add column if not exists used_note text;                 -- offline redemption: who / where (panel)

-- page mode: 'test' = no payment, voucher created at once (is_test); 'live' = Tpay
insert into public.app_config (key, value) values ('gift_mode', 'test') on conflict (key) do nothing;
insert into public.app_config (key, value) values ('gift_inpost_net', '50') on conflict (key) do nothing;
