/* Shared site code: Discord login (Supabase), the profile menu, the phone menu,
   value loading and small helpers. Pages read window.BB. */
(() => {
  // Public project URL and publishable key: reads are limited by row level security.
  const C = { url: "https://rkzgsndfzzgezoltddvx.supabase.co", key: "sb_publishable_CfTjHiYYCGqLZMlgpiKN-Q_m7JNITb5" };
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
  /* Discord-style formatting, built as DOM nodes (never innerHTML):
     # ## ### headings, -# small text, > quotes, - lists, **bold**, *italic*, __underline__,
     ~~strike~~, `code`, ||spoilers||, [links](https://…) and custom emojis <:name:id>. */
  const INLINE = /<(a?):(\w{2,32}):(\d{5,25})>|\*\*(.+?)\*\*|__(.+?)__|~~(.+?)~~|\|\|(.+?)\|\||`([^`]+)`|(?<![\w*])\*(?!\s)([^*]+?)\*(?![\w*])|(?<![\w])_(?!\s)([^_]+?)_(?![\w])|<(@[!&]?|#)(\d{5,25})>|\[([^\]\n]{1,100})\]\((https:\/\/[^)\s]+)\)|(https:\/\/[^\s<]+[^\s<.,:;"')\]!?])/g;
  BB.emoji = (id, name, animated, cls = "demoji") => {
    const img = BB.el("img", cls);
    img.alt = ":" + name + ":";
    img.title = name;
    img.loading = "lazy";
    img.src = `https://cdn.discordapp.com/emojis/${id}.${animated ? "gif" : "png"}?size=48`;
    img.onerror = () => img.remove();
    return img;
  };
  function inline(parent, text, onText, depth = 0) {
    const plain = s => s && (onText ? onText(parent, s) : parent.append(s));
    if (depth > 4) return plain(text);
    let last = 0, m;
    INLINE.lastIndex = 0;
    const re = new RegExp(INLINE.source, "g");
    while ((m = re.exec(text))) {
      plain(text.slice(last, m.index));
      last = re.lastIndex;
      const wrap = (tag, cls, inner) => { const n = BB.el(tag, cls); inline(n, inner, onText, depth + 1); parent.append(n); };
      if (m[3]) parent.append(BB.emoji(m[3], m[2], m[1] === "a"));
      else if (m[4] != null) wrap("strong", null, m[4]);
      else if (m[5] != null) wrap("u", null, m[5]);
      else if (m[6] != null) wrap("s", null, m[6]);
      else if (m[7] != null) {
        const sp = BB.el("span", "spoiler");
        sp.tabIndex = 0;
        sp.title = "Spoiler: click to show";
        sp.onclick = sp.onkeydown = () => sp.classList.add("open");
        inline(sp, m[7], onText, depth + 1);
        parent.append(sp);
      }
      else if (m[8] != null) parent.append(BB.el("code", null, m[8]));
      else if (m[9] != null) wrap("em", null, m[9]);
      else if (m[10] != null) wrap("em", null, m[10]);
      else if (m[11]) parent.append(BB.el("span", "mention", m[11] === "#" ? "#channel" : m[11] === "@&" ? "@role" : "@user"));
      else {
        const href = BB.safeUrl(m[14] || m[15]);
        const a = BB.el("a", null);
        a.href = href; a.target = "_blank"; a.rel = "noopener nofollow ugc";
        a.textContent = m[13] || m[15];
        parent.append(a);
      }
    }
    plain(text.slice(last));
  }
  BB.mdInline = (parent, text, onText) => inline(parent, String(text || ""), onText);
  BB.md = (text, opts = {}) => {
    const root = BB.el("div", "md" + (opts.cls ? " " + opts.cls : ""));
    const lines = String(text || "").replace(/\r/g, "").split("\n");
    let box = root, quoting = false, rest = false, list = null, para = null;
    const fill = (node, s) => inline(node, s, opts.onText);
    for (let raw of lines) {
      let line = raw, quoted = rest;
      if (!rest && /^>>> /.test(line)) { rest = quoted = true; line = line.slice(4); }
      else if (!rest && /^> /.test(line)) { quoted = true; line = line.slice(2); }
      else if (!rest && line === ">") { quoted = true; line = ""; }
      if (quoted !== quoting) {
        list = para = null;
        if (quoted) { box = BB.el("blockquote"); root.append(box); } else box = root;
        quoting = quoted;
      }
      let h;
      if (!line.trim()) { list = para = null; continue; }
      if ((h = line.match(/^(#{1,3}) (.+)$/))) {
        list = para = null;
        const n = BB.el("div", "md-h md-h" + h[1].length);
        n.setAttribute("role", "heading");
        n.setAttribute("aria-level", String(3 + h[1].length));
        fill(n, h[2]);
        box.append(n);
      } else if ((h = line.match(/^-# (.+)$/))) {
        list = para = null;
        const n = BB.el("div", "md-sub");
        fill(n, h[1]);
        box.append(n);
      } else if ((h = line.match(/^(\s*)[-*•] (.+)$/))) {
        para = null;
        if (!list) { list = BB.el("ul"); box.append(list); }
        const li = BB.el("li", h[1].length >= 2 ? "sub" : null);
        fill(li, h[2]);
        list.append(li);
      } else if ((h = line.match(/^\s*(\d{1,3})[.)] (.+)$/))) {
        para = null;
        if (!list || list.tagName !== "OL") { list = BB.el("ol"); list.start = +h[1]; box.append(list); }
        const li = BB.el("li");
        fill(li, h[2]);
        list.append(li);
      } else {
        list = null;
        if (para) para.append(BB.el("br")); else { para = BB.el("p"); box.append(para); }
        fill(para, line);
      }
    }
    return root;
  };
  /* The same text with the formatting taken out, for titles, previews and search. */
  BB.plain = text => String(text || "")
    .replace(/<a?:(\w+):\d+>/g, "").replace(/<(@[!&]?|#)\d+>/g, "")
    .replace(/^(?:>>> |> |-# |#{1,3} |\s*[-*•] )/gm, "")
    .replace(/\*\*|__|~~|\|\||`/g, "").replace(/(^|[^\w])[*_](?=\S)|(?<=\S)[*_](?=[^\w]|$)/g, "$1")
    .replace(/\[([^\]]+)\]\((https:\/\/[^)\s]+)\)/g, "$1").replace(/[ \t]+/g, " ").trim();

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

  /* Interactive step chart: hover or drag to read the price on any day. */
  BB.interactiveChart = (box, points) => {
    const pts = (points || []).filter(p => p && p[1] > 0).map(p => [new Date(p[0]).getTime(), p[1]]);
    box.replaceChildren();
    if (!pts.length) { box.append(BB.el("p", "empty", "No price history yet.")); return; }
    const W = 600, H = 220, PL = 8, PR = 52, PT = 14, PB = 26;
    const now = Date.now();
    const x0 = pts[0][0], x1 = Math.max(now, x0 + 864e5);
    let lo = Math.min(...pts.map(p => p[1])), hi = Math.max(...pts.map(p => p[1]));
    if (hi === lo) { hi += hi * 0.1 || 1; lo -= lo * 0.1 || 1; }
    const span = hi - lo; hi += span * 0.08; lo = Math.max(0, lo - span * 0.08);
    const X = t => PL + (t - x0) / (x1 - x0) * (W - PL - PR);
    const Y = v => PT + (1 - (v - lo) / (hi - lo)) * (H - PT - PB);
    const all = pts.concat([[now, pts[pts.length - 1][1]]]);
    let d = `M${X(all[0][0])},${Y(all[0][1])}`;
    for (let i = 1; i < all.length; i++) d += `H${X(all[i][0]).toFixed(1)}V${Y(all[i][1]).toFixed(1)}`;
    const up = all[all.length - 1][1] >= all[0][1];
    const col = up ? "#33c46a" : "#ef4b4f";
    const day = t => new Date(t).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
    let grid = "";
    for (let i = 0; i <= 3; i++) {
      const v = lo + (hi - lo) * i / 3, y = Y(v).toFixed(1);
      grid += `<line x1="${PL}" x2="${W - PR}" y1="${y}" y2="${y}" class="gl"/><text x="${W - PR + 6}" y="${+y + 4}">${BB.fmt(v)}</text>`;
    }
    grid += `<text x="${PL}" y="${H - 6}">${day(x0)}</text><text x="${W - PR}" y="${H - 6}" text-anchor="end">Today</text>`;
    const dots = pts.map(p => `<circle cx="${X(p[0]).toFixed(1)}" cy="${Y(p[1]).toFixed(1)}" r="3" fill="${col}"/>`).join("");
    const wrap = BB.el("div", "ichart");
    wrap.innerHTML = `<svg viewBox="0 0 ${W} ${H}" aria-label="Price chart">${grid}<path d="${d}V${H - PB}H${PL}Z" fill="${col}" opacity=".12"/>` +
      `<path d="${d}" fill="none" stroke="${col}" stroke-width="2.5" stroke-linejoin="round"/>${dots}` +
      `<line class="cross" x1="0" x2="0" y1="${PT}" y2="${H - PB}" visibility="hidden"/><circle class="cdot" r="6" fill="${col}" stroke="#fff" stroke-width="2" visibility="hidden"/></svg>`;
    const tip = BB.el("div", "ctip");
    tip.hidden = true;
    wrap.append(tip);
    box.append(wrap);
    const svg = wrap.querySelector("svg"), cross = svg.querySelector(".cross"), dot = svg.querySelector(".cdot");
    const at = t => { let v = pts[0][1], since = pts[0][0]; for (const p of pts) { if (p[0] <= t) { v = p[1]; since = p[0]; } } return [v, since]; };
    const move = e => {
      const r = svg.getBoundingClientRect();
      const sx = (e.clientX - r.left) / r.width * W;
      const t = Math.min(x1, Math.max(x0, x0 + (sx - PL) / (W - PL - PR) * (x1 - x0)));
      const [v, since] = at(t);
      const cx = X(t), cy = Y(v);
      cross.setAttribute("x1", cx); cross.setAttribute("x2", cx); cross.setAttribute("visibility", "visible");
      dot.setAttribute("cx", cx); dot.setAttribute("cy", cy); dot.setAttribute("visibility", "visible");
      tip.hidden = false;
      tip.replaceChildren(BB.el("strong", null, BB.fmt(v)), BB.el("span", null, day(t)), BB.el("em", null, "since " + day(since)));
      const px = cx / W * r.width;
      tip.style.left = Math.min(r.width - tip.offsetWidth - 4, Math.max(4, px - tip.offsetWidth / 2)) + "px";
    };
    const leave = () => { tip.hidden = true; cross.setAttribute("visibility", "hidden"); dot.setAttribute("visibility", "hidden"); };
    svg.addEventListener("pointermove", move);
    svg.addEventListener("pointerdown", move);
    svg.addEventListener("pointerleave", leave);
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
  /* Same rule as the bot: a price that sat untouched 60+ days and then jumped
     is the list catching up, not a move this month. */
  function caughtUp(history) {
    const cut = Date.now() - 30 * 864e5;
    const pts = (history || []).map(p => [new Date(p[0]).getTime(), p[1]]);
    let i = -1;
    pts.forEach((p, j) => { if (p[0] <= cut) i = j; });
    return i >= 0 && i + 1 < pts.length && pts[i + 1][0] - pts[i][0] >= 60 * 864e5;
  }
  /* Owner's-choice items have no fixed value; use the first number written ("62k+ (O/C)" -> 62k). */
  function prep(list) {
    for (const it of list) {
      const m = !(it.value > 0) && String(it.value_text || "").match(/(\d+(?:\.\d+)?)\s*([km]?)/i);
      it.est = it.value > 0 ? it.value : m ? BB.parseValue(m[1] + m[2]) || 0 : 0;
      it.oc = !(it.value > 0) && it.est > 0;
      if (it.change_30d != null && caughtUp(it.history)) it.change_30d = null;
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
      link("strategies.html", "bullseye", "Share a strategy"), link("calculator.html", "calculator", "Trade calculator"), out);
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
