# FRA STRONA — Fastline Racing Academy

Redesign strony głównej Fastline Racing Academy. React + Vite → GitHub Pages, backend Supabase.

## Stack
- **Frontend:** React 18 + Vite, React Router (BrowserRouter), framer-motion, self-hosted fonts (@fontsource Montserrat + Poppins).
- **Backend:** Supabase `lreikmsgebcyaddshpax` (Postgres + RLS + Storage `media` + 2 Edge Functions).
- **Hosting:** GitHub Pages (Actions), custom domain `draft.fastlineracingacademy.pl` (CNAME, base `/`).
- **Języki:** PL (źródło) + EN (tłumaczone automatycznie przez Barabash AI gateway).

## Dev
```bash
npm install
npm run dev        # http://localhost:5173
npm run build
npm run test:e2e   # Playwright (desktop + mobile)
```

## CMS
- **Panel `/admin`** — login `admin` / hasło `fastline2026` (⚠ zmień w produkcji).
  - Wizualny edytor inline treści strony: „Strona (edycja inline)” → pływający pasek na stronie, edycja tekstów i mediów w miejscu (PL; EN tłumaczy się samo).
  - Osobne zakładki-kolekcje: **Samochody / Instruktorzy / Wydarzenia / Programy** — pełny CRUD, kolejność, upload zdjęć (auto-WebP po stronie klienta), kolory, widoczność.
- Content strony (nagłówki, wideo hero, licznik itd.) siedzi w tabeli `content` (klucz → PL + EN); domyślne wartości w `src/lib/defaults.js`.

## Auto-tłumaczenie EN
Edge `admin-api` przy zapisie tłumaczy pola PL → EN przez Barabash AI gateway.
Wymaga sekretu **`BARABASH_AI_KEY`** w projekcie Supabase (Settings → Edge Functions → Secrets).
Bez klucza EN pozostaje puste i front pokazuje wersję PL jako fallback.

## Struktura
```
src/
  sections/     # Nav, Hero, Programs, Fleet, Training, Instructors, Events, CtaBuy, Footer, CmsBar
  components/    # Editable (EText, EMedia) — inline CMS
  pages/         # Home, Admin
  lib/           # store, supabase, api, i18n defaults, hooks, util
supabase/functions/  # admin-auth, admin-api
public/assets/       # hero, cars, instructors, klocki, ui, covers (WebP/WebM)
```

## Do zrobienia po stronie użytkownika
- `git push` → GitHub Pages (Source = Actions) → DNS CNAME `draft` → `<user>.github.io`.
- Ustawić sekret `BARABASH_AI_KEY` (żeby EN się tłumaczyło).
- Zmienić hasło admina; wgrać docelowe PNG samochodów w CMS.
