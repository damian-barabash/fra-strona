-- One request for everything the public site needs at start (2026-10-20).
-- Before: 17 PostgREST queries per page view, each with its own CORS preflight (custom headers).
-- Now: GET /rest/v1/rpc/site_data?apikey=… — a "simple" request (no preflight), preloaded from <head>.
-- SECURITY INVOKER: runs as the caller (anon), so every table's RLS applies exactly as before.
-- Lists and filters mirror src/lib/store.jsx (visible rows, ordered by sort; posts = cards without body).
create or replace function public.site_data()
returns json
language sql
stable
security invoker
set search_path = public
as $$
  select json_build_object(
    'content',          (select coalesce(json_agg(x), '[]') from public.content x),
    'cars',             (select coalesce(json_agg(x order by x.sort), '[]') from public.cars x where x.visible),
    'instructors',      (select coalesce(json_agg(x order by x.sort), '[]') from public.instructors x where x.visible),
    'events',           (select coalesce(json_agg(x order by x.sort), '[]') from public.events x where x.visible),
    'programs',         (select coalesce(json_agg(x order by x.sort), '[]') from public.programs x where x.visible),
    'banners',          (select coalesce(json_agg(x order by x.sort), '[]') from public.banners x where x.visible),
    'tracks',           (select coalesce(json_agg(x order by x.sort), '[]') from public.tracks x where x.visible),
    'media',            (select coalesce(json_agg(x order by x.sort), '[]') from public.media x where x.visible),
    'terms',            (select coalesce(json_agg(x order by x.sort), '[]') from public.terms x where x.visible),
    'products',         (select coalesce(json_agg(x order by x.sort), '[]') from public.products x where x.visible),
    'ice_packages',     (select coalesce(json_agg(x order by x.sort), '[]') from public.ice_packages x where x.visible),
    'ice_windows',      (select coalesce(json_agg(x order by x.sort), '[]') from public.ice_windows x where x.visible),
    'trip_packages',    (select coalesce(json_agg(x order by x.sort), '[]') from public.trip_packages x where x.visible),
    'trip_attractions', (select coalesce(json_agg(x order by x.sort), '[]') from public.trip_attractions x where x.visible),
    'trip_points',      (select coalesce(json_agg(x order by x.sort), '[]') from public.trip_points x where x.visible),
    'posts',            (select coalesce(json_agg(x order by x.published_at desc), '[]') from (
                           select id, slug, title_pl, title_en, tag_pl, tag_en, excerpt_pl, excerpt_en, cover, cover_alt, author,
                                  published_at, reading_min, visible, sort, created_at, updated_at
                             from public.posts where visible) x),
    'popups',           (select coalesce(json_agg(x), '[]') from (select * from public.popups where active limit 1) x)
  );
$$;

revoke all on function public.site_data() from public;
grant execute on function public.site_data() to anon, authenticated, service_role;
