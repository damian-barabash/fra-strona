-- Blog: posts written in the panel (rich text as HTML), public pages /blog and /blog/<slug>.
-- A post is public when it is visible and its publication date has come (a future date = scheduled).
create table if not exists posts (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title_pl text, title_en text,
  tag_pl text, tag_en text,              -- category shown on the card and used by the filter
  excerpt_pl text, excerpt_en text,      -- lead on the card; also the default meta description
  body_pl text, body_en text,            -- sanitised HTML from the panel's editor, one block per line
  cover text, cover_alt text,
  author text,
  published_at date not null default current_date,
  seo_title text, seo_desc text,         -- optional overrides for <title> / meta description
  reading_min int,
  visible boolean not null default true,
  sort int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists posts_published_idx on posts (published_at desc);

alter table posts enable row level security;
drop policy if exists "posts public read" on posts;
create policy "posts public read" on posts for select
  using (visible = true and published_at <= (now() at time zone 'Europe/Warsaw')::date);

-- the menu order lives in the database: BLOG goes between KALENDARZ and KONTAKT
update content
   set pl = replace(pl, 'nav.contact', 'nav.blog,nav.contact'), updated_at = now()
 where key = 'nav.order' and pl not like '%nav.blog%' and pl like '%nav.contact%';
