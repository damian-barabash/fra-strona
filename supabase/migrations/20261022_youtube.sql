-- YouTube videos for the video block at the bottom of product and car pages.
-- One link per line, optionally "link | title" (parsed by src/lib/youtube.js).
alter table public.products add column if not exists youtube text;
alter table public.cars add column if not exists youtube text;
notify pgrst, 'reload schema';
