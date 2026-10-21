import { SUPABASE_URL, SUPABASE_ANON } from "../config";

/* Everything the public site reads at start, in ONE request: the SQL function `site_data()`
   (supabase/migrations/20261020_site_data.sql). Before, 17 separate queries each paid a CORS
   preflight — on a phone that was dozens of round trips before the page had its data.
   - A plain GET with the key in the query string is a "simple" request: no preflight.
   - index.html preloads this exact URL, so the download starts while the HTML is still parsing,
     in parallel with the JS bundle — usually the data is there before React starts.
   - main.jsx waits (briefly) for it, so the first render already has the data and matches the
     prerendered page: no empty frame, no jump of the layout. */
export const SITE_DATA_URL = `${SUPABASE_URL}/rest/v1/rpc/site_data?apikey=${SUPABASE_ANON}`;

let boot = null;
const get = () => fetch(SITE_DATA_URL, { credentials: "same-origin" })
  .then((r) => (r.ok ? r.json() : null))
  .then((d) => (d && typeof d === "object" && Array.isArray(d.cars) ? d : null))
  .catch(() => null);

// started when the module loads (= with the main bundle) and picks up the <link rel=preload> response
export const siteData = get().then((d) => (boot = d));

/** the start-up data if it has already arrived (null otherwise) */
export const bootData = () => boot;

/** resolves when the data is in, or after `ms` — whichever comes first */
export const waitSiteData = (ms) => Promise.race([siteData, new Promise((r) => setTimeout(r, ms))]);

/** a fresh copy (after logging out, etc.) */
export const fetchSiteData = get;
