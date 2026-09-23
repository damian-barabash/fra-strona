-- 2026-09-23: car detail pages (/flota/<slug>) + race cars (info only, Flota tab)
alter table cars
  add column if not exists category text default 'sport',
  add column if not exists intro_pl text, add column if not exists intro_en text,
  add column if not exists accel text, add column if not exists weight text, add column if not exists drive text;

update cars set intro_pl = 'Najnowsze wcielenie legendarnego Porsche 911 w wersji 4 GTS! Niepowtarzalna linia, 3-litrowy silnik typu bokser z dwoma turbosprężarkami umieszczony za tylną osią, napęd na 4 koła — to przepis na niezapomnianą przygodę w świetnym stylu! Porsche 911 to idealna maszyna na tor!', accel = '3.3 s', weight = '1595 kg', drive = 'Na 4 koła' where slug = 'porsche-911-gts';
update cars set intro_pl = 'Lekkość, silnik za plecami kierowcy, napęd na tylne koła i dwusprzęgłowa skrzynia biegów — Alpine A110 S to sprzęt stworzony do toru, który dostarczy ogromnych emocji już od pierwszego zakrętu.', accel = '4.2 s', weight = '1080 kg', drive = 'Na tylne koła' where slug = 'alpine-a110-s';
update cars set intro_pl = 'Nasz egzemplarz przeszedł modyfikację, dzięki czemu ma rasowy, bardzo głośny wydech oraz aż 450 koni mechanicznych mocy!', accel = '4.0 s', weight = '1495 kg', drive = 'Na tylne koła' where slug = 'toyota-gr-supra';
update cars set intro_pl = 'Ręcznie składany i fabrycznie zakuty silnik nadaje motorsportowego charakteru. Połączenie tych wszystkich cech powoduje, że Mercedes daje sobie radę zarówno na ciasnych, jak i na długich i szybkich torach!', accel = '3.9 s', weight = '1570 kg', drive = 'Na wszystkie koła' where slug = 'mercedes-amg-a45s';
update cars set intro_pl = 'Parametry samochodu oraz jego charakterystyka powodują, że jest to samochód stworzony do jazdy na ciasnych i technicznych torach!', accel = '5.2 s', weight = '1280 kg', drive = 'Na wszystkie koła' where slug = 'toyota-gr-yaris';
update cars set intro_pl = 'Ciekawostką jest tryb jazdy „Drift” — po jego uruchomieniu silnik przekazuje 80% momentu na tylną oś, a 20% na przednią, dzięki czemu Ford bardzo chętnie „lata bokami”.', accel = '4.2 s', weight = '1524 kg', drive = 'Na wszystkie koła' where slug = 'ford-focus-rs';

-- race cars: shown only in the Flota tab (no prices, not bookable online)
insert into cars (sort, slug, badge, name, category, engine, power, torque, top_speed, weight, drive, color, png, photos, description_pl, intro_pl, visible)
values
 (101, 'mini-cooper-s-cup', 'MINI', 'MINI COOPER S R53 CUP', 'race', '1600 cm³', '185 KM', null, null, '1160 kg', 'FWD — na przednią oś', '#2b2f36', null, '["/assets/cars/race/mini-1.webp","/assets/cars/race/mini-2.webp","/assets/cars/race/mini-3.webp"]',
  'Mini R53 Cup to samochód przygotowany przez stajnię DRIVE SQUAD, która współpracuje z Fastline Racing Academy. Samochody Mini są przeznaczone do markowego pucharu „Super S Cup”, który jest idealną kuźnią kierowców wyścigowych na każdym szczeblu — od amatorów rozpoczynających przygodę z profesjonalnymi wyścigami, aż po zaawansowanych kierowców, mających ambicje, aby sprawdzić się z najlepszymi w samochodach o identycznych parametrach.',
  'Mini Cooper R53 to samochód bardzo przyjazny w zakresie właściwości jezdnych dla osób, które stawiają pierwsze kroki w profesjonalnym motorsporcie lub chcą sprawdzić profesjonalne pucharowe auto. Dla średnio zaawansowanych i profesjonalnych kierowców to doskonały sprawdzian umiejętności — wszystkie samochody w ramach markowego pucharu mają identyczne parametry, dzięki czemu liczą się umiejętności kierowcy oraz wiedza techniczna w zakresie przygotowania i ustawienia samochodu.', true),
 (102, 'porsche-911-gt3-cup', 'GT3', 'PORSCHE 911 GT3 CUP', 'race', '3800 cm³ boxer', '460 KM', null, null, '1400 kg', 'Na tylną oś', '#d9dde2', null, '["/assets/cars/race/gt3-1.webp","/assets/cars/race/gt3-2.webp","/assets/cars/race/gt3-3.webp"]',
  'Wyścigówka zbudowana głównie z myślą o startach w pucharze Porsche Supercup rozgrywanym przed wyścigami F1. Niezawodny i pięknie brzmiący silnik boxer umieszczony za tylną osią daje świetną przyczepność, lecz jest trudny do opanowania w przypadku poślizgu.',
  'Porsche nie posiada kontroli trakcji, przez co wszystko jest w rękach kierowcy — opanowanie tego samochodu odwdzięczy się ogromnym wzrostem umiejętności także w codziennej jeździe.', true),
 (103, 'lamborghini-huracan-super-trofeo', 'EVO', 'LAMBORGHINI HURACÁN SUPER TROFEO EVO', 'race', '5204 cm³ V10', '620 KM', null, null, '1200 kg', 'Na tylną oś', '#1db954', null, '["/assets/cars/race/evo-1.webp","/assets/cars/race/evo-2.webp","/assets/cars/race/evo-3.webp"]',
  'Samochód zbudowany przez fabrykę Lamborghini z myślą o pucharze Lamborghini Super Trofeo, organizowanym przez samego producenta.',
  'Huracán to bardzo szybka wyścigówka z centralnie umieszczonym silnikiem. Posiada świetną przyczepność, którą zawdzięcza mocnemu pakietowi aerodynamicznemu dociskającemu ją z ogromną siłą do asfaltu. Na prostych również nie ma sobie równych w swojej klasie.', true)
on conflict do nothing;

-- social links (editable in the panel → Menu)
insert into content(key, pl, en, kind) values
 ('soc.facebook', 'https://www.facebook.com/fastlineracingacademy/', null, 'url'),
 ('soc.instagram', 'https://www.instagram.com/fastline_racing_academy/', null, 'url'),
 ('soc.linkedin', 'https://www.linkedin.com/showcase/fastline-racing-academy/', null, 'url')
on conflict (key) do nothing;
