// Live CMS data for data-driven expectations: the product wall, footer and calendar follow the
// admin's ordering/visibility, so tests read the same rows instead of hard-coding counts.
import { SUPABASE_URL, SUPABASE_ANON } from "../src/config.js";
export async function visibleProducts(request) {
  const r = await request.get(`${SUPABASE_URL}/rest/v1/products?select=slug,title_pl,code,external_url,logo&visible=eq.true&order=sort`, { headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${SUPABASE_ANON}` } });
  return r.json();
}
