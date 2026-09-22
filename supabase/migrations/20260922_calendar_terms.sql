-- 2026-09-22: new calendar dates from the client, trip dates on products (auto-calendar), addresses on terms
alter table terms add column if not exists address text;
alter table products add column if not exists date_from date, add column if not exists date_to date, add column if not exists place_pl text, add column if not exists place_en text;

delete from terms;
insert into terms (sort, date, time, track, type, title_pl, title_en, location_pl, location_en, address, capacity, visible) values
 (1, '2026-09-23', '10:00–15:00', 'poznan', 'sport', 'SPORT DRIVING EXPERIENCE', 'SPORT DRIVING EXPERIENCE', 'TOR POZNAŃ', 'POZNAŃ CIRCUIT', 'Wyścigowa 3, 62-081 Przeźmierowo', 8, true),
 (2, '2026-09-24', '14:00–19:00', 'lodz', 'sport', 'SPORT DRIVING EXPERIENCE', 'SPORT DRIVING EXPERIENCE', 'TOR ŁÓDŹ', 'ŁÓDŹ CIRCUIT', 'Kiełmina 78, Kiełmina', 8, true),
 (3, '2026-09-26', '10:00–16:00', 'lodz', 'sport', 'SPORT DRIVING EXPERIENCE', 'SPORT DRIVING EXPERIENCE', 'TOR ŁÓDŹ', 'ŁÓDŹ CIRCUIT', 'Kiełmina 78, Kiełmina', 8, true),
 (4, '2026-10-07', '13:00–18:00', 'lodz', 'sport', 'SPORT DRIVING EXPERIENCE', 'SPORT DRIVING EXPERIENCE', 'TOR ŁÓDŹ', 'ŁÓDŹ CIRCUIT', 'Kiełmina 78, Kiełmina', 8, true),
 (5, '2026-10-18', '10:00–14:00', 'lodz', 'heels', 'HEELS ON THE TRACK', 'HEELS ON THE TRACK', 'TOR ŁÓDŹ', 'ŁÓDŹ CIRCUIT', 'Kiełmina 78, Kiełmina', 8, true),
 (6, '2026-10-18', '14:00–19:00', 'lodz', 'sport', 'SPORT DRIVING EXPERIENCE', 'SPORT DRIVING EXPERIENCE', 'TOR ŁÓDŹ', 'ŁÓDŹ CIRCUIT', 'Kiełmina 78, Kiełmina', 8, true);

-- Laponia season 2027 (drives the ice configurator + the calendar band)
delete from ice_windows;
insert into ice_windows (sort, label_pl, label_en, date_from, date_to, capacity, visible) values (1, 'Sezon lodowy 2027 · Kuusamo', 'Ice season 2027 · Kuusamo', '2027-02-20', '2027-03-10', 10, true);

-- Andalusia 2026 trip (wyprawa) — dates land in the calendar automatically; packages/attractions to be filled in the CMS
insert into products (sort, slug, code, color, theme, trip_status, title_pl, title_en, tag_pl, tag_en, excerpt_pl, excerpt_en, trip_dates_pl, trip_dates_en, map_query, place_pl, place_en, date_from, date_to, photo, buy_direct, visible)
values (4, 'andaluzja-2026', 'ANDALUZJA', '#f59e0b', 'wyprawa', 'upcoming', 'ANDALUZJA 2026', 'ANDALUSIA 2026', 'WYPRAWA', 'TRIP',
 'Pięć dni sportowej jazdy po drogach Andaluzji — Sewilla, góry i wybrzeże, w gronie pasjonatów Fastline.', 'Five days of sport driving across Andalusia — Seville, mountains and the coast, with the Fastline crew.',
 '15–19 PAŹDZIERNIKA 2026', '15–19 OCTOBER 2026', 'Sevilla, Spain', 'SEVILLA · HISZPANIA', 'SEVILLE · SPAIN', '2026-10-15', '2026-10-19', '/assets/firmy/p3.webp', true, true)
on conflict do nothing;
update products set date_from = '2026-10-15', date_to = '2026-10-19' where slug = 'andaluzja-2026';
update products set sort = sort + 1 where slug in ('monaco') and sort >= 4;
