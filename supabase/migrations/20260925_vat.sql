-- All list prices are NET; the gateway charges GROSS (23% VAT). Grosze need decimals.
alter table bookings add column if not exists vat_rate numeric(5,4) default 0.23;
alter table bookings add column if not exists total_gross numeric(12,2);
alter table bookings alter column amount_pln type numeric(12,2);
alter table bookings alter column paid_amount type numeric(12,2);
-- historic rows: keep amounts as they were (net) but mark them so the panel can tell
update bookings set vat_rate = 0 where total_gross is null;
