import { createClient } from "https://esm.sh/@supabase/supabase-js@2.110.5";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

function token(): string {
  const a = new Uint8Array(32);
  crypto.getRandomValues(a);
  return [...a].map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const { action, login, password, token: tok } = await req.json();

    if (action === "verify") {
      if (!tok) return json({ ok: false }, 401);
      const { data: s } = await admin
        .from("admin_sessions").select("admin_id, expires_at").eq("token", tok).maybeSingle();
      if (!s || new Date(s.expires_at) < new Date()) return json({ ok: false }, 401);
      const { data: a } = await admin
        .from("admins").select("id, login, name, role, perms, position").eq("id", s.admin_id).maybeSingle();
      if (!a) return json({ ok: false }, 401);
      return json({ ok: true, admin: a });
    }

    // login
    if (!login || !password) return json({ ok: false, error: "missing" }, 400);
    // verify password via pgcrypto crypt()
    const { data: match } = await admin.rpc("verify_admin", { p_login: login, p_password: password });
    if (!match) return json({ ok: false, error: "invalid" }, 401);
    const a = match; // {id, login, name, role, perms}
    const t = token();
    await admin.from("admin_sessions").insert({ token: t, admin_id: a.id });
    // the audit log (read by the owner in the panel) starts with the login itself
    const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || null;
    await admin.from("audit_log").insert({ admin_id: a.id, admin_login: a.login, admin_name: a.name, action: "login", target: null, details: null, ip }).then(() => {}, () => {});
    return json({ ok: true, token: t, admin: { id: a.id, login: a.login, name: a.name, role: a.role, perms: a.perms, position: a.position ?? null } });
  } catch (e) {
    return json({ ok: false, error: String(e) }, 500);
  }
});
