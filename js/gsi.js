/* Google sign-in button, isolated in its own small frame (gsi.html).
   Google's button needs inline styles; keeping it here lets every other page keep a
   strict style policy. The ID token and the raw nonce go only to our own parent page. */
(() => {
  if (window.parent === window) return;
  const q = new URLSearchParams(location.search);
  const cid = q.get("cid") || "";
  const mode = q.get("mode") === "link" ? "link" : "login";
  const w = Math.min(400, Math.max(200, parseInt(q.get("w"), 10) || 320));
  const send = m => window.parent.postMessage(Object.assign({ bbgsi: 1 }, m), location.origin);
  if (!/^[0-9]+-[a-z0-9]+\.apps\.googleusercontent\.com$/.test(cid)) { send({ error: "config" }); return; }
  const hex = b => Array.from(b, x => x.toString(16).padStart(2, "0")).join("");
  const start = async () => {
    if (!(window.google && google.accounts && google.accounts.id)) { send({ error: "load" }); return; }
    const raw = hex(crypto.getRandomValues(new Uint8Array(32)));
    const hashed = hex(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw))));
    google.accounts.id.initialize({
      client_id: cid,
      nonce: hashed,
      ux_mode: "popup",
      context: mode === "link" ? "use" : "signin",
      itp_support: true,
      callback: r => { if (r && r.credential) send({ credential: r.credential, nonce: raw }); },
    });
    google.accounts.id.renderButton(document.getElementById("b"), {
      type: "standard", size: "large", shape: "pill", text: "continue_with",
      theme: "outline", logo_alignment: "center", width: w,
    });
    send({ ready: true });
  };
  if (document.readyState === "complete") start();
  else window.addEventListener("load", start);
})();
