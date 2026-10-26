-- Faktura VAT na firmę (2026-10-26): the configurators' DANE step can carry the company details.
-- { nip (10 digits), company, street, postal "00-000", city }; NULL = no invoice. Checked in admin-api (invoiceOf).
alter table public.bookings add column if not exists invoice jsonb;
