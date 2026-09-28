import { PostgrestClient } from "@supabase/postgrest-js";
import { SUPABASE_URL, SUPABASE_ANON } from "../config";

/* The public site only reads tables through PostgREST, so it ships just that client
   (~30 KB) instead of the full supabase-js bundle (auth, storage, realtime ~250 KB).
   Same `.from().select().eq().order()` API and `{ data, error }` results. */
export const supabase = new PostgrestClient(`${SUPABASE_URL}/rest/v1`, {
  headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${SUPABASE_ANON}` },
});
