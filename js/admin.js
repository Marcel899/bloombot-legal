// Bloombot admin dashboard. Owner only: every number comes from owner-checked database functions
// (public.admin_* in Supabase, see sql/site-admin.sql). This file only draws what the server allows;
// hiding or showing things here is not what keeps the data safe.
(function () {
  "use strict";
  const C = window.AC;
  const SB_URL = "https://rkzgsndfzzgezoltddvx.supabase.co";
  const SB_KEY = "sb_publishable_CfTjHiYYCGqLZMlgpiKN-Q_m7JNITb5";
  const $ = (q, r) => (r || document).querySelector(q);
  const $$ = (q, r) => Array.from((r || document).querySelectorAll(q));
  const esc = (t) => String(t == null ? "" : t).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const full = C.full, compact = C.compact;
  const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const WD = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const DAY = 864e5;
  const fdate = (d) => (d ? d.getDate() + " " + MON[d.getMonth()] + " " + d.getFullYear() : "–");
  const fshort = (d) => d.getDate() + " " + MON[d.getMonth()];
  const ftime = (d) => String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
  const sum = (a) => a.reduce((x, y) => x + (+y || 0), 0);
  const ic = (n) => `img/${n}${n.includes(".") ? "" : ".png"}`;
  const isoDay = (d) => d.getUTCFullYear() + "-" + String(d.getUTCMonth() + 1).padStart(2, "0") + "-" + String(d.getUTCDate()).padStart(2, "0");
  const isId = (t) => /^[0-9]{15,22}$/.test(String(t || ""));
  // SQLite times ("2026-11-07 10:00:00", UTC) and ISO times both become Dates.
  function toDate(t) {
    if (!t) return null;
    const s = String(t);
    const d = new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(s) ? s : s.replace(" ", "T") + "Z");
    return isNaN(d) ? null : d;
  }
  function ago(d) {
    if (!d) return "–";
    const s = Math.round((Date.now() - d.getTime()) / 1000);
    if (s < 45) return "just now";
    if (s < 3600) return Math.max(1, Math.floor(s / 60)) + "m ago";
    if (s < 86400) return Math.floor(s / 3600) + "h ago";
    if (s < 86400 * 30) return Math.floor(s / 86400) + "d ago";
    return fdate(d);
  }
  const SRCH = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" d="M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15Zm5.4-2.1L21 21"/></svg>';

  // ---------- state ----------
  let sb = null, session = null;
  const S = { ov: null, profiles: [], users: [], byId: new Map(), D: null, loadedAt: null, trade: null, logs: null, values: null, gw: null };

  // ---------- server calls ----------
  async function rpc(fn, args) {
    const { data, error } = await sb.rpc(fn, args || {});
    if (error) throw new Error(error.message || "Request failed");
    if (data && data.error) {
      if (/session|not logged|not an owner/.test(data.error)) gate(data.error);
      throw new Error(data.error);
    }
    return data;
  }

  // ---------- turning server data into series ----------
  function build() {
    const ov = S.ov, bot = ov.bot || {};
    const st = (bot.stats && bot.stats.data) || {};
    const N = 400;
    const end = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate()));
    const days = [], keys = [];
    for (let i = N - 1; i >= 0; i--) { const d = new Date(end.getTime() - i * DAY); keys.push(isoDay(d)); days.push(new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())); }
    const idx = new Map(keys.map((k, i) => [k, i]));
    const arr = () => new Array(N).fill(0);
    const fill = (rows, col, into) => { (rows || []).forEach((r) => { const i = idx.get(String(r[0]).slice(0, 10)); if (i != null) into[i] = +r[col] || 0; }); return into; };
    const tr = ov.traffic || {};
    const D = {
      N, days, keys,
      visits: fill(tr.days, 1, arr()), uniques: fill(tr.days, 2, arr()),
      regs: fill(st.daily_users, 1, arr()), verified: fill(st.daily_verified, 1, arr()),
      cmds: fill(st.daily_commands, 1, arr()), cmdErr: fill(st.daily_commands, 2, arr()), cmdMs: fill(st.daily_commands, 3, arr()),
      active: fill(st.daily_commands, 4, arr()), ads: fill(st.daily_ads, 1, arr()),
      webAds: fill(ov.website_ads, 2, arr()), webTries: fill(ov.website_ads, 1, arr()),
      cats: {}, hasBot: !!bot.stats, hasTraffic: !!tr.first_day, trafficSince: tr.first_day ? toDate(tr.first_day + "T00:00:00Z") : null,
    };
    if (!st.daily_users && ov.accounts) { fill(ov.accounts.per_day, 1, D.regs); fill(ov.accounts.per_day, 2, D.verified); }
    (st.daily_categories || []).forEach(([day, cat, n]) => { const i = idx.get(String(day).slice(0, 10)); if (i == null) return; (D.cats[cat] = D.cats[cat] || arr())[i] += +n || 0; });
    D.lookups = (D.cats.Values || arr()).slice();
    const t = st.totals || {};
    D.totalUsers = t.users != null ? t.users : (ov.accounts || {}).total || 0;
    D.totalVerified = t.verified != null ? t.verified : (ov.accounts || {}).verified || 0;
    D.totals = t;
    S.D = D;
    // users: bot accounts merged with website profiles
    const map = new Map();
    const get = (id) => { let u = map.get(id); if (!u) { u = { id, name: "", avatar: "", roblox: "", robloxUrl: "", verified: false, registered: null, last: null, cmds: 0, ads: 0, warns: 0, banned: false, xp: null, level: null }; map.set(id, u); } return u; };
    ((bot.users && bot.users.data) || []).forEach(([id, roblox, reg, cmds, last, ads, warns, banned, xp, ver]) => {
      const u = get(String(id)); Object.assign(u, { roblox: roblox || "", registered: toDate(reg), cmds: +cmds || 0, last: toDate(last), ads: +ads || 0, warns: +warns || 0, banned: !!banned, xp, verified: !!ver });
    });
    (S.profiles || []).forEach((p) => {
      const u = get(String(p.id));
      u.name = p.name || u.name; u.avatar = /^https:\/\/(cdn\.discordapp\.com|media\.discordapp\.net)\//.test(p.avatar || "") ? p.avatar : ""; u.roblox = u.roblox || p.roblox || ""; u.robloxUrl = p.roblox_url || "";
      u.verified = u.verified || !!p.verified; u.level = p.level; u.xp = u.xp != null ? u.xp : p.xp;
      u.registered = u.registered || toDate(p.registered_at);
    });
    ((st.bans) || []).forEach(([id]) => { if (map.has(String(id))) map.get(String(id)).banned = true; });
    S.users = Array.from(map.values()).sort((a, b) => (b.registered || 0) - (a.registered || 0));
    S.byId = map;
  }
  const botKey = (k) => (S.ov && S.ov.bot && S.ov.bot[k]) || null;
  const stats = () => (botKey("stats") && botKey("stats").data) || {};
  const nameOf = (id) => { const u = S.byId.get(String(id)); return u && u.name ? u.name : String(id || "–"); };
  function botOnline() {
    const s = botKey("status");
    if (!s) return { state: "unknown", text: "No data yet" };
    const age = Date.now() - toDate(s.updated_at).getTime();
    if (age > 5 * 60e3) return { state: "crit", text: "Offline for " + ago(toDate(s.updated_at)).replace(" ago", ""), age };
    return { state: s.data.online ? "good" : "warn", text: s.data.online ? "Online" : "Starting", age };
  }

  // ---------- shared UI (toasts, modals, tables, tabs) ----------
  function toast(msg, icon) {
    const t = document.createElement("div");
    t.className = "toast";
    t.innerHTML = `<img src="${ic(icon || "verified_stud")}" alt=""><span></span>`;
    t.querySelector("span").textContent = msg;
    $("#toasts").appendChild(t);
    setTimeout(() => { t.classList.add("out"); setTimeout(() => t.remove(), 250); }, 3200);
  }
  function openModal(html, onOpen) {
    const m = $("#modal");
    m.innerHTML = html;
    $("#scrim").classList.add("on");
    m.classList.add("on");
    if (onOpen) onOpen(m);
    setTimeout(() => { const f = m.querySelector("input,select,textarea,[data-yes]"); if (f) f.focus(); }, 50);
    return m;
  }
  function closeModal() { $("#modal").classList.remove("on"); if (!$("#drawer").classList.contains("on")) $("#scrim").classList.remove("on"); }
  function confirmBox(opts) {
    return new Promise((res) => {
      const m = openModal(`<h3></h3><p></p>${opts.typed ? '<div class="field"><label for="mtyped">Type <b></b> to confirm</label><input class="inp" id="mtyped" autocomplete="off"></div>' : ""}${opts.reason ? `<div class="field"><label for="mreason">Reason${opts.reason === "need" ? "" : " (optional)"}</label><input class="inp" id="mreason" maxlength="300" placeholder="Saved in the moderation log"></div>` : ""}<div class="mf"><button class="btn g-dark" data-no type="button">Cancel</button><button class="btn ${opts.danger ? "g-red" : "g-green"}" data-yes type="button"></button></div>`);
      m.querySelector("h3").textContent = opts.title;
      m.querySelector("p").textContent = opts.text;
      const yes = m.querySelector("[data-yes]");
      yes.textContent = opts.ok || "Confirm";
      const check = () => {
        const typed = !opts.typed || m.querySelector("#mtyped").value.trim() === opts.typed;
        const rs = opts.reason !== "need" || m.querySelector("#mreason").value.trim().length > 0;
        yes.disabled = !(typed && rs);
        yes.classList.toggle("off", yes.disabled);
      };
      if (opts.typed) m.querySelector("label b").textContent = opts.typed;
      $$("input", m).forEach((i) => i.addEventListener("input", check));
      check();
      const done = (v) => { closeModal(); res(v); };
      yes.addEventListener("click", () => done({ reason: (m.querySelector("#mreason") || {}).value || "" }));
      m.querySelector("[data-no]").addEventListener("click", () => done(null));
      m._close = () => done(null);
    });
  }
  function seg(host, opts, cur, onPick) {
    host.classList.add("seg");
    host.setAttribute("role", "group");
    host.innerHTML = opts.map(([v, l]) => `<button type="button" data-v="${esc(v)}" class="${String(v) === String(cur) ? "on" : ""}">${esc(l)}</button>`).join("");
    $$("button", host).forEach((b) => b.addEventListener("click", () => { $$("button", host).forEach((x) => x.classList.toggle("on", x === b)); onPick(b.dataset.v); }));
  }
  function tabs(host, opts, cur, onPick) {
    host.className = "tabs";
    host.setAttribute("role", "tablist");
    host.innerHTML = opts.map(([v, l]) => `<button type="button" role="tab" data-v="${esc(v)}" aria-selected="${v === cur}" class="${v === cur ? "on" : ""}">${esc(l)}</button>`).join("");
    $$("button", host).forEach((b) => b.addEventListener("click", () => { $$("button", host).forEach((x) => { x.classList.toggle("on", x === b); x.setAttribute("aria-selected", x === b); }); onPick(b.dataset.v); }));
  }
  function table(host, cfg) {
    const st = { sort: cfg.sort || null, dir: cfg.dir || -1, page: 0, per: cfg.per || 15 };
    host.classList.add("card", "flush");
    function draw() {
      const rows = cfg.rows().slice();
      if (st.sort) {
        const col = cfg.cols.find((c) => c.key === st.sort);
        const f = col.sort || ((r) => r[col.key]);
        rows.sort((a, b) => { let x = f(a), y = f(b); if (x == null) x = -Infinity; if (y == null) y = -Infinity; if (x instanceof Date) x = +x; if (y instanceof Date) y = +y; return (x > y ? 1 : x < y ? -1 : 0) * st.dir; });
      }
      const pages = Math.max(1, Math.ceil(rows.length / st.per));
      st.page = Math.min(st.page, pages - 1);
      const slice = rows.slice(st.page * st.per, st.page * st.per + st.per);
      host.innerHTML = `<div class="tw"><table class="t${cfg.cls ? " " + cfg.cls : ""}"><thead><tr>${cfg.cols.map((c) => `<th class="${c.n ? "n " : ""}${c.nosort ? "" : "sort "}${c.hide ? "hide-sm " : ""}${st.sort === c.key ? (st.dir > 0 ? "asc" : "desc") : ""}" data-k="${c.key}" ${c.nosort ? "" : 'tabindex="0"'} scope="col">${esc(c.label)}${c.nosort ? "" : `<span class="ar">${st.sort === c.key ? (st.dir > 0 ? "▲" : "▼") : "↕"}</span>`}</th>`).join("")}</tr></thead>
        <tbody>${slice.length ? slice.map((r, i) => `<tr data-i="${i}" class="${cfg.onRow ? "click" : ""}"${cfg.onRow ? ' tabindex="0"' : ""}>${cfg.cols.map((c) => `<td class="${c.n ? "n " : ""}${c.hide ? "hide-sm " : ""}${c.cls || ""}">${c.render ? c.render(r) : esc(r[c.key])}</td>`).join("")}</tr>`).join("") : `<tr><td colspan="${cfg.cols.length}" class="empty-row">${esc(cfg.empty || "Nothing matches these filters.")}</td></tr>`}</tbody></table></div>
        ${rows.length > st.per ? `<div class="pager"><span>${full(st.page * st.per + 1)}–${full(Math.min(rows.length, (st.page + 1) * st.per))} of ${full(rows.length)}</span><div class="pg"><button type="button" data-p="-1" ${st.page ? "" : "disabled"} aria-label="Previous page">‹</button>${pageBtns(st.page, pages)}<button type="button" data-p="+1" ${st.page < pages - 1 ? "" : "disabled"} aria-label="Next page">›</button></div></div>` : rows.length ? `<div class="pager"><span>${full(rows.length)} ${rows.length === 1 ? "row" : "rows"}</span></div>` : ""}`;
      $$("th.sort", host).forEach((th) => {
        const go = () => { if (st.sort === th.dataset.k) st.dir *= -1; else { st.sort = th.dataset.k; st.dir = cfg.cols.find((c) => c.key === th.dataset.k).n ? -1 : 1; } draw(); };
        th.addEventListener("click", go);
        th.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(); } });
      });
      $$(".pager button", host).forEach((b) => b.addEventListener("click", () => { const p = b.dataset.p; st.page = p === "-1" ? st.page - 1 : p === "+1" ? st.page + 1 : +p; draw(); }));
      if (cfg.onRow) $$("tbody tr[data-i]", host).forEach((tr) => {
        const go = (e) => { if (e.target.closest("button,a,input,select")) return; cfg.onRow(slice[+tr.dataset.i]); };
        tr.addEventListener("click", go);
        tr.addEventListener("keydown", (e) => { if (e.key === "Enter") go(e); });
      });
      if (cfg.after) cfg.after(host, slice);
    }
    draw();
    return { draw, reset: () => { st.page = 0; draw(); } };
  }
  function pageBtns(p, n) {
    const out = [];
    const add = (i) => out.push(`<button type="button" data-p="${i}" class="${i === p ? "on" : ""}">${i + 1}</button>`);
    if (n <= 7) { for (let i = 0; i < n; i++) add(i); return out.join(""); }
    add(0);
    const a = Math.max(1, p - 1), b = Math.min(n - 2, p + 1);
    if (a > 1) out.push('<button type="button" disabled>…</button>');
    for (let i = a; i <= b; i++) add(i);
    if (b < n - 2) out.push('<button type="button" disabled>…</button>');
    add(n - 1);
    return out.join("");
  }
  function deltaHtml(cur, prev) {
    if (!prev) return "";
    const p = ((cur - prev) / prev) * 100;
    const cls = Math.abs(p) < 0.5 ? "flat" : p > 0 ? "up" : "down";
    return `<span class="delta ${cls}">${p >= 0 ? "▲" : "▼"} ${Math.abs(p).toFixed(1)}%</span>`;
  }
  function kpi(label, icon, value, cur, prev, spark, color, note) {
    return { html: `<div class="kpi"><div class="kl"><img src="${ic(icon)}" alt="">${esc(label)}</div><div class="kv">${value}</div><div class="kd">${cur == null ? "" : deltaHtml(cur, prev)}<span>${esc(note || (prev ? "vs previous period" : ""))}</span></div><div class="spk"></div></div>`, spark, color };
  }
  function renderKpis(host, list) {
    host.className = "kpis";
    host.innerHTML = list.map((k) => k.html).join("");
    $$(".spk", host).forEach((s, i) => { const sp = list[i].spark; if (sp && sp.some((x) => x > 0)) s.replaceWith(C.spark(sp, list[i].color || C.PAL[0])); else s.remove(); });
  }
  const empty = (host, title, text) => { host.innerHTML = `<div class="empty"><img src="img/clock.png" alt=""><b>${esc(title)}</b><span>${esc(text)}</span></div>`; };
  const skel = (n) => `<div class="skel-wrap">${Array.from({ length: n || 6 }, () => '<i class="skel"></i>').join("")}</div>`;
  const avatar = (u) => `<img src="${esc(u && u.avatar ? u.avatar : "img/task_user.png")}" alt="" loading="lazy" referrerpolicy="no-referrer">`;
  const verPill = (u) => (u.verified ? '<span class="pill green"><img src="img/verified_stud.png" alt="">Verified</span>' : u.roblox ? '<span class="pill gray">Linked</span>' : '<span class="pill gray">No Roblox</span>');
  function statusPill(s) { return `<span class="pill ${{ Active: "green", Banned: "red", Live: "green", posted: "green", rejected: "red", pending: "yellow", done: "green", failed: "red", verified: "green", error: "red", join: "blue", leave: "gray", Done: "green", Ended: "gray", Won: "purple" }[s] || "gray"}">${esc(s)}</span>`; }
  const robloxLink = (u) => (u.roblox ? (u.robloxUrl && /^https:\/\/www\.roblox\.com\//.test(u.robloxUrl) ? `<a href="${esc(u.robloxUrl)}" target="_blank" rel="noopener noreferrer">${esc(u.roblox)}</a>` : esc(u.roblox)) : '<span class="faint">–</span>');
  const userCell = (u) => `<div class="who">${avatar(u)}<div><b>${esc(u.name || u.id)}</b><small>${esc(u.id)}</small></div></div>`;

  // ---------- date range ----------
  const RANGE = { days: 30, from: null, to: null };
  function rangeIdx() {
    const D = S.D;
    if (RANGE.from && RANGE.to) {
      const a = Math.round((RANGE.from - D.days[0]) / DAY), b = Math.round((RANGE.to - D.days[0]) / DAY);
      return [Math.max(0, Math.min(a, b)), Math.min(D.N - 1, Math.max(a, b))];
    }
    return [Math.max(0, D.N - RANGE.days), D.N - 1];
  }
  const slice = (a) => { const [x, y] = rangeIdx(); return a.slice(x, y + 1); };
  const prevSlice = (a) => { const [x, y] = rangeIdx(); const n = y - x + 1; return x - n < 0 ? [] : a.slice(x - n, x); };
  const rangeLabels = () => { const [x, y] = rangeIdx(); return S.D.days.slice(x, y + 1); };
  function bucket(arrs) {
    const L = rangeLabels();
    if (L.length <= 120) return { labels: L, arrs };
    const labels = [], out = arrs.map(() => []);
    for (let i = 0; i < L.length; i += 7) { labels.push(L[i]); arrs.forEach((a, k) => out[k].push(sum(a.slice(i, i + 7)))); }
    return { labels, arrs: out, weekly: true };
  }
  const tipFor = (b) => (i) => (b.weekly ? "Week of " : WD[b.labels[i].getDay()] + " ") + fdate(b.labels[i]);
  function rangeBar(host, onChange) {
    host.className = "filters";
    host.innerHTML = `<div class="rseg"></div><label class="sr" for="rfrom">From</label><input type="date" class="inp date-in" id="rfrom"><span class="faint">to</span><label class="sr" for="rto">To</label><input type="date" class="inp date-in" id="rto"><span class="sp"></span><span class="muted rtext"></span>`;
    const loc = (d) => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
    const f = $("#rfrom", host), t = $("#rto", host), D = S.D;
    f.min = t.min = loc(D.days[0]); f.max = t.max = loc(D.days[D.N - 1]);
    const sync = () => { const [a, b] = rangeIdx(); f.value = loc(D.days[a]); t.value = loc(D.days[b]); $(".rtext", host).textContent = fshort(D.days[a]) + " – " + fdate(D.days[b]); };
    seg($(".rseg", host), [["1", "Today"], ["7", "7 days"], ["30", "30 days"], ["90", "90 days"], ["365", "12 months"]], RANGE.from ? "" : RANGE.days, (v) => { RANGE.days = +v; RANGE.from = RANGE.to = null; sync(); onChange(); });
    const custom = () => { if (!f.value || !t.value) return; RANGE.from = new Date(f.value + "T00:00"); RANGE.to = new Date(t.value + "T00:00"); $$(".rseg button", host).forEach((b) => b.classList.remove("on")); sync(); onChange(); };
    f.addEventListener("change", custom); t.addEventListener("change", custom);
    sync();
  }
  function chartOr(host, arrs, title, text, draw) {
    if (!arrs.some((a) => a.some((x) => x > 0))) { empty(host, title, text); return; }
    draw();
  }
  const NO_BOT = ["Waiting for the bot", "The bot sends these numbers every 5 minutes once it runs the new update."];
  const NO_TRAFFIC = ["No visits counted yet", "Visits are counted from the day this update went live, for visitors who chose Accept all."];

  // ---------- user actions (queued for the bot, checked on the server) ----------
  const ACTIONS = {
    warn_user: { title: "Warn", ok: "Send warning", text: "They get a DM with the reason, and it goes in the moderation log.", reason: "need" },
    ban_user: { title: "Ban", ok: "Ban user", text: "They can't use Bloombot or post trade ads until you unban them.", reason: "need", danger: true, typed: true },
    unban_user: { title: "Unban", ok: "Unban", text: "They can use Bloombot again.", reason: "opt" },
    reset_roblox: { title: "Reset Roblox verification", ok: "Reset", text: "Their Roblox account is no longer marked verified. They can verify again on the website.", reason: "opt", danger: true },
    remove_ad: { title: "Remove trade ad", ok: "Remove ad", text: "It's taken off the board and deleted from every server's trade channel.", reason: "opt", danger: true },
  };
  async function doAction(kind, target, label, after) {
    const a = ACTIONS[kind];
    const r = await confirmBox({ title: a.title + (label ? " " + label : "") + "?", text: a.text, ok: a.ok, danger: a.danger, reason: a.reason, typed: a.typed ? String(label || target) : null });
    if (!r) return;
    try {
      const res = await rpc("admin_action", { p_kind: kind, p_target: String(target), p_reason: r.reason || null });
      toast("Sent to the bot. It usually takes about 10 seconds.", "clock");
      waitForAction(res.id, kind, after);
    } catch (e) { toast("Not done: " + e.message, "warning"); }
  }
  function waitForAction(id, kind, after, tries) {
    tries = tries || 0;
    setTimeout(async () => {
      try {
        const lg = await rpc("admin_logs", { p_limit: 50 });
        S.logs = lg;
        const a = (lg.actions || []).find((x) => x.id === id);
        if (a && a.status !== "pending") {
          toast(a.status === "done" ? ACTIONS[kind].title + ": done" : "The bot couldn't do it: " + (a.result || "unknown error"), a.status === "done" ? "verified_stud" : "warning");
          if (a.status === "done" && after) after();
          return;
        }
        if (tries < 5) waitForAction(id, kind, after, tries + 1);
        else toast("Still waiting for the bot. Check Activity log → Bot actions later.", "clock");
      } catch (e) { /* the next refresh shows it */ }
    }, tries ? 8000 : 9000);
  }

  // ---------- navigation ----------
  const NAV = [
    ["Dashboard", [["overview", "Overview", "gem"], ["analytics", "Analytics", "chart_up"], ["users", "Users", "task_user"]]],
    ["Bot", [["ads", "Trade ads", "swap"], ["commands", "Commands", "lightning"], ["moderation", "Moderation", "shield"], ["servers", "Servers", "discord_stud_white"], ["values", "Values & demand", "dollar"], ["giveaways", "Giveaways", "gift"]]],
    ["Site & system", [["website", "Website", "task_about"], ["logs", "Activity log", "task_addbot"], ["system", "System health", "lightning"], ["reports", "Reports", "calculator"]]],
  ];
  const PAGES = {};
  NAV.forEach(([g, items]) => items.forEach(([id, label, icon]) => { PAGES[id] = { id, label, icon, group: g }; }));
  function buildNav() {
    let open = {};
    try { open = JSON.parse(localStorage.getItem("bb_admin_groups") || "{}"); } catch (e) { /* storage off */ }
    $("#snav").innerHTML = NAV.map(([g, items]) => `<div class="sgrp${open[g] === false ? " shut" : ""}" data-g="${esc(g)}"><button type="button" aria-expanded="${open[g] !== false}"><span>${esc(g)}</span><svg viewBox="0 0 12 8" aria-hidden="true"><path d="M1 1l5 5 5-5" fill="none" stroke="currentColor" stroke-width="2"/></svg></button><ul><div>${items.map(([id, label, icon]) => `<li><a class="si" href="#${id}" data-id="${id}" title="${esc(label)}"><img src="${ic(icon)}" alt=""><span>${esc(label)}</span><em class="cnt" data-cnt="${id}" hidden></em></a></li>`).join("")}</div></ul></div>`).join("");
    $$(".sgrp>button").forEach((b) => b.addEventListener("click", () => {
      const g = b.parentElement;
      if ($(".app").classList.contains("collapsed") && innerWidth > 900) return;
      g.classList.toggle("shut");
      b.setAttribute("aria-expanded", !g.classList.contains("shut"));
      open[g.dataset.g] = !g.classList.contains("shut");
      try { localStorage.setItem("bb_admin_groups", JSON.stringify(open)); } catch (e) { /* ignore */ }
    }));
  }
  function setCount(id, n, hot) { const el = $(`[data-cnt="${id}"]`); if (!el) return; el.hidden = !n; el.textContent = n > 99 ? "99+" : n; el.classList.toggle("hot", !!hot); }

  // ================= PAGES =================
  const R = {};

  R.overview = (v) => {
    const D = S.D;
    v.innerHTML = `<div class="phead"><div><h1>Overview</h1><p>Live numbers from Bloombot and the website.</p></div><div class="acts"><a class="btn g-dark" href="#reports"><img src="img/calculator.png" alt="">Reports</a><a class="btn g-blue" href="#analytics"><img src="img/chart_up.png" alt="">Full analytics</a></div></div>
      <div id="ovr"></div><div id="ovk"></div>
      <div class="grid g-21 mt"><section class="card"><div class="ch"><div class="hl"><h2><img src="img/chart_up.png" alt="">Website traffic</h2></div><div id="ovm"></div></div><div id="ovc"></div></section>
        <section class="card"><div class="ch"><h2><img src="img/favicon.png" alt="">Bot status</h2><span id="ovst"></span></div><div id="ovb"></div></section></div>
      <div class="grid g3 mt"><section class="card"><div class="ch"><h2><img src="img/lightning.png" alt="">Top commands, 30 days</h2><a href="#commands" class="muted">All</a></div><div id="ovcmd"></div></section>
        <section class="card"><div class="ch"><h2><img src="img/task_user.png" alt="">New users</h2><a href="#users" class="muted">All users</a></div><div id="ovu" class="rows"></div></section>
        <section class="card"><div class="ch"><h2><img src="img/task_addbot.png" alt="">Latest bot events</h2><a href="#logs" class="muted">Logs</a></div><div id="ova"></div></section></div>`;
    let metric = "both";
    const draw = () => {
      const p = (a) => sum(prevSlice(a)), c = (a) => sum(slice(a));
      const N = D.N;
      renderKpis($("#ovk"), [
        kpi("Registered users", "task_user", full(D.totalUsers), c(D.regs), p(D.regs), slice(D.regs), "#3987e5", "+" + full(c(D.regs)) + " this period"),
        kpi("Verified Roblox users", "verified_stud", full(D.totalVerified), c(D.verified), p(D.verified), slice(D.verified), "#199e70", D.totalUsers ? ((D.totalVerified / D.totalUsers) * 100).toFixed(0) + "% of users" : ""),
        kpi("Website visits", "chart_up", D.hasTraffic ? full(c(D.visits)) : "–", D.hasTraffic ? c(D.visits) : null, p(D.visits), slice(D.visits), "#3987e5", D.hasTraffic ? full(sum(D.visits)) + " since " + fshort(D.trafficSince) : "counting starts with this update"),
        kpi("Visitors today", "rise", D.hasTraffic ? full(D.uniques[N - 1]) : "–", D.hasTraffic ? D.uniques[N - 1] : null, D.uniques[N - 8], D.uniques.slice(-14), "#9085e9", "vs same day last week"),
        kpi("Visitors this week", "rise", D.hasTraffic ? full(sum(D.uniques.slice(-7))) : "–", D.hasTraffic ? sum(D.uniques.slice(-7)) : null, sum(D.uniques.slice(-14, -7)), D.uniques.slice(-28), "#9085e9", "vs last week"),
        kpi("Visitors this month", "rise", D.hasTraffic ? full(sum(D.uniques.slice(-30))) : "–", D.hasTraffic ? sum(D.uniques.slice(-30)) : null, sum(D.uniques.slice(-60, -30)), D.uniques.slice(-90), "#9085e9", "vs previous 30 days"),
        kpi("Active users today", "lightning", D.hasBot ? full(D.active[N - 1]) : "–", D.hasBot ? D.active[N - 1] : null, D.active[N - 8], D.active.slice(-30), "#d55181", "used a command"),
        kpi("New registrations", "plus", full(c(D.regs)), c(D.regs), p(D.regs), slice(D.regs), "#3987e5"),
        kpi("Trade ads posted", "swap", D.hasBot ? full(c(D.ads)) : "–", D.hasBot ? c(D.ads) : null, p(D.ads), slice(D.ads), "#d95926", (S.ov.live_ads || 0) + " live now"),
        kpi("Value lookups", "dollar", D.hasBot ? full(c(D.lookups)) : "–", D.hasBot ? c(D.lookups) : null, p(D.lookups), slice(D.lookups), "#199e70", "value commands"),
        kpi("Commands used", "lightning", D.hasBot ? full(c(D.cmds)) : "–", D.hasBot ? c(D.cmds) : null, p(D.cmds), slice(D.cmds), "#3987e5", D.totals.commands ? full(D.totals.commands) + " all time" : ""),
        kpi("Bot uptime", "clock", uptimeText(), null, null, null, null, botOnline().text),
      ]);
      const b = bucket([slice(D.visits), slice(D.uniques)]);
      const series = [];
      if (metric !== "uniques") series.push({ name: "Page views", values: b.arrs[0], color: "#3987e5" });
      if (metric !== "views") series.push({ name: "Unique visitors", values: b.arrs[1], color: "#d95926" });
      chartOr($("#ovc"), b.arrs, ...NO_TRAFFIC, () => C.line($("#ovc"), { labels: b.labels, series, area: true, height: 270, xfmt: fshort, tipLabel: tipFor(b), label: "Website traffic" }));
    };
    rangeBar($("#ovr"), draw);
    seg($("#ovm"), [["both", "Both"], ["views", "Views"], ["uniques", "Visitors"]], metric, (m) => { metric = m; draw(); });
    draw();
    statusCard($("#ovb"), $("#ovst"));
    const cm = (stats().commands || []).slice(0, 7);
    if (cm.length) C.blist($("#ovcmd"), cm.map((x) => ({ name: "/" + x[0], value: +x[3] || 0 })), { unit: "uses, 30 days" }); else empty($("#ovcmd"), ...NO_BOT);
    const nu = S.users.filter((u) => u.registered).slice(0, 6);
    $("#ovu").innerHTML = nu.length ? nu.map((u) => `<div class="row click" data-id="${esc(u.id)}" tabindex="0"><span class="who">${avatar(u)}</span><div class="grow"><b>${esc(u.name || u.id)}</b><small>${u.roblox ? "Roblox: " + esc(u.roblox) : "No Roblox name"}</small></div><small>${ago(u.registered)}</small></div>`).join("") : "";
    if (!nu.length) empty($("#ovu"), "No users yet", "New accounts show up here.");
    $$("#ovu [data-id]").forEach((r) => { const go = () => openUser(S.byId.get(r.dataset.id)); r.addEventListener("click", go); r.addEventListener("keydown", (e) => { if (e.key === "Enter") go(); }); });
    const ev = ((botKey("events") || {}).data || []).slice().reverse().slice(0, 6);
    $("#ova").innerHTML = ev.length ? `<ul class="tl">${ev.map((e) => `<li class="${e.kind === "error" ? "b" : e.kind === "join" ? "g" : ""}"><b>${esc(e.title || e.kind)}</b><small>${esc((e.fields && (e.fields.Guild || e.fields.Server)) || "")} ${ago(toDate(e.at))}</small></li>`).join("")}</ul>` : "";
    if (!ev.length) empty($("#ova"), "Nothing yet", "Errors and server joins/leaves since the bot last started show up here.");
  };
  function uptimeText() {
    const s = botKey("status");
    if (!s || !s.data.started_at || botOnline().state === "crit") return "–";
    const ms = Date.now() - toDate(s.data.started_at).getTime();
    const d = Math.floor(ms / DAY), h = Math.floor((ms % DAY) / 3600e3), m = Math.floor((ms % 3600e3) / 60e3);
    return d ? `${d}d ${h}h` : h ? `${h}h ${m}m` : `${m}m`;
  }
  function statusCard(host, badge) {
    const s = botKey("status"), on = botOnline();
    badge.innerHTML = `<span class="st ${on.state === "good" ? "good live" : on.state === "crit" ? "crit" : "warn"}"><i></i>${esc(on.text)}</span>`;
    if (!s) { empty(host, ...NO_BOT); return; }
    const d = s.data;
    host.innerHTML = `<div class="dl-grid"><div><small>Running for</small><b>${uptimeText()}</b></div><div><small>Ping</small><b>${d.latency_ms != null ? d.latency_ms + " ms" : "–"}</b></div><div><small>Servers</small><b>${full(d.servers || 0)}</b></div><div><small>Members</small><b>${full(d.members || 0)}</b></div><div><small>Last check-in</small><b>${ago(toDate(s.updated_at))}</b></div><div><small>Version</small><b>${esc(d.version || "–")}</b></div></div>
      <div class="row"><a class="btn g-dark sm" href="#system">System health</a></div>`;
  }

  // ANALYTICS
  R.analytics = (v) => {
    const D = S.D;
    v.innerHTML = `<div class="phead"><div><h1>Analytics</h1><p>Website traffic, users, commands and trading. Hover any chart for exact numbers.</p></div><div class="acts"><button class="btn g-dark" id="anexp" type="button"><img src="img/calculator.png" alt="">Export CSV</button></div></div>
      <div id="anr"></div>
      <section class="card"><div class="ch"><div class="hl"><h2><img src="img/chart_up.png" alt="">Website traffic</h2></div><div class="row"><div id="anm"></div><div id="ant"></div></div></div><div id="anc"></div></section>
      <section class="card mt"><div class="ch"><div class="hl"><h2><img src="img/rise.png" alt="">Period comparison</h2><p id="cmpnote"></p></div><div class="row"><div id="cmpm"></div><div id="cmps"></div></div></div><div id="cmpk"></div><div id="cmpc" class="mt"></div></section>
      <div class="grid g-12 mt"><section class="card"><div class="ch"><h2><img src="img/verified_stud.png" alt="">Roblox verification</h2></div><div id="dver"></div><p class="muted" id="dvern"></p></section>
        <section class="card"><div class="ch"><div class="hl"><h2><img src="img/task_user.png" alt="">User registration growth</h2></div><div id="rgm"></div></div><div id="rgc"></div></section></div>
      <div class="grid g-21 mt"><section class="card"><div class="ch"><h2><img src="img/lightning.png" alt="">Command usage by category</h2></div><div id="cuc"></div></section>
        <section class="card"><div class="ch"><h2><img src="img/medal_gold.png" alt="">Most used commands, 30 days</h2></div><div id="cmc"></div></section></div>
      <div class="grid g2 mt"><section class="card"><div class="ch"><h2><img src="img/swap.png" alt="">Trade ads posted</h2></div><div id="tac"></div></section>
        <section class="card"><div class="ch"><h2><img src="img/lightning.png" alt="">Active users over time</h2></div><div id="auc"></div></section></div>
      <div class="grid g3 mt"><section class="card"><div class="ch"><div class="hl"><h2><img src="img/rbx_stud.png" alt="">Visitors by country</h2><p>Last 30 days</p></div></div><div id="geo"></div></section>
        <section class="card"><div class="ch"><div class="hl"><h2><img src="img/discord_stud_white.png" alt="">Referral sources</h2><p>Last 30 days</p></div></div><div id="ref"></div></section>
        <section class="card"><div class="ch"><div class="hl"><h2><img src="img/clock.png" alt="">Peak activity hours</h2><p id="heatnote"></p></div><div id="heatm"></div></div><div id="heat"></div></section></div>
      <section class="mt" id="pgt"></section>`;
    let tmode = "area", tmetric = "views", cmp = "weekly", cmpm = "visits", rgmode = "total", hmode = D.hasTraffic ? "site" : "bot";
    const draw = () => {
      const b = bucket([slice(D.visits), slice(D.uniques), slice(D.regs), slice(D.verified), slice(D.active), slice(D.ads), slice(D.cmds), slice(D.webAds)]);
      const tip = tipFor(b);
      const tv = tmetric === "views" ? [{ name: "Page views", values: b.arrs[0], color: "#3987e5" }] : tmetric === "uniques" ? [{ name: "Unique visitors", values: b.arrs[1], color: "#d95926" }] : [{ name: "Page views", values: b.arrs[0], color: "#3987e5" }, { name: "Unique visitors", values: b.arrs[1], color: "#d95926" }];
      chartOr($("#anc"), [b.arrs[0]], ...NO_TRAFFIC, () => C.line($("#anc"), { labels: b.labels, series: tv, area: tmode === "area", height: 300, xfmt: fshort, tipLabel: tip, label: "Website traffic" }));
      const [x0] = rangeIdx();
      if (rgmode === "total") {
        let acc = D.totalUsers - sum(D.regs.slice(x0)), accV = D.totalVerified - sum(D.verified.slice(x0));
        const tot = [], ver = [];
        b.arrs[2].forEach((x, i) => { acc += x; accV += b.arrs[3][i]; tot.push(Math.max(0, acc)); ver.push(Math.max(0, accV)); });
        chartOr($("#rgc"), [tot], "No users yet", "", () => C.line($("#rgc"), { labels: b.labels, series: [{ name: "All users", values: tot, color: "#3987e5" }, { name: "Verified", values: ver, color: "#199e70" }], area: true, height: 250, xfmt: fshort, tipLabel: tip, label: "Total users" }));
      } else {
        chartOr($("#rgc"), [b.arrs[2]], "No new users in this period", "", () => C.bars($("#rgc"), { labels: b.labels.map(fshort), series: [{ name: "New users", values: b.arrs[2], color: "#3987e5" }, { name: "New verifications", values: b.arrs[3], color: "#199e70" }], height: 250, tipLabel: tip, label: "New registrations" }));
      }
      // categories: top 5 + other, fixed colour per category name
      const catNames = Object.keys(D.cats).sort((a, c) => sum(D.cats[c]) - sum(D.cats[a]));
      const top = catNames.slice(0, 5), rest = catNames.slice(5);
      const catSeries = top.map((c) => slice(D.cats[c]));
      if (rest.length) { const o = slice(D.cats[rest[0]]).map(() => 0); rest.forEach((c) => slice(D.cats[c]).forEach((x, i) => { o[i] += x; })); catSeries.push(o); }
      const cb = bucket(catSeries);
      chartOr($("#cuc"), cb.arrs, ...NO_BOT, () => C.line($("#cuc"), { labels: cb.labels, series: cb.arrs.map((a, i) => ({ name: i < top.length ? top[i] : "Other", values: a, color: C.PAL[i] })), area: true, stacked: true, height: 280, xfmt: fshort, tipLabel: tipFor(cb), label: "Command usage by category" }));
      const discordAds = b.arrs[5].map((x, i) => Math.max(0, x - b.arrs[7][i]));
      chartOr($("#tac"), [b.arrs[5], b.arrs[7]], ...NO_BOT, () => C.bars($("#tac"), { labels: b.labels.map(fshort), series: [{ name: "From Discord", values: discordAds, color: "#d95926" }, { name: "From the website", values: b.arrs[7], color: "#9085e9" }], stacked: true, height: 250, tipLabel: tip, label: "Trade ads posted" }));
      const avg7 = b.arrs[4].map((_, i) => Math.round(sum(b.arrs[4].slice(Math.max(0, i - 6), i + 1)) / Math.min(7, i + 1)));
      chartOr($("#auc"), [b.arrs[4]], ...NO_BOT, () => C.line($("#auc"), { labels: b.labels, series: [{ name: b.weekly ? "Active users (week total)" : "Daily active users", values: b.arrs[4], color: "#d55181" }, { name: "7-point average", values: avg7, color: "#3987e5", dash: true }], height: 250, xfmt: fshort, tipLabel: tip, label: "Active users" }));
      drawCompare();
    };
    function drawCompare() {
      const arr = cmpm === "visits" ? D.visits : cmpm === "commands" ? D.cmds : D.regs;
      const N = D.N;
      let labels, cur, prev, nameC, nameP, note;
      if (cmp === "daily") {
        labels = Array.from({ length: 7 }, (_, i) => WD[D.days[N - 7 + i].getDay()]);
        cur = arr.slice(-7); prev = arr.slice(-14, -7); nameC = "This week"; nameP = "Last week"; note = "Each of the last 7 days vs the same weekday a week earlier.";
      } else if (cmp === "weekly") {
        labels = Array.from({ length: 8 }, (_, i) => "W" + (i + 1));
        cur = labels.map((_, i) => sum(arr.slice(N - 56 + i * 7, N - 49 + i * 7)));
        prev = labels.map((_, i) => sum(arr.slice(N - 112 + i * 7, N - 105 + i * 7)));
        nameC = "Last 8 weeks"; nameP = "8 weeks before"; note = "Weekly totals, last 8 weeks vs the 8 weeks before.";
      } else if (cmp === "monthly") {
        const m = {}, k = (d) => d.getFullYear() * 12 + d.getMonth();
        D.days.forEach((d, i) => { m[k(d)] = (m[k(d)] || 0) + arr[i]; });
        const endK = k(D.days[N - 1]);
        labels = []; cur = []; prev = [];
        for (let j = 5; j >= 0; j--) { const kk = endK - j; labels.push(MON[kk % 12]); cur.push(m[kk] || 0); prev.push(m[kk - 12] || 0); }
        nameC = "Last 6 months"; nameP = "Year before"; note = "Monthly totals vs the same month a year earlier (data goes back 400 days).";
      } else {
        labels = ["Q1", "Q2", "Q3", "Q4"];
        const y = D.days[N - 1].getFullYear();
        const q = (yr, qi) => sum(D.days.map((d, i) => (d.getFullYear() === yr && Math.floor(d.getMonth() / 3) === qi ? arr[i] : 0)));
        cur = labels.map((_, i) => q(y, i)); prev = labels.map((_, i) => q(y - 1, i));
        nameC = String(y); nameP = String(y - 1); note = "Totals per quarter, this year vs last year.";
      }
      $("#cmpnote").textContent = note;
      const a = sum(cur), b = sum(prev);
      renderKpis($("#cmpk"), [
        kpi(nameC, "chart_up", full(a), a, b, null, null, b ? "vs " + nameP.toLowerCase() : "nothing to compare with yet"),
        kpi(nameP, "clock", full(b), null, null, null, null, ""),
        kpi("Best " + { daily: "day", weekly: "week", monthly: "month", yearly: "quarter" }[cmp], "medal_gold", a ? labels[cur.indexOf(Math.max(...cur))] : "–", null, null, null, null, a ? full(Math.max(...cur)) : ""),
      ]);
      chartOr($("#cmpc"), [cur, prev], cmpm === "visits" ? NO_TRAFFIC[0] : NO_BOT[0], cmpm === "visits" ? NO_TRAFFIC[1] : NO_BOT[1], () => C.bars($("#cmpc"), { labels, series: [{ name: nameP, values: prev, color: "#9085e9" }, { name: nameC, values: cur, color: "#3987e5" }], height: 230, label: "Period comparison" }));
    }
    rangeBar($("#anr"), draw);
    seg($("#ant"), [["area", "Area"], ["line", "Line"]], tmode, (m) => { tmode = m; draw(); });
    seg($("#anm"), [["views", "Views"], ["uniques", "Visitors"], ["both", "Both"]], tmetric, (m) => { tmetric = m; draw(); });
    seg($("#cmps"), [["daily", "Daily"], ["weekly", "Weekly"], ["monthly", "Monthly"], ["yearly", "Yearly"]], cmp, (m) => { cmp = m; drawCompare(); });
    seg($("#cmpm"), [["visits", "Visits"], ["commands", "Commands"], ["users", "New users"]], cmpm, (m) => { cmpm = m; drawCompare(); });
    seg($("#rgm"), [["total", "Total"], ["new", "New per day"]], rgmode, (m) => { rgmode = m; draw(); });
    draw();
    if (D.totalUsers) {
      C.donut($("#dver"), { items: [{ name: "Verified", value: D.totalVerified, color: "#199e70" }, { name: "Not verified", value: Math.max(0, D.totalUsers - D.totalVerified), color: "#3987e5" }], center: ((D.totalVerified / D.totalUsers) * 100).toFixed(0) + "%", sub: "verified", unit: "users", label: "Verified vs unverified users" });
      $("#dvern").textContent = full(D.totalVerified) + " of " + full(D.totalUsers) + " Bloombot users proved their Roblox account.";
    } else empty($("#dver"), "No users yet", "");
    const tr = S.ov.traffic || {};
    const cn = (tr.countries || []).filter((x) => x[0]);
    if (cn.length) C.blist($("#geo"), cn.map(([c, n]) => ({ name: countryName(c), value: +n })), { pct: true, unit: "visits", color: "#3987e5" });
    else empty($("#geo"), ...(D.hasTraffic ? ["No country data", "The host didn't pass a country for these visits."] : NO_TRAFFIC));
    const refs = (tr.refs || []).map(([r, n]) => [r || "Direct / unknown", +n]);
    if (refs.length) C.donut($("#ref"), { items: refs.slice(0, 7).map(([n, val], i) => ({ name: n, value: val, color: C.PAL[i] })), center: String(refs.length), sub: refs.length === 1 ? "source" : "sources", unit: "visits", label: "Referral sources" });
    else empty($("#ref"), ...NO_TRAFFIC);
    const drawHeat = () => {
      const grid = Array.from({ length: 7 }, () => new Array(24).fill(0));
      ((hmode === "site" ? tr.hours : stats().hours) || []).forEach(([d, h, n]) => { if (grid[d]) grid[d][h] += +n || 0; });
      $("#heatnote").textContent = (hmode === "site" ? "Website visits" : "Bot commands") + " by weekday and hour (UTC), last 30 days";
      if (!grid.some((r) => r.some((x) => x))) empty($("#heat"), ...(hmode === "site" ? NO_TRAFFIC : NO_BOT));
      else heatmap($("#heat"), grid, hmode === "site" ? "visits" : "commands");
    };
    seg($("#heatm"), [["site", "Website"], ["bot", "Bot"]], hmode, (m) => { hmode = m; drawHeat(); });
    drawHeat();
    pageTable($("#pgt"));
    $("#anexp").addEventListener("click", () => {
      const [a] = rangeIdx();
      downloadCsv("bloombot-analytics.csv", ["date", "page_views", "unique_visitors", "new_users", "new_verified", "active_users", "commands", "command_errors", "trade_ads", "website_trade_ads"],
        rangeLabels().map((d, i) => { const k = a + i; return [S.D.keys[k], D.visits[k], D.uniques[k], D.regs[k], D.verified[k], D.active[k], D.cmds[k], D.cmdErr[k], D.ads[k], D.webAds[k]]; }));
    });
  };
  let REGION = null;
  function countryName(c) { try { REGION = REGION || new Intl.DisplayNames(["en"], { type: "region" }); return REGION.of(c) || c; } catch (e) { return c; } }
  function heatmap(host, grid, unit) {
    const max = Math.max(1, ...grid.flat());
    const ramp = ["#16243a", "#184f95", "#1c5cab", "#256abf", "#2a78d6", "#3987e5", "#5598e7", "#86b6ef", "#b7d3f6"];
    const order = [1, 2, 3, 4, 5, 6, 0];
    let html = `<div class="heat" role="img" aria-label="${esc(unit)} by weekday and hour"><span></span>`;
    for (let hr = 0; hr < 24; hr++) html += `<span class="hx">${hr % 6 === 0 ? hr : ""}</span>`;
    order.forEach((d) => { html += `<span class="hl">${WD[d]}</span>`; grid[d].forEach((val, hr) => { html += `<i class="hc" tabindex="0" data-d="${d}" data-h="${hr}" data-c="${val ? Math.min(8, Math.floor((val / max) * 8.99)) : 0}"></i>`; }); });
    html += `</div><div class="heat-scale">Fewer<span class="bar">${ramp.map(() => "<i></i>").join("")}</span>More</div>`;
    host.innerHTML = html;
    $$(".heat-scale i", host).forEach((i, k) => { i.style.background = ramp[k]; });
    $$(".hc", host).forEach((c) => {
      c.style.background = ramp[+c.dataset.c];
      const show = (ev) => {
        const d = +c.dataset.d, hr = +c.dataset.h;
        let x, y; if (ev && ev.clientX != null) { x = ev.clientX; y = ev.clientY; } else { const r = c.getBoundingClientRect(); x = r.left; y = r.top; }
        C.showTip(x, y, WD[d] + " " + String(hr).padStart(2, "0") + ":00 UTC", [{ name: unit + ", 30 days", value: full(grid[d][hr]), color: ramp[+c.dataset.c] }]);
      };
      c.addEventListener("pointermove", show); c.addEventListener("focus", () => show());
      c.addEventListener("pointerleave", C.hideTip); c.addEventListener("blur", C.hideTip);
    });
  }
  const PAGE_NAMES = { "/": "Home", "/values.html": "Values", "/calculator.html": "Trade calculator", "/trades.html": "Trade ads", "/crates.html": "Crate calculator", "/levels.html": "Levels", "/strategies.html": "Strategies", "/features.html": "Features", "/dashboard.html": "Server dashboard", "/profile.html": "Profile", "/privacy.html": "Privacy Policy", "/terms.html": "Terms of Service", "/intents.html": "Intents", "/giveaway-admin.html": "Giveaway manager", "/404.html": "Not found" };
  function pageTable(host) {
    const pages = ((S.ov.traffic || {}).pages || []).map(([path, v, u]) => ({ path, title: PAGE_NAMES[path] || path, views: +v, uniques: +u }));
    const tot = sum(pages.map((p) => p.views)) || 1;
    host.innerHTML = '<div class="ch"><div class="hl"><h2><img src="img/task_about.png" alt="">Most visited pages</h2><p>Last 30 days</p></div></div><div></div>';
    table(host.lastElementChild, {
      rows: () => pages, sort: "views", dir: -1, per: 12, empty: NO_TRAFFIC[1],
      cols: [
        { key: "title", label: "Page", render: (p) => `<b>${esc(p.title)}</b><br><small class="muted">${esc(p.path)}</small>` },
        { key: "views", label: "Views", n: true, render: (p) => full(p.views) },
        { key: "uniques", label: "Visitors", n: true, render: (p) => full(p.uniques), hide: true },
        { key: "share", label: "Share", n: true, sort: (p) => p.views, render: (p) => ((p.views / tot) * 100).toFixed(1) + "%" },
      ],
    });
  }

  // USERS
  const UF = { q: "", ver: "all", st: "all" };
  R.users = (v) => {
    const U = S.users;
    v.innerHTML = `<div class="phead"><div><h1>Users</h1><p>${full(U.length)} Bloombot accounts. Click someone to see their history and manage them.</p></div><div class="acts"><button class="btn g-dark" id="uexp" type="button"><img src="img/calculator.png" alt="">Export CSV</button></div></div>
      <div id="uk"></div>
      <div class="filters mt"><label class="srch"><span class="sr">Search users</span>${SRCH}<input class="inp" id="uq" placeholder="Name, Roblox user or Discord ID" value="${esc(UF.q)}"></label>
        <select class="sel" id="uver" aria-label="Roblox verification"><option value="all">All verification</option><option value="yes">Verified</option><option value="no">Not verified</option></select>
        <select class="sel" id="ust" aria-label="Status"><option value="all">All statuses</option><option value="banned">Banned</option><option value="warned">Has warnings</option><option value="active">Active this week</option></select></div>
      <div id="ut"></div>`;
    renderKpis($("#uk"), [
      kpi("Accounts", "task_user", full(U.length), null, null, null, null, "bot + website"),
      kpi("Verified Roblox", "verified_stud", full(U.filter((u) => u.verified).length), null, null, null, null, U.length ? ((U.filter((u) => u.verified).length / U.length) * 100).toFixed(0) + "%" : ""),
      kpi("Active this week", "lightning", full(U.filter((u) => u.last && Date.now() - u.last < 7 * DAY).length), null, null, null, null, "used a command"),
      kpi("Banned", "lose", full(U.filter((u) => u.banned).length), null, null, null, null, full(U.filter((u) => u.warns).length) + " with warnings"),
    ]);
    $("#uver").value = UF.ver; $("#ust").value = UF.st;
    const rows = () => U.filter((u) => {
      const q = UF.q.toLowerCase();
      if (q && !((u.name || "").toLowerCase().includes(q) || (u.roblox || "").toLowerCase().includes(q) || u.id.includes(q))) return false;
      if (UF.ver !== "all" && u.verified !== (UF.ver === "yes")) return false;
      if (UF.st === "banned" && !u.banned) return false;
      if (UF.st === "warned" && !u.warns) return false;
      if (UF.st === "active" && !(u.last && Date.now() - u.last < 7 * DAY)) return false;
      return true;
    });
    const t = table($("#ut"), {
      rows, sort: "registered", dir: -1, per: 15, onRow: openUser, empty: U.length ? "Nobody matches these filters." : "No accounts yet.",
      cols: [
        { key: "name", label: "User", sort: (u) => (u.name || "").toLowerCase(), render: userCell },
        { key: "roblox", label: "Roblox", sort: (u) => (u.roblox || "").toLowerCase(), render: robloxLink, hide: true },
        { key: "verified", label: "Verification", sort: (u) => +u.verified, render: verPill },
        { key: "registered", label: "Registered", sort: (u) => u.registered, render: (u) => fdate(u.registered), hide: true },
        { key: "last", label: "Last active", sort: (u) => u.last, render: (u) => ago(u.last) },
        { key: "cmds", label: "Commands", n: true, render: (u) => full(u.cmds), hide: true },
        { key: "ads", label: "Ads", n: true, hide: true },
        { key: "banned", label: "Status", sort: (u) => (u.banned ? 2 : u.warns ? 1 : 0), render: (u) => statusPill(u.banned ? "Banned" : "Active") + (u.warns ? ` <span class="pill yellow" title="Warnings">⚠ ${u.warns}</span>` : "") },
      ],
    });
    let tm;
    $("#uq").addEventListener("input", (e) => { clearTimeout(tm); tm = setTimeout(() => { UF.q = e.target.value.trim(); t.reset(); }, 120); });
    $("#uver").addEventListener("change", (e) => { UF.ver = e.target.value; t.reset(); });
    $("#ust").addEventListener("change", (e) => { UF.st = e.target.value; t.reset(); });
    $("#uexp").addEventListener("click", () => downloadCsv("bloombot-users.csv", ["discord_id", "discord_name", "roblox", "verified", "registered", "last_active", "commands", "trade_ads", "warnings", "banned", "level"], rows().map((u) => [u.id, u.name, u.roblox, u.verified, u.registered ? u.registered.toISOString() : "", u.last ? u.last.toISOString() : "", u.cmds, u.ads, u.warns, u.banned, u.level == null ? "" : u.level])));
    R.users._t = t;
  };

  async function openUser(u) {
    if (!u) return;
    const dr = $("#drawer");
    const mod = (stats().moderation || []).filter((m) => String(m[2]) === u.id);
    const reports = (stats().reports || []).filter((r) => String(r[2]) === u.id);
    dr.innerHTML = `<div class="dh"><img class="av" src="${esc(u.avatar || "img/task_user.png")}" alt="" referrerpolicy="no-referrer"><div><h2>${esc(u.name || u.id)}</h2><div class="row">${verPill(u)}${statusPill(u.banned ? "Banned" : "Active")}${u.level != null ? `<span class="pill purple">Level ${esc(u.level)}</span>` : ""}</div></div><button class="ibtn x" type="button" aria-label="Close" data-close><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg></button></div>
      <div class="db"><div id="utabs"></div><div id="ubody"></div></div>`;
    const body = $("#ubody", dr);
    let extra = null;
    const load = rpc("admin_user", { p_id: u.id }).then((x) => { extra = x; }).catch(() => { extra = { error: true }; });
    const show = async (tab) => {
      if (tab === "info") {
        body.innerHTML = `<div class="dl-grid"><div><small>Discord ID</small><b>${esc(u.id)}</b></div><div><small>Discord name</small><b>${esc(u.name || "–")}</b></div><div><small>Roblox</small><b>${robloxLink(u)}</b></div><div><small>Verification</small><b>${u.verified ? "Verified" : u.roblox ? "Linked, not verified" : "Not linked"}</b></div><div><small>Registered</small><b>${fdate(u.registered)}</b></div><div><small>Last command</small><b>${ago(u.last)}</b></div></div>
          <div class="kpis" id="ukp"></div>
          <div class="ch mt"><h2>Manage</h2></div>
          <div class="chips" id="uacts"><button class="btn g-yellow sm" data-a="warn_user" type="button">Warn</button><button class="btn g-dark sm" data-a="reset_roblox" type="button" ${u.verified ? "" : "disabled"}>Reset verification</button>${u.banned ? '<button class="btn g-green sm" data-a="unban_user" type="button">Unban</button>' : '<button class="btn g-red sm" data-a="ban_user" type="button">Ban</button>'}</div>
          <p class="muted"><small>Every action is checked on the server, done by the bot within seconds and saved in the activity log.</small></p>`;
        renderKpis($("#ukp", body), [
          kpi("Commands", "lightning", full(u.cmds), null, null, null, null, "all time"),
          kpi("Trade ads", "swap", full(u.ads), null, null, null, null, "posted"),
          kpi("Warnings", "warning", full(u.warns), null, null, null, null, ""),
          kpi("XP", "medal_gold", u.xp != null ? full(u.xp) : "–", null, null, null, null, u.level != null ? "level " + u.level : ""),
        ]);
        $$("#uacts button", body).forEach((b) => b.addEventListener("click", () => doAction(b.dataset.a, u.id, u.name || u.id, () => {
          if (b.dataset.a === "ban_user") u.banned = true;
          if (b.dataset.a === "unban_user") u.banned = false;
          if (b.dataset.a === "warn_user") u.warns++;
          if (b.dataset.a === "reset_roblox") u.verified = false;
          if ($("#drawer").classList.contains("on")) openUser(u);
          if (R.users._t && location.hash === "#users") R.users._t.draw();
        })));
      } else {
        body.innerHTML = skel(4);
        await load;
        if (extra && extra.error) { empty(body, "Couldn't load", "Try again in a moment."); return; }
        if (tab === "ads") {
          const live = extra.live_ads || [], subs = extra.ads || [];
          body.innerHTML = (live.length ? `<div class="ch"><h2>Live now</h2></div>${live.map((a) => `<div class="ann"><h4>#${esc(a.id)} ${statusPill("Live")}</h4><p></p><div class="row"><small>${ago(toDate(a.at))}</small><span class="grow"></span><button class="mini-btn danger" data-rm="${esc(a.id)}" type="button">Remove</button></div></div>`).join("")}` : "") +
            `<div class="ch mt"><h2>Posted on the website</h2></div>` + (subs.length ? subs.map((s) => `<div class="ann"><h4>${statusPill(s.status)}${s.ad_id ? " #" + esc(s.ad_id) : ""}</h4><p></p><small>${ago(toDate(s.at))}${s.reason ? " · " + esc(s.reason) : ""}</small></div>`).join("") : '<p class="muted">No website trade ads.</p>') +
            `<p class="muted"><small>${full(u.ads)} trade ads in total (Discord + website).</small></p>`;
          const ps = $$(".ann p", body);
          [...live, ...subs].forEach((a, i) => { if (ps[i]) ps[i].textContent = a.content; });
          $$("[data-rm]", body).forEach((b) => b.addEventListener("click", () => doAction("remove_ad", b.dataset.rm, "#" + b.dataset.rm)));
        } else if (tab === "mod") {
          const items = [
            ...mod.map((m) => ({ c: /BLOCK|BAN/.test(m[1]) && !/UN/.test(m[1]) ? "b" : m[1] === "WARN" ? "w" : "", t: m[1].replace(/_/g, " ").toLowerCase(), s: (m[4] || "") + " · by " + nameOf(m[3]) + " · " + fdate(toDate(m[5])), at: toDate(m[5]) })),
            ...reports.map((r) => ({ c: "w", t: "reported by " + nameOf(r[1]), s: (r[3] || "") + " · " + fdate(toDate(r[4])), at: toDate(r[4]) })),
            ...(extra.actions || []).map((a) => ({ c: a.status === "failed" ? "b" : "g", t: "dashboard: " + a.kind.replace(/_/g, " ") + " (" + a.status + ")", s: (a.reason || "") + " · " + fdate(toDate(a.at)), at: toDate(a.at) })),
          ].sort((a, b) => (b.at || 0) - (a.at || 0));
          body.innerHTML = items.length ? `<ul class="tl">${items.map((e) => `<li class="${e.c}"><b></b><small></small></li>`).join("")}</ul>` : '<p class="muted">Clean record. No warnings, bans or reports.</p>';
          $$(".tl li", body).forEach((li, i) => { li.querySelector("b").textContent = items[i].t; li.querySelector("small").textContent = items[i].s; });
        } else if (tab === "verify") {
          const vs = extra.verify || [];
          body.innerHTML = vs.length ? `<ul class="tl">${vs.map((x) => `<li class="${x.status === "verified" ? "g" : x.status === "failed" ? "b" : ""}"><b>${esc(x.status)}</b><small>${ago(toDate(x.at))}${x.reason ? " · " + esc(x.reason) : ""}</small></li>`).join("")}</ul>` : '<p class="muted">No website verification attempts.</p>';
        }
      }
    };
    tabs($("#utabs", dr), [["info", "Profile"], ["ads", "Trade ads"], ["verify", "Verification"], ["mod", "Moderation (" + (mod.length + reports.length) + ")"]], "info", show);
    show("info");
    $("[data-close]", dr).addEventListener("click", closeDrawer);
    $("#scrim").classList.add("on");
    dr.classList.add("on");
    setTimeout(() => $("[data-close]", dr).focus(), 60);
  }
  function closeDrawer() { $("#drawer").classList.remove("on"); if (!$("#modal").classList.contains("on")) $("#scrim").classList.remove("on"); }

  // TRADE ADS
  R.ads = async (v) => {
    v.innerHTML = `<div class="phead"><div><h1>Trade ads</h1><p>Live ads on the board and trade ads posted from the website.</p></div><div class="acts"><button class="btn g-dark" type="button" id="adref"><img src="img/clock.png" alt="">Refresh</button></div></div><div id="adk"></div><div class="mt" id="adtabs"></div><div class="filters"><label class="srch"><span class="sr">Search ads</span>${SRCH}<input class="inp" id="adq" placeholder="Text, user or ad #"></label></div><div id="adt">${skel(8)}</div>`;
    $("#adref").addEventListener("click", () => { S.trade = null; R.ads(v); });
    try { S.trade = S.trade || await rpc("admin_trade_ads"); } catch (e) { empty($("#adt"), "Couldn't load trade ads", e.message); return; }
    if (location.hash !== "#ads") return;
    const live = S.trade.live || [], subs = S.trade.submissions || [];
    const D = S.D;
    renderKpis($("#adk"), [
      kpi("Live ads", "swap", full(live.length), null, null, null, null, "on the board now"),
      kpi("Posted today", "plus", D.hasBot ? full(D.ads[D.N - 1]) : "–", D.hasBot ? D.ads[D.N - 1] : null, D.ads[D.N - 8], D.ads.slice(-14), "#d95926", "vs same day last week"),
      kpi("Website posts, 24h", "chart_up", full(subs.filter((s) => Date.now() - toDate(s.at) < DAY).length), null, null, null, null, subs.filter((s) => s.status === "rejected" && Date.now() - toDate(s.at) < DAY).length + " rejected"),
      kpi("All-time ads", "medal_gold", D.totals.trade_ads != null ? full(D.totals.trade_ads) : "–", null, null, null, null, "posted"),
    ]);
    let tab = "live", q = "";
    const draw = () => {
      const qq = q.toLowerCase();
      if (tab === "live") {
        t = table($("#adt"), {
          rows: () => live.filter((a) => !qq || String(a.content).toLowerCase().includes(qq) || String(a.name || "").toLowerCase().includes(qq) || String(a.id).includes(qq) || String(a.user).includes(qq)),
          sort: "at", dir: -1, per: 15, empty: live.length ? "No ads match." : "No live trade ads right now.",
          cols: [
            { key: "id", label: "Ad", n: true, render: (a) => `<b>#${esc(a.id)}</b>` },
            { key: "content", label: "Ad text", cls: "msg", render: () => '<span class="adtxt"></span>' },
            { key: "name", label: "User", render: (a) => `<button class="linkbtn" type="button" data-u="${esc(a.user)}">${esc(a.name || a.user)}</button>`, hide: true },
            { key: "at", label: "Posted", sort: (a) => toDate(a.at), render: (a) => ago(toDate(a.at)) },
            { key: "x", label: "", nosort: true, render: (a) => `<div class="acts"><button class="mini-btn danger" data-x="${esc(a.id)}" type="button">Remove</button></div>` },
          ],
          after: (host, sl) => {
            $$(".adtxt", host).forEach((s, i) => { s.textContent = sl[i].content; });
            $$("[data-x]", host).forEach((b) => b.addEventListener("click", () => doAction("remove_ad", b.dataset.x, "#" + b.dataset.x, () => { S.trade = null; })));
            $$("[data-u]", host).forEach((b) => b.addEventListener("click", () => openUser(S.byId.get(b.dataset.u) || { id: b.dataset.u, name: b.textContent, cmds: 0, ads: 0, warns: 0 })));
          },
        });
      } else {
        t = table($("#adt"), {
          rows: () => subs.filter((s) => (tab === "all" || s.status === tab) && (!qq || String(s.content).toLowerCase().includes(qq) || nameOf(s.user).toLowerCase().includes(qq))),
          sort: "at", dir: -1, per: 15, empty: "No website trade ads here.",
          cols: [
            { key: "at", label: "When", sort: (s) => toDate(s.at), render: (s) => ago(toDate(s.at)) },
            { key: "user", label: "User", render: (s) => `<button class="linkbtn" type="button" data-u="${esc(s.user)}">${esc(nameOf(s.user))}</button>` },
            { key: "content", label: "Ad text", cls: "msg", render: () => '<span class="adtxt"></span>' },
            { key: "status", label: "Result", render: (s) => statusPill(s.status) + (s.reason ? `<br><small class="muted">${esc(s.reason)}</small>` : "") },
            { key: "servers", label: "Servers", n: true, render: (s) => (s.servers != null ? full(s.servers) : "–"), hide: true },
          ],
          after: (host, sl) => {
            $$(".adtxt", host).forEach((s, i) => { s.textContent = sl[i].content; });
            $$("[data-u]", host).forEach((b) => b.addEventListener("click", () => openUser(S.byId.get(b.dataset.u))));
          },
        });
      }
    };
    let t;
    tabs($("#adtabs"), [["live", "Live (" + live.length + ")"], ["all", "Website posts"], ["rejected", "Rejected (" + subs.filter((s) => s.status === "rejected").length + ")"], ["pending", "Waiting"]], tab, (x) => { tab = x; draw(); });
    $("#adq").addEventListener("input", (e) => { q = e.target.value.trim(); draw(); });
    draw();
  };

  // COMMANDS
  R.commands = (v) => {
    const cmds = (stats().commands || []).map(([name, cat, total, d30, err30, ms, last]) => ({ name: "/" + name, cat: cat || "Other", total: +total, d30: +d30, err: d30 ? (err30 / d30) * 100 : 0, ms: ms == null ? null : +ms, last: toDate(last) }));
    v.innerHTML = `<div class="phead"><div><h1>Commands</h1><p>How each slash command is used. Server admins turn features on or off with /config in Discord.</p></div></div><div id="ck"></div>
      <div class="grid g-21 mt"><section class="card"><div class="ch"><h2><img src="img/warning.png" alt="">Errors and response time</h2><div id="cerm"></div></div><div id="cerc"></div></section><section class="card"><div class="ch"><h2><img src="img/medal_gold.png" alt="">By category, 30 days</h2></div><div id="ccat"></div></section></div>
      <div class="filters mt"><label class="srch"><span class="sr">Search commands</span>${SRCH}<input class="inp" id="cq" placeholder="Search commands"></label><select class="sel" id="cc" aria-label="Category"><option value="all">All categories</option>${[...new Set(cmds.map((c) => c.cat))].sort().map((c) => `<option>${esc(c)}</option>`).join("")}</select></div><div id="ct"></div>`;
    const D = S.D, d30 = sum(cmds.map((c) => c.d30)), e30 = sum(cmds.map((c) => (c.err * c.d30) / 100));
    renderKpis($("#ck"), [
      kpi("Commands, 30 days", "lightning", full(d30), sum(D.cmds.slice(-30)), sum(D.cmds.slice(-60, -30)), D.cmds.slice(-30), "#3987e5", "vs previous 30 days"),
      kpi("Error rate", "warning", d30 ? ((e30 / d30) * 100).toFixed(2) + "%" : "–", null, null, null, null, full(Math.round(e30)) + " failed"),
      kpi("Different commands", "gem", full(cmds.length), null, null, null, null, "used at least once"),
      kpi("All time", "medal_gold", D.totals.commands != null ? full(D.totals.commands) : "–", null, null, null, null, "commands run"),
    ]);
    let em = "errors";
    const drawE = () => {
      const b = { labels: D.days.slice(-30), arrs: [D.cmdErr.slice(-30), D.cmdMs.slice(-30)] };
      chartOr($("#cerc"), [D.cmds.slice(-30)], ...NO_BOT, () => (em === "errors"
        ? C.bars($("#cerc"), { labels: b.labels.map(fshort), series: [{ name: "Failed commands", values: b.arrs[0], color: "#e66767" }], height: 220, tipLabel: (i) => fdate(b.labels[i]) })
        : C.line($("#cerc"), { labels: b.labels, series: [{ name: "Average response", values: b.arrs[1], color: "#3987e5" }], area: true, height: 220, xfmt: fshort, fmt: (x) => Math.round(x) + " ms", yfmt: (x) => Math.round(x) + "ms", tipLabel: (i) => fdate(b.labels[i]) })));
    };
    seg($("#cerm"), [["errors", "Errors"], ["ms", "Response time"]], em, (m) => { em = m; drawE(); });
    drawE();
    const byCat = {};
    cmds.forEach((c) => { byCat[c.cat] = (byCat[c.cat] || 0) + c.d30; });
    const cats = Object.entries(byCat).filter((x) => x[1]).sort((a, b) => b[1] - a[1]);
    if (cats.length) C.blist($("#ccat"), cats.map(([n, val]) => ({ name: n, value: val })), { pct: true, unit: "uses" }); else empty($("#ccat"), ...NO_BOT);
    let q = "", cat = "all";
    const t = table($("#ct"), {
      rows: () => cmds.filter((c) => (!q || c.name.includes(q)) && (cat === "all" || c.cat === cat)), sort: "d30", dir: -1, per: 25, empty: cmds.length ? "No commands match." : NO_BOT[1],
      cols: [
        { key: "name", label: "Command", render: (c) => `<b>${esc(c.name)}</b><br><small class="muted">${esc(c.cat)}</small>` },
        { key: "d30", label: "30 days", n: true, render: (c) => full(c.d30) },
        { key: "total", label: "All time", n: true, render: (c) => full(c.total), hide: true },
        { key: "err", label: "Errors", n: true, render: (c) => `<span class="${c.err > 2 ? "delta down" : ""}">${c.err.toFixed(1)}%</span>` },
        { key: "ms", label: "Avg. response", n: true, render: (c) => (c.ms == null ? "–" : full(c.ms) + " ms"), hide: true },
        { key: "last", label: "Last used", sort: (c) => c.last, render: (c) => ago(c.last), hide: true },
      ],
    });
    $("#cq").addEventListener("input", (e) => { q = e.target.value.trim().toLowerCase(); t.reset(); });
    $("#cc").addEventListener("change", (e) => { cat = e.target.value; t.reset(); });
  };

  // MODERATION
  R.moderation = (v) => {
    const st = stats();
    const bans = (st.bans || []).map(([id, reason, at]) => ({ id: String(id), reason, at: toDate(at) }));
    const logs = (st.moderation || []).map(([id, action, target, by, reason, at]) => ({ id, action, target: String(target), by: String(by), reason, at: toDate(at) }));
    const reps = (st.reports || []).map(([id, by, target, reason, at]) => ({ id, by: String(by), target: String(target), reason, at: toDate(at) }));
    v.innerHTML = `<div class="phead"><div><h1>Moderation</h1><p>Bans, warnings and user reports from Discord and this dashboard.</p></div><div class="acts"><button class="btn g-red" type="button" id="mban"><img src="img/lose.png" alt="">Ban by ID</button></div></div><div id="mk"></div><div class="mt" id="mtabs"></div><div class="filters"><label class="srch"><span class="sr">Search</span>${SRCH}<input class="inp" id="mq" placeholder="User, ID or reason"></label></div><div id="mt"></div>`;
    renderKpis($("#mk"), [
      kpi("Banned users", "lose", full(bans.length), null, null, null, null, ""),
      kpi("Warnings", "warning", full((st.totals || {}).warnings || 0), null, null, null, null, "all time"),
      kpi("Reports", "envelope", full((st.totals || {}).reports || 0), null, null, null, null, reps.filter((r) => r.at && Date.now() - r.at < 7 * DAY).length + " this week"),
      kpi("Mod actions, 7 days", "shield", full(logs.filter((l) => l.at && Date.now() - l.at < 7 * DAY).length), null, null, null, null, ""),
    ]);
    let tab = "bans", q = "";
    const match = (...xs) => !q || xs.some((x) => String(x || "").toLowerCase().includes(q));
    const draw = () => {
      if (tab === "bans") table($("#mt"), {
        rows: () => bans.filter((b) => match(b.id, nameOf(b.id), b.reason)), sort: "at", dir: -1, empty: "Nobody is banned.",
        cols: [{ key: "id", label: "User", render: (b) => userCell(S.byId.get(b.id) || { id: b.id }) }, { key: "reason", label: "Reason", cls: "msg" }, { key: "at", label: "Since", render: (b) => fdate(b.at), hide: true },
          { key: "x", label: "", nosort: true, render: (b) => `<div class="acts"><button class="mini-btn" data-un="${esc(b.id)}" type="button">Unban</button></div>` }],
        after: (h) => $$("[data-un]", h).forEach((b) => b.addEventListener("click", () => doAction("unban_user", b.dataset.un, nameOf(b.dataset.un)))),
      });
      else if (tab === "log") table($("#mt"), {
        rows: () => logs.filter((l) => match(l.target, nameOf(l.target), l.reason, l.action, nameOf(l.by))), sort: "at", dir: -1, empty: "No moderation actions yet.",
        cols: [{ key: "at", label: "When", render: (l) => fdate(l.at) + " " + (l.at ? ftime(l.at) : "") }, { key: "action", label: "Action", render: (l) => `<span class="pill ${/WARN/.test(l.action) ? "yellow" : /UNBLOCK|UNBAN/.test(l.action) ? "green" : /BLOCK|BAN|REMOVE/.test(l.action) ? "red" : "gray"}">${esc(l.action.replace(/_/g, " ").toLowerCase())}</span>` },
          { key: "target", label: "User", render: (l) => `<button class="linkbtn" data-u="${esc(l.target)}" type="button">${esc(nameOf(l.target))}</button>` }, { key: "reason", label: "Reason", cls: "msg", hide: true }, { key: "by", label: "By", render: (l) => esc(nameOf(l.by)), hide: true }],
        after: (h) => $$("[data-u]", h).forEach((b) => b.addEventListener("click", () => openUser(S.byId.get(b.dataset.u) || { id: b.dataset.u, cmds: 0, ads: 0, warns: 0 }))),
      });
      else table($("#mt"), {
        rows: () => reps.filter((r) => match(r.target, nameOf(r.target), r.reason, nameOf(r.by))), sort: "at", dir: -1, empty: "No reports.",
        cols: [{ key: "at", label: "When", render: (r) => ago(r.at) }, { key: "target", label: "Reported", render: (r) => `<button class="linkbtn" data-u="${esc(r.target)}" type="button">${esc(nameOf(r.target))}</button>` }, { key: "reason", label: "Reason", cls: "msg" }, { key: "by", label: "By", render: (r) => esc(nameOf(r.by)), hide: true }],
        after: (h) => $$("[data-u]", h).forEach((b) => b.addEventListener("click", () => openUser(S.byId.get(b.dataset.u) || { id: b.dataset.u, cmds: 0, ads: 0, warns: 0 }))),
      });
    };
    tabs($("#mtabs"), [["bans", "Banned (" + bans.length + ")"], ["log", "Moderation log"], ["reports", "Reports (" + reps.length + ")"]], tab, (x) => { tab = x; draw(); });
    $("#mq").addEventListener("input", (e) => { q = e.target.value.trim().toLowerCase(); draw(); });
    draw();
    $("#mban").addEventListener("click", () => {
      const m = openModal('<h3>Ban a user by ID</h3><p>For someone who isn\'t in the user list.</p><div class="field"><label for="bid">Discord user ID</label><input class="inp" id="bid" inputmode="numeric" autocomplete="off"></div><div class="mf"><button class="btn g-dark" data-no type="button">Cancel</button><button class="btn g-red" data-yes type="button">Next</button></div>');
      m._close = closeModal;
      m.querySelector("[data-no]").addEventListener("click", closeModal);
      m.querySelector("[data-yes]").addEventListener("click", () => { const id = m.querySelector("#bid").value.trim(); if (!isId(id)) { toast("That isn't a Discord user ID.", "warning"); return; } closeModal(); setTimeout(() => doAction("ban_user", id, id), 50); });
    });
  };

  // SERVERS
  R.servers = (v) => {
    const sv = ((botKey("servers") || {}).data || []).map(([id, name, members, joined, setup, ads, teams, reports, values]) => ({ id, name, members: +members, joined: toDate(joined), setup: !!setup, f: { "Trade ads": ads, "Team finds": teams, Reports: reports, "Value updates": values } }));
    v.innerHTML = `<div class="phead"><div><h1>Servers</h1><p>Every server Bloombot is in. Settings are changed by each server's admins with /setup and /config.</p></div></div><div id="sk"></div>
      <div class="grid g-21 mt"><div><div class="filters"><label class="srch"><span class="sr">Search servers</span>${SRCH}<input class="inp" id="sq" placeholder="Name or ID"></label><select class="sel" id="sst" aria-label="Setup"><option value="all">All servers</option><option value="ok">Set up</option><option value="no">Needs /setup</option></select></div><div id="stb"></div></div><section class="card" id="scfg"></section></div>`;
    const tot = sum(sv.map((s) => s.members));
    renderKpis($("#sk"), [
      kpi("Servers", "discord_stud_white", full(sv.length), null, null, null, null, ""),
      kpi("Members", "task_user", full(tot), null, null, null, null, "across all servers"),
      kpi("Set up", "verified_stud", full(sv.filter((s) => s.setup).length), null, null, null, null, sv.length ? ((sv.filter((s) => s.setup).length / sv.length) * 100).toFixed(0) + "% ran /setup" : ""),
      kpi("Joined, 30 days", "plus", full(sv.filter((s) => s.joined && Date.now() - s.joined < 30 * DAY).length), null, null, null, null, ""),
    ]);
    let q = "", ss = "all", sel = sv[0];
    const cfg = () => {
      if (!sel) { empty($("#scfg"), ...NO_BOT); return; }
      $("#scfg").innerHTML = `<div class="ch"><div class="hl"><h2><img src="img/gear.png" alt=""><span class="sname"></span></h2><p>${full(sel.members)} members · ID ${esc(sel.id)}</p></div>${sel.setup ? '<span class="st good"><i></i>Set up</span>' : '<span class="st warn"><i></i>Needs /setup</span>'}</div>
        <div class="dl-grid"><div><small>Bloombot joined</small><b>${fdate(sel.joined)}</b></div><div><small>Share of all members</small><b>${tot ? ((sel.members / tot) * 100).toFixed(1) + "%" : "–"}</b></div></div>
        <div class="rows">${Object.entries(sel.f).map(([a, on]) => `<div class="row"><div class="grow"><b>${a}</b></div><span class="st ${on ? "good" : ""}"><i></i>${on ? "On" : "Off"}</span></div>`).join("")}</div>`;
      $(".sname", $("#scfg")).textContent = sel.name;
    };
    const t = table($("#stb"), {
      rows: () => sv.filter((s) => (!q || s.name.toLowerCase().includes(q) || s.id.includes(q)) && (ss === "all" || s.setup === (ss === "ok"))), sort: "members", dir: -1, per: 12,
      onRow: (s) => { sel = s; cfg(); if (innerWidth < 1280) $("#scfg").scrollIntoView({ behavior: "smooth" }); }, empty: sv.length ? "No servers match." : NO_BOT[1],
      cols: [
        { key: "name", label: "Server", render: () => '<b class="sn"></b>' },
        { key: "members", label: "Members", n: true, render: (s) => full(s.members) },
        { key: "setup", label: "Setup", sort: (s) => +s.setup, render: (s) => (s.setup ? '<span class="st good"><i></i>Done</span>' : '<span class="st warn"><i></i>Needs /setup</span>') },
        { key: "joined", label: "Joined", sort: (s) => s.joined, render: (s) => ago(s.joined), hide: true },
      ],
      after: (h, sl) => $$(".sn", h).forEach((b, i) => { b.textContent = sl[i].name; }),
    });
    $("#sq").addEventListener("input", (e) => { q = e.target.value.trim().toLowerCase(); t.reset(); });
    $("#sst").addEventListener("change", (e) => { ss = e.target.value; t.reset(); });
    cfg();
  };

  // VALUES & DEMAND
  R.values = async (v) => {
    v.innerHTML = `<div class="phead"><div><h1>Values &amp; demand</h1><p>The value list the bot copies from the official Garden TD sheet, plus what traders ask for. Values change on the sheet, not here.</p></div><div class="acts"><a class="btn g-dark" href="values.html" target="_blank" rel="noopener"><img src="img/dollar.png" alt="">Public value list</a></div></div>
      <div class="grid g2"><section class="card"><div class="ch"><div class="hl"><h2><img src="img/swap.png" alt="">Most offered in trade ads</h2><p>Last 30 days, different traders</p></div></div><div id="vo"></div></section><section class="card"><div class="ch"><div class="hl"><h2><img src="img/wish_star.png" alt="">Most wanted in trade ads</h2><p>Last 30 days, different traders</p></div></div><div id="vw"></div></section></div>
      <div class="filters mt"><label class="srch"><span class="sr">Search units</span>${SRCH}<input class="inp" id="vq" placeholder="Search units"></label><select class="sel" id="vtr" aria-label="Trend"><option value="all">Any change</option><option value="up">Rising</option><option value="down">Falling</option></select></div><div id="vt">${skel(8)}</div>`;
    const dem = stats().unit_demand || [];
    const side = (s) => dem.filter((d) => d[1] === s).slice(0, 8).map(([n, , c]) => ({ name: n, value: +c }));
    side("offer").length ? C.blist($("#vo"), side("offer"), { color: "#d95926", unit: "traders" }) : empty($("#vo"), ...NO_BOT);
    side("want").length ? C.blist($("#vw"), side("want"), { color: "#199e70", unit: "traders" }) : empty($("#vw"), ...NO_BOT);
    if (!S.values) {
      try {
        const { data, error } = await sb.from("item_values").select("name,category,value,value_text,demand,status,rarity,icon_url,image_url,change_30d,updated_at").order("value", { ascending: false }).limit(3000);
        if (error) throw error;
        S.values = data || [];
      } catch (e) { empty($("#vt"), "Couldn't load values", e.message || ""); return; }
    }
    if (location.hash !== "#values") return;
    let q = "", tr = "all";
    const t = table($("#vt"), {
      rows: () => S.values.filter((u) => (!q || u.name.toLowerCase().includes(q)) && (tr === "all" || (tr === "up" ? u.change_30d > 0 : u.change_30d < 0))), sort: "value", dir: -1, per: 15,
      cols: [
        { key: "name", label: "Unit", render: (u) => `<div class="unit"><img src="${esc(/^https:\/\//.test(u.icon_url || "") ? u.icon_url : /^https:\/\//.test(u.image_url || "") ? u.image_url : "img/units/" + u.name.toLowerCase().replace(/[^a-z0-9]+/g, "_") + ".webp")}" alt="" loading="lazy" referrerpolicy="no-referrer"><b class="un"></b></div>` },
        { key: "rarity", label: "Rarity", hide: true, render: (u) => esc(u.rarity || "–") },
        { key: "value", label: "Value", n: true, render: (u) => (u.value > 0 ? full(u.value) : esc(u.value_text || "–")) },
        { key: "change_30d", label: "30 days", n: true, render: (u) => (u.change_30d == null ? '<span class="faint">–</span>' : `<span class="delta ${u.change_30d > 0.5 ? "up" : u.change_30d < -0.5 ? "down" : "flat"}">${u.change_30d >= 0 ? "▲" : "▼"} ${Math.abs(u.change_30d).toFixed(1)}%</span>`) },
        { key: "demand", label: "Demand", hide: true, render: (u) => esc(u.demand || "–") },
        { key: "updated_at", label: "Synced", sort: (u) => toDate(u.updated_at), render: (u) => ago(toDate(u.updated_at)), hide: true },
      ],
      after: (h, sl) => $$(".un", h).forEach((b, i) => { b.textContent = sl[i].name; }),
    });
    $("#vq").addEventListener("input", (e) => { q = e.target.value.trim().toLowerCase(); t.reset(); });
    $("#vtr").addEventListener("change", (e) => { tr = e.target.value; t.reset(); });
  };

  // GIVEAWAYS
  R.giveaways = async (v) => {
    v.innerHTML = `<div class="phead"><div><h1>Giveaways</h1><p>Website giveaways. Create, end and draw them in the giveaway manager.</p></div><div class="acts"><a class="btn g-purple" href="giveaway-admin.html"><img src="img/gift.png" alt="">Open giveaway manager</a></div></div><div id="gk"></div><div id="gl" class="mt">${skel(4)}</div>`;
    try { S.gw = S.gw || (await (async () => { const { data, error } = await sb.rpc("gw_admin_list"); if (error) throw error; return data || []; })()); } catch (e) { empty($("#gl"), "Couldn't load giveaways", e.message || ""); return; }
    if (location.hash !== "#giveaways") return;
    const g = S.gw.map((x) => ({ ...x, ends: toDate(x.ends_at), state: x.winner_id ? "Won" : toDate(x.ends_at) > Date.now() ? "Live" : "Ended" }));
    renderKpis($("#gk"), [
      kpi("Live now", "gift", full(g.filter((x) => x.state === "Live").length), null, null, null, null, ""),
      kpi("Entrants, live", "task_user", full(sum(g.filter((x) => x.state === "Live").map((x) => +x.entrants))), null, null, null, null, ""),
      kpi("All giveaways", "medal_gold", full(g.length), null, null, null, null, full(sum(g.map((x) => +x.entrants))) + " entrants total"),
    ]);
    table($("#gl"), {
      rows: () => g, sort: "ends", dir: -1, empty: "No giveaways yet.",
      cols: [
        { key: "title", label: "Prize", render: () => '<b class="gt"></b>' },
        { key: "state", label: "Status", render: (x) => statusPill(x.state) },
        { key: "ends", label: "Ends", render: (x) => fdate(x.ends) + " " + (x.ends ? ftime(x.ends) : "") },
        { key: "entrants", label: "Entrants", n: true, render: (x) => full(+x.entrants) },
        { key: "entries", label: "Entries", n: true, render: (x) => full(+x.entries), hide: true },
        { key: "winner_name", label: "Winner", render: () => '<span class="gw"></span>', hide: true },
      ],
      after: (h, sl) => { $$(".gt", h).forEach((b, i) => { b.textContent = sl[i].title; }); $$(".gw", h).forEach((b, i) => { b.textContent = sl[i].winner_name || (sl[i].winner_id ? sl[i].winner_id : "–"); }); },
    });
  };

  // WEBSITE
  R.website = (v) => {
    const D = S.D, tr = S.ov.traffic || {};
    v.innerHTML = `<div class="phead"><div><h1>Website</h1><p>bloombot-gtd.vercel.app. Visits are counted anonymously for visitors who choose Accept all.</p></div><div class="acts"><a class="btn g-dark" href="./" target="_blank" rel="noopener"><img src="img/flower.png" alt="">Open website</a></div></div>
      <div id="wk"></div><div class="grid g-21 mt"><section class="card"><div class="ch"><div class="hl"><h2><img src="img/task_about.png" alt="">Views per page</h2><p>Last 30 days</p></div></div><div id="wpc"></div></section><section class="card"><div class="ch"><div class="hl"><h2><img src="img/rbx_stud.png" alt="">Devices</h2><p>Last 30 days</p></div></div><div id="wdev"></div></section></div>
      <div class="grid g2 mt"><section class="card"><div class="ch"><h2><img src="img/swap.png" alt="">Trade ads from the website</h2></div><div id="wads"></div></section><section class="card"><div class="ch"><h2><img src="img/verified_stud.png" alt="">Roblox verification attempts</h2></div><div id="wver"></div></section></div><div class="mt" id="wpt"></div>`;
    const v30 = sum(D.visits.slice(-30));
    const tries = sum(D.webTries.slice(-30)), posted = sum(D.webAds.slice(-30));
    renderKpis($("#wk"), [
      kpi("Page views, 30 days", "chart_up", D.hasTraffic ? full(v30) : "–", D.hasTraffic ? v30 : null, sum(D.visits.slice(-60, -30)), D.visits.slice(-30), "#3987e5"),
      kpi("Visitors, 30 days", "rise", D.hasTraffic ? full(sum(D.uniques.slice(-30))) : "–", null, null, D.uniques.slice(-30), "#9085e9", "first visit of the day"),
      kpi("Website trade ads", "swap", full(posted), null, null, D.webAds.slice(-30), "#d95926", tries ? full(tries - posted) + " rejected, 30 days" : "30 days"),
      kpi("Strategies", "bullseye", full(S.ov.strategies || 0), null, null, null, null, "on the website"),
    ]);
    const pages = (tr.pages || []).slice(0, 10);
    if (pages.length) C.bars($("#wpc"), { labels: pages.map((p) => PAGE_NAMES[p[0]] || p[0]), series: [{ name: "Views", values: pages.map((p) => +p[1]), color: "#3987e5" }], horizontal: true, rowH: 26, labelW: 130 });
    else empty($("#wpc"), ...NO_TRAFFIC);
    const dev = tr.devices || [];
    if (dev.length) { const tot = sum(dev.map((d) => +d[1])); const top = dev[0]; C.donut($("#wdev"), { items: dev.map(([n, x], i) => ({ name: n[0].toUpperCase() + n.slice(1), value: +x, color: C.PAL[i] })), center: ((top[1] / tot) * 100).toFixed(0) + "%", sub: top[0], unit: "views" }); }
    else empty($("#wdev"), ...NO_TRAFFIC);
    chartOr($("#wads"), [D.webTries.slice(-30)], "No website trade ads", "In the last 30 days.", () => C.bars($("#wads"), { labels: D.days.slice(-30).map(fshort), series: [{ name: "Posted", values: D.webAds.slice(-30), color: "#199e70" }, { name: "Rejected", values: D.webTries.slice(-30).map((x, i) => Math.max(0, x - D.webAds[D.N - 30 + i])), color: "#e66767" }], stacked: true, height: 220, tipLabel: (i) => fdate(D.days[D.N - 30 + i]) }));
    const ver = Object.entries(S.ov.verifications || {}).filter((x) => +x[1]);
    if (ver.length) C.donut($("#wver"), { items: ver.map(([n, x]) => ({ name: n, value: +x, color: n === "verified" ? "#199e70" : n === "failed" ? "#e66767" : "#c98500" })), center: full(sum(ver.map((x) => +x[1]))), sub: "attempts", unit: "attempts" });
    else empty($("#wver"), "No attempts yet", "Roblox verifications started on the website show up here.");
    pageTable($("#wpt"));
  };

  // ACTIVITY LOG
  R.logs = async (v) => {
    v.innerHTML = `<div class="phead"><div><h1>Activity log</h1><p>Every dashboard action and refused attempt, what the bot did, and bot events.</p></div><div class="acts"><button class="btn g-dark" type="button" id="lref"><img src="img/clock.png" alt="">Refresh</button><button class="btn g-dark" type="button" id="lexp"><img src="img/calculator.png" alt="">Export CSV</button></div></div><div id="ltabs"></div><div class="filters"><label class="srch"><span class="sr">Search logs</span>${SRCH}<input class="inp" id="lq" placeholder="Search"></label></div><div id="ltb">${skel(10)}</div>`;
    $("#lref").addEventListener("click", () => { S.logs = null; R.logs(v); });
    try { S.logs = S.logs || await rpc("admin_logs", { p_limit: 500 }); } catch (e) { empty($("#ltb"), "Couldn't load the log", e.message); return; }
    if (location.hash !== "#logs") return;
    const audit = (S.logs.audit || []).map((a) => ({ at: toDate(a.at), who: a.who, action: a.action, target: a.target, detail: a.detail, ok: a.ok }));
    const acts = (S.logs.actions || []).map((a) => ({ ...a, at: toDate(a.at), done: toDate(a.done_at) }));
    const events = ((botKey("events") || {}).data || []).map((e) => ({ ...e, at: toDate(e.at) }));
    const regs = S.users.filter((u) => u.registered && Date.now() - u.registered < 30 * DAY).map((u) => ({ at: u.registered, u }));
    let tab = "audit", q = "";
    const m = (...xs) => !q || xs.some((x) => String(x || "").toLowerCase().includes(q));
    const rowsFor = () => {
      if (tab === "audit") return audit.filter((a) => m(a.action, a.target, nameOf(a.target), a.who, JSON.stringify(a.detail || "")));
      if (tab === "actions") return acts.filter((a) => m(a.kind, a.target, nameOf(a.target), a.reason, a.result, a.status));
      if (tab === "events") return events.filter((e) => m(e.kind, e.title, e.text, JSON.stringify(e.fields || {})));
      return regs.filter((r) => m(r.u.name, r.u.id, r.u.roblox));
    };
    const draw = () => {
      if (tab === "audit") table($("#ltb"), { rows: rowsFor, sort: "at", dir: -1, per: 20, cls: "log", empty: "Nothing logged yet.", cols: [
        { key: "at", label: "Time", render: (a) => fshort(a.at) + " " + ftime(a.at) },
        { key: "ok", label: "Result", sort: (a) => +a.ok, render: (a) => (a.ok ? '<span class="pill green">allowed</span>' : '<span class="pill red">refused</span>') },
        { key: "action", label: "Action", render: (a) => esc(a.action) },
        { key: "target", label: "Target", render: (a) => esc(a.target ? (isId(a.target) ? nameOf(a.target) : a.target) : "–") },
        { key: "detail", label: "Details", cls: "msg", nosort: true, render: (a) => esc(a.detail ? Object.entries(a.detail).filter((x) => x[1] != null).map(([k, x]) => k + ": " + x).join(", ") : ""), hide: true },
        { key: "who", label: "Discord ID", render: (a) => esc(a.who || "not logged in"), hide: true } ] });
      else if (tab === "actions") table($("#ltb"), { rows: rowsFor, sort: "at", dir: -1, per: 20, cls: "log", empty: "No bot actions queued yet.", cols: [
        { key: "at", label: "Queued", render: (a) => fshort(a.at) + " " + ftime(a.at) },
        { key: "kind", label: "Action", render: (a) => esc(a.kind.replace(/_/g, " ")) },
        { key: "target", label: "Target", render: (a) => esc(isId(a.target) ? nameOf(a.target) : "#" + a.target) },
        { key: "status", label: "Status", render: (a) => statusPill(a.status) },
        { key: "result", label: "Result", cls: "msg", render: (a) => esc([a.result, a.reason ? "reason: " + a.reason : ""].filter(Boolean).join(" · ")), hide: true } ] });
      else if (tab === "events") table($("#ltb"), { rows: rowsFor, sort: "at", dir: -1, per: 20, cls: "log", empty: "No events since the bot last started.", cols: [
        { key: "at", label: "Time", render: (e) => fshort(e.at) + " " + ftime(e.at) },
        { key: "kind", label: "Type", render: (e) => statusPill(e.kind) },
        { key: "title", label: "Event", cls: "msg", render: () => '<b class="et"></b><br><span class="muted ex"></span>' } ],
        after: (h, sl) => { $$(".et", h).forEach((b, i) => { b.textContent = sl[i].title; }); $$(".ex", h).forEach((b, i) => { b.textContent = Object.entries(sl[i].fields || {}).map(([k, x]) => k + ": " + x).join(" · ") || (sl[i].text || "").split("\n")[0]; }); } });
      else table($("#ltb"), { rows: rowsFor, sort: "at", dir: -1, per: 20, empty: "No new accounts in the last 30 days.", onRow: (r) => openUser(r.u), cols: [
        { key: "at", label: "Registered", render: (r) => fdate(r.at) + " " + ftime(r.at) },
        { key: "u", label: "User", sort: (r) => (r.u.name || "").toLowerCase(), render: (r) => userCell(r.u) },
        { key: "v", label: "Roblox", nosort: true, render: (r) => verPill(r.u) } ] });
    };
    tabs($("#ltabs"), [["audit", "Dashboard log (" + audit.filter((a) => !a.ok).length + " refused)"], ["actions", "Bot actions"], ["events", "Bot events"], ["regs", "Registrations"]], tab, (x) => { tab = x; draw(); });
    $("#lq").addEventListener("input", (e) => { q = e.target.value.trim().toLowerCase(); draw(); });
    $("#lexp").addEventListener("click", () => downloadCsv("bloombot-admin-log.csv", ["time", "allowed", "action", "target", "discord_id", "details"], audit.map((a) => [a.at.toISOString(), a.ok, a.action, a.target || "", a.who || "", JSON.stringify(a.detail || {})])));
    draw();
  };

  // SYSTEM HEALTH
  R.system = (v) => {
    const D = S.D, on = botOnline(), st = botKey("status");
    const ev = ((botKey("events") || {}).data || []).filter((e) => e.kind === "error");
    const age = (k) => { const x = botKey(k); return x ? Date.now() - toDate(x.updated_at).getTime() : null; };
    const svc = [
      ["Discord bot", "Checks in every minute", age("status"), 3 * 60e3, st ? (st.data.latency_ms != null ? st.data.latency_ms + " ms ping" : "") : ""],
      ["Bot → website stats", "Every 5 minutes", age("stats"), 12 * 60e3, ""],
      ["Bot → server list", "Every 5 minutes", age("servers"), 12 * 60e3, ""],
      ["Bot → user list", "Every 15 minutes", age("users"), 35 * 60e3, ""],
      ["Database (Supabase)", "This dashboard's data", 0, 1, S.loadMs + " ms to load"],
      ["Visit counter", "Website traffic", D.hasTraffic ? (Date.now() - (S.D.visits[D.N - 1] ? Date.now() : D.N && Date.now() - DAY)) : null, 2 * DAY, D.hasTraffic ? "counting" : "no visits yet"],
    ];
    v.innerHTML = `<div class="phead"><div><h1>System health</h1><p>Bot uptime, data freshness, errors and response times.</p></div><div class="acts"><button class="btn g-dark" type="button" id="sref"><img src="img/clock.png" alt="">Refresh</button></div></div>
      <section class="card"><div class="row"><span class="st ${on.state === "good" ? "good live" : on.state === "crit" ? "crit" : "warn"}"><i></i></span><div class="grow"><b>${on.state === "good" ? "Bloombot is running" : on.state === "crit" ? "Bloombot isn't checking in" : on.state === "unknown" ? "No data from the bot yet" : "Bloombot is starting"}</b><small class="muted">${st ? "Last check-in " + ago(toDate(st.updated_at)) : NO_BOT[1]}</small></div></div></section>
      <div id="sk" class="mt"></div>
      <div class="grid g-21 mt"><section class="card"><div class="ch"><div class="hl"><h2><img src="img/lightning.png" alt="">Command response time, 30 days</h2><p>Average per day</p></div></div><div id="slat"></div></section>
        <section class="card"><div class="ch"><h2><img src="img/shield.png" alt="">Services</h2></div><div id="ssv"></div></section></div>
      <div class="grid g2 mt"><section class="card"><div class="ch"><h2><img src="img/warning.png" alt="">Command errors, 30 days</h2></div><div id="serc"></div></section>
        <section class="card"><div class="ch"><div class="hl"><h2><img src="img/warning.png" alt="">Latest errors</h2><p>Since the bot last started</p></div></div><div id="serr"></div></section></div>`;
    const err24 = ev.filter((e) => Date.now() - toDate(e.at) < DAY).length;
    renderKpis($("#sk"), [
      kpi("Running for", "clock", uptimeText(), null, null, null, null, st && st.data.started_at ? "since " + fdate(toDate(st.data.started_at)) + " " + ftime(toDate(st.data.started_at)) : ""),
      kpi("Avg. response, today", "lightning", D.cmdMs[D.N - 1] ? full(D.cmdMs[D.N - 1]) + " ms" : "–", null, null, D.cmdMs.slice(-30), "#3987e5", "slash commands"),
      kpi("Errors, 24h", "warning", full(err24), null, null, null, null, "reported to the dev log"),
      kpi("Version", "gear", st ? esc(st.data.version || "–") : "–", null, null, null, null, st ? "Python " + esc(st.data.python || "") + " · discord.py " + esc(st.data.discord_py || "") : ""),
    ]);
    chartOr($("#slat"), [D.cmdMs.slice(-30)], ...NO_BOT, () => C.line($("#slat"), { labels: D.days.slice(-30), series: [{ name: "Average response", values: D.cmdMs.slice(-30), color: "#3987e5" }], area: true, height: 250, xfmt: fshort, fmt: (x) => Math.round(x) + " ms", yfmt: (x) => Math.round(x) + "ms", tipLabel: (i) => fdate(D.days[D.N - 30 + i]) }));
    chartOr($("#serc"), [D.cmds.slice(-30)], ...NO_BOT, () => C.bars($("#serc"), { labels: D.days.slice(-30).map(fshort), series: [{ name: "Failed commands", values: D.cmdErr.slice(-30), color: "#e66767" }], height: 220, tipLabel: (i) => fdate(D.days[D.N - 30 + i]) }));
    $("#ssv").innerHTML = svc.map(([n, d, a, lim, extra]) => { const s = a == null ? "" : a <= lim ? "good" : "crit"; return `<div class="svc"><span class="st ${s}"><i></i></span><div class="grow"><b>${esc(n)}</b><small>${esc(d)}</small></div><span class="ms">${esc(a == null ? "waiting" : a > lim ? "late: " + ago(new Date(Date.now() - a)) : extra || ago(new Date(Date.now() - a)))}</span></div>`; }).join("");
    const last = ev.slice().reverse().slice(0, 8);
    if (last.length) {
      $("#serr").innerHTML = `<ul class="tl">${last.map(() => '<li class="b"><b></b><small></small><pre class="trace"></pre></li>').join("")}</ul>`;
      $$("#serr li").forEach((li, i) => { const e = last[i]; li.querySelector("b").textContent = e.title; li.querySelector("small").textContent = ago(toDate(e.at)) + " · " + Object.entries(e.fields || {}).map(([k, x]) => k + ": " + x).join(" · "); li.querySelector("pre").textContent = e.text; });
    } else empty($("#serr"), "No errors", st ? "Nothing went wrong since the bot last started." : NO_BOT[1]);
    $("#sref").addEventListener("click", () => refresh(true));
  };

  // REPORTS
  R.reports = (v) => {
    v.innerHTML = `<div class="phead"><div><h1>Reports</h1><p>Download real statistics as CSV or JSON.</p></div></div>
      <div class="filters"><label for="rpr" class="muted">Period</label><select class="sel" id="rpr"><option value="7">Last 7 days</option><option value="30" selected>Last 30 days</option><option value="90">Last 90 days</option><option value="365">Last 12 months</option></select><select class="sel" id="rpf" aria-label="Format"><option>CSV</option><option>JSON</option></select></div>
      <div class="grid g2" id="rpl"></div><p class="muted mt"><small>Downloads are made in your browser from data this dashboard already loaded; they're logged like every other dashboard read.</small></p>`;
    const D = S.D;
    const lastN = (n) => Array.from({ length: n }, (_, i) => D.N - n + i);
    const REP = [
      ["Website traffic", "chart_up", "Page views and visitors per day", (n) => [["date", "page_views", "unique_visitors"], lastN(n).map((i) => [D.keys[i], D.visits[i], D.uniques[i]])]],
      ["User growth", "task_user", "New users, new verifications and active users per day", (n) => [["date", "new_users", "new_verified", "active_users"], lastN(n).map((i) => [D.keys[i], D.regs[i], D.verified[i], D.active[i]])]],
      ["Command usage", "lightning", "Uses, errors and response time per command (30 days)", () => [["command", "category", "uses_30d", "uses_total", "error_percent_30d", "avg_ms_30d"], (stats().commands || []).map((c) => [c[0], c[1], c[3], c[2], c[3] ? ((c[4] / c[3]) * 100).toFixed(2) : 0, c[5]])]],
      ["Trading", "swap", "Trade ads per day, Discord and website", (n) => [["date", "trade_ads", "website_posted", "website_tries"], lastN(n).map((i) => [D.keys[i], D.ads[i], D.webAds[i], D.webTries[i]])]],
      ["Servers", "discord_stud_white", "Every server with members and setup", () => [["guild_id", "name", "members", "joined", "setup"], ((botKey("servers") || {}).data || []).map((s) => [s[0], s[1], s[2], s[3], !!s[4]])]],
      ["Moderation", "shield", "Moderation log (latest 300)", () => [["time", "action", "target_id", "moderator_id", "reason"], (stats().moderation || []).map((m) => [m[5], m[1], m[2], m[3], m[4]])]],
    ];
    $("#rpl").innerHTML = REP.map(([t, i, d], k) => `<div class="rep"><img src="${ic(i)}" alt=""><div class="grow"><b>${t}</b><small>${d}</small></div><button class="btn g-blue sm" type="button" data-k="${k}">Download</button></div>`).join("");
    $$("#rpl [data-k]").forEach((b) => b.addEventListener("click", () => {
      const r = REP[+b.dataset.k], n = +$("#rpr").value, [head, rows] = r[3](n);
      const name = "bloombot-" + r[0].toLowerCase().replace(/\s+/g, "-") + "-" + n + "d";
      if ($("#rpf").value === "JSON") download(name + ".json", JSON.stringify(rows.map((row) => Object.fromEntries(head.map((h, i) => [h, row[i]]))), null, 2), "application/json");
      else downloadCsv(name + ".csv", head, rows);
    }));
  };
  function download(name, text, type) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([text], { type }));
    a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    toast("Downloaded " + name, "calculator");
  }
  function downloadCsv(name, head, rows) {
    // a leading = + - @ would run as a formula in Excel: prefix it
    const q = (x) => { let s = String(x == null ? "" : x); if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
    download(name, [head, ...rows].map((r) => r.map(q).join(",")).join("\n"), "text/csv");
  }

  // ---------- router ----------
  function go() {
    if (!S.D) return;
    const id = (location.hash || "#overview").slice(1).split("?")[0];
    const page = PAGES[id] ? id : "overview";
    $$(".si").forEach((a) => { const on = a.dataset.id === page; a.classList.toggle("on", on); if (on) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current"); });
    $("#crumb").innerHTML = `<small>${esc(PAGES[page].group)}</small><b>${esc(PAGES[page].label)}</b>`;
    document.title = PAGES[page].label + " · Bloombot Admin";
    const v = $("#view");
    v.className = "view";
    void v.offsetWidth;
    v.classList.add("view");
    C.hideTip();
    closeDrawer();
    R[page](v);
    $(".app").classList.remove("mopen");
    scrollTo(0, 0);
  }

  // ---------- notifications (made from the loaded data) ----------
  function notifications() {
    const out = [], on = botOnline(), D = S.D;
    if (on.state === "crit") out.push({ t: "Bloombot isn't checking in", s: "Last seen " + ago(toDate(botKey("status").updated_at)), go: "system", icon: "warning", at: Date.now() });
    if (on.state === "unknown") out.push({ t: "No data from the bot yet", s: "Update the bot and run site-admin.sql", go: "system", icon: "clock", at: 0 });
    const errs = ((botKey("events") || {}).data || []).filter((e) => e.kind === "error" && Date.now() - toDate(e.at) < DAY);
    if (errs.length) out.push({ t: errs.length + " bot error" + (errs.length > 1 ? "s" : "") + " in the last 24h", s: errs[errs.length - 1].title, go: "system", icon: "warning", at: toDate(errs[errs.length - 1].at).getTime() });
    const reps = (stats().reports || []).filter((r) => Date.now() - toDate(r[4]) < DAY);
    if (reps.length) out.push({ t: reps.length + " new user report" + (reps.length > 1 ? "s" : ""), s: "Moderation", go: "moderation", icon: "envelope", at: toDate(reps[0][4]).getTime() });
    if (D.regs[D.N - 1]) out.push({ t: D.regs[D.N - 1] + " new user" + (D.regs[D.N - 1] > 1 ? "s" : "") + " today", s: "Users", go: "users", icon: "task_user", at: new Date().setHours(0, 0, 0, 0) });
    if (!D.hasTraffic) out.push({ t: "Visit counting hasn't started", s: "It starts with the first visit after this update", go: "website", icon: "chart_up", at: 0 });
    return out.sort((a, b) => b.at - a.at);
  }
  function drawNotes() {
    let seen = 0;
    try { seen = +localStorage.getItem("bb_admin_seen") || 0; } catch (e) { /* ignore */ }
    const list = notifications();
    const un = list.filter((n) => n.at > seen).length;
    $("#ndot").textContent = un; $("#ndot").hidden = !un;
    const np = $("#npop");
    np.innerHTML = `<div class="ph">Notifications<button type="button" id="nall">Mark all read</button></div>` + (list.length ? list.map((n, i) => `<a class="pi${n.at > seen ? " unread" : ""}" href="#${n.go}" data-i="${i}"><img src="${ic(n.icon)}" alt=""><span class="grow"><span></span><small></small></span></a>`).join("") : '<div class="empty-pop">All quiet.</div>');
    $$("a.pi", np).forEach((a) => { const n = list[+a.dataset.i]; a.querySelector(".grow>span").textContent = n.t; a.querySelector("small").textContent = n.s; a.addEventListener("click", () => np.classList.remove("open")); });
    $("#nall").addEventListener("click", (e) => { e.stopPropagation(); try { localStorage.setItem("bb_admin_seen", String(Date.now())); } catch (er) { /* ignore */ } drawNotes(); });
    setCount("system", errsCount(), true);
  }
  const errsCount = () => ((botKey("events") || {}).data || []).filter((e) => e.kind === "error" && Date.now() - toDate(e.at) < DAY).length;

  function drawBotCard() {
    const b = botOnline(), st = $("#bstat"), s = botKey("status");
    st.className = "st " + (b.state === "unknown" ? "" : b.state);
    const txt = b.state === "good" && s ? b.text + " · " + full(s.data.servers || 0) + " servers" : b.text;
    st.textContent = "";
    st.append(document.createElement("i"), document.createTextNode(txt));
  }

  // ---------- top bar ----------
  function popToggle(btn, pop) {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const open = !pop.classList.contains("open");
      $$(".pop.open").forEach((p) => p.classList.remove("open"));
      pop.classList.toggle("open", open);
      btn.setAttribute("aria-expanded", open);
    });
  }
  function initTop() {
    const app = $(".app");
    try { if (localStorage.getItem("bb_admin_side") === "1") app.classList.add("collapsed"); } catch (e) { /* ignore */ }
    $("#collapse").addEventListener("click", () => {
      app.classList.toggle("collapsed");
      try { localStorage.setItem("bb_admin_side", app.classList.contains("collapsed") ? "1" : "0"); } catch (e) { /* ignore */ }
    });
    $("#burger").addEventListener("click", () => app.classList.add("mopen"));
    $(".sideshade").addEventListener("click", () => app.classList.remove("mopen"));
    popToggle($("#nbtn"), $("#npop"));
    popToggle($("#mebtn"), $("#mepop"));
    $("#mout").addEventListener("click", async () => { await sb.auth.signOut(); location.href = "./"; });
    $("#mref").addEventListener("click", () => { $("#mepop").classList.remove("open"); refresh(true); });
    document.addEventListener("click", (e) => { if (!e.target.closest(".pop")) $$(".pop.open").forEach((p) => p.classList.remove("open")); });
    const inp = $("#gs"), res = $("#gres");
    let act = 0, items = [];
    const run = () => {
      const q = inp.value.trim().toLowerCase();
      if (!q || !S.D) { res.classList.remove("open"); inp.setAttribute("aria-expanded", "false"); return; }
      const pages = Object.values(PAGES).filter((p) => p.label.toLowerCase().includes(q) || p.id.includes(q)).slice(0, 4).map((p) => ({ kind: "Pages", label: p.label, sub: p.group, icon: ic(p.icon), go: () => { location.hash = p.id; } }));
      const users = S.users.filter((u) => (u.name || "").toLowerCase().includes(q) || (u.roblox || "").toLowerCase().includes(q) || u.id.startsWith(q)).slice(0, 6).map((u) => ({ kind: "Users", label: u.name || u.id, sub: u.roblox ? "Roblox: " + u.roblox : u.id, icon: u.avatar || ic("task_user"), go: () => openUser(u) }));
      const cmds = (stats().commands || []).filter((c) => c[0].includes(q.replace(/^\//, ""))).slice(0, 3).map((c) => ({ kind: "Commands", label: "/" + c[0], sub: full(c[3]) + " uses in 30 days", icon: ic("lightning"), go: () => { location.hash = "commands"; } }));
      const servers = ((botKey("servers") || {}).data || []).filter((s) => String(s[1]).toLowerCase().includes(q)).slice(0, 3).map((s) => ({ kind: "Servers", label: s[1], sub: full(s[2]) + " members", icon: ic("discord_stud_white"), go: () => { location.hash = "servers"; } }));
      items = [...pages, ...users, ...cmds, ...servers];
      act = 0;
      let last = "";
      res.innerHTML = items.length ? items.map((it, i) => `${it.kind !== last ? `<div class="lab">${(last = it.kind)}</div>` : ""}<button type="button" class="pi${i === 0 ? " act" : ""}" data-i="${i}" role="option"><img src="${esc(it.icon)}" alt="" referrerpolicy="no-referrer"><span><span></span><small></small></span></button>`).join("") : '<div class="empty-pop"></div>';
      $$("button.pi", res).forEach((b) => { const it = items[+b.dataset.i]; b.querySelector("span>span").textContent = it.label; b.querySelector("small").textContent = it.sub; b.addEventListener("click", () => pick(+b.dataset.i)); });
      if (!items.length) res.querySelector(".empty-pop").textContent = "No results for “" + inp.value.trim() + "”";
      res.classList.add("open");
      inp.setAttribute("aria-expanded", "true");
    };
    const pick = (i) => { const it = items[i]; if (!it) return; res.classList.remove("open"); inp.value = ""; inp.blur(); it.go(); };
    inp.addEventListener("input", run);
    inp.addEventListener("focus", run);
    inp.addEventListener("keydown", (e) => {
      const bs = $$("button.pi", res);
      if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); act = (act + (e.key === "ArrowDown" ? 1 : -1) + bs.length) % Math.max(1, bs.length); bs.forEach((b, i) => b.classList.toggle("act", i === act)); if (bs[act]) bs[act].scrollIntoView({ block: "nearest" }); }
      if (e.key === "Enter") { e.preventDefault(); pick(act); }
      if (e.key === "Escape") { res.classList.remove("open"); inp.blur(); }
    });
    document.addEventListener("keydown", (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); inp.focus(); inp.select(); }
      if (e.key === "Escape") {
        const m = $("#modal");
        if (m.classList.contains("on")) m._close();
        else if ($("#drawer").classList.contains("on")) closeDrawer();
        else { $$(".pop.open").forEach((p) => p.classList.remove("open")); $(".app").classList.remove("mopen"); }
      }
    });
    $("#scrim").addEventListener("click", () => { const m = $("#modal"); if (m.classList.contains("on")) m._close(); else closeDrawer(); });
  }

  // ---------- login gate + loading ----------
  function gate(reason) {
    S.D = null;
    document.body.classList.add("gated");
    const g = $("#gate");
    g.hidden = false;
    const why = {
      "not logged in": ["Owner login", "Log in with the Discord account that owns Bloombot."],
      "not an owner": ["Owners only", "This account can't open the admin dashboard. The attempt was logged."],
      "session too old": ["Please log in again", "For safety, admin logins last 7 days. Log out and back in to continue."],
      "session not found": ["Please log in again", "Your login session ended. Log in again to continue."],
      "rate limited": ["Slow down", "Too many requests in a minute. Wait a moment and reload."],
    }[reason] || (/could not find the function|schema cache/i.test(reason || "") ? ["Setup not finished", "The admin database functions are missing. Run site-admin.sql in Supabase, then reload."] : ["Couldn't open the dashboard", reason || "Something went wrong."]);
    $("#gtitle").textContent = why[0];
    $("#gtext").textContent = why[1];
    const btn = $("#glogin");
    btn.hidden = reason === "not an owner" || reason === "rate limited";
    btn.textContent = reason === "not logged in" ? "Log in with Discord" : "Log in again";
    $("#gloading").hidden = true;
  }
  async function refresh(manual) {
    const t0 = performance.now();
    if (manual) $$("#view .chart").forEach((c) => c.classList.add("busy"));
    try {
      const [ov, prof] = await Promise.all([rpc("admin_overview", { p_days: 400 }), rpc("admin_profiles")]);
      S.ov = ov; S.profiles = Array.isArray(prof) ? prof : [];
      S.loadMs = Math.round(performance.now() - t0);
      S.trade = S.logs = S.gw = null;
      build();
      drawNotes();
      drawBotCard();
      $("#lastload").textContent = "Updated " + ftime(new Date());
      if (manual) { toast("Up to date", "clock"); if (!$("#drawer").classList.contains("on")) go(); }
    } catch (e) {
      if (!S.D) gate(e.message);
      else toast("Couldn't refresh: " + e.message, "warning");
    }
  }
  async function boot() {
    buildNav();
    initTop();
    if (!window.supabase || !window.AC) { gate("The page didn't load completely. Reload to try again."); return; }
    sb = window.supabase.createClient(SB_URL, SB_KEY);
    $("#glogin").addEventListener("click", async () => {
      if (session) await sb.auth.signOut();
      sb.auth.signInWithOAuth({ provider: "discord", options: { redirectTo: location.origin + location.pathname, scopes: "identify" } });
    });
    const { data } = await sb.auth.getSession();
    session = data.session;
    if (!session) { gate("not logged in"); return; }
    const meta = session.user.user_metadata || {};
    const nm = (meta.custom_claims && meta.custom_claims.global_name) || meta.full_name || meta.name || "Owner";
    $("#mename").textContent = nm; $("#mepop .ph b").textContent = nm;
    if (/^https:\/\//.test(meta.avatar_url || "")) $("#meav").src = meta.avatar_url;
    let me;
    try { me = await rpc("admin_me"); } catch (e) { gate(e.message); return; }
    if (!me || !me.ok) { gate((me && me.reason) || "not an owner"); return; }
    await refresh(false);
    if (!S.D) return;
    document.body.classList.remove("gated");
    $("#gate").hidden = true;
    addEventListener("hashchange", go);
    go();
    // status refresh every 2 minutes while the tab is open
    setInterval(() => { if (!document.hidden) refresh(false).then(() => { const p = (location.hash || "#overview").slice(1); if (["overview", "system"].includes(p) && !$("#drawer").classList.contains("on") && !$("#modal").classList.contains("on")) go(); }); }, 120e3);
    sb.auth.onAuthStateChange((ev) => { if (ev === "SIGNED_OUT") location.reload(); });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();
