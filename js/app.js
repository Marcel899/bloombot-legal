/* Shared site code: Discord login (Supabase), the profile menu, the phone menu,
   value loading and small helpers. Pages read window.BB. */
(() => {
  const C = window.BB_CONF || {};
  const listeners = [];
  const BB = window.BB = {
    sb: null, session: null, ready: false,
    onAuth(fn) { listeners.push(fn); if (BB.ready) fn(BB.session); },
  };

  /* ── helpers ─────────────────────────────────────────────── */
  BB.el = (tag, cls, text) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  };
  BB.safeUrl = u => (typeof u === "string" && /^https:\/\//.test(u) ? u : null);
  BB.fmt = n => {
    if (n == null || isNaN(n)) return "–";
    const a = Math.abs(n);
    const trim = x => (Math.round(x * 100) / 100).toString();
    if (a >= 1e6) return trim(n / 1e6) + "m";
    if (a >= 1e3) return trim(n / 1e3) + "k";
    return trim(n);
  };
  BB.parseValue = t => {
    const m = String(t || "").trim().toLowerCase().replace(/,/g, "").match(/^(\d+(?:\.\d+)?)\s*([km]?)\+?$/);
    if (!m) return null;
    return parseFloat(m[1]) * (m[2] === "k" ? 1e3 : m[2] === "m" ? 1e6 : 1);
  };
  BB.ago = t => {
    const s = (Date.now() - new Date(t)) / 1000;
    if (!(s >= 0)) return "";
    if (s < 60) return "just now";
    if (s < 3600) return Math.floor(s / 60) + "m ago";
    if (s < 86400) return Math.floor(s / 3600) + "h ago";
    return Math.floor(s / 86400) + "d ago";
  };
  /* An item's picture: the bot's emoji, then the value list's picture, then the flower. */
  BB.itemImg = (item, cls) => {
    const img = BB.el("img", cls);
    img.alt = "";
    img.loading = "lazy";
    const srcs = [BB.safeUrl(item.icon_url), BB.safeUrl(item.image_url), "img/flower.png"].filter(Boolean);
    let i = 0;
    img.src = srcs[0];
    img.onerror = () => { if (++i < srcs.length) img.src = srcs[i]; };
    return img;
  };
  /* Step chart of [[date, value], ...] as an SVG string. */
  BB.chart = (points, w, h, opts = {}) => {
    const pts = (points || []).filter(p => p && p[1] > 0).map(p => [new Date(p[0]).getTime(), p[1]]);
    if (!pts.length) return "";
    const now = Date.now();
    pts.push([now, pts[pts.length - 1][1]]);
    const x0 = pts[0][0], x1 = Math.max(now, x0 + 864e5);
    let lo = Math.min(...pts.map(p => p[1])), hi = Math.max(...pts.map(p => p[1]));
    if (hi === lo) { hi += hi * 0.1 || 1; lo -= lo * 0.1 || 1; }
    const pad = opts.pad || 2;
    const X = t => pad + (t - x0) / (x1 - x0) * (w - pad * 2);
    const Y = v => pad + (1 - (v - lo) / (hi - lo)) * (h - pad * 2);
    let d = `M${X(pts[0][0]).toFixed(1)},${Y(pts[0][1]).toFixed(1)}`;
    for (let i = 1; i < pts.length; i++) d += `H${X(pts[i][0]).toFixed(1)}V${Y(pts[i][1]).toFixed(1)}`;
    const up = pts[pts.length - 1][1] >= pts[0][1];
    const col = opts.color || (up ? "#33c46a" : "#ef4b4f");
    const area = `${d}V${h}H${X(pts[0][0]).toFixed(1)}Z`;
    let labels = "";
    if (opts.labels) {
      labels = `<text x="${w - 4}" y="12" text-anchor="end">${BB.fmt(hi)}</text><text x="${w - 4}" y="${h - 4}" text-anchor="end">${BB.fmt(lo)}</text>` +
        `<text x="4" y="${h - 4}">${new Date(x0).toLocaleDateString(undefined, { month: "short", year: "2-digit" })}</text>`;
    }
    return `<svg class="chart" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true">` +
      `<path d="${area}" fill="${col}" opacity=".14"/><path d="${d}" fill="none" stroke="${col}" stroke-width="${opts.stroke || 2}" vector-effect="non-scaling-stroke" stroke-linejoin="round"/>${labels}</svg>`;
  };

  /* ── values (cached for 10 minutes) ──────────────────────── */
  const VKEY = "bb-values-v1";
  BB.loadValues = async () => {
    try {
      const c = JSON.parse(localStorage.getItem(VKEY) || "null");
      if (c && Date.now() - c.t < 6e5 && c.d.length) return prep(c.d);
    } catch (e) { /* ignore */ }
    const { data, error } = await BB.sb.from("item_values")
      .select("name,category,value,value_text,demand,status,rarity,icon_url,image_url,change_30d,history,updated_at")
      .order("value", { ascending: false }).limit(3000);
    if (error) throw error;
    try { localStorage.setItem(VKEY, JSON.stringify({ t: Date.now(), d: data })); } catch (e) { /* full or blocked */ }
    return prep(data || []);
  };
  /* Owner's-choice items have no fixed value; use the first number written ("62k+ (O/C)" -> 62k). */
  function prep(list) {
    for (const it of list) {
      const m = !(it.value > 0) && String(it.value_text || "").match(/(\d+(?:\.\d+)?)\s*([km]?)/i);
      it.est = it.value > 0 ? it.value : m ? BB.parseValue(m[1] + m[2]) || 0 : 0;
      it.oc = !(it.value > 0) && it.est > 0;
    }
    return list;
  }

  /* ── account ─────────────────────────────────────────────── */
  BB.user = s => {
    const m = (s && s.user && s.user.user_metadata) || {};
    const ident = s && s.user && (s.user.identities || []).find(i => i.provider === "discord");
    return {
      id: (ident && ident.id) || m.provider_id || null,
      name: (m.custom_claims && m.custom_claims.global_name) || m.full_name || m.name || "Discord user",
      avatar: BB.safeUrl(m.avatar_url) || "img/flower.png",
    };
  };
  BB.login = () => BB.sb.auth.signInWithOAuth({
    provider: "discord",
    options: { redirectTo: location.origin + location.pathname + location.search, scopes: "identify" },
  });

  function renderAcct() {
    const box = document.getElementById("acct");
    if (!box) return;
    box.replaceChildren();
    if (!BB.session) {
      const b = BB.el("button", "brick nb dark login-btn");
      b.type = "button";
      b.dataset.login = "";
      b.innerHTML = document.querySelector(".add .dc") ? document.querySelector(".add .dc").outerHTML : "";
      b.append(BB.el("span", null, "Log in"));
      box.append(b);
      return;
    }
    const u = BB.user(BB.session);
    const btn = BB.el("button", "me-btn");
    btn.type = "button";
    btn.setAttribute("aria-haspopup", "true");
    btn.setAttribute("aria-expanded", "false");
    const av = BB.el("img", "me-av");
    av.alt = "";
    av.src = u.avatar;
    av.onerror = () => { av.src = "img/flower.png"; };
    btn.append(av, BB.el("span", "me-name", u.name), BB.el("span", "caret", "▾"));
    const menu = BB.el("div", "me-menu");
    const head = BB.el("div", "me-head");
    const hav = av.cloneNode();
    head.append(hav, Object.assign(BB.el("div"), {}));
    head.lastChild.append(BB.el("strong", null, u.name), BB.el("span", null, "Logged in with Discord"));
    const link = (href, icon, label) => {
      const a = BB.el("a", "me-item");
      a.href = href;
      const i = BB.el("img"); i.src = `img/${icon}.png`; i.alt = "";
      a.append(i, BB.el("span", null, label));
      return a;
    };
    const out = BB.el("button", "me-item out", "Log out");
    out.type = "button";
    out.onclick = async () => { await BB.sb.auth.signOut(); };
    menu.append(head, link("trades.html#post", "offer", "Post a trade ad"), link("trades.html?mine=1", "swap", "My trade ads"),
      link("calculator.html", "calculator", "Trade calculator"), out);
    btn.onclick = e => {
      e.stopPropagation();
      const open = box.classList.toggle("open");
      btn.setAttribute("aria-expanded", String(open));
    };
    box.append(btn, menu);
  }

  function setSession(s) {
    BB.session = s;
    BB.ready = true;
    renderAcct();
    listeners.forEach(fn => { try { fn(s); } catch (e) { console.error(e); } });
  }

  document.addEventListener("click", e => {
    if (e.target.closest("[data-login]")) { e.preventDefault(); BB.login(); return; }
    const acct = document.getElementById("acct");
    if (acct && !acct.contains(e.target)) acct.classList.remove("open");
    const links = document.getElementById("links");
    if (links && !e.target.closest("#burger") && !links.contains(e.target)) {
      links.classList.remove("open");
      const b = document.getElementById("burger");
      if (b) b.setAttribute("aria-expanded", "false");
    }
  });
  document.addEventListener("keydown", e => {
    if (e.key === "Escape") {
      const acct = document.getElementById("acct");
      if (acct) acct.classList.remove("open");
    }
  });

  function init() {
    const burger = document.getElementById("burger");
    if (burger) burger.onclick = () => {
      const open = document.getElementById("links").classList.toggle("open");
      burger.setAttribute("aria-expanded", String(open));
    };
    if (!window.supabase || !C.url) { setSession(null); return; }
    BB.sb = window.supabase.createClient(C.url, C.key);
    BB.sb.auth.onAuthStateChange((event, s) => {
      if (event === "TOKEN_REFRESHED" && BB.ready) { BB.session = s; return; }
      setTimeout(() => setSession(s), 0);
    });
    const p = new URLSearchParams(location.hash.slice(1) + "&" + location.search.slice(1));
    if (p.get("error_description")) BB.loginError = p.get("error_description");
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
