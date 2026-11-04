-- Google Calendar mirror: which site entry became which Google event (+ hash of what was sent)
create table if not exists public.gcal_events (
  key text primary key,            -- term:<uuid> | ice:<uuid> | trip:<slug>
  event_id text not null,
  hash text,
  error text,
  synced_at timestamptz default now()
);
alter table public.gcal_events enable row level security;   -- no policies: service role only
