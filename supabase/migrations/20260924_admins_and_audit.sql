-- Admin accounts with granular permissions + an audit log of every admin action.
-- roles: 'owner' (the moderator — everything, manages admins, reads the log) | 'admin' (perms jsonb decides)
alter table admins alter column role set default 'admin';
alter table admins alter column perms set default '{}'::jsonb;
update admins set perms = '{}'::jsonb where perms is null;

create table if not exists audit_log (
  id uuid primary key default gen_random_uuid(),
  at timestamptz not null default now(),
  admin_id uuid,
  admin_login text,
  admin_name text,
  action text not null,
  target text,
  details jsonb,
  ip text
);
create index if not exists audit_log_at_idx on audit_log (at desc);
create index if not exists audit_log_admin_idx on audit_log (admin_id, at desc);
alter table audit_log enable row level security;   -- no policies: only the service role (edge functions) reads/writes

-- password handling stays in SQL (pgcrypto), the edge function never sees a hash
create or replace function admin_create(p_login text, p_name text, p_password text, p_role text, p_perms jsonb)
returns jsonb language sql security definer set search_path = public, extensions as $$
  insert into admins (login, name, pass_hash, role, perms)
  values (p_login, p_name, crypt(p_password, gen_salt('bf')), coalesce(p_role, 'admin'), coalesce(p_perms, '{}'::jsonb))
  returning to_jsonb(admins) - 'pass_hash';
$$;
create or replace function admin_set_password(p_id uuid, p_password text)
returns void language sql security definer set search_path = public, extensions as $$
  update admins set pass_hash = crypt(p_password, gen_salt('bf')) where id = p_id;
$$;
revoke execute on function admin_create(text, text, text, text, jsonb) from public, anon, authenticated;
revoke execute on function admin_set_password(uuid, text) from public, anon, authenticated;
grant execute on function admin_create(text, text, text, text, jsonb) to service_role;
grant execute on function admin_set_password(uuid, text) to service_role;

-- job title shown next to the account (e.g. "Szef instruktorów", "Księgowość")
alter table admins add column if not exists position text;
update admins set position = 'Właściciel' where login = 'admin' and position is null;
drop function if exists admin_create(text, text, text, text, jsonb);
create or replace function admin_create(p_login text, p_name text, p_password text, p_role text, p_perms jsonb, p_position text default null)
returns jsonb language sql security definer set search_path = public, extensions as $$
  insert into admins (login, name, pass_hash, role, perms, position)
  values (p_login, p_name, crypt(p_password, gen_salt('bf')), coalesce(p_role, 'admin'), coalesce(p_perms, '{}'::jsonb), p_position)
  returning to_jsonb(admins) - 'pass_hash';
$$;
revoke execute on function admin_create(text, text, text, text, jsonb, text) from public, anon, authenticated;
grant execute on function admin_create(text, text, text, text, jsonb, text) to service_role;
