-- Laponia: days sold out entirely (marked in the panel → "Laponia — sezon"); the configurator
-- blocks every stay that touches one, the product page shows them red, the server rejects them.
alter table ice_windows add column if not exists sold_out date[] not null default '{}';
