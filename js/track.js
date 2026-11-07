/* Anonymous visit counter. Runs only after "Accept all" in the cookie notice and only on the live site.
   Sends the page, the website you came from, phone/tablet/desktop and "first visit today": no ID, no cookie.
   public.track_hit (Supabase) adds 1 to a total; it keeps no IP address. */
(() => {
  const ENDPOINT = "https://rkzgsndfzzgezoltddvx.supabase.co/rest/v1/rpc/track_hit";
  const KEY = "sb_publishable_CfTjHiYYCGqLZMlgpiKN-Q_m7JNITb5";
  const HOST = "bloombot-gtd.vercel.app";
  function send() {
    if (location.hostname !== HOST || !window.BB_CONSENT || !BB_CONSENT.optional()) return;
    let path = location.pathname.toLowerCase();
    if (path === "/index.html") path = "/";
    let ref = "";
    try { const r = new URL(document.referrer); if (r.hostname !== location.hostname) ref = r.hostname; } catch (e) { /* no referrer */ }
    const w = Math.min(screen.width || innerWidth, innerWidth);
    const touch = matchMedia("(pointer: coarse)").matches;
    const device = w < 700 ? "phone" : touch && w < 1200 ? "tablet" : "desktop";
    const today = new Date().toISOString().slice(0, 10);
    let fresh = false;
    try { fresh = localStorage.getItem("bb_seen") !== today; localStorage.setItem("bb_seen", today); } catch (e) { /* storage blocked */ }
    fetch(ENDPOINT, {
      method: "POST", keepalive: true, credentials: "omit",
      headers: { apikey: KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ p_path: path, p_ref: ref, p_device: device, p_new: fresh }),
    }).catch(() => {});
  }
  if (document.readyState === "complete") setTimeout(send, 300);
  else addEventListener("load", () => setTimeout(send, 300), { once: true });
})();
