-- Black Friday Weeks 2026: orders from /black-week carry the campaign and the gifts the team hands out.
-- promo       = 'black-week-2026' (null for every other order)
-- promo_data  = { product, title, gift, options, gifts: [{ id, label, auto, done, done_at, done_by }], taxi_code }
alter table public.bookings add column if not exists promo text;
alter table public.bookings add column if not exists promo_data jsonb;
create index if not exists bookings_promo_idx on public.bookings (promo) where promo is not null;

-- the switch and the Heels prices are public (the pop-up and the configurator read them from site_data → content);
-- only the admin-api (service role) writes them
insert into public.content (key, pl, en, kind) values
  ('bw.on', '0', null, 'url'),
  ('bw.heels.basic', '3200', null, 'url'),
  ('bw.heels.premium', '4500', null, 'url')
on conflict (key) do nothing;

-- who gets the "someone used the promotion" e-mail
insert into public.app_config (key, value) values ('bw_to', 'mariusz.miekos@greywolfgroup.pl')
on conflict (key) do nothing;
