-- 2026-09-22: Tpay payments, vouchers, company inquiries, admin settings
alter table bookings
  add column if not exists number serial,
  add column if not exists tpay_id text,
  add column if not exists tpay_title text,
  add column if not exists payment_url text,
  add column if not exists paid_amount integer,
  add column if not exists amount_pln integer,
  add column if not exists payment_error text,
  add column if not exists paid_at timestamptz,
  add column if not exists lang text default 'pl',
  add column if not exists voucher_for text,
  add column if not exists voucher_message text,
  add column if not exists voucher_code text,
  add column if not exists mail_sent boolean default false,
  add column if not exists tpay_method text,
  add column if not exists meta jsonb;
alter table bookings alter column status set default 'pending';
create index if not exists bookings_status_idx on bookings(status);
create index if not exists bookings_created_idx on bookings(created_at desc);

alter table messages
  add column if not exists kind text default 'contact',
  add column if not exists company text,
  add column if not exists meta jsonb;

-- home "programs" cards now open real pages
update programs set link = '/rezerwacja' where title_pl = 'JAZDA SPORTOWA';
update programs set link = '/produkty/stage-3' where title_pl = 'TRENINGI WYŚCIGOWE';
update programs set link = '/produkty/ice-driving-laponia' where title_pl = 'ICE DRIVING EXPERIENCE';
update programs set link = 'https://heelsonthetrack.pl/' where title_pl = 'HEELS ON THE TRACK';
update programs set link = '/dla-firm' where title_pl = 'EVENTY NA TORACH';
update programs set link = '/voucher' where title_pl = 'VOUCHERY PREZENTOWE';

-- instructors slider: Mariusz moves to his own founder block; first (red) card = Łukasz, head of instructors
update instructors set
  name = 'ŁUKASZ KAŹMIERCZAK',
  label_pl = 'SZEF INSTRUKTORÓW', label_en = 'HEAD OF INSTRUCTORS',
  subtitle_pl = 'KIEROWCA WYŚCIGOWY', subtitle_en = 'RACING DRIVER',
  signature = null,
  description_pl = 'Instruktor wyścigowy i szef teamu instruktorów Fastline Racing Academy. Sezon 2019 w Pucharze Super S Cup (Mini R32): dwukrotne pole position WSMP, zwycięstwo w 4. rundzie WSMP oraz III miejsce w wyścigu Endurance. Na co dzień prowadzi szkolenia indywidualne i opiekuje się kursantami od pierwszego okrążenia po starty w zawodach.',
  description_en = 'Racing instructor and head of the Fastline Racing Academy instructor team. 2019 season in the Super S Cup (Mini R32): two WSMP pole positions, a win in round 4 of the WSMP and 3rd place in the Endurance race. Day to day he runs individual training and looks after students from their first lap to their first race.'
where id = '1c4717fe-d2d1-439a-ab39-ba9bd9320317';

-- app settings (recipients are editable in the admin "Ustawienia" tab)
insert into app_config(key, value) values
  ('contact_to', 'marcin.piotrowski@greywolfgroup.pl, lukasz.kazmierczak@greywolfgroup.pl'),
  ('firma_to', 'lukasz.kazmierczak@greywolfgroup.pl, mariusz.miekos@greywolfgroup.pl'),
  ('voucher_to', 'lukasz.kazmierczak@greywolfgroup.pl, mariusz.miekos@greywolfgroup.pl, maria.szymanska@greywolfgroup.pl, dmytrii.barabash@greywolfgroup.pl'),
  ('order_to', 'lukasz.kazmierczak@greywolfgroup.pl, marcin.piotrowski@greywolfgroup.pl'),
  ('eur_pln', '4.35')
on conflict (key) do update set value = excluded.value, updated_at = now();
