/* Shared site code: Discord + Google login (Supabase), the profile menu, the phone menu,
   value loading and small helpers. Pages read window.BB. */
(() => {
  // Public project URL and publishable key: reads are limited by row level security.
  const C = { url: "https://rkzgsndfzzgezoltddvx.supabase.co", key: "sb_publishable_CfTjHiYYCGqLZMlgpiKN-Q_m7JNITb5" };
  // Google OAuth web client ID (public, not a secret). Empty hides the Google button.
  const GOOGLE_CLIENT_ID = "";
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

  /* Notification popups. BB.toast(text, kind, opts) shows one and returns a handle:
     t.update(text, kind, opts) changes it in place (handy for "Saving…" -> "Saved"),
     t.close() hides it. Kinds: ok, bad, info, wait (spinner, stays until updated).
     opts: { title, time (ms, 0 = stay), action: { label, run } }. */
  const T_ICONS = {
    ok: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.2 4.2L19 7" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    bad: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 7v6.5M12 17.2v.1" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>',
    info: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 11v6M12 7v.1" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>',
    wait: '<svg viewBox="0 0 24 24" aria-hidden="true" class="spin"><circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-dasharray="34 60"/></svg>',
  };
  const T_TITLES = { ok: "Done", bad: "Something went wrong", info: "Heads up", wait: "Working on it" };
  const T_TIME = { ok: 3400, bad: 6500, info: 4200, wait: 0 };
  const T_MAX = 3;
  BB.toast = (text, kind = "ok", opts = {}) => {
    if (!T_ICONS[kind]) kind = "ok";
    let box = document.getElementById("toasts");
    if (!box) { box = BB.el("div", "toasts"); box.id = "toasts"; document.body.append(box); }
    /* The same message twice in a row: bump a counter instead of stacking copies. */
    const same = [...box.children].find(x => x._h && !x._gone && x._h.text === text && x._h.kind === kind);
    if (same) { same._h.bump(); return same._h; }

    const t = BB.el("div", "toast");
    const ic = BB.el("span", "t-ic");
    const body = BB.el("div", "t-body");
    const head = BB.el("strong", "t-title");
    const msg = BB.el("span", "t-msg");
    const count = BB.el("span", "t-count");
    const act = BB.el("button", "t-act");
    act.type = "button";
    const x = BB.el("button", "t-x", "×");
    x.type = "button";
    x.setAttribute("aria-label", "Dismiss");
    const bar = BB.el("i", "t-bar");
    body.append(head, msg);
    t.append(ic, body, count, act, x, bar);

    let timer = null, left = 0, started = 0, n = 1;
    const h = { text, kind };
    const stop = () => { clearTimeout(timer); timer = null; };
    const run = () => {
      stop();
      if (!left) return;
      started = Date.now();
      timer = setTimeout(h.close, left);
    };
    h.close = () => {
      if (t._gone) return;
      t._gone = true; stop();
      t.classList.add("out");
      setTimeout(() => t.remove(), 260);
    };
    h.update = (newText, newKind = h.kind, o = {}) => {
      if (!T_ICONS[newKind]) newKind = "ok";
      h.text = newText; h.kind = newKind; h.o = o;
      t.className = "toast " + newKind + (t._gone ? " out" : "");
      t.setAttribute("role", newKind === "bad" ? "alert" : "status");
      ic.innerHTML = T_ICONS[newKind];
      head.textContent = o.title || T_TITLES[newKind];
      msg.textContent = newText || "";
      msg.hidden = !newText;
      act.hidden = !o.action;
      if (o.action) { act.textContent = o.action.label; act.onclick = () => { h.close(); o.action.run(); }; }
      left = o.time != null ? o.time : T_TIME[newKind];
      bar.hidden = !left;
      if (left) { bar.style.animation = "none"; void bar.offsetWidth; bar.style.animation = ""; bar.style.animationDuration = left + "ms"; }
      if (h.kind !== "wait" && t.isConnected) { t.classList.remove("flash"); void t.offsetWidth; t.classList.add("flash"); }
      run();
      return h;
    };
    h.bump = () => {
      n += 1; count.textContent = "×" + n; count.classList.remove("bump"); void count.offsetWidth; count.classList.add("bump");
      left = h.o.time != null ? h.o.time : T_TIME[h.kind];
      if (left) { bar.style.animation = "none"; void bar.offsetWidth; bar.style.animation = ""; bar.style.animationDuration = left + "ms"; }
      run();
    };
    t._h = h;
    x.onclick = h.close;
    /* Hover or touch pauses the timer, so there's time to read it. */
    const pause = () => { if (!timer) return; stop(); left = Math.max(800, left - (Date.now() - started)); t.classList.add("paused"); };
    const resume = () => { if (t._gone || !left || timer) return; t.classList.remove("paused"); run(); };
    t.addEventListener("mouseenter", pause);
    t.addEventListener("mouseleave", resume);
    /* Swipe it away on phones. */
    let sx = null;
    t.addEventListener("touchstart", e => { sx = e.touches[0].clientX; pause(); }, { passive: true });
    t.addEventListener("touchmove", e => { if (sx == null) return; const dx = e.touches[0].clientX - sx; t.style.transform = `translateX(${dx}px)`; t.style.opacity = String(Math.max(0, 1 - Math.abs(dx) / 220)); }, { passive: true });
    t.addEventListener("touchend", e => {
      const dx = sx == null ? 0 : e.changedTouches[0].clientX - sx; sx = null;
      if (Math.abs(dx) > 80) { t.classList.add(dx > 0 ? "swiped-r" : "swiped-l"); h.close(); return; }
      t.style.transform = ""; t.style.opacity = ""; resume();
    });

    h.update(text, kind, opts);
    box.append(t);
    const live = [...box.children].filter(c => !c._gone);
    if (live.length > T_MAX) live.slice(0, live.length - T_MAX).forEach(c => c._h.close());
    return h;
  };
  /* Copy text: clipboard API, then the old select-and-copy way, then show it to copy by hand. */
  BB.copy = async (text, done = "Copied!") => {
    try {
      if (navigator.clipboard && window.isSecureContext) { await navigator.clipboard.writeText(text); BB.toast("", "ok", { title: done }); return true; }
    } catch (e) { /* fall through */ }
    const ta = BB.el("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.cssText = "position:fixed;top:0;left:0;opacity:0";
    document.body.append(ta);
    ta.select();
    let ok = false;
    try { ok = document.execCommand("copy"); } catch (e) { ok = false; }
    ta.remove();
    if (ok) { BB.toast("", "ok", { title: done }); return true; }
    window.prompt("Copy this:", text);
    return false;
  };
  /* Share a link: the phone's share sheet when there is one, otherwise copy it. */
  BB.share = async (url, title, done = "Link copied") => {
    if (navigator.share && matchMedia("(pointer:coarse)").matches) {
      try { await navigator.share({ title, url }); return; } catch (e) { if (e && e.name === "AbortError") return; }
    }
    return BB.copy(url, done);
  };

  /* Watchlist: units you starred, kept in this browser only. */
  const FKEY = "bb_watch";
  BB.favs = {
    all() { try { return new Set(JSON.parse(localStorage.getItem(FKEY) || "[]")); } catch (e) { return new Set(); } },
    has(name) { return BB.favs.all().has(name); },
    toggle(name) {
      const f = BB.favs.all();
      const on = !f.has(name);
      if (on) f.add(name); else f.delete(name);
      try { localStorage.setItem(FKEY, JSON.stringify([...f].slice(-100))); } catch (e) { /* blocked */ }
      return on;
    },
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
    const pts = (points || []).map(p => p && [new Date(p[0]).getTime(), Number(p[1])]).filter(p => p && isFinite(p[0]) && isFinite(p[1]) && p[1] > 0);
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
    const pts = (points || []).map(p => p && [new Date(p[0]).getTime(), Number(p[1])]).filter(p => p && isFinite(p[0]) && isFinite(p[1]) && p[1] > 0);
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
    const u = (s && s.user) || {};
    const m = u.user_metadata || {};
    const ids = u.identities || [];
    const dc = ids.find(i => i.provider === "discord");
    const go = ids.find(i => i.provider === "google");
    const dm = (dc && dc.identity_data) || {}, gm = (go && go.identity_data) || {};
    /* Only a real Discord identity gives a Discord ID: a Google ID must never be used as one. */
    let id = dc ? String(dc.id || dm.provider_id || dm.sub || "") || null : null;
    if (!ids.length && u.app_metadata && u.app_metadata.provider === "discord") id = m.provider_id || null;
    return {
      id,
      hasDiscord: !!id,
      hasGoogle: !!go,
      via: dc ? "Discord" : go ? "Google" : "Discord",
      name: (dm.custom_claims && dm.custom_claims.global_name) || dm.full_name || dm.name
        || (m.custom_claims && m.custom_claims.global_name) || gm.full_name || gm.name || m.full_name || m.name || "Bloombot user",
      avatar: BB.safeUrl(dm.avatar_url) || BB.safeUrl(gm.avatar_url) || BB.safeUrl(m.avatar_url) || "img/flower.png",
    };
  };
  const here = () => location.origin + location.pathname + location.search;
  BB.loginDiscord = () => BB.sb.auth.signInWithOAuth({
    provider: "discord",
    options: { redirectTo: here(), scopes: "identify" },
  });
  BB.login = () => loginDialog();
  BB.googleReady = !!GOOGLE_CLIENT_ID;
  BB.addGoogle = () => addGoogleDialog();

  /* ── login dialog: Discord or Google ─────────────────────── */
  function modal(labelId) {
    const back = BB.el("div", "wm-back");
    const box = BB.el("div", "wm panel");
    box.setAttribute("role", "dialog");
    box.setAttribute("aria-modal", "true");
    box.setAttribute("aria-labelledby", labelId);
    back.append(box);
    const close = () => { back.remove(); document.removeEventListener("keydown", esc); };
    const esc = e => { if (e.key === "Escape") close(); };
    document.addEventListener("keydown", esc);
    back.addEventListener("mousedown", e => { if (e.target === back) close(); });
    document.body.append(back);
    return { back, box, close };
  }
  const logoImg = () => { const i = BB.el("img", "wm-logo"); i.src = "img/flower.png"; i.alt = ""; return i; };
  const dcSvg = () => (document.querySelector(".add .dc") || { outerHTML: "" }).outerHTML;

  function loginDialog() {
    if (!BB.sb) return;
    if (document.querySelector(".lg-box")) return;
    const { box, close } = modal("lg-h");
    box.classList.add("lg-box");
    const h = BB.el("h2", null, "Log in to Bloombot"); h.id = "lg-h";
    const sub = BB.el("p", "hint", "New here? Logging in creates your account.");
    const opts = BB.el("div", "lg-opts");
    const dc = BB.el("button", "brick discord lg-btn");
    dc.type = "button";
    dc.innerHTML = dcSvg();
    dc.append(BB.el("span", null, "Continue with Discord"));
    dc.onclick = () => { dc.disabled = true; BB.loginDiscord(); };
    opts.append(dc);
    const st = BB.el("p", "post-status"); st.hidden = true;
    const say = (kind, t) => { st.hidden = !t; st.className = "post-status " + kind; st.textContent = t; };
    if (GOOGLE_CLIENT_ID) {
      const slot = BB.el("div", "lg-google");
      slot.setAttribute("aria-label", "Continue with Google");
      opts.append(slot);
      googleButton(slot, "login", say, close);
    }
    const x = BB.el("button", "brick dark sm lg-x", "Cancel"); x.type = "button"; x.onclick = close;
    box.append(logoImg(), h, sub, opts, st, BB.el("p", "hint lg-note", "Bloombot never sees your password."), x);
    setTimeout(() => dc.focus(), 50);
  }
  BB.loginDialog = loginDialog;

  /* Google uses its own "Sign in with Google" button (Google Identity Services), so Google's
     window shows this website's address, not the Supabase one. Google hands back a signed ID
     token; Supabase checks its signature, our client ID and the nonce before logging in. */
  let gisP = null;
  const loadGis = () => gisP || (gisP = new Promise((ok, bad) => {
    if (window.google && google.accounts && google.accounts.id) { ok(); return; }
    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client";
    s.async = true;
    s.onload = ok;
    s.onerror = () => { gisP = null; bad(new Error("load")); };
    document.head.append(s);
  }));
  const hex = b => Array.from(b, x => x.toString(16).padStart(2, "0")).join("");
  async function googleButton(slot, mode, say, done) {
    slot.replaceChildren(BB.el("span", "hint", "Loading Google…"));
    try { await loadGis(); }
    catch (e) { slot.replaceChildren(); say("bad", "Google sign-in didn't load. Turn off blockers for this site or use Discord."); return; }
    const raw = hex(crypto.getRandomValues(new Uint8Array(32)));
    const hashed = hex(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw))));
    google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      nonce: hashed,
      ux_mode: "popup",
      context: mode === "link" ? "use" : "signin",
      use_fedcm_for_button: true,
      itp_support: true,
      callback: r => onGoogle(r && r.credential, raw, mode, say, done),
    });
    slot.replaceChildren();
    const light = document.documentElement.dataset.theme === "light";
    google.accounts.id.renderButton(slot, {
      type: "standard", size: "large", shape: "pill", text: mode === "link" ? "continue_with" : "continue_with",
      theme: light ? "outline" : "filled_black", logo_alignment: "left", width: Math.min(400, Math.max(240, slot.clientWidth || 320)),
    });
  }
  const googleErr = msg => /already|exists|linked/i.test(msg || "")
    ? "That Google account already belongs to another Bloombot login."
    : /nonce|audience|aud|client/i.test(msg || "") ? "Google sign-in isn't set up right yet. Try Discord for now."
    : "Google sign-in failed: " + (msg || "unknown error");
  async function onGoogle(token, raw, mode, say, done) {
    if (!token) return;
    say("wait", mode === "link" ? "Adding Google…" : "Logging you in…");
    if (mode === "login") {
      let error;
      try { ({ error } = await BB.sb.auth.signInWithIdToken({ provider: "google", token, nonce: raw })); }
      catch (e) { error = e; }
      if (error) { say("bad", googleErr(error.message)); return; }
      done();
      return;
    }
    /* link Google to the account that's logged in now */
    try {
      const { data: { session } } = await BB.sb.auth.getSession();
      if (!session) { say("bad", "You're logged out. Log in again and retry."); return; }
      const r = await fetch(C.url + "/auth/v1/token?grant_type=id_token", {
        method: "POST",
        headers: { apikey: C.key, Authorization: "Bearer " + session.access_token, "Content-Type": "application/json" },
        body: JSON.stringify({ provider: "google", id_token: token, nonce: raw, link_identity: true }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { say("bad", googleErr(j.msg || j.error_description || j.message || r.status)); return; }
      const { data } = await BB.sb.auth.refreshSession();
      if (!data || !data.session || !BB.user(data.session).hasGoogle) { say("bad", "Google wasn't added. Try again in a minute."); return; }
      done();
      BB.toast("You can now log in with Google too.", "ok", { title: "Google added" });
    } catch (e) { say("bad", googleErr(e && e.message)); }
  }

  /* Google-only logins: Bloombot accounts are Discord accounts, so connect Discord once. */
  BB.connectDiscord = async () => {
    const { data, error } = await BB.sb.auth.linkIdentity({ provider: "discord", options: { redirectTo: here(), scopes: "identify" } });
    if (error) BB.toast(/manual linking/i.test(error.message) ? "Connecting accounts is switched off right now. Try again later." : error.message, "bad", { title: "Couldn't connect Discord" });
    return data;
  };
  function connectDialog(force) {
    if (document.querySelector(".lg-box")) return;
    const s = BB.session;
    const key = "bb_link_" + (s && s.user && s.user.id);
    if (!force) { try { if (sessionStorage.getItem(key)) return; } catch (e) { /* storage blocked */ } }
    const { box, close } = modal("cd-h");
    box.classList.add("lg-box");
    const h = BB.el("h2", null, "One more step: connect Discord"); h.id = "cd-h";
    const sub = BB.el("p", "hint", "Bloombot lives in Discord, so your trade ads, strategies and levels belong to your Discord account. Connect it once, then Google logs you straight in.");
    const dc = BB.el("button", "brick discord lg-btn");
    dc.type = "button";
    dc.innerHTML = dcSvg();
    dc.append(BB.el("span", null, "Connect Discord"));
    dc.onclick = async () => { dc.disabled = true; await BB.connectDiscord(); dc.disabled = false; };
    const later = BB.el("button", "brick dark sm lg-x", "Later"); later.type = "button";
    later.onclick = () => { try { sessionStorage.setItem(key, "1"); } catch (e) { /* ignore */ } close(); };
    box.append(logoImg(), h, sub, BB.el("div", "lg-opts"), BB.el("p", "hint lg-note", "Already logged in with Discord before? Log out, log in with Discord, then add Google from your account menu."), later);
    box.querySelector(".lg-opts").append(dc);
    setTimeout(() => dc.focus(), 50);
  }
  /* Pages call this before anything that needs a Discord ID (posting, profiles). */
  BB.requireDiscord = () => {
    if (!BB.session) { loginDialog(); return false; }
    if (BB.user(BB.session).id) return true;
    connectDialog(true);
    return false;
  };
  function addGoogleDialog() {
    const { box, close } = modal("ag-h");
    box.classList.add("lg-box");
    const h = BB.el("h2", null, "Add Google login"); h.id = "ag-h";
    const st = BB.el("p", "post-status"); st.hidden = true;
    const say = (kind, t) => { st.hidden = !t; st.className = "post-status " + kind; st.textContent = t; };
    const slot = BB.el("div", "lg-google");
    const opts = BB.el("div", "lg-opts"); opts.append(slot);
    const x = BB.el("button", "brick dark sm lg-x", "Cancel"); x.type = "button"; x.onclick = close;
    box.append(logoImg(), h, BB.el("p", "hint", "Log in to this same Bloombot account with Google next time."), opts, st, x);
    googleButton(slot, "link", say, close);
  }

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
    btn.setAttribute("aria-haspopup", "menu");
    btn.setAttribute("aria-expanded", "false");
    btn.setAttribute("aria-label", "Account menu for " + u.name);
    const av = BB.el("img", "me-av");
    av.alt = "";
    av.src = u.avatar;
    av.onerror = () => { av.src = "img/flower.png"; };
    const caret = BB.el("span", "caret");
    caret.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" d="m6 9 6 6 6-6"/></svg>';
    btn.append(av, BB.el("span", "me-name", u.name), caret);
    const menu = BB.el("div", "me-menu");
    menu.setAttribute("role", "menu");
    menu.id = "me-menu";
    btn.setAttribute("aria-controls", "me-menu");

    /* Header: who you are, with Roblox name + level once the profile row loads. */
    const head = BB.el("a", "me-head");
    head.href = "profile.html";
    head.setAttribute("role", "menuitem");
    const hav = BB.el("img", "me-hav");
    hav.alt = "";
    hav.src = u.avatar;
    hav.onerror = () => { hav.src = "img/flower.png"; };
    const who = BB.el("div", "me-who");
    const meta = BB.el("span", "me-meta", "Logged in with " + u.via);
    who.append(BB.el("strong", null, u.name), meta);
    head.append(hav, who, BB.el("span", "me-view", "View"));
    let loaded = false;
    const loadMeta = async () => {
      if (!u.id) { meta.replaceChildren(BB.el("span", "me-setup", "Connect Discord to finish")); return; }
      if (loaded || !BB.sb) return;
      loaded = true;
      try {
        const { data: p } = await BB.sb.from("profiles").select("*").eq("discord_id", u.id).maybeSingle();
        meta.replaceChildren();
        if (!p) { meta.append(BB.el("span", "me-setup", "Finish setting up your account")); return; }
        if (p.level) {
          const lv = BB.el("span", "me-lvl", "Lv " + p.level);
          lv.title = BB.rankFor(p.level).name + " rank";
          meta.append(lv);
        }
        const rb = BB.el("span", "me-rbx", p.roblox_name || "No Roblox linked");
        if (p.roblox_name && p.roblox_verified) { rb.classList.add("ok"); rb.title = "Verified Roblox account"; }
        meta.append(rb);
      } catch (e) { loaded = false; }
    };

    const here = location.pathname.replace(/^.*\//, "") + location.search + location.hash;
    const link = (href, icon, label) => {
      const a = BB.el("a", "me-item");
      a.href = href;
      a.setAttribute("role", "menuitem");
      const i = BB.el("img"); i.src = `img/${icon}.png`; i.alt = "";
      a.append(i, BB.el("span", null, label));
      if (here === href) a.setAttribute("aria-current", "page");
      return a;
    };
    const sep = () => { const s = BB.el("div", "me-sep"); s.setAttribute("role", "separator"); return s; };
    const out = BB.el("button", "me-item out");
    out.type = "button";
    out.setAttribute("role", "menuitem");
    out.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l5-5-5-5M15 12H4"/></svg>';
    out.append(BB.el("span", null, "Log out"));
    out.onclick = async () => { out.disabled = true; await BB.sb.auth.signOut(); };
    const act = (icon, label, run) => {
      const b = BB.el("button", "me-item");
      b.type = "button";
      b.setAttribute("role", "menuitem");
      const i = BB.el("img"); i.src = `img/${icon}.png`; i.alt = "";
      b.append(i, BB.el("span", null, label));
      b.onclick = () => { box.classList.remove("open"); run(); };
      return b;
    };
    const extra = [];
    if (!u.hasDiscord) extra.push(act("plus", "Connect Discord", () => connectDialog(true)), sep());
    else if (!u.hasGoogle && GOOGLE_CLIENT_ID) extra.push(act("plus", "Add Google login", addGoogleDialog), sep());
    menu.append(head, sep(), ...extra,
      link("profile.html#edit", "gear", "Edit profile"),
      link("levels.html", "medal_gold", "Levels & perks"),
      link("values.html#watchlist", "wish_star", "My watchlist"),
      sep(),
      link("trades.html#post", "plus", "Post a trade ad"),
      link("trades.html?mine=1", "trading", "My trade ads"),
      link("dashboard.html", "shield", "Server dashboard"),
      sep(), out);
    /* owner-only link; Supabase also checks on every giveaway call */
    BB.sb.rpc("is_site_owner").then(({ data }) => {
      if (data === true) out.before(link("giveaway-admin.html", "gift", "Manage giveaways"), sep());
    }, () => {});

    const items = () => [...menu.querySelectorAll("[role=menuitem]")];
    const setOpen = (open, focus) => {
      box.classList.toggle("open", open);
      if (open) {
        loadMeta();
        const nav = document.getElementById("links"), bg = document.getElementById("burger");
        if (nav) { nav.classList.remove("open"); if (bg) bg.setAttribute("aria-expanded", "false"); }
        if (focus) setTimeout(() => items()[0].focus(), 30);
      }
    };
    /* Other code closes the menu by removing .open; keep aria-expanded in sync. */
    new MutationObserver(() => btn.setAttribute("aria-expanded", String(box.classList.contains("open")))).observe(box, { attributes: true, attributeFilter: ["class"] });
    btn.onclick = e => { e.stopPropagation(); setOpen(!box.classList.contains("open"), e.detail === 0); };
    /* Start loading the level + Roblox name on hover, so it is there when the menu opens. */
    btn.addEventListener("pointerenter", loadMeta);
    btn.addEventListener("focus", loadMeta);
    btn.onkeydown = e => { if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); setOpen(true, true); } };
    menu.onkeydown = e => {
      const list = items(), i = list.indexOf(document.activeElement);
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        list[(i + (e.key === "ArrowDown" ? 1 : list.length - 1)) % list.length].focus();
      } else if (e.key === "Home" || e.key === "End") { e.preventDefault(); list[e.key === "Home" ? 0 : list.length - 1].focus(); }
      else if (e.key === "Escape") { e.preventDefault(); setOpen(false); btn.focus(); }
      else if (e.key === "Tab") setOpen(false);
    };
    menu.addEventListener("click", e => { if (e.target.closest("a")) setOpen(false); });
    box.append(btn, menu);
  }

  function setSession(s) {
    BB.session = s;
    BB.ready = true;
    renderAcct();
    listeners.forEach(fn => { try { fn(s); } catch (e) { console.error(e); } });
    if (s) checkAccount(s);
    if (BB.loginError && !document.getElementById("loginerr")) {
      const t = BB.loginError;
      BB.loginError = null;
      BB.toast(/already|exists/i.test(t) ? "That Discord account already has its own Bloombot login. Log in with Discord instead." : t, "bad", { title: "Login didn't work" });
    }
  }

  /* ── confirm dialog: resolves true when the user agrees ──── */
  BB.confirm = ({ title, text, ok = "Delete", type = null }) => new Promise(done => {
    const el = BB.el;
    const back = el("div", "wm-back");
    const box = el("form", "wm panel cf");
    box.setAttribute("role", "alertdialog");
    box.setAttribute("aria-modal", "true");
    box.setAttribute("aria-labelledby", "cf-h");
    const h = el("h2", null, title); h.id = "cf-h";
    box.append(h, el("p", "hint", text));
    let input = null;
    if (type) {
      const l = el("label", "cf-type");
      l.append(document.createTextNode("Type " + type + " to confirm"));
      input = el("input", "search wm-in"); input.autocomplete = "off"; input.spellcheck = false;
      l.append(input);
      box.append(l);
    }
    const no = el("button", "brick dark sm", "Cancel"); no.type = "button";
    const yes = el("button", "brick red", ok); yes.type = "submit";
    const acts = el("div", "post-actions"); acts.append(no, yes);
    box.append(acts);
    back.append(box);
    document.body.append(back);
    const ready = () => { yes.disabled = !!input && input.value.trim().toUpperCase() !== type; };
    if (input) input.oninput = ready;
    ready();
    const close = v => { back.remove(); document.removeEventListener("keydown", esc); done(v); };
    const esc = e => { if (e.key === "Escape") close(false); };
    document.addEventListener("keydown", esc);
    back.onclick = e => { if (e.target === back) close(false); };
    no.onclick = () => close(false);
    box.onsubmit = e => { e.preventDefault(); if (!yes.disabled) close(true); };
    setTimeout(() => (input || no).focus(), 50);
  });

  /* Delete your own trade ad ("trade_ad") or strategy ("strategy"). Resolves true when deleted. */
  BB.deleteMine = async (kind, id) => {
    const ad = kind === "trade_ad";
    const sure = await BB.confirm({
      title: ad ? "Delete this trade ad?" : "Delete this strategy?",
      text: ad ? "It comes off the trade board here and in Discord. Copies already posted in server channels stay up."
        : "It is removed from the website and from /home → Strategies in Discord.",
    });
    if (!sure) return false;
    const tt = BB.toast("", "wait", { title: ad ? "Deleting trade ad…" : "Deleting strategy…" });
    let data, error;
    try { ({ data, error } = await BB.sb.rpc(ad ? "delete_my_trade_ad" : "delete_my_strategy", ad ? { ad_id: id } : { sid: id })); }
    catch (err) { error = { message: (err && err.message) || "network error" }; }
    if (error) { tt.update(error.message, "bad", { title: "Couldn't delete it" }); return false; }
    if (data === "login") { tt.update("Log in again and retry.", "bad", { title: "Couldn't delete it" }); return false; }
    if (data === "not_found") { tt.update("", "info", { title: "It's already gone" }); return true; }
    tt.update(ad ? "It's off the board here and in Discord." : "It's off the website and Discord.", "ok", { title: ad ? "Trade ad deleted" : "Strategy deleted" });
    return true;
  };

  BB.deleteAccount = async () => {
    const sure = await BB.confirm({
      title: "Delete your Bloombot account?",
      text: "This removes your Roblox link, private server link, profile, live trade ads, strategies, wishlist and website login, on the website and in Discord. Your levels stay. This can't be undone.",
      ok: "Delete my account",
      type: "DELETE",
    });
    if (!sure) return false;
    const tt = BB.toast("", "wait", { title: "Deleting your account…" });
    let data, error;
    try { ({ data, error } = await BB.sb.rpc("delete_my_account")); }
    catch (err) { error = { message: (err && err.message) || "network error" }; }
    if (error || data !== "ok") { tt.update((error && error.message) || "Log in again and retry.", "bad", { title: "Couldn't delete your account" }); return false; }
    try {
      Object.keys(localStorage).filter(k => /^bb_acct_/.test(k)).forEach(k => localStorage.removeItem(k));
    } catch (e) { /* storage blocked */ }
    try { await BB.sb.auth.signOut({ scope: "local" }); } catch (e) { /* the login is already gone */ }
    tt.update("Sorry to see you go. Your levels are kept.", "ok", { title: "Account deleted" });
    return true;
  };

  /* ── first login: create a Bloombot account ──────────────── */
  let checked = null;
  async function checkAccount(s) {
    const id = BB.user(s).id;
    if (!id) { if (!/profile\.html/.test(location.pathname)) connectDialog(false); return; }
    if (checked === id) return;
    checked = id;
    if (/profile\.html/.test(location.pathname)) return;
    let skip = null;
    try { skip = localStorage.getItem("bb_acct_" + id); } catch (e) { /* storage blocked */ }
    if (skip) return;
    try {
      const [{ data: p }, { data: pend }] = await Promise.all([
        BB.sb.from("profiles").select("discord_id").eq("discord_id", id).maybeSingle(),
        BB.sb.from("profile_updates").select("id,status").order("id", { ascending: false }).limit(1),
      ]);
      if (p || (pend && pend.length && pend[0].status !== "rejected")) { remember(id, "has"); return; }
    } catch (e) { return; }
    welcome(id);
  }
  function remember(id, v) { try { localStorage.setItem("bb_acct_" + id, v); } catch (e) { /* ignore */ } }

  function welcome(id) {
    const el = BB.el;
    const back = el("div", "wm-back");
    const box = el("form", "wm panel");
    box.setAttribute("role", "dialog");
    box.setAttribute("aria-modal", "true");
    box.setAttribute("aria-labelledby", "wm-h");
    const logo = el("img", "wm-logo"); logo.src = "img/flower.png"; logo.alt = "";
    const h = el("h2", null, "Welcome to Bloombot!"); h.id = "wm-h";
    const sub = el("p", "hint", "Create your Bloombot account to post trade ads, share strategies and get a profile. It's the same account you use in Discord.");
    const lab = (text, input, opt) => { const l = el("label"); l.append(document.createTextNode(text)); if (opt) l.append(el("em", null, " optional")); l.append(input); return l; };
    const u = el("input", "search wm-in"); u.maxLength = 20; u.autocomplete = "off"; u.placeholder = "Your Roblox username";
    const k = el("input", "search wm-in"); k.maxLength = 300; k.autocomplete = "off"; k.placeholder = "https://www.roblox.com/share?code=...&type=Server";
    const st = el("p", "post-status"); st.hidden = true;
    const say = (kind, t) => { st.hidden = !t; st.className = "post-status " + kind; st.textContent = t; };
    const later = el("button", "brick dark sm", "Later"); later.type = "button";
    const go = el("button", "brick green", "Create account"); go.type = "submit";
    const acts = el("div", "post-actions"); acts.append(later, go);
    const rv = el("button", "rv-other", "Or verify with your Roblox account instead"); rv.type = "button";
    rv.onclick = () => { close(); BB.verifyRoblox({ name: u.value.trim() }); };
    box.append(logo, h, sub, lab("Roblox username", u), lab("Private server link", k, true), acts, rv, st);
    back.append(box);
    document.body.append(back);
    setTimeout(() => u.focus(), 50);
    const close = () => { back.remove(); document.removeEventListener("keydown", esc); };
    const esc = e => { if (e.key === "Escape") { remember(id, "later"); close(); } };
    document.addEventListener("keydown", esc);
    later.onclick = () => { remember(id, "later"); close(); };
    let busy = false;
    box.onsubmit = async e => {
      e.preventDefault();
      if (busy) return;
      const name = u.value.trim(), link = k.value.trim();
      if (!/^[A-Za-z0-9_]{3,20}$/.test(name)) { say("bad", "Your Roblox username needs 3 to 20 letters, numbers or underscores."); u.focus(); return; }
      if (link && !/^https:\/\/www\.roblox\.com\/share\?code=[A-Za-z0-9]+&type=Server$/.test(link)) { say("bad", "That server link isn't right. Leave it empty or paste the Private Server Link from Roblox."); k.focus(); return; }
      busy = true; go.disabled = true; say("wait", "Creating your account…");
      const row = { roblox_username: name };
      if (link) row.server_link = link;
      let data, error;
      try { ({ data, error } = await BB.sb.from("profile_updates").insert(row).select("id").single()); }
      catch (err) { error = { message: (err && err.message) || "network error" }; }
      if (error) { busy = false; go.disabled = false; say("bad", "Couldn't create it: " + error.message); return; }
      const t0 = Date.now();
      const poll = async () => {
        let r = null;
        try { ({ data: r } = await BB.sb.from("profile_updates").select("status,reason").eq("id", data.id).single()); } catch (err) { /* retry */ }
        if (r && r.status === "posted") { remember(id, "has"); say("ok", "Your account is ready!"); BB.toast("Your account is ready.", "ok", { title: "Welcome to Bloombot!" }); setTimeout(close, 1200); return; }
        if (r && r.status === "rejected") { busy = false; go.disabled = false; say("bad", r.reason || "Bloombot couldn't create it."); return; }
        if (Date.now() - t0 > 45000) { remember(id, "has"); say("wait", "Bloombot will finish creating it as soon as it's online."); setTimeout(close, 2500); return; }
        setTimeout(poll, 1500);
      };
      setTimeout(poll, 1000);
    };
  }

  /* ── Verify Roblox: a code in your Roblox About text proves the account is yours ──
     rpc roblox_verify_start gives the code, rpc roblox_verify_check hands it to the bot,
     which reads the public profile and sets the row to verified/failed. */
  /* Any page: a link to #verify opens the verify dialog once you're logged in. */
  let verifyHash = location.hash === "#verify";
  BB.onAuth(sess => {
    if (!verifyHash || !sess) return;
    verifyHash = false;
    history.replaceState(null, "", location.pathname + location.search);
    BB.verifyRoblox();
  });
  addEventListener("hashchange", () => {
    if (location.hash !== "#verify") return;
    history.replaceState(null, "", location.pathname + location.search);
    BB.verifyRoblox();
  });

  BB.robloxTag = p => {
    const t = BB.el("span", "p-tag ok" + (p.roblox_verified ? " vf" : ""), p.roblox_verified ? "Roblox verified" : "Roblox linked");
    t.title = p.roblox_verified ? "Proved they own this Roblox account" : "Not verified yet";
    return t;
  };
  BB.verifyRoblox = (opts = {}) => {
    if (!BB.requireDiscord()) return;
    const el = BB.el, me = BB.user(BB.session).id;
    const back = el("div", "wm-back");
    const box = el("form", "wm panel rv");
    box.setAttribute("role", "dialog");
    box.setAttribute("aria-modal", "true");
    box.setAttribute("aria-labelledby", "rv-h");
    const logo = el("img", "wm-logo"); logo.src = "img/shield.png"; logo.alt = "";
    const h = el("h2", null, "Verify your Roblox account"); h.id = "rv-h";
    const sub = el("p", "hint", "Prove the account is yours with a code in your Roblox About. You get a verified tag, and it creates your Bloombot account if you don't have one yet.");
    const lab = el("label", null, "Roblox username");
    const u = el("input", "search wm-in"); u.maxLength = 20; u.autocomplete = "off"; u.spellcheck = false;
    u.autocapitalize = "off"; u.placeholder = "CoolGardener123"; u.value = opts.name || "";
    lab.append(u);
    const step2 = el("div", "rv-step"); step2.hidden = true;
    const st = el("p", "post-status"); st.hidden = true; st.setAttribute("role", "status");
    const say = (kind, t) => { st.hidden = !t; st.className = "post-status " + kind; st.textContent = t || ""; };
    const cancel = el("button", "brick dark sm", "Cancel"); cancel.type = "button";
    const go = el("button", "brick green", "Get my code"); go.type = "submit";
    const acts = el("div", "post-actions"); acts.append(cancel, go);
    box.append(logo, h, sub, lab, step2, acts, st);
    back.append(box);
    document.body.append(back);
    setTimeout(() => u.focus(), 50);
    let vid = null, code = "", busy = false, done = false;
    const close = () => { back.remove(); document.removeEventListener("keydown", esc); };
    const esc = e => { if (e.key === "Escape" && !busy) close(); };
    document.addEventListener("keydown", esc);
    cancel.onclick = close;
    back.onclick = e => { if (e.target === back && !busy) close(); };

    function showCode(name) {
      lab.hidden = true;
      sub.textContent = "Do this for " + name + ". You can remove the code once you're verified.";
      const codeBox = el("div", "rv-code");
      const txt = el("code", null, code);
      const cp = el("button", "brick blue sm", "Copy"); cp.type = "button";
      cp.onclick = () => BB.copy(code, "Code copied");
      codeBox.append(txt, cp);
      const ol = el("ol", "rv-list");
      const li = (...kids) => { const x = el("li"); x.append(...kids); ol.append(x); };
      li(document.createTextNode("Copy the code above."));
      const open = el("a", null, "your Roblox profile"); open.href = "https://www.roblox.com/users/profile"; open.target = "_blank"; open.rel = "noopener";
      li(document.createTextNode("Open "), open, document.createTextNode(" and press the pencil next to About."));
      li(document.createTextNode("Paste the code anywhere in About and press Save."));
      li(document.createTextNode("Come back and press Check."));
      const other = el("button", "rv-other", "Use a different username"); other.type = "button";
      other.onclick = () => { if (busy) return; vid = null; step2.hidden = true; lab.hidden = false; go.textContent = "Get my code"; say("", ""); u.focus(); };
      step2.replaceChildren(codeBox, ol, other);
      step2.hidden = false;
      go.textContent = "Check";
    }

    async function start() {
      const name = u.value.trim();
      if (!/^[A-Za-z0-9_]{3,20}$/.test(name)) { say("bad", "Your Roblox username needs 3 to 20 letters, numbers or underscores."); u.focus(); return; }
      busy = true; go.disabled = true; say("wait", "Getting your code…");
      const { data, error } = await BB.sb.rpc("roblox_verify_start", { p_username: name }).then(r => r, e => ({ error: e }));
      busy = false; go.disabled = false;
      if (error) { say("bad", /function|schema/i.test(error.message || "") ? "Roblox verify isn't switched on yet. Try again later." : "Couldn't get a code: " + (error.message || "network error")); return; }
      if (!data || data.error) { say("bad", (data && data.error) || "Couldn't get a code."); return; }
      vid = data.id; code = data.code;
      say("", "");
      showCode(name);
    }

    async function check() {
      busy = true; go.disabled = true; go.classList.add("busy");
      say("wait", "Bloombot is reading your Roblox profile…");
      const stop = (kind, t) => { busy = false; go.disabled = false; go.classList.remove("busy"); say(kind, t); };
      const { data: r0, error } = await BB.sb.rpc("roblox_verify_check", { vid }).then(r => r, e => ({ error: e }));
      if (error) return stop("bad", "Couldn't check: " + (error.message || "network error"));
      if (r0 !== "ok" && r0 !== "verified") return stop("bad", r0 || "Couldn't check.");
      const t0 = Date.now();
      const poll = async () => {
        if (!back.isConnected) return;
        let r = null;
        try { ({ data: r } = await BB.sb.from("roblox_verifications").select("status,reason").eq("id", vid).single()); } catch (e) { /* retry */ }
        if (r && r.status === "verified") {
          done = true; busy = false; go.classList.remove("busy");
          try { localStorage.setItem("bb_acct_" + me, "has"); } catch (e) { /* ignore */ }
          say("ok", "Verified! Your Roblox account is linked to Bloombot.");
          go.textContent = "Done"; go.disabled = false; cancel.hidden = true;
          step2.querySelectorAll(".rv-other").forEach(x => x.remove());
          BB.toast("Your Roblox account is verified.", "ok", { title: "Roblox verified" });
          document.dispatchEvent(new CustomEvent("bb:roblox-verified"));
          if (opts.done) opts.done();
          return;
        }
        if (r && r.status === "failed") return stop("bad", r.reason || "Bloombot couldn't find the code.");
        if (Date.now() - t0 > 45000) return stop("wait", "Bloombot is busy or offline. Press Check again in a minute.");
        setTimeout(poll, 1500);
      };
      setTimeout(poll, 1200);
    }

    box.onsubmit = e => {
      e.preventDefault();
      if (busy) return;
      if (done) { close(); return; }
      if (vid) check(); else start();
    };
  };

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

  /* ── levels + ranks (same numbers as bot/leveling.py) ── */
  const EMO = id => "https://cdn.discordapp.com/emojis/" + id + ".png?size=96&quality=lossless";
  BB.RANKS = [
    { level: 1, name: "Seedling", color: "#8b95a1", icon: EMO("1548052374604484689") },
    { level: 5, name: "Sprout", color: "#c7834a", icon: EMO("1548052510328234064") },
    { level: 10, name: "Bloom", color: "#d0c8c6", icon: EMO("1548052388810850334") },
    { level: 20, name: "Blossom", color: "#6fb2ff", icon: EMO("1548052382448099408") },
    { level: 35, name: "Grove", color: "#b07cff", icon: EMO("1548052473451773983") },
    { level: 50, name: "Ancient Tree", color: "#ffc447", icon: EMO("1548052475964039189") },
  ];
  BB.xpForNext = lv => 5 * lv * lv + 50 * lv + 100;
  /* total XP -> { level, into, need, total } */
  BB.levelFromXp = xp => {
    let level = 1, rest = Math.max(0, Math.floor(Number(xp) || 0));
    while (rest >= BB.xpForNext(level) && level < 1000) { rest -= BB.xpForNext(level); level++; }
    return { level, into: rest, need: BB.xpForNext(level), total: Math.max(0, Math.floor(Number(xp) || 0)) };
  };
  BB.xpAtLevel = lv => { let t = 0; for (let i = 1; i < lv; i++) t += BB.xpForNext(i); return t; };
  BB.rankFor = lv => BB.RANKS.reduce((r, x) => (lv >= x.level ? x : r), BB.RANKS[0]);
  BB.rankTag = lv => {
    const r = BB.rankFor(lv || 1);
    const t = BB.el("a", "p-tag rank-tag");
    t.href = "levels.html";
    t.dataset.page = "";
    t.style.setProperty("--rk", r.color);
    if (r.level >= 50) t.classList.add("ancient");
    const i = BB.el("img"); i.alt = ""; i.src = r.icon;
    i.onerror = () => { if (i.src.indexOf("img/shield.png") < 0) i.src = "img/shield.png"; };
    t.append(i, BB.el("span", null, r.name));
    t.title = r.name + " rank · Level " + (lv || 1);
    return t;
  };

  /* ── profile banners (Profile settings → Banner; table profile_banners) ── */
  BB.BANNERS = [
    ["auto", "Surprise me"], ["green", "Grass"], ["blue", "Sky"], ["purple", "Mythic"],
    ["red", "Brick"], ["orange", "Sunset"], ["yellow", "Gold"], ["ocean", "Ocean"], ["candy", "Candy"],
    ["night", "Night"], ["rainbow", "Rainbow"],
    ["aurora", "Aurora", 5], ["lava", "Lava", 10], ["galaxy", "Galaxy", 20], ["royal", "Royal", 35], ["ancient", "Ancient", 50],
  ];
  /* banner colour -> level it unlocks at (checked again by set_my_banner) */
  BB.bannerLevel = color => ((BB.BANNERS.find(b => b[0] === color) || [])[2] || 0);
  const AUTO = ["blue", "green", "purple", "orange", "ocean", "candy"];
  /* key = colour, optionally + "-weld" (default texture is studs) */
  BB.bannerParts = key => {
    const m = String(key || "auto").match(/^(.*?)(?:-(studs|weld))?$/);
    return { color: BB.BANNERS.some(b => b[0] === m[1]) ? m[1] : "auto", tex: m[2] || "studs" };
  };
  BB.bannerKey = (color, tex) => tex === "weld" ? color + "-weld" : color;
  BB.paintBanner = (node, key, id) => {
    const parts = BB.bannerParts(key);
    node.dataset.tex = parts.tex;
    let k = parts.color;
    if (k === "auto") k = AUTO[[...String(id || "0")].reduce((a, c) => a + c.charCodeAt(0), 0) % AUTO.length];
    node.dataset.banner = k;
    return k;
  };
  const bannerCache = {};
  BB.getBanner = async id => {
    if (!id || !BB.sb || !BB.session) return "auto";
    if (bannerCache[id]) return bannerCache[id];
    try {
      const { data, error } = await BB.sb.from("profile_banners").select("banner").eq("discord_id", id).maybeSingle();
      if (error) return "auto";
      return (bannerCache[id] = (data && data.banner) || "auto");
    } catch (e) { return "auto"; }
  };
  BB.setBanner = async key => {
    const { error } = await BB.sb.rpc("set_my_banner", { b: key });
    if (!error) bannerCache[BB.user(BB.session).id] = key;
    return error;
  };

  /* ── profile popup: opens a player's profile on top of the current page ── */
  let popOpen = null;
  BB.openProfile = async (id, hint = {}) => {
    const el = BB.el;
    if (popOpen) popOpen(true);
    const opener = document.activeElement;
    const back = el("div", "wm-back upop-back");
    const box = el("div", "upop");
    box.setAttribute("role", "dialog");
    box.setAttribute("aria-modal", "true");
    box.setAttribute("aria-label", (hint.name || "Player") + "'s profile");
    box.tabIndex = -1;
    const banner = el("div", "upop-ban pban");
    BB.paintBanner(banner, bannerCache[id] || "auto", id);
    const x = el("button", "upop-x");
    x.type = "button";
    x.setAttribute("aria-label", "Close profile");
    x.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path stroke="currentColor" stroke-width="2.6" stroke-linecap="round" d="M7 7l10 10M17 7 7 17"/></svg>';
    const body = el("div", "upop-body");
    box.append(banner, x, body);
    back.append(box);
    document.body.append(back);
    document.documentElement.classList.add("upop-lock");
    const img = (src, cls) => {
      const i = el("img", cls);
      i.alt = "";
      i.src = BB.safeUrl(src) || "img/flower.png";
      i.onerror = () => { if (i.src.indexOf("img/flower.png") < 0) i.src = "img/flower.png"; };
      return i;
    };
    const close = quick => {
      if (!back.isConnected) return;
      popOpen = null;
      document.removeEventListener("keydown", key);
      document.documentElement.classList.remove("upop-lock");
      if (quick) back.remove();
      else { back.classList.add("out"); setTimeout(() => back.remove(), 180); }
      if (opener && opener.focus && !quick) opener.focus({ preventScroll: true });
    };
    popOpen = close;
    const key = e => {
      if (e.key === "Escape" && !document.querySelector(".wm-back:not(.upop-back)")) { e.preventDefault(); close(); }
      if (e.key === "Tab") {
        const f = [...box.querySelectorAll("a[href],button:not([disabled])")];
        if (!f.length) return;
        if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
        else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
      }
    };
    document.addEventListener("keydown", key);
    back.addEventListener("click", e => { if (e.target === back) close(); });
    x.onclick = () => close();
    setTimeout(() => x.focus({ preventScroll: true }), 30);

    const top = el("div", "upop-top");
    const avs = el("div", "upop-avs");
    avs.append(img(hint.avatar, "upop-av"));
    top.append(avs);
    const name = el("h2", "upop-name", hint.name || "Loading…");
    const tags = el("div", "p-tags");
    body.append(top, name, tags, el("div", "upop-sk"));

    if (!BB.session) {
      body.querySelector(".upop-sk").remove();
      const p = el("p", "hint upop-note", "Log in with Discord to see player profiles.");
      const b = el("button", "brick discord sm", "Log in with Discord");
      b.type = "button";
      b.onclick = () => BB.login();
      const acts = el("div", "upop-acts"); acts.append(b);
      body.append(p, acts);
      return;
    }
    const isMe = BB.user(BB.session).id === id;
    let p = null, ads = [], strs = [];
    try {
      BB.getBanner(id).then(k => BB.paintBanner(banner, k, id));
      const [a, b, c] = await Promise.all([
        BB.sb.from("profiles").select("*").eq("discord_id", id).maybeSingle(),
        BB.sb.from("trade_ads").select("id,content,created_at,expires_at").eq("discord_id", id).order("created_at", { ascending: false }).limit(10),
        BB.sb.from("strategies").select("id,title,category").eq("author_id", id).order("id", { ascending: false }).limit(10),
      ]);
      p = a.data; ads = (b.data || []).filter(r => !r.expires_at || new Date(r.expires_at) > Date.now()); strs = c.data || [];
    } catch (err) { /* show what we have */ }
    if (!back.isConnected) return;
    body.querySelector(".upop-sk").remove();
    if (isMe && !p) p = { discord_name: BB.user(BB.session).name, discord_avatar: BB.user(BB.session).avatar };
    const nm = (p && p.discord_name) || hint.name || "Unknown player";
    name.textContent = nm;
    box.setAttribute("aria-label", nm + "'s profile");
    if (p && p.discord_avatar) avs.firstChild.src = BB.safeUrl(p.discord_avatar) || avs.firstChild.src;
    if (p && p.roblox_avatar) avs.append(img(p.roblox_avatar, "upop-rav"));
    if (p && p.registered_at) tags.append(el("span", "p-tag", "Joined " + new Date(p.registered_at).toLocaleDateString(undefined, { month: "short", year: "numeric" })));
    if (p && p.level) tags.append(BB.rankTag(p.level));
    if (p && p.roblox_name) tags.append(BB.robloxTag(p));
    if (isMe) tags.append(el("span", "p-tag you", "You"));
    if (p && p.level >= 50) name.classList.add("ancient-name");
    if (p && p.level >= 20) box.classList.add("rk-ring");
    if (p && p.level) box.style.setProperty("--rk", BB.rankFor(p.level).color);
    if (isMe) {
      const cb = el("a", "upop-cb", "Change banner");
      cb.href = "profile.html#edit";
      cb.dataset.page = "";
      box.append(cb);
    }

    if (!p || (!p.roblox_name && !isMe)) body.append(el("p", "hint upop-note", "This player hasn't linked a Roblox account to Bloombot yet."));
    if (p && p.description) {
      const d = el("div", "upop-sec");
      d.append(el("h3", "upop-h", "About me"), BB.md(p.description, { cls: "p-desc" }));
      body.append(d);
    }
    const stats = el("div", "upop-stats");
    const stat = (v, l, g, ic) => {
      const s = el("div", "weld " + g);
      const i = el("img"); i.alt = ""; i.src = "img/" + ic + ".png";
      s.append(i, el("strong", null, String(v)), el("span", null, l));
      return s;
    };
    stats.append(stat(p && p.level ? p.level : "–", "Level", "g-yellow", "medal_gold"), stat(ads.length, ads.length === 1 ? "Trade ad" : "Trade ads", "g-blue", "swap"), stat(strs.length, strs.length === 1 ? "Strategy" : "Strategies", "g-purple", "bullseye"));
    body.append(stats);

    const accs = el("div", "upop-accs");
    const pill = (kind, label, val, href) => {
      const a = el(href ? "a" : "span", "acc " + kind);
      if (href) { a.href = href; a.target = "_blank"; a.rel = "noopener nofollow"; }
      const t = el("span", "acc-t");
      t.append(el("em", null, label), el("strong", null, val));
      a.append(t);
      return a;
    };
    if (!isMe) accs.append(pill("discord", "Discord", "Message", "https://discord.com/users/" + id));
    accs.append(p && p.roblox_name ? pill("roblox", "Roblox", p.roblox_name, BB.safeUrl(p.roblox_url)) : pill("roblox", "Roblox", "Not linked", null));
    body.append(accs);

    if (ads.length) {
      const s = el("div", "upop-sec");
      const h = el("div", "upop-sh");
      const all = el("a", null, "All ads →"); all.href = isMe ? "trades.html?mine=1" : "trades.html";
      h.append(el("h3", "upop-h", "Live trade ads"), all);
      s.append(h);
      ads.slice(0, 3).forEach(a => {
        const c = el("div", "upop-ad");
        c.append(BB.md(a.content, { cls: "tc-text" }), el("span", "upop-ago", BB.ago(a.created_at)));
        s.append(c);
      });
      body.append(s);
    }
    if (strs.length) {
      const s = el("div", "upop-sec");
      s.append(el("h3", "upop-h", "Strategies"));
      const l = el("div", "upop-strs");
      strs.slice(0, 4).forEach(st => {
        const a = el("a", "upop-str");
        a.href = "strategies.html#s-" + st.id;
        const t = el("strong"); BB.mdInline(t, st.title);
        a.append(t, el("span", null, (st.category || "").replace("-", " ")));
        a.onclick = () => close(true);
        l.append(a);
      });
      s.append(l);
      body.append(s);
    }

    const acts = el("div", "upop-acts");
    if (isMe) {
      const e = el("a", "brick blue sm", "Edit profile"); e.href = "profile.html#edit";
      acts.append(e);
    }
    const link = location.origin + location.pathname.replace(/[^/]*$/, "profile.html") + "?id=" + encodeURIComponent(id);
    const cp = el("button", "brick dark sm", "Copy link"); cp.type = "button";
    cp.onclick = () => BB.share(link, "Bloombot profile");
    const full = el("a", "brick dark sm", "Full profile"); full.href = "profile.html?id=" + encodeURIComponent(id); full.dataset.page = "";
    acts.append(cp, full);
    body.append(acts);
  };

  /* Any link to a profile opens the popup instead (Ctrl/middle click still opens the page). */
  document.addEventListener("click", e => {
    if (e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
    const a = e.target.closest && e.target.closest('a[href^="profile.html"]');
    if (!a || a.hasAttribute("data-page") || !BB.sb) return;
    const u = new URL(a.href, location.href);
    if (u.hash === "#edit") return;
    const id = u.searchParams.get("id") || (BB.session && BB.user(BB.session).id);
    if (!id) return;
    e.preventDefault();
    const acct = document.getElementById("acct");
    if (acct) acct.classList.remove("open");
    const av = a.querySelector("img");
    const nm = a.dataset.name || (a.querySelector("strong, span:not(.me-view):not(.me-meta)") || {}).textContent;
    e.stopPropagation();
    const qs = a.closest(".qs-wrap");
    if (qs) qs.dispatchEvent(new MouseEvent("mousedown", { bubbles: false }));
    BB.openProfile(id, { name: nm && nm.trim(), avatar: av && av.src });
  }, true);

  function init() {
    const burger = document.getElementById("burger");
    if (burger) burger.onclick = () => {
      const open = document.getElementById("links").classList.toggle("open");
      const acct = document.getElementById("acct");
      if (open && acct) acct.classList.remove("open");
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
