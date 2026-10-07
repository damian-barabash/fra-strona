-- Advertising pop-up: saved layouts written in the panel, at most ONE of them switched on.
-- The site shows the active one after `delay_sec` seconds on the site (once per visit).
create table if not exists popups (
  id uuid primary key default gen_random_uuid(),
  name text not null default '',            -- internal name, seen in the panel only
  active boolean not null default false,
  delay_sec int not null default 5,
  pages text not null default 'all',        -- all | home
  date_from date, date_to date,             -- optional campaign window (empty = no limit)
  layout text not null default 'left',      -- left | right | cover (where the photo sits)
  image text, image_mobile text, image_alt text,
  color text not null default '#14161a',    -- background of the text block
  btn_color text not null default '#e30613',
  eyebrow_pl text, eyebrow_en text,
  title_pl text, title_en text,
  body_pl text, body_en text,               -- sanitised HTML from the panel's editor, one block per line
  btn_label_pl text, btn_label_en text,
  btn_url text,                             -- /page on the site or https://… ; empty = no button
  btn_blank boolean not null default false,
  views int not null default 0,
  clicks int not null default 0,
  sort int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- only one pop-up can be on at a time
create unique index if not exists popups_one_active on popups ((true)) where active;

alter table popups enable row level security;
drop policy if exists "popups public read" on popups;
create policy "popups public read" on popups for select
  using (active = true
    and (date_from is null or date_from <= (now() at time zone 'Europe/Warsaw')::date)
    and (date_to is null or date_to >= (now() at time zone 'Europe/Warsaw')::date));

-- counters for the panel: the site reports "shown" and "button clicked" (nothing about the visitor is stored)
create or replace function popup_hit(p_id uuid, p_kind text) returns void
language sql security definer set search_path = public as $$
  update popups
     set views = views + (case when p_kind = 'view' then 1 else 0 end),
         clicks = clicks + (case when p_kind = 'click' then 1 else 0 end)
   where id = p_id and active = true and p_kind in ('view', 'click');
$$;
revoke all on function popup_hit(uuid, text) from public;
grant execute on function popup_hit(uuid, text) to anon, authenticated, service_role;
