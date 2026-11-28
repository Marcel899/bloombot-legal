// Roblox OAuth 2.0: swaps the one-time code from roblox-callback.html for a token,
// reads the player's verified Roblox id + username, then queues a roblox_verifications
// row (method 'oauth') for the bot, which links it like a verified About code.
//
// Secrets (Supabase dashboard > Edge Functions > Secrets):
//   ROBLOX_CLIENT_SECRET  required
//   ROBLOX_CLIENT_ID      optional (defaults to the Bloombot app)
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided by Supabase.
import { createClient } from "jsr:@supabase/supabase-js@2";

const CLIENT_ID = Deno.env.get("ROBLOX_CLIENT_ID") || "5599238111365011302";
const CLIENT_SECRET = Deno.env.get("ROBLOX_CLIENT_SECRET") || "";
const REDIRECT = "https://bloombot-gtd.vercel.app/roblox-callback.html";
const ORIGINS = new Set(["https://bloombot-gtd.vercel.app"]);
const NAME = /^[A-Za-z0-9_]{3,20}$/;

const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function cors(req: Request): Record<string, string> {
  const o = req.headers.get("origin") || "";
  return {
    "Access-Control-Allow-Origin": ORIGINS.has(o) ? o : "https://bloombot-gtd.vercel.app",
    "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

async function roblox(path: string, body: Record<string, string>): Promise<Response> {
  return await fetch("https://apis.roblox.com/oauth/v1/" + path, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body),
    signal: AbortSignal.timeout(8000),
  });
}

Deno.serve(async (req) => {
  const h = cors(req);
  const reply = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...h, "Content-Type": "application/json" } });
  if (req.method === "OPTIONS") return new Response("ok", { headers: h });
  if (req.method !== "POST") return reply({ error: "Use POST." }, 405);
  if (!CLIENT_SECRET) return reply({ error: "Roblox login isn't switched on yet. Try again later." }, 503);

  // Who is asking: their Bloombot account is their Discord login.
  const jwt = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  const { data: auth, error: authErr } = await sb.auth.getUser(jwt);
  if (authErr || !auth?.user) return reply({ error: "Log in again and retry." }, 401);
  const dc = (auth.user.identities || []).find((i) => i.provider === "discord");
  const did = String(dc?.identity_data?.provider_id || dc?.identity_data?.sub || dc?.id || "");
  if (!/^\d{5,25}$/.test(did)) return reply({ error: "Connect Discord first." }, 400);

  let input: { code?: unknown; verifier?: unknown };
  try { input = await req.json(); } catch { return reply({ error: "Bad request." }, 400); }
  const code = typeof input.code === "string" ? input.code : "";
  const verifier = typeof input.verifier === "string" ? input.verifier : "";
  if (!code || code.length > 2048 || !/^[A-Za-z0-9\-._~]{43,128}$/.test(verifier)) return reply({ error: "That link ran out. Try again." }, 400);

  // Same limits as the About-code flow.
  const hourAgo = new Date(Date.now() - 3600_000).toISOString();
  const { count } = await sb.from("roblox_verifications").select("id", { count: "exact", head: true })
    .eq("discord_id", did).gt("created_at", hourAgo);
  if ((count || 0) >= 6) return reply({ error: "Too many tries. Wait an hour and try again." }, 429);
  const { data: busy } = await sb.from("roblox_verifications").select("id")
    .eq("discord_id", did).in("status", ["pending", "processing"]).limit(1);
  if (busy && busy.length) return reply({ error: "Bloombot is still linking your last try. Give it a few seconds." }, 409);

  // Code -> token -> verified user info. The token is revoked right after: we only need it once.
  let sub = "", username = "";
  try {
    const tr = await roblox("token", {
      grant_type: "authorization_code", code, code_verifier: verifier,
      client_id: CLIENT_ID, client_secret: CLIENT_SECRET, redirect_uri: REDIRECT,
    });
    const tok = await tr.json().catch(() => ({}));
    if (!tr.ok || !tok.access_token) {
      console.warn("roblox token", tr.status, tok.error, tok.error_description);
      return reply({ error: "Roblox said that login has run out. Try again." }, 400);
    }
    const ur = await fetch("https://apis.roblox.com/oauth/v1/userinfo", {
      headers: { Authorization: "Bearer " + tok.access_token }, signal: AbortSignal.timeout(8000),
    });
    const info = await ur.json().catch(() => ({}));
    roblox("token/revoke", { token: tok.refresh_token || tok.access_token, client_id: CLIENT_ID, client_secret: CLIENT_SECRET })
      .catch(() => {});
    if (!ur.ok) return reply({ error: "Roblox didn't answer. Try again in a minute." }, 502);
    sub = String(info.sub || "");
    username = String(info.preferred_username || "");
  } catch (e) {
    console.warn("roblox oauth", e);
    return reply({ error: "Roblox didn't answer. Try again in a minute." }, 502);
  }
  if (!/^\d{1,19}$/.test(sub) || !NAME.test(username)) return reply({ error: "Roblox didn't send your username. Try again." }, 502);

  await sb.from("roblox_verifications").delete().eq("discord_id", did).in("status", ["waiting", "failed"]);
  const { data: row, error } = await sb.from("roblox_verifications")
    .insert({ discord_id: did, roblox_username: username, roblox_id: Number(sub), code: "", method: "oauth", status: "pending" })
    .select("id").single();
  if (error || !row) {
    console.error("insert", error);
    return reply({ error: /method/.test(error?.message || "") ? "Roblox login isn't switched on yet. Try again later." : "Couldn't save it. Try again." }, 500);
  }
  return reply({ id: row.id, username });
});
