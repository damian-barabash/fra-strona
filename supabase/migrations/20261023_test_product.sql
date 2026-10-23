-- Test products (2026-10-23): a product reachable only by its long secret address, for trying the whole
-- purchase path (Tpay → webhook → e-mails → Performance Lab) with real money. Its orders carry is_test,
-- the panel marks them TEST and leaves them out of the revenue numbers.
alter table public.products add column if not exists is_test boolean not null default false;
alter table public.bookings add column if not exists is_test boolean not null default false;

-- the public may read every product except a test one (that one only by its exact address, below)
drop policy if exists "products public read" on public.products;
create policy "products public read" on public.products for select using (not is_test);

create or replace function public.test_product(p_slug text)
returns json
language sql
stable
security definer
set search_path = public
as $$
  select row_to_json(x) from public.products x where x.is_test and x.slug = p_slug and length(p_slug) >= 32 limit 1;
$$;
revoke all on function public.test_product(text) from public;
grant execute on function public.test_product(text) to anon, authenticated, service_role;

notify pgrst, 'reload schema';
