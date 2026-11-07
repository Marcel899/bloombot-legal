// Bloombot admin dashboard: frontend preview. Every number comes from js/admin-data.js (sample data);
// saving, banning, exporting etc. only change this page's in-memory copy.
(function () {
  "use strict";
  const D = window.AD, C = window.AC;
  const $ = (q, r) => (r || document).querySelector(q);
  const $$ = (q, r) => Array.from((r || document).querySelectorAll(q));
  const esc = (t) => String(t == null ? "" : t).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const full = C.full, compact = C.compact;
  const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const WD = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const fdate = (d) => d.getDate() + " " + MON[d.getMonth()] + " " + d.getFullYear();
  const fshort = (d) => d.getDate() + " " + MON[d.getMonth()];
  const ftime = (d) => String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
  function ago(d) {
    const s = Math.round((Date.now() - d.getTime()) / 1000);
    if (s < 0) { const m = -s / 60; return m < 60 ? "in " + Math.round(m) + "m" : m < 1440 ? "in " + Math.round(m / 60) + "h" : "in " + Math.round(m / 1440) + "d"; }
    if (s < 60) return "just now";
    if (s < 3600) return Math.floor(s / 60) + "m ago";
    if (s < 86400) return Math.floor(s / 3600) + "h ago";
    if (s < 86400 * 30) return Math.floor(s / 86400) + "d ago";
    return fdate(d);
  }
  const sum = (a) => a.reduce((x, y) => x + y, 0);
  const ic = (n) => `img/${n}${n.includes(".") ? "" : ".png"}`;
  const SRCH = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" d="M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15Zm5.4-2.1L21 21"/></svg>';
  const N = D.days.length;

  // ---------- navigation ----------
  const NAV = [
    ["Dashboard", [["overview", "Overview", "gem"], ["analytics", "Analytics", "chart_up"], ["users", "Users", "task_user"]]],
    ["Bot", [
      ["ads", "Trade ads", "swap", "5"], ["values", "Values", "dollar"], ["units", "Units & enemies", "rbx_stud"], ["tradestats", "Trading stats", "scale"],
      ["commands", "Commands", "lightning"], ["filters", "Word filters", "warning"], ["roles", "Roles & permissions", "medal_gold"], ["servers", "Servers", "discord_stud_white"],
      ["giveaways", "Giveaways & events", "gift"], ["announce", "Announcements", "bell"], ["loading", "Loading & errors", "clock", "3"],
    ]],
    ["Site & system", [["website", "Website", "task_about"], ["logs", "Activity logs", "task_addbot"], ["system", "System health", "shield"], ["reports", "Reports", "calculator"]]],
  ];
  const PAGES = {};
  NAV.forEach(([g, items]) => items.forEach(([id, label, icon]) => { PAGES[id] = { id, label, icon, group: g }; }));

  function buildNav() {
    const nav = $("#snav");
    let open = {};
    try { open = JSON.parse(localStorage.getItem("bb_admin_groups") || "{}"); } catch (e) { /* storage off */ }
    nav.innerHTML = NAV.map(([g, items]) => `
      <div class="sgrp${open[g] === false ? " shut" : ""}" data-g="${esc(g)}">
        <button type="button" aria-expanded="${open[g] !== false}"><span>${esc(g)}</span><svg viewBox="0 0 12 8" aria-hidden="true"><path d="M1 1l5 5 5-5" fill="none" stroke="currentColor" stroke-width="2"/></svg></button>
        <ul><div>${items.map(([id, label, icon, cnt]) => `<li><a class="si" href="#${id}" data-id="${id}" title="${esc(label)}"><img src="${ic(icon)}" alt=""><span>${esc(label)}</span>${cnt ? `<em class="cnt${id === "ads" ? " hot" : ""}">${cnt}</em>` : ""}</a></li>`).join("")}</div></ul>
      </div>`).join("");
    $$(".sgrp>button", nav).forEach((b) => b.addEventListener("click", () => {
      const g = b.parentElement;
      if (document.querySelector(".app").classList.contains("collapsed") && innerWidth > 900) return;
      g.classList.toggle("shut");
      b.setAttribute("aria-expanded", !g.classList.contains("shut"));
      open[g.dataset.g] = !g.classList.contains("shut");
      try { localStorage.setItem("bb_admin_groups", JSON.stringify(open)); } catch (e) { /* ignore */ }
    }));
  }

  // ---------- shared UI ----------
  function toast(msg, icon) {
    const box = $("#toasts");
    const t = document.createElement("div");
    t.className = "toast";
    t.innerHTML = `<img src="${ic(icon || "verified_stud")}" alt=""><span></span>`;
    t.querySelector("span").textContent = msg;
    box.appendChild(t);
    setTimeout(() => { t.classList.add("out"); setTimeout(() => t.remove(), 250); }, 2600);
  }
  const saved = (what) => toast((what || "Saved") + " (preview only, nothing was changed)");

  // confirm modal; opts.typed = text the admin must type for risky actions
  function confirmBox(opts) {
    return new Promise((res) => {
      const m = $("#modal");
      m.innerHTML = `<h3></h3><p></p>${opts.typed ? `<div class="field"><label for="mtyped">Type <b></b> to confirm</label><input class="inp" id="mtyped" autocomplete="off"></div>` : ""}
        ${opts.reason ? `<div class="field"><label for="mreason">Reason</label><input class="inp" id="mreason" placeholder="Shown in the user's moderation history"></div>` : ""}
        <div class="mf"><button class="btn g-dark" data-no type="button">Cancel</button><button class="btn ${opts.danger ? "g-red" : "g-green"}" data-yes type="button"></button></div>`;
      m.querySelector("h3").textContent = opts.title;
      m.querySelector("p").textContent = opts.text;
      m.querySelector("[data-yes]").textContent = opts.ok || "Confirm";
      const yes = m.querySelector("[data-yes]");
      if (opts.typed) {
        m.querySelector("label b").textContent = opts.typed;
        yes.disabled = true; yes.style.opacity = ".5";
        m.querySelector("#mtyped").addEventListener("input", (e) => { const ok = e.target.value.trim() === opts.typed; yes.disabled = !ok; yes.style.opacity = ok ? "" : ".5"; });
      }
      const close = (v) => { m.classList.remove("on"); $("#scrim").classList.remove("on"); if (!$("#drawer").classList.contains("on")) $("#scrim").classList.remove("on"); else $("#scrim").classList.add("on"); res(v); };
      yes.addEventListener("click", () => close(true));
      m.querySelector("[data-no]").addEventListener("click", () => close(false));
      $("#scrim").classList.add("on");
      m.classList.add("on");
      m._close = () => close(false);
      setTimeout(() => (m.querySelector("input") || yes).focus(), 50);
    });
  }

  // form modal (edit value etc.)
  function formBox(title, fields, ok) {
    return new Promise((res) => {
      const m = $("#modal");
      m.innerHTML = `<h3>${esc(title)}</h3>${fields.map((f, i) => `<div class="field"><label for="mf${i}">${esc(f.label)}</label>${f.type === "select" ? `<select class="sel" id="mf${i}">${f.options.map((o) => `<option${o === f.value ? " selected" : ""}>${esc(o)}</option>`).join("")}</select>` : f.type === "textarea" ? `<textarea class="inp" id="mf${i}">${esc(f.value || "")}</textarea>` : `<input class="inp" id="mf${i}" type="${f.type || "text"}" value="${esc(f.value == null ? "" : f.value)}">`}${f.hint ? `<small>${esc(f.hint)}</small>` : ""}</div>`).join("")}
        <div class="mf"><button class="btn g-dark" data-no type="button">Cancel</button><button class="btn g-green" data-yes type="button">${esc(ok || "Save")}</button></div>`;
      const close = (v) => { m.classList.remove("on"); if (!$("#drawer").classList.contains("on")) $("#scrim").classList.remove("on"); res(v); };
      m.querySelector("[data-yes]").addEventListener("click", () => close(fields.map((f, i) => m.querySelector("#mf" + i).value)));
      m.querySelector("[data-no]").addEventListener("click", () => close(null));
      m._close = () => close(null);
      $("#scrim").classList.add("on");
      m.classList.add("on");
      setTimeout(() => { const f = m.querySelector("input,select,textarea"); if (f) f.focus(); }, 50);
    });
  }

  // toggles
  function wireToggles(root) {
    $$(".tog", root).forEach((t) => {
      if (t._w) return; t._w = 1;
      t.addEventListener("click", () => {
        const on = t.getAttribute("aria-checked") !== "true";
        t.setAttribute("aria-checked", on);
        if (!t.dataset.silent) toast((t.dataset.name || "Setting") + (on ? " turned on" : " turned off") + " (preview)", on ? "verified_stud" : "warning");
      });
    });
  }
  const tog = (name, on, silent) => `<button type="button" class="tog" role="switch" aria-checked="${!!on}" data-name="${esc(name)}"${silent ? " data-silent=1" : ""} aria-label="${esc(name)}"></button>`;

  // segmented controls
  function seg(host, opts, cur, onPick) {
    host.innerHTML = opts.map(([v, l]) => `<button type="button" data-v="${esc(v)}" class="${String(v) === String(cur) ? "on" : ""}">${esc(l)}</button>`).join("");
    host.classList.add("seg");
    host.setAttribute("role", "group");
    $$("button", host).forEach((b) => b.addEventListener("click", () => {
      $$("button", host).forEach((x) => x.classList.toggle("on", x === b));
      onPick(b.dataset.v);
    }));
  }
  function tabs(host, opts, cur, onPick) {
    host.className = "tabs";
    host.setAttribute("role", "tablist");
    host.innerHTML = opts.map(([v, l]) => `<button type="button" role="tab" data-v="${esc(v)}" aria-selected="${v === cur}" class="${v === cur ? "on" : ""}">${esc(l)}</button>`).join("");
    $$("button", host).forEach((b) => b.addEventListener("click", () => {
      $$("button", host).forEach((x) => { x.classList.toggle("on", x === b); x.setAttribute("aria-selected", x === b); });
      onPick(b.dataset.v);
    }));
  }

  // sortable + paged table. cols: [{key,label,n(umeric),sort:fn,render:fn,cls}]
  function table(host, cfg) {
    const st = { sort: cfg.sort || null, dir: cfg.dir || -1, page: 0, per: cfg.per || 12 };
    host.classList.add("card", "flush");
    function draw() {
      let rows = cfg.rows().slice();
      if (st.sort) {
        const col = cfg.cols.find((c) => c.key === st.sort);
        const f = col.sort || ((r) => r[col.key]);
        rows.sort((a, b) => { const x = f(a), y = f(b); return (x > y ? 1 : x < y ? -1 : 0) * st.dir; });
      }
      const pages = Math.max(1, Math.ceil(rows.length / st.per));
      st.page = Math.min(st.page, pages - 1);
      const slice = rows.slice(st.page * st.per, st.page * st.per + st.per);
      host.innerHTML = `<div class="tw"><table class="t${cfg.cls ? " " + cfg.cls : ""}"><thead><tr>${cfg.cols.map((c) => `<th class="${c.n ? "n " : ""}${c.nosort ? "" : "sort "}${c.hide ? "hide-sm " : ""}${st.sort === c.key ? (st.dir > 0 ? "asc" : "desc") : ""}" data-k="${c.key}" ${c.nosort ? "" : 'tabindex="0"'} scope="col">${esc(c.label)}${c.nosort ? "" : `<span class="ar">${st.sort === c.key ? (st.dir > 0 ? "▲" : "▼") : "↕"}</span>`}</th>`).join("")}</tr></thead>
        <tbody>${slice.length ? slice.map((r, i) => `<tr data-i="${i}" class="${cfg.onRow ? "click" : ""}">${cfg.cols.map((c) => `<td class="${c.n ? "n " : ""}${c.hide ? "hide-sm " : ""}${c.cls || ""}">${c.render ? c.render(r) : esc(r[c.key])}</td>`).join("")}</tr>`).join("") : `<tr><td colspan="${cfg.cols.length}" class="empty-row">${esc(cfg.empty || "Nothing matches these filters.")}</td></tr>`}</tbody></table></div>
        ${rows.length > st.per ? `<div class="pager"><span>${full(st.page * st.per + 1)}–${full(Math.min(rows.length, (st.page + 1) * st.per))} of ${full(rows.length)}</span><div class="pg"><button type="button" data-p="-1" ${st.page ? "" : "disabled"} aria-label="Previous page">‹</button>${pageBtns(st.page, pages)}<button type="button" data-p="+1" ${st.page < pages - 1 ? "" : "disabled"} aria-label="Next page">›</button></div></div>` : rows.length ? `<div class="pager"><span>${full(rows.length)} ${rows.length === 1 ? "row" : "rows"}</span></div>` : ""}`;
      $$("th.sort", host).forEach((th) => {
        const go = () => { if (st.sort === th.dataset.k) st.dir *= -1; else { st.sort = th.dataset.k; st.dir = cfg.cols.find((c) => c.key === th.dataset.k).n ? -1 : 1; } draw(); };
        th.addEventListener("click", go);
        th.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(); } });
      });
      $$(".pager button", host).forEach((b) => b.addEventListener("click", () => {
        const p = b.dataset.p;
        st.page = p === "-1" ? st.page - 1 : p === "+1" ? st.page + 1 : +p;
        draw();
      }));
      if (cfg.onRow) $$("tbody tr[data-i]", host).forEach((tr) => tr.addEventListener("click", (e) => { if (e.target.closest("button,a,input,select")) return; cfg.onRow(slice[+tr.dataset.i]); }));
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

  function deltaHtml(cur, prev, invert) {
    if (!prev) return '<span class="delta flat">–</span>';
    const p = ((cur - prev) / prev) * 100;
    const good = invert ? p < 0 : p > 0;
    const cls = Math.abs(p) < 0.5 ? "flat" : good ? "up" : "down";
    return `<span class="delta ${cls}">${p >= 0 ? "▲" : "▼"} ${Math.abs(p).toFixed(1)}%</span>`;
  }
  function kpi(label, icon, value, cur, prev, spark, color, note) {
    return { html: `<div class="kpi"><div class="kl"><img src="${ic(icon)}" alt="">${esc(label)}</div><div class="kv">${value}</div><div class="kd">${cur == null ? "" : deltaHtml(cur, prev)}<span>${esc(note || "vs previous period")}</span></div><div class="spk"></div></div>`, spark, color };
  }
  function renderKpis(host, list) {
    host.className = "kpis";
    host.innerHTML = list.map((k) => k.html).join("");
    $$(".spk", host).forEach((s, i) => { if (list[i].spark) s.replaceWith(C.spark(list[i].spark, list[i].color || C.PAL[0])); else s.remove(); });
  }
  function avatar(u) { return `<img src="${esc(u.avatar)}" alt="" loading="lazy">`; }
  function verPill(u) { return u.verified ? '<span class="pill green"><img src="img/verified_stud.png" alt="">Verified</span>' : '<span class="pill gray">Not verified</span>'; }
  function statusPill(s) { return `<span class="pill ${{ Active: "green", Muted: "yellow", Banned: "red", Live: "green", Flagged: "yellow", Removed: "red", Expired: "gray", Scheduled: "blue", Ended: "gray", Sent: "green", Draft: "gray", Error: "red", Warning: "yellow", Info: "blue" }[s] || "gray"}">${esc(s)}</span>`; }
  const robloxLink = (u) => u.verified ? `<a href="https://www.roblox.com/users/${u.robloxId}/profile" target="_blank" rel="noopener">${esc(u.roblox)}</a>` : '<span class="faint">–</span>';

  // ---------- date range (shared by Overview + Analytics) ----------
  const RANGE = { days: 30, from: null, to: null };
  function rangeIdx() {
    if (RANGE.from && RANGE.to) {
      const a = Math.round((RANGE.from - D.days[0]) / D.DAY), b = Math.round((RANGE.to - D.days[0]) / D.DAY);
      const lo = Math.max(0, Math.min(a, b)), hi = Math.min(N - 1, Math.max(a, b));
      return [lo, hi];
    }
    return [N - RANGE.days, N - 1];
  }
  function slice(arr) { const [a, b] = rangeIdx(); return arr.slice(a, b + 1); }
  function prevSlice(arr) { const [a, b] = rangeIdx(); const n = b - a + 1; return arr.slice(Math.max(0, a - n), a); }
  function rangeLabels() { const [a, b] = rangeIdx(); return D.days.slice(a, b + 1); }
  function rangeText() { const [a, b] = rangeIdx(); return fshort(D.days[a]) + " – " + fdate(D.days[b]); }
  // long ranges are summed per week so charts stay readable
  function bucket(arrs) {
    const L = rangeLabels();
    if (L.length <= 120) return { labels: L, arrs };
    const labels = [], out = arrs.map(() => []);
    for (let i = 0; i < L.length; i += 7) {
      labels.push(L[i]);
      arrs.forEach((a, k) => out[k].push(sum(a.slice(i, i + 7))));
    }
    return { labels, arrs: out, weekly: true };
  }
  function rangeBar(host, onChange) {
    host.className = "filters";
    host.innerHTML = `<div class="rseg"></div><label class="sr" for="rfrom">From</label><input type="date" class="inp date-in" id="rfrom"><span class="faint">to</span><label class="sr" for="rto">To</label><input type="date" class="inp date-in" id="rto"><span class="sp"></span><span class="muted rtext"></span>`;
    const iso = (d) => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
    const f = $("#rfrom", host), t = $("#rto", host);
    f.min = t.min = iso(D.days[0]); f.max = t.max = iso(D.days[N - 1]);
    const sync = () => { const [a, b] = rangeIdx(); f.value = iso(D.days[a]); t.value = iso(D.days[b]); $(".rtext", host).textContent = rangeText(); };
    seg($(".rseg", host), [["1", "Today"], ["7", "7 days"], ["30", "30 days"], ["90", "90 days"], ["365", "12 months"]], RANGE.from ? "" : RANGE.days, (v) => { RANGE.days = +v; RANGE.from = RANGE.to = null; sync(); onChange(); });
    const custom = () => {
      if (!f.value || !t.value) return;
      RANGE.from = new Date(f.value + "T00:00"); RANGE.to = new Date(t.value + "T00:00");
      $$(".rseg button", host).forEach((b) => b.classList.remove("on"));
      sync(); onChange();
    };
    f.addEventListener("change", custom); t.addEventListener("change", custom);
    sync();
  }
  function busy(root, fn) { $$(".chart", root).forEach((c) => c.classList.add("busy")); setTimeout(() => { fn(); }, 120); }

  // ---------- pages ----------
  const R = {};

  // OVERVIEW
  R.overview = (v) => {
    v.innerHTML = `<div class="phead"><div><h1>Overview <span class="sample">Sample data</span></h1><p>Everything happening on Bloombot and the website.</p></div><div class="acts"><a class="btn g-dark" href="#reports"><img src="img/calculator.png" alt="">Reports</a><a class="btn g-blue" href="#analytics"><img src="img/chart_up.png" alt="">Full analytics</a></div></div>
      <div id="ovr"></div><div id="ovk"></div>
      <div class="grid g-21 mt"><section class="card"><div class="ch"><div class="hl"><h2><img src="img/chart_up.png" alt="">Website traffic</h2></div><div id="ovm"></div></div><div id="ovc"></div></section>
        <section class="card"><div class="ch"><h2><img src="img/favicon.png" alt="">Bot status</h2><span class="st good live"><i></i>Online</span></div><div id="ovb"></div></section></div>
      <div class="grid g3 mt"><section class="card"><div class="ch"><h2><img src="img/lightning.png" alt="">Top commands</h2><a href="#commands" class="muted">Manage</a></div><div id="ovcmd"></div></section>
        <section class="card"><div class="ch"><h2><img src="img/task_user.png" alt="">New users</h2><a href="#users" class="muted">All users</a></div><div id="ovu" class="rows"></div></section>
        <section class="card"><div class="ch"><h2><img src="img/task_addbot.png" alt="">Live activity</h2><a href="#logs" class="muted">Logs</a></div><div id="ova"></div></section></div>`;
    let metric = "both";
    const draw = () => {
      const totUsers = 4120 + sum(D.regs), totVer = 2600 + sum(D.verified);
      const p = (a) => sum(prevSlice(a)), c = (a) => sum(slice(a));
      const visTot = 182000 + sum(D.visits);
      renderKpis($("#ovk"), [
        kpi("Registered users", "task_user", full(totUsers), c(D.regs), p(D.regs), slice(D.regs), "#3987e5", "+" + full(c(D.regs)) + " this period"),
        kpi("Verified Roblox users", "verified_stud", full(totVer), c(D.verified), p(D.verified), slice(D.verified), "#199e70", ((totVer / totUsers) * 100).toFixed(0) + "% of users"),
        kpi("Total website visits", "chart_up", full(visTot), c(D.visits), p(D.visits), slice(D.visits), "#3987e5", "all time"),
        kpi("Visitors today", "rise", full(D.uniques[N - 1]), D.uniques[N - 1], D.uniques[N - 8], D.uniques.slice(-14), "#9085e9", "vs same day last week"),
        kpi("Visitors this week", "rise", full(sum(D.uniques.slice(-7))), sum(D.uniques.slice(-7)), sum(D.uniques.slice(-14, -7)), D.uniques.slice(-28), "#9085e9", "vs last week"),
        kpi("Visitors this month", "rise", full(sum(D.uniques.slice(-30))), sum(D.uniques.slice(-30)), sum(D.uniques.slice(-60, -30)), D.uniques.slice(-90), "#9085e9", "vs previous 30 days"),
        kpi("Active users", "lightning", full(D.active[N - 1]), D.active[N - 1], D.active[N - 8], slice(D.active), "#d55181", "today"),
        kpi("New registrations", "plus", full(c(D.regs)), c(D.regs), p(D.regs), slice(D.regs), "#3987e5"),
        kpi("Trades checked", "scale", full(c(D.trades)), c(D.trades), p(D.trades), slice(D.trades), "#c98500"),
        kpi("Trade ads posted", "swap", full(c(D.ads)), c(D.ads), p(D.ads), slice(D.ads), "#d95926"),
        kpi("Value lookups", "dollar", full(c(D.lookups)), c(D.lookups), p(D.lookups), slice(D.lookups), "#199e70"),
        kpi("Commands used", "lightning", full(c(D.cmds)), c(D.cmds), p(D.cmds), slice(D.cmds), "#3987e5"),
      ]);
      const b = bucket([slice(D.visits), slice(D.uniques)]);
      const series = [];
      if (metric !== "uniques") series.push({ name: "Page views", values: b.arrs[0], color: "#3987e5" });
      if (metric !== "views") series.push({ name: "Unique visitors", values: b.arrs[1], color: "#d95926" });
      C.line($("#ovc"), { labels: b.labels, series, area: true, height: 270, xfmt: fshort, tipLabel: (i) => (b.weekly ? "Week of " : WD[b.labels[i].getDay()] + " ") + fdate(b.labels[i]), label: "Website traffic" });
    };
    rangeBar($("#ovr"), () => busy(v, draw));
    seg($("#ovm"), [["both", "Both"], ["views", "Views"], ["uniques", "Visitors"]], metric, (m) => { metric = m; draw(); });
    draw();
    // bot status
    $("#ovb").innerHTML = `<div class="dl-grid"><div><small>Uptime (30 days)</small><b>99.94%</b></div><div><small>Ping</small><b>41 ms</b></div><div><small>Servers</small><b>${full(1284)}</b></div><div><small>Shards</small><b>2 / 2 online</b></div><div><small>Last restart</small><b>${ago(new Date(Date.now() - 3.2 * D.DAY))}</b></div><div><small>Version</small><b>main @ 9591ca1</b></div></div>
      <div class="muted">Last 90 days</div><div class="ubar" id="ovup"></div><div class="row mt"><a class="btn g-dark sm" href="#system">System health</a><button class="btn g-red sm" type="button" id="ovrst">Restart bot</button></div>`;
    uptimeBar($("#ovup"));
    $("#ovrst").addEventListener("click", async () => { if (await confirmBox({ title: "Restart Bloombot?", text: "The bot goes offline for about 20 seconds. Buttons on old messages keep working.", ok: "Restart", danger: true })) toast("Restart queued (preview only)", "clock"); });
    const cm = D.COMMANDS.slice(0, 7);
    const tot = sum(D.cmds.slice(-30));
    C.blist($("#ovcmd"), cm.map((x) => ({ name: x.name, value: Math.round(tot * x.share) })), { unit: "uses, 30 days" });
    $("#ovu").innerHTML = D.users.slice(0, 6).map((u) => `<div class="row"><span class="who">${avatar(u)}</span><div class="grow"><b>${esc(u.discord)}</b><small>${u.verified ? "Roblox: " + esc(u.roblox) : "Not verified yet"}</small></div><small>${ago(u.registered)}</small></div>`).join("");
    $$("#ovu .who img").forEach((i) => { i.width = 32; i.height = 32; i.className = "av32"; });
    $("#ova").innerHTML = `<ul class="tl">${D.logs.slice(0, 6).map((l) => `<li class="${l.type === "admin" ? "w" : l.type === "verification" ? "g" : ""}"><b>${esc(l.title)}</b><small>${esc(l.text)} · ${ago(l.time)}</small></li>`).join("")}</ul>`;
  };
  function uptimeBar(host) {
    host.innerHTML = D.uptimeDays.map((s, i) => `<i class="${s}" tabindex="0" data-i="${i}"></i>`).join("");
    $$("i", host).forEach((el) => {
      const show = (ev) => {
        const i = +el.dataset.i, d = new Date(D.today.getTime() - (89 - i) * D.DAY), s = D.uptimeDays[i];
        let x, y; if (ev && ev.clientX != null) { x = ev.clientX; y = ev.clientY; } else { const r = el.getBoundingClientRect(); x = r.left; y = r.top; }
        C.showTip(x, y, fdate(d), [{ name: s === "c" ? "Outage, 38 min" : s === "w" ? "Slow responses" : "No problems", value: s === "c" ? "97.4%" : s === "w" ? "99.8%" : "100%", color: s === "c" ? "#d03b3b" : s === "w" ? "#fab219" : "#0ca30c" }]);
      };
      el.addEventListener("pointermove", show); el.addEventListener("focus", () => show());
      el.addEventListener("pointerleave", C.hideTip); el.addEventListener("blur", C.hideTip);
    });
  }

  // ANALYTICS
  R.analytics = (v) => {
    v.innerHTML = `<div class="phead"><div><h1>Analytics <span class="sample">Sample data</span></h1><p>Website traffic, users, commands and trading. Hover any chart for exact numbers.</p></div><div class="acts"><button class="btn g-dark" id="anexp" type="button"><img src="img/calculator.png" alt="">Export CSV</button></div></div>
      <div id="anr"></div>
      <section class="card"><div class="ch"><div class="hl"><h2><img src="img/chart_up.png" alt="">Website traffic</h2></div><div class="row"><div id="anm"></div><div id="ant"></div></div></div><div id="anc"></div></section>
      <section class="card mt"><div class="ch"><div class="hl"><h2><img src="img/rise.png" alt="">Period comparison</h2><p id="cmpnote"></p></div><div id="cmps"></div></div><div id="cmpk" class="kpis"></div><div id="cmpc" class="mt"></div></section>
      <div class="grid g-12 mt"><section class="card"><div class="ch"><h2><img src="img/verified_stud.png" alt="">Roblox verification</h2></div><div id="dver"></div><p class="muted" id="dvern"></p></section>
        <section class="card"><div class="ch"><div class="hl"><h2><img src="img/task_user.png" alt="">User registration growth</h2></div><div id="rgm"></div></div><div id="rgc"></div></section></div>
      <div class="grid g-21 mt"><section class="card"><div class="ch"><h2><img src="img/lightning.png" alt="">Command usage by category</h2></div><div id="cuc"></div></section>
        <section class="card"><div class="ch"><h2><img src="img/medal_gold.png" alt="">Most used commands</h2></div><div id="cmc"></div></section></div>
      <div class="grid g2 mt"><section class="card"><div class="ch"><div class="hl"><h2><img src="img/swap.png" alt="">Trade advertisements</h2></div></div><div id="tac"></div></section>
        <section class="card"><div class="ch"><h2><img src="img/lightning.png" alt="">Active users over time</h2></div><div id="auc"></div></section></div>
      <div class="grid g3 mt"><section class="card"><div class="ch"><h2><img src="img/rbx_stud.png" alt="">Visitors by country</h2></div><div id="geo"></div></section>
        <section class="card"><div class="ch"><h2><img src="img/discord_stud_white.png" alt="">Referral sources</h2></div><div id="ref"></div></section>
        <section class="card"><div class="ch"><div class="hl"><h2><img src="img/clock.png" alt="">Peak activity hours</h2><p>Visits by weekday and hour (UTC)</p></div></div><div id="heat"></div></section></div>
      <section class="mt" id="pgt"></section>`;
    let tmode = "area", tmetric = "views", cmp = "weekly", rgmode = "total";
    const draw = () => {
      const b = bucket([slice(D.visits), slice(D.uniques), slice(D.regs), slice(D.verified), slice(D.active), slice(D.ads), slice(D.cmds)]);
      const tip = (i) => (b.weekly ? "Week of " : WD[b.labels[i].getDay()] + " ") + fdate(b.labels[i]);
      const tv = tmetric === "views" ? [{ name: "Page views", values: b.arrs[0], color: "#3987e5" }] : tmetric === "uniques" ? [{ name: "Unique visitors", values: b.arrs[1], color: "#d95926" }] : [{ name: "Page views", values: b.arrs[0], color: "#3987e5" }, { name: "Unique visitors", values: b.arrs[1], color: "#d95926" }];
      C.line($("#anc"), { labels: b.labels, series: tv, area: tmode === "area", height: 300, xfmt: fshort, tipLabel: tip, label: "Website traffic" });
      // registrations
      let acc = 4120 + sum(D.regs.slice(0, rangeIdx()[0])), accV = 2600 + sum(D.verified.slice(0, rangeIdx()[0]));
      if (rgmode === "total") {
        const tot = [], ver = [];
        b.arrs[2].forEach((x, i) => { acc += x; accV += b.arrs[3][i]; tot.push(acc); ver.push(accV); });
        C.line($("#rgc"), { labels: b.labels, series: [{ name: "All users", values: tot, color: "#3987e5" }, { name: "Verified", values: ver, color: "#199e70" }], area: true, height: 250, xfmt: fshort, tipLabel: tip, label: "Total users" });
      } else {
        C.bars($("#rgc"), { labels: b.labels.map(fshort), series: [{ name: "Verified", values: b.arrs[3], color: "#199e70" }, { name: "Not verified", values: b.arrs[2].map((x, i) => x - b.arrs[3][i]), color: "#3987e5" }], stacked: true, height: 250, tipLabel: tip, label: "New registrations" });
      }
      // command categories
      const cats = ["Values", "Trading", "Stats", "Levels", "Other"];
      const share = cats.map((c) => sum(D.COMMANDS.filter((x) => (c === "Other" ? !["Values", "Trading", "Stats", "Levels"].includes(x.cat) : x.cat === c)).map((x) => x.share)));
      const totS = sum(share);
      C.line($("#cuc"), { labels: b.labels, series: cats.map((c, i) => ({ name: c, values: b.arrs[6].map((x, k) => Math.round(x * share[i] / totS * (0.92 + ((k * 7 + i * 3) % 10) / 60))), color: C.PAL[i] })), area: true, stacked: true, height: 280, xfmt: fshort, tipLabel: tip, label: "Command usage by category" });
      const cmdTot = sum(slice(D.cmds));
      C.bars($("#cmc"), { labels: D.COMMANDS.slice(0, 10).map((x) => x.name), series: [{ name: "Uses", values: D.COMMANDS.slice(0, 10).map((x) => Math.round(cmdTot * x.share)), color: "#3987e5" }], horizontal: true, rowH: 27, labelW: 128, label: "Most used commands" });
      // trade ads
      C.bars($("#tac"), { labels: b.labels.map(fshort), series: [{ name: "From Discord", values: b.arrs[5].map((x) => Math.round(x * 0.73)), color: "#d95926" }, { name: "From website", values: b.arrs[5].map((x) => x - Math.round(x * 0.73)), color: "#9085e9" }], stacked: true, height: 250, tipLabel: tip, label: "Trade ads posted" });
      // active users
      const wau = b.arrs[4].map((x) => Math.round(x * (b.weekly ? 0.38 : 2.6)));
      C.line($("#auc"), { labels: b.labels, series: [{ name: b.weekly ? "Daily active (week total)" : "Daily active", values: b.arrs[4], color: "#d55181" }, { name: "Weekly active", values: wau, color: "#3987e5" }], height: 250, xfmt: fshort, tipLabel: tip, label: "Active users" });
      drawCompare();
    };
    function drawCompare() {
      let labels, cur, prev, nameC, nameP, note;
      const arr = D.visits;
      if (cmp === "daily") {
        labels = Array.from({ length: 7 }, (_, i) => WD[D.days[N - 7 + i].getDay()]);
        cur = arr.slice(-7); prev = arr.slice(-14, -7); nameC = "This week"; nameP = "Last week"; note = "Each day of the last 7 days vs the same weekday a week earlier.";
      } else if (cmp === "weekly") {
        labels = Array.from({ length: 8 }, (_, i) => "W" + (i + 1));
        cur = labels.map((_, i) => sum(arr.slice(N - 56 + i * 7, N - 49 + i * 7)));
        prev = labels.map((_, i) => sum(arr.slice(N - 112 + i * 7, N - 105 + i * 7)));
        nameC = "Last 8 weeks"; nameP = "8 weeks before"; note = "Weekly page views, last 8 weeks vs the 8 weeks before.";
      } else if (cmp === "monthly") {
        const m = {}, k = (d) => d.getFullYear() * 12 + d.getMonth();
        D.days.forEach((d, i) => { m[k(d)] = (m[k(d)] || 0) + arr[i]; });
        const end = k(D.today);
        labels = []; cur = []; prev = [];
        for (let j = 11; j >= 0; j--) { const kk = end - j; labels.push(MON[kk % 12]); cur.push(m[kk] || 0); prev.push(m[kk - 12] || 0); }
        nameC = "Last 12 months"; nameP = "Year before"; note = "Monthly page views vs the same month a year earlier. This month is still running.";
      } else {
        labels = ["Q1", "Q2", "Q3", "Q4"];
        const y = D.today.getFullYear();
        const q = (yr, qi) => sum(D.days.map((d, i) => (d.getFullYear() === yr && Math.floor(d.getMonth() / 3) === qi ? arr[i] : 0)));
        cur = labels.map((_, i) => q(y, i)); prev = labels.map((_, i) => q(y - 1, i));
        nameC = String(y); nameP = String(y - 1); note = "Page views per quarter, this year vs last year.";
      }
      $("#cmpnote").textContent = note;
      const a = sum(cur), b = sum(prev);
      renderKpis($("#cmpk"), [
        kpi(nameC, "chart_up", full(a), a, b, null, null, "vs " + nameP.toLowerCase()),
        kpi(nameP, "clock", full(b), null, null, null, null, "page views"),
        kpi("Best " + (cmp === "daily" ? "day" : cmp === "weekly" ? "week" : cmp === "monthly" ? "month" : "quarter"), "medal_gold", labels[cur.indexOf(Math.max(...cur))], null, null, null, null, full(Math.max(...cur)) + " views"),
      ]);
      C.bars($("#cmpc"), { labels, series: [{ name: nameP, values: prev, color: "#9085e9" }, { name: nameC, values: cur, color: "#3987e5" }], height: 230, label: "Period comparison" });
    }
    rangeBar($("#anr"), () => busy(v, draw));
    seg($("#ant"), [["area", "Area"], ["line", "Line"]], tmode, (m) => { tmode = m; draw(); });
    seg($("#anm"), [["views", "Views"], ["uniques", "Visitors"], ["both", "Both"]], tmetric, (m) => { tmetric = m; draw(); });
    seg($("#cmps"), [["daily", "Daily"], ["weekly", "Weekly"], ["monthly", "Monthly"], ["yearly", "Yearly"]], cmp, (m) => { cmp = m; drawCompare(); });
    seg($("#rgm"), [["total", "Total"], ["new", "New per day"]], rgmode, (m) => { rgmode = m; draw(); });
    draw();
    const ver = 2600 + sum(D.verified), all = 4120 + sum(D.regs);
    C.donut($("#dver"), { items: [{ name: "Verified", value: ver, color: "#199e70" }, { name: "Not verified", value: all - ver, color: "#3987e5" }], center: ((ver / all) * 100).toFixed(0) + "%", sub: "verified", unit: "users", label: "Verified vs unverified users" });
    $("#dvern").textContent = full(ver) + " of " + full(all) + " accounts linked a Roblox profile.";
    C.blist($("#geo"), D.countries.map(([n, , p]) => ({ name: n, value: Math.round(p * 1000) })), { pct: true, unit: "visits, sample", color: "#3987e5" });
    C.donut($("#ref"), { items: D.referrers.map(([n, p], i) => ({ name: n, value: Math.round(p * 100), color: C.PAL[i] })), center: "7", sub: "sources", unit: "visits", label: "Referral sources", fmt: (x) => full(x) });
    heatmap($("#heat"));
    pageTable($("#pgt"));
    $("#anexp").addEventListener("click", () => downloadCsv("bloombot-analytics.csv", ["date", "page_views", "unique_visitors", "registrations", "verified", "active_users", "commands", "trade_ads"], rangeLabels().map((d, i) => { const a = rangeIdx()[0] + i; return [iso(d), D.visits[a], D.uniques[a], D.regs[a], D.verified[a], D.active[a], D.cmds[a], D.ads[a]]; })));
  };
  const iso = (d) => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  function heatmap(host) {
    const max = Math.max(...D.heat.flat());
    const ramp = ["#16243a", "#184f95", "#1c5cab", "#256abf", "#2a78d6", "#3987e5", "#5598e7", "#86b6ef", "#b7d3f6"];
    const order = [1, 2, 3, 4, 5, 6, 0];
    let html = '<div class="heat" role="img" aria-label="Visits by weekday and hour"><span></span>';
    for (let hr = 0; hr < 24; hr++) html += `<span class="hx">${hr % 6 === 0 ? hr : ""}</span>`;
    order.forEach((d) => {
      html += `<span class="hl">${WD[d]}</span>`;
      D.heat[d].forEach((v, hr) => { html += `<i class="hc" tabindex="0" data-d="${d}" data-h="${hr}" data-c="${Math.min(8, Math.floor((v / max) * 8.99))}"></i>`; });
    });
    html += `</div><div class="heat-scale">Fewer<span class="bar">${ramp.map(() => "<i></i>").join("")}</span>More</div>`;
    host.innerHTML = html;
    $$(".heat-scale i", host).forEach((i, k) => { i.style.background = ramp[k]; });
    $$(".hc", host).forEach((c) => {
      c.style.background = ramp[+c.dataset.c];
      const show = (ev) => {
        const d = +c.dataset.d, hr = +c.dataset.h;
        let x, y; if (ev && ev.clientX != null) { x = ev.clientX; y = ev.clientY; } else { const r = c.getBoundingClientRect(); x = r.left; y = r.top; }
        C.showTip(x, y, WD[d] + " " + String(hr).padStart(2, "0") + ":00–" + String(hr).padStart(2, "0") + ":59 UTC", [{ name: "avg. visits", value: full(D.heat[d][hr]), color: ramp[+c.dataset.c] }]);
      };
      c.addEventListener("pointermove", show); c.addEventListener("focus", () => show());
      c.addEventListener("pointerleave", C.hideTip); c.addEventListener("blur", C.hideTip);
    });
  }
  function pageTable(host) {
    const tot = sum(slice(D.visits));
    host.innerHTML = '<div class="ch"><h2><img src="img/task_about.png" alt="">Most visited pages</h2></div><div></div>';
    table(host.lastElementChild, {
      rows: () => D.pages, sort: "share", dir: -1, per: 12,
      cols: [
        { key: "title", label: "Page", render: (p) => `<b>${esc(p.title)}</b><br><small class="muted">${esc(p.path)}</small>` },
        { key: "share", label: "Views", n: true, render: (p) => full(tot * p.share / 100) },
        { key: "share2", label: "Share", n: true, sort: (p) => p.share, render: (p) => p.share.toFixed(1) + "%", hide: true },
        { key: "time", label: "Avg. time", n: true, render: (p) => Math.floor(p.time / 60) + "m " + String(p.time % 60).padStart(2, "0") + "s" },
        { key: "bounce", label: "Bounce", n: true, render: (p) => Math.round(p.bounce * 100) + "%", hide: true },
      ],
    });
  }

  // USERS
  const UF = { q: "", ver: "all", st: "all", role: "all" };
  R.users = (v) => {
    const tot = D.users.length, ver = D.users.filter((u) => u.verified).length;
    v.innerHTML = `<div class="phead"><div><h1>Users <span class="sample">Sample data</span></h1><p>${full(tot)} sample accounts. Click a user to see their history and manage them.</p></div><div class="acts"><button class="btn g-dark" id="uexp" type="button"><img src="img/calculator.png" alt="">Export</button></div></div>
      <div id="uk"></div>
      <div class="filters mt"><label class="srch"><span class="sr">Search users</span>${SRCH}<input class="inp" id="uq" placeholder="Name, Roblox user or Discord ID" value="${esc(UF.q)}"></label>
        <select class="sel" id="uver" aria-label="Verification"><option value="all">All verification</option><option value="yes">Verified</option><option value="no">Not verified</option></select>
        <select class="sel" id="ust" aria-label="Status"><option value="all">All statuses</option><option>Active</option><option>Muted</option><option>Banned</option></select>
        <select class="sel" id="urole" aria-label="Role"><option value="all">All roles</option><option>Member</option><option>Trusted trader</option><option>Value team</option><option>Moderator</option><option>Admin</option></select></div>
      <div id="ut"></div>`;
    renderKpis($("#uk"), [
      kpi("Total users", "task_user", full(tot), null, null, null, null, "in this sample"),
      kpi("Verified", "verified_stud", full(ver), null, null, null, null, ((ver / tot) * 100).toFixed(0) + "%"),
      kpi("With warnings", "warning", full(D.users.filter((u) => u.warns).length), null, null, null, null, "at least one"),
      kpi("Banned", "lose", full(D.users.filter((u) => u.status === "Banned").length), null, null, null, null, "from trade ads"),
    ]);
    $("#uver").value = UF.ver; $("#ust").value = UF.st; $("#urole").value = UF.role;
    const rows = () => D.users.filter((u) => {
      const q = UF.q.toLowerCase();
      if (q && !(u.discord.includes(q) || u.roblox.toLowerCase().includes(q) || u.id.includes(q))) return false;
      if (UF.ver !== "all" && u.verified !== (UF.ver === "yes")) return false;
      if (UF.st !== "all" && u.status !== UF.st) return false;
      if (UF.role !== "all" && u.role !== UF.role) return false;
      return true;
    });
    const t = table($("#ut"), {
      rows, sort: "registered", dir: -1, per: 15, onRow: openUser,
      cols: [
        { key: "discord", label: "User", render: (u) => `<div class="who">${avatar(u)}<div><b>${esc(u.discord)}</b><small>${esc(u.id)}</small></div></div>` },
        { key: "roblox", label: "Roblox", render: robloxLink, hide: true },
        { key: "verified", label: "Verification", sort: (u) => +u.verified, render: verPill },
        { key: "role", label: "Role", render: (u) => esc(u.role), hide: true },
        { key: "registered", label: "Registered", sort: (u) => u.registered.getTime(), render: (u) => fdate(u.registered), hide: true },
        { key: "lastActive", label: "Last active", sort: (u) => u.lastActive.getTime(), render: (u) => ago(u.lastActive) },
        { key: "ads", label: "Ads", n: true, hide: true },
        { key: "status", label: "Status", render: (u) => statusPill(u.status) + (u.warns ? ` <span class="pill yellow" title="Warnings">⚠ ${u.warns}</span>` : "") },
      ],
    });
    let tm;
    $("#uq").addEventListener("input", (e) => { clearTimeout(tm); tm = setTimeout(() => { UF.q = e.target.value.trim(); t.reset(); }, 120); });
    $("#uver").addEventListener("change", (e) => { UF.ver = e.target.value; t.reset(); });
    $("#ust").addEventListener("change", (e) => { UF.st = e.target.value; t.reset(); });
    $("#urole").addEventListener("change", (e) => { UF.role = e.target.value; t.reset(); });
    $("#uexp").addEventListener("click", () => downloadCsv("bloombot-users.csv", ["discord_id", "discord", "roblox", "verified", "role", "registered", "last_active", "trade_ads", "warnings", "status"], rows().map((u) => [u.id, u.discord, u.roblox, u.verified, u.role, iso(u.registered), iso(u.lastActive), u.ads, u.warns, u.status])));
    R.users._t = t;
  };

  function userHistory(u) {
    const ev = [];
    ev.push({ c: "g", t: "Created an account", s: fdate(u.registered) + " via " + (u.method === "OAuth" ? "website login" : "Discord /link") });
    if (u.verified) ev.push({ c: "g", t: "Verified Roblox account " + u.roblox, s: u.method + " · " + fdate(new Date(u.registered.getTime() + 3600e3)) });
    const seedN = u.id.charCodeAt(5) + u.id.charCodeAt(9);
    const cmdsU = ["/value", "/trade ad", "/value-calculator", "/search", "/level", "/trade bump", "/wishlist"];
    for (let i = 0; i < 6; i++) ev.push({ c: "", t: "Used " + cmdsU[(seedN + i) % cmdsU.length], s: ago(new Date(u.lastActive.getTime() - i * 5.3 * 3600e3)) });
    return ev.sort((a, b) => (a.c === "g" ? 1 : 0) - (b.c === "g" ? 1 : 0));
  }
  function openUser(u) {
    const dr = $("#drawer");
    const ads = D.ads_list.filter((a) => a.user === u);
    const fakeAds = ads.length ? ads : D.ads_list.slice(u.discord.length % 20, u.discord.length % 20 + Math.min(3, u.ads)).map((a) => ({ ...a, user: u }));
    const mod = [];
    for (let i = 0; i < u.warns; i++) mod.push({ c: i >= 2 ? "b" : "w", t: ["Warning: spam in trade ads", "Warning: scam link in ad", "Muted 1h: repeated spam", "Banned from trade ads"][i], s: "by " + ["Marcel", "Moderator", "AutoMod", "Marcel"][i] + " · " + fdate(new Date(u.lastActive.getTime() - (i + 1) * 4 * D.DAY)) });
    dr.innerHTML = `<div class="dh"><img class="av" src="${esc(u.avatar)}" alt=""><div><h2>${esc(u.discord)}</h2><div class="row">${verPill(u)}${statusPill(u.status)}<span class="pill purple">${esc(u.role)}</span></div></div><button class="ibtn x" type="button" aria-label="Close" data-close><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg></button></div>
      <div class="db"><div id="utabs"></div><div id="ubody"></div></div>`;
    const body = $("#ubody", dr);
    const show = (tab) => {
      if (tab === "info") {
        body.innerHTML = `<div class="dl-grid"><div><small>Discord ID</small><b>${esc(u.id)}</b></div><div><small>Discord name</small><b>@${esc(u.discord)}</b></div><div><small>Roblox</small><b>${robloxLink(u)}</b></div><div><small>Verification</small><b>${u.verified ? esc(u.method) : "Not linked"}</b></div><div><small>Registered</small><b>${fdate(u.registered)}</b></div><div><small>Last active</small><b>${ago(u.lastActive)}</b></div></div>
          <div class="kpis" id="ukp"></div>
          <div class="ch mt"><h2>Manage</h2></div>
          <div class="chips" id="uacts"><button class="btn g-blue sm" data-a="role" type="button">Change role</button><button class="btn g-yellow sm" data-a="warn" type="button">Warn</button><button class="btn g-orange sm" data-a="mute" type="button">${u.status === "Muted" ? "Unmute" : "Mute"}</button><button class="btn g-dark sm" data-a="unverify" type="button" ${u.verified ? "" : "disabled"}>Reset verification</button><button class="btn g-red sm" data-a="ban" type="button">${u.status === "Banned" ? "Unban" : "Ban"}</button></div>
          <p class="muted"><small>Risky actions ask you to confirm. In this preview nothing reaches the bot.</small></p>`;
        renderKpis($("#ukp", body), [
          kpi("Commands", "lightning", full(u.cmds), null, null, null, null, "all time"),
          kpi("Trade ads", "swap", full(u.ads), null, null, null, null, "posted"),
          kpi("Trades checked", "scale", full(u.trades), null, null, null, null, "all time"),
          kpi("Level", "medal_gold", String(u.level), null, null, null, null, "XP rank"),
        ]);
        $$("#uacts button", body).forEach((b) => b.addEventListener("click", () => userAction(u, b.dataset.a)));
      } else if (tab === "act") {
        body.innerHTML = `<div class="ch"><h2>Commands, last 14 days</h2></div><div id="uac"></div><div class="ch mt"><h2>Recent activity</h2></div><ul class="tl">${userHistory(u).map((e) => `<li class="${e.c}"><b>${esc(e.t)}</b><small>${esc(e.s)}</small></li>`).join("")}</ul>`;
        const vals = Array.from({ length: 14 }, (_, i) => Math.max(0, Math.round((u.cmds / 300) * (1 + Math.sin(i * 1.7 + u.level)) + ((i * u.level) % 5))));
        C.bars($("#uac", body), { labels: D.days.slice(-14).map(fshort), series: [{ name: "Commands", values: vals, color: "#3987e5" }], height: 170, label: "Commands per day" });
      } else if (tab === "ads") {
        body.innerHTML = fakeAds.length ? fakeAds.map((a) => `<div class="ann"><h4>#${a.id} ${statusPill(a.status)}</h4><p>${esc(a.text)}</p><small>${ago(a.posted)} · ${a.servers} servers · ${a.source}</small></div>`).join("") : '<p class="muted">No trade ads yet.</p>';
      } else {
        body.innerHTML = mod.length ? `<ul class="tl">${mod.map((e) => `<li class="${e.c}"><b>${esc(e.t)}</b><small>${esc(e.s)}</small></li>`).join("")}</ul>` : '<p class="muted">Clean record. No warnings, mutes or bans.</p>';
      }
    };
    tabs($("#utabs", dr), [["info", "Profile"], ["act", "Activity"], ["ads", "Trade ads"], ["mod", "Moderation (" + u.warns + ")"]], "info", show);
    show("info");
    $("[data-close]", dr).addEventListener("click", closeDrawer);
    $("#scrim").classList.add("on");
    dr.classList.add("on");
    dr._u = u;
    setTimeout(() => $("[data-close]", dr).focus(), 60);
  }
  function closeDrawer() { $("#drawer").classList.remove("on"); if (!$("#modal").classList.contains("on")) $("#scrim").classList.remove("on"); }
  async function userAction(u, a) {
    let done = false;
    if (a === "role") {
      const r = await formBox("Change role for " + u.discord, [{ label: "Role", type: "select", options: ["Member", "Trusted trader", "Value team", "Moderator", "Admin"], value: u.role, hint: "Admin and Moderator can open this dashboard." }]);
      if (r) { u.role = r[0]; done = "Role changed to " + r[0]; }
    } else if (a === "warn") {
      const r = await formBox("Warn " + u.discord, [{ label: "Reason", value: "", hint: "The user gets a DM with this reason." }], "Send warning");
      if (r) { u.warns++; done = "Warning sent"; }
    } else if (a === "mute") {
      if (u.status === "Muted") { if (await confirmBox({ title: "Unmute " + u.discord + "?", text: "They can post trade ads again." , ok: "Unmute" })) { u.status = "Active"; done = "Unmuted"; } }
      else { const r = await formBox("Mute " + u.discord, [{ label: "Length", type: "select", options: ["1 hour", "6 hours", "1 day", "7 days"], value: "1 hour" }, { label: "Reason", value: "" }], "Mute"); if (r) { u.status = "Muted"; done = "Muted for " + r[0]; } }
    } else if (a === "unverify") {
      if (await confirmBox({ title: "Reset Roblox verification?", text: `${u.discord} will have to link their Roblox account again. Their trade ads stay up.`, ok: "Reset", danger: true })) { u.verified = false; u.roblox = ""; done = "Verification reset"; }
    } else if (a === "ban") {
      if (u.status === "Banned") { if (await confirmBox({ title: "Unban " + u.discord + "?", text: "They can use Bloombot again.", ok: "Unban" })) { u.status = "Active"; done = "Unbanned"; } }
      else if (await confirmBox({ title: "Ban " + u.discord + "?", text: "They can't use Bloombot or post trade ads. Their live ads are removed.", ok: "Ban user", danger: true, typed: u.discord, reason: true })) { u.status = "Banned"; done = "User banned"; }
    }
    if (done) {
      toast(done + " (preview only)", a === "ban" ? "lose" : "verified_stud");
      openUser(u);
      if (R.users._t && location.hash === "#users") R.users._t.draw();
    }
  }

  // TRADE ADS
  R.ads = (v) => {
    const by = (s) => D.ads_list.filter((a) => a.status === s).length;
    v.innerHTML = `<div class="phead"><div><h1>Trade advertisements <span class="sample">Sample data</span></h1><p>Ads posted from Discord and the website, sent to every server's trade channel.</p></div><div class="acts"><button class="btn g-dark" type="button" id="adset"><img src="img/gear.png" alt="">Ad settings</button></div></div>
      <div id="adk"></div><div class="mt" id="adtabs"></div>
      <div class="filters"><label class="srch"><span class="sr">Search ads</span>${SRCH}<input class="inp" id="adq" placeholder="Unit, user or ad #"></label><select class="sel" id="adsrc" aria-label="Source"><option value="all">Discord + website</option><option>Discord</option><option>Website</option></select></div>
      <div id="adt"></div>`;
    renderKpis($("#adk"), [
      kpi("Live ads", "swap", full(by("Live")), null, null, null, null, "on the board"),
      kpi("Posted today", "plus", full(D.ads[N - 1]), D.ads[N - 1], D.ads[N - 8], D.ads.slice(-14), "#d95926", "vs last week"),
      kpi("Flagged", "warning", full(by("Flagged")), null, null, null, null, "need a look"),
      kpi("Removed", "lose", full(by("Removed")), null, null, null, null, "last 3 days"),
    ]);
    let st = "all", q = "", src = "all";
    const rows = () => D.ads_list.filter((a) => (st === "all" || a.status === st) && (src === "all" || a.source === src) && (!q || a.text.toLowerCase().includes(q) || a.user.discord.includes(q) || String(a.id).includes(q)));
    const t = table($("#adt"), {
      rows, sort: "posted", dir: -1, per: 12,
      cols: [
        { key: "id", label: "Ad", n: false, render: (a) => `<b>#${a.id}</b>` },
        { key: "give", label: "Trading", nosort: true, render: (a) => `<div class="unit">${a.give.map((g) => `<img src="img/units/${D.slug(g)}.webp" alt="" title="${esc(g)}">`).join("")}<span class="hide-sm">${esc(a.give.join(", "))}</span></div>` },
        { key: "want", label: "Wants", nosort: true, render: (a) => `<div class="unit">${a.want.map((g) => `<img src="img/units/${D.slug(g)}.webp" alt="" title="${esc(g)}">`).join("")}<span class="hide-sm">${esc(a.want.join(", "))}</span></div>` },
        { key: "user", label: "User", sort: (a) => a.user.discord, render: (a) => esc(a.user.discord), hide: true },
        { key: "posted", label: "Posted", sort: (a) => a.posted.getTime(), render: (a) => ago(a.posted) },
        { key: "status", label: "Status", render: (a) => statusPill(a.status) + (a.tags.length ? " " + a.tags.map((x) => `<span class="pill gray">${esc(x)}</span>`).join(" ") : "") },
        { key: "act", label: "", nosort: true, render: (a) => `<div class="acts"><button class="mini-btn" data-v="${a.id}" type="button">View</button>${a.status === "Removed" ? `<button class="mini-btn" data-r="${a.id}" type="button">Restore</button>` : `<button class="mini-btn danger" data-x="${a.id}" type="button">Remove</button>`}</div>` },
      ],
      after: (host) => {
        $$("[data-x]", host).forEach((b) => b.addEventListener("click", async () => {
          const a = D.ads_list.find((x) => x.id === +b.dataset.x);
          if (await confirmBox({ title: "Remove ad #" + a.id + "?", text: "It's deleted from the board and every server's trade channel. The user gets a DM.", ok: "Remove ad", danger: true, reason: true })) { a.status = "Removed"; t.draw(); toast("Ad #" + a.id + " removed (preview)", "lose"); }
        }));
        $$("[data-r]", host).forEach((b) => b.addEventListener("click", () => { const a = D.ads_list.find((x) => x.id === +b.dataset.r); a.status = "Live"; t.draw(); toast("Ad #" + a.id + " restored (preview)"); }));
        $$("[data-v]", host).forEach((b) => b.addEventListener("click", () => { const a = D.ads_list.find((x) => x.id === +b.dataset.v); adPreview(a); }));
      },
    });
    tabs($("#adtabs"), [["all", "All"], ["Live", "Live"], ["Flagged", "Flagged (" + by("Flagged") + ")"], ["Removed", "Removed"], ["Expired", "Expired"]], st, (x) => { st = x; t.reset(); });
    $("#adq").addEventListener("input", (e) => { q = e.target.value.trim().toLowerCase(); t.reset(); });
    $("#adsrc").addEventListener("change", (e) => { src = e.target.value; t.reset(); });
    $("#adset").addEventListener("click", async () => {
      const r = await formBox("Trade ad settings", [
        { label: "Cooldown between ads (minutes)", type: "number", value: 5 }, { label: "Ad text length", value: "7–200 characters" },
        { label: "Auto-bump", type: "select", options: ["Users choose", "Always on", "Off for everyone"], value: "Users choose" },
        { label: "Who can post", type: "select", options: ["Everyone", "Verified Roblox users only", "Level 5+"], value: "Everyone" },
      ]);
      if (r) saved("Ad settings saved");
    });
  };
  function adPreview(a) {
    confirmBox({ title: "Trade ad #" + a.id, text: `${a.user.discord}: ${a.text}  ·  Posted ${ago(a.posted)} to ${a.servers} servers, bumped ${a.bumps}×, from ${a.source}.`, ok: "Close" });
  }

  // VALUES
  R.values = (v) => {
    v.innerHTML = `<div class="phead"><div><h1>Values <span class="sample">Sample data</span></h1><p>The value database behind /value, /value-hub and the website value list.</p></div><div class="acts"><button class="btn g-dark" id="vsync" type="button"><img src="img/clock.png" alt="">Sync from sheet</button><button class="btn g-green" id="vadd" type="button"><img src="img/plus.png" alt="">Add unit</button></div></div>
      <div class="grid g-21"><section class="card"><div class="ch"><div class="hl"><h2 id="vhn"><img src="img/dollar.png" alt="">Value history</h2><p>Click a unit in the table to see its chart.</p></div></div><div id="vhc"></div></section>
        <section class="card"><div class="ch"><h2><img src="img/chart_up.png" alt="">Value commands, 30 days</h2></div><div id="vcmd"></div></section></div>
      <div class="filters mt"><label class="srch"><span class="sr">Search units</span>${SRCH}<input class="inp" id="vq" placeholder="Search units"></label><select class="sel" id="vr" aria-label="Rarity"><option value="all">All rarities</option>${["Godly", "Legendary", "Epic", "Rare", "Exclusive", "Limited"].map((r) => `<option>${r}</option>`).join("")}</select><select class="sel" id="vtr" aria-label="Trend"><option value="all">Any trend</option><option>Rising</option><option>Stable</option><option>Falling</option></select></div>
      <div id="vt"></div>`;
    let sel = D.values[0];
    const hist = () => {
      $("#vhn").innerHTML = `<img src="${esc(sel.img)}" alt="">${esc(sel.name)} <span class="muted">· ${full(sel.value)}</span>`;
      C.line($("#vhc"), { labels: D.days.slice(-30), series: [{ name: "Value", values: sel.history, color: sel.change >= 0 ? "#199e70" : "#e66767" }], area: true, height: 220, xfmt: fshort, tipLabel: (i) => fdate(D.days[N - 30 + i]), label: sel.name + " value" });
    };
    hist();
    const vl = sum(D.lookups.slice(-30));
    C.blist($("#vcmd"), [{ name: "/value", value: Math.round(vl * 0.52) }, { name: "/value-calculator", value: Math.round(vl * 0.27) }, { name: "/value-hub", value: Math.round(vl * 0.13) }, { name: "Website value list", value: Math.round(vl * 0.42) }, { name: "Check trade (menu)", value: Math.round(vl * 0.1) }], { color: "#199e70", unit: "lookups" });
    let q = "", rar = "all", tr = "all";
    const t = table($("#vt"), {
      rows: () => D.values.filter((u) => (!q || u.name.toLowerCase().includes(q)) && (rar === "all" || u.rarity === rar) && (tr === "all" || u.trend === tr)),
      sort: "value", dir: -1, per: 10, onRow: (u) => { sel = u; hist(); scrollTo({ top: 0, behavior: "smooth" }); },
      cols: [
        { key: "name", label: "Unit", render: (u) => `<div class="unit"><img src="${esc(u.img)}" alt="" loading="lazy"><b>${esc(u.name)}</b></div>` },
        { key: "rarity", label: "Rarity", render: (u) => `<span class="pill ${{ Godly: "purple", Legendary: "red", Epic: "yellow", Rare: "green", Exclusive: "purple", Limited: "blue" }[u.rarity]}">${u.rarity}</span>`, hide: true },
        { key: "value", label: "Value", n: true, render: (u) => `<b>${full(u.value)}</b>` },
        { key: "change", label: "30 days", n: true, render: (u) => `<span class="delta ${u.change > 0.5 ? "up" : u.change < -0.5 ? "down" : "flat"}">${u.change >= 0 ? "▲" : "▼"} ${Math.abs(u.change)}%</span>` },
        { key: "demand", label: "Demand", n: true, render: (u) => u.demand + "/10", hide: true },
        { key: "lookups", label: "Lookups", n: true, render: (u) => compact(u.lookups), hide: true },
        { key: "updated", label: "Updated", sort: (u) => u.updated.getTime(), render: (u) => ago(u.updated), hide: true },
        { key: "e", label: "", nosort: true, render: (u) => `<div class="acts"><button class="mini-btn" data-e="${esc(u.name)}" type="button">Edit</button></div>` },
      ],
      after: (host) => $$("[data-e]", host).forEach((b) => b.addEventListener("click", async () => {
        const u = D.values.find((x) => x.name === b.dataset.e);
        const r = await formBox("Edit " + u.name, [{ label: "Value", type: "number", value: u.value }, { label: "Demand (1–10)", type: "number", value: u.demand }, { label: "Rarity", type: "select", options: ["Godly", "Legendary", "Epic", "Rare", "Exclusive", "Limited"], value: u.rarity }, { label: "Note for the value-update ping", value: "", hint: "Optional. Shown in servers that follow value updates." }]);
        if (r) { const nv = Math.max(0, +r[0] || u.value); u.change = +(((nv - u.history[0]) / u.history[0]) * 100).toFixed(1); u.value = nv; u.history[29] = nv; u.demand = Math.min(10, Math.max(1, +r[1] || u.demand)); u.rarity = r[2]; u.updated = new Date(); t.draw(); if (sel === u) hist(); saved(u.name + " updated"); }
      })),
    });
    $("#vq").addEventListener("input", (e) => { q = e.target.value.trim().toLowerCase(); t.reset(); });
    $("#vr").addEventListener("change", (e) => { rar = e.target.value; t.reset(); });
    $("#vtr").addEventListener("change", (e) => { tr = e.target.value; t.reset(); });
    $("#vsync").addEventListener("click", () => { toast("Syncing with the value sheet…", "clock"); setTimeout(() => toast("Value sheet up to date: 0 changes (preview)"), 1200); });
    $("#vadd").addEventListener("click", async () => { const r = await formBox("Add unit", [{ label: "Name" }, { label: "Value", type: "number" }, { label: "Rarity", type: "select", options: ["Godly", "Legendary", "Epic", "Rare", "Exclusive", "Limited"], value: "Rare" }], "Add"); if (r && r[0]) saved(r[0] + " added"); });
  };

  // UNITS & ENEMIES
  R.units = (v) => {
    v.innerHTML = `<div class="phead"><div><h1>Units &amp; enemies <span class="sample">Sample data</span></h1><p>The stats behind /search and /dps.</p></div><div class="acts"><button class="btn g-green" type="button" id="uadd"><img src="img/plus.png" alt="">Add entry</button></div></div><div id="ue-tabs"></div><div class="filters"><label class="srch"><span class="sr">Search</span>${SRCH}<input class="inp" id="ueq" placeholder="Search by name"></label></div><div id="uet"></div>`;
    let tab = "units", q = "";
    const draw = () => {
      if (tab === "units") {
        table($("#uet"), {
          rows: () => D.values.filter((u) => !q || u.name.toLowerCase().includes(q)).map((u, i) => ({ ...u, dps: Math.round(u.value / 9 + 120 + i * 7), range: (12 + (i % 7) * 2.5).toFixed(1), place: ["Ground", "Ground", "Cliff", "Water"][i % 4] })),
          sort: "dps", dir: -1, per: 12,
          cols: [
            { key: "name", label: "Unit", render: (u) => `<div class="unit"><img src="${esc(u.img)}" alt="" loading="lazy"><b>${esc(u.name)}</b></div>` },
            { key: "rarity", label: "Rarity", hide: true },
            { key: "dps", label: "DPS (max)", n: true, render: (u) => full(u.dps) },
            { key: "range", label: "Range", n: true, sort: (u) => +u.range },
            { key: "place", label: "Placement", hide: true },
            { key: "lookups", label: "/search uses", n: true, render: (u) => compact(u.lookups / 3), hide: true },
            { key: "e", label: "", nosort: true, render: () => '<div class="acts"><button class="mini-btn" data-ed type="button">Edit stats</button></div>' },
          ],
          after: (h) => $$("[data-ed]", h).forEach((b) => b.addEventListener("click", async () => { const r = await formBox("Edit unit stats", [{ label: "DPS (max level)", type: "number", value: 900 }, { label: "Range", type: "number", value: 14 }, { label: "Placement", type: "select", options: ["Ground", "Cliff", "Water"], value: "Ground" }]); if (r) saved("Unit stats saved"); })),
        });
      } else {
        table($("#uet"), {
          rows: () => D.enemies.filter((u) => !q || u.name.toLowerCase().includes(q)), sort: "hp", dir: -1,
          cols: [
            { key: "name", label: "Enemy", render: (e) => `<b>${esc(e.name)}</b>` },
            { key: "type", label: "Type", render: (e) => `<span class="pill ${e.type === "Boss" ? "red" : e.type === "Flying" ? "blue" : e.type === "Hidden" ? "purple" : "gray"}">${e.type}</span>` },
            { key: "hp", label: "Health", n: true, render: (e) => full(e.hp) },
            { key: "speed", label: "Speed", n: true },
            { key: "first", label: "First wave", n: true, hide: true },
            { key: "lookups", label: "Lookups", n: true, render: (e) => full(e.lookups), hide: true },
            { key: "e", label: "", nosort: true, render: () => '<div class="acts"><button class="mini-btn" data-ed type="button">Edit</button></div>' },
          ],
          after: (h) => $$("[data-ed]", h).forEach((b) => b.addEventListener("click", async () => { const r = await formBox("Edit enemy", [{ label: "Health", type: "number", value: 1200 }, { label: "Speed", type: "number", value: 1.2 }, { label: "Type", type: "select", options: ["Ground", "Flying", "Hidden", "Boss"], value: "Ground" }]); if (r) saved("Enemy saved"); })),
        });
      }
    };
    tabs($("#ue-tabs"), [["units", "Units (" + D.values.length + ")"], ["enemies", "Enemies (" + D.enemies.length + ")"]], tab, (x) => { tab = x; draw(); });
    $("#ueq").addEventListener("input", (e) => { q = e.target.value.trim().toLowerCase(); draw(); });
    $("#uadd").addEventListener("click", async () => { const r = await formBox("Add entry", [{ label: "Kind", type: "select", options: ["Unit", "Enemy"], value: tab === "units" ? "Unit" : "Enemy" }, { label: "Name" }], "Add"); if (r && r[1]) saved(r[1] + " added"); });
    draw();
  };

  // TRADING STATS
  R.tradestats = (v) => {
    v.innerHTML = `<div class="phead"><div><h1>Trading statistics <span class="sample">Sample data</span></h1><p>Trade checks, ads and the units people trade most.</p></div></div><div id="tsr"></div>
      <div id="tsk"></div>
      <div class="grid g-21 mt"><section class="card"><div class="ch"><h2><img src="img/scale.png" alt="">Trades checked</h2></div><div id="tsc"></div></section><section class="card"><div class="ch"><h2><img src="img/fair.png" alt="">Trade check results</h2></div><div id="tsd"></div></section></div>
      <div class="grid g2 mt"><section class="card"><div class="ch"><h2><img src="img/swap.png" alt="">Most offered units</h2></div><div id="tso"></div></section><section class="card"><div class="ch"><h2><img src="img/wish_star.png" alt="">Most wanted units</h2></div><div id="tsw"></div></section></div>`;
    const draw = () => {
      const c = (a) => sum(slice(a)), p = (a) => sum(prevSlice(a));
      renderKpis($("#tsk"), [
        kpi("Trades checked", "scale", full(c(D.trades)), c(D.trades), p(D.trades), slice(D.trades), "#c98500"),
        kpi("Trade ads posted", "swap", full(c(D.ads)), c(D.ads), p(D.ads), slice(D.ads), "#d95926"),
        kpi("Wishlist DMs sent", "wish_star", full(Math.round(c(D.ads) * 0.6)), c(D.ads), p(D.ads), null, null),
        kpi("Avg. ad reach", "discord_stud_white", "74 servers", null, null, null, null, "per ad"),
      ]);
      const b = bucket([slice(D.trades)]);
      C.line($("#tsc"), { labels: b.labels, series: [{ name: "Trades checked", values: b.arrs[0], color: "#c98500" }], area: true, height: 250, xfmt: fshort, tipLabel: (i) => fdate(b.labels[i]), label: "Trades checked" });
    };
    rangeBar($("#tsr"), () => busy(v, draw));
    draw();
    C.donut($("#tsd"), { items: [{ name: "Fair", value: 41, color: "#3987e5" }, { name: "Win", value: 24, color: "#199e70" }, { name: "Lose", value: 22, color: "#d95926" }, { name: "Big win / big lose", value: 13, color: "#9085e9" }], center: "41%", sub: "fair", unit: "checks", fmt: (x) => x + "%" });
    C.blist($("#tso"), D.units.slice(0, 8).map((n, i) => ({ name: n, img: `img/units/${D.slug(n)}.webp`, value: Math.round(4200 / (i + 1.3)) })), { color: "#d95926", unit: "ads offering it" });
    C.blist($("#tsw"), D.units.slice(4, 12).reverse().map((n, i) => ({ name: n, img: `img/units/${D.slug(n)}.webp`, value: Math.round(3900 / (i + 1.2)) })), { color: "#199e70", unit: "ads wanting it" });
    $$("#tso img, #tsw img").forEach((i) => { i.classList.add("uimg"); });
  };

  // COMMANDS
  R.commands = (v) => {
    v.innerHTML = `<div class="phead"><div><h1>Command configuration <span class="sample">Sample data</span></h1><p>Turn commands on or off, set cooldowns and who can use them.</p></div><div class="acts"><button class="btn g-green" id="csave" type="button">Save changes</button></div></div>
      <div class="filters"><label class="srch"><span class="sr">Search commands</span>${SRCH}<input class="inp" id="cq" placeholder="Search commands"></label><select class="sel" id="ccat" aria-label="Category"><option value="all">All categories</option>${[...new Set(D.COMMANDS.map((c) => c.cat))].map((c) => `<option>${esc(c)}</option>`).join("")}</select></div><div id="ct"></div>`;
    let q = "", cat = "all";
    const tot = sum(D.cmds.slice(-30));
    const t = table($("#ct"), {
      rows: () => D.COMMANDS.filter((c) => (!q || c.name.includes(q)) && (cat === "all" || c.cat === cat)), sort: "share", dir: -1, per: 25,
      cols: [
        { key: "name", label: "Command", render: (c) => `<b>${esc(c.name)}</b><br><small class="muted">${esc(c.cat)}</small>` },
        { key: "share", label: "Uses (30d)", n: true, render: (c) => compact(tot * c.share) },
        { key: "avgMs", label: "Avg. response", n: true, render: (c) => c.avgMs + " ms", hide: true },
        { key: "errors", label: "Errors", n: true, render: (c) => `<span class="${c.errors > 1 ? "delta down" : ""}">${c.errors}%</span>`, hide: true },
        { key: "cooldown", label: "Cooldown", nosort: true, render: (c) => `<input class="inp" type="number" min="0" value="${c.cooldown}" aria-label="Cooldown in seconds for ${esc(c.name)}" data-cd="${esc(c.name)}">` },
        { key: "perm", label: "Who can use", nosort: true, render: (c) => `<select class="sel" data-pm="${esc(c.name)}" aria-label="Permission for ${esc(c.name)}">${["Everyone", "Verified only", "Manage Server", "Bot admins"].map((o) => `<option${o === c.perm ? " selected" : ""}>${o}</option>`).join("")}</select>`, hide: true },
        { key: "enabled", label: "On", nosort: true, render: (c) => tog(c.name, c.enabled) },
      ],
      after: (h) => { wireToggles(h); $$("[data-cd]", h).forEach((i) => { i.style.width = "80px"; i.addEventListener("change", () => { D.COMMANDS.find((c) => c.name === i.dataset.cd).cooldown = +i.value; }); }); $$("[data-pm]", h).forEach((s) => s.addEventListener("change", () => { D.COMMANDS.find((c) => c.name === s.dataset.pm).perm = s.value; })); $$(".tog", h).forEach((tg) => tg.addEventListener("click", () => { D.COMMANDS.find((c) => c.name === tg.dataset.name).enabled = tg.getAttribute("aria-checked") === "true"; })); },
    });
    $("#cq").addEventListener("input", (e) => { q = e.target.value.trim().toLowerCase(); t.reset(); });
    $("#ccat").addEventListener("change", (e) => { cat = e.target.value; t.reset(); });
    $("#csave").addEventListener("click", () => saved("Command settings saved"));
  };

  // WORD FILTERS
  R.filters = (v) => {
    v.innerHTML = `<div class="phead"><div><h1>Banned words &amp; filters <span class="sample">Sample data</span></h1><p>Checked on trade ads, strategies, profile text and website posts.</p></div></div>
      <div class="grid g2"><section class="card"><div class="ch"><h2><img src="img/warning.png" alt="">Banned words</h2><span class="muted" id="bwc"></span></div>
          <form class="row" id="bwf"><label class="sr" for="bwi">Add a word or phrase</label><input class="inp" id="bwi" placeholder="Add a word or phrase" autocomplete="off"><button class="btn g-green" type="submit">Add</button></form>
          <div class="chips mt" id="bwl"></div></section>
        <section class="card"><div class="ch"><div class="hl"><h2><img src="img/bullseye.png" alt="">Test the filter</h2><p>Type a message to see what would be blocked.</p></div></div><textarea class="inp" id="bwt" placeholder="e.g. free robux at discord.gg/abc">selling sea dragon, dm me first for free robux</textarea><div id="bwr" class="mt"></div></section></div>
      <section class="card mt"><div class="ch"><h2><img src="img/shield.png" alt="">Filter rules</h2></div><div class="rows">
        ${[["Block Discord invite links", "Stops discord.gg links in ads and strategies.", true], ["Block other links", "Only roblox.com links are allowed.", true], ["Check images with image moderation", "Uses Sightengine on trade banners and profile pictures.", true], ["Catch look-alike letters", "fr€€ r0bux counts as free robux.", true], ["Auto-mute after 3 blocked messages in 10 minutes", "Mute for 1 hour and tell the moderators.", false], ["Hold new users' first ad for review", "Accounts younger than 1 day.", false]].map(([a, b, on]) => `<div class="row"><div class="grow"><b>${a}</b><small>${b}</small></div>${tog(a, on)}</div>`).join("")}
      </div></section>
      <section class="mt"><div class="ch"><h2><img src="img/clock.png" alt="">Recent filter hits</h2></div><div id="bwh"></div></section>`;
    const draw = () => {
      $("#bwc").textContent = D.banned.length + " entries";
      $("#bwl").innerHTML = D.banned.map((w, i) => `<span class="chip">${esc(w)}<button type="button" data-i="${i}" aria-label="Remove ${esc(w)}">×</button></span>`).join("");
      $$("#bwl button").forEach((b) => b.addEventListener("click", () => { const w = D.banned.splice(+b.dataset.i, 1)[0]; draw(); test(); toast("Removed “" + w + "” (preview)", "warning"); }));
    };
    const test = () => {
      const txt = $("#bwt").value.toLowerCase();
      const hits = D.banned.filter((w) => txt.includes(w));
      $("#bwr").innerHTML = hits.length ? `<span class="st crit"><i></i>Blocked</span> <span class="muted">matched:</span> ${hits.map((h) => `<span class="pill red">${esc(h)}</span>`).join(" ")}` : '<span class="st good"><i></i>Allowed</span> <span class="muted">No banned words found.</span>';
    };
    $("#bwf").addEventListener("submit", (e) => { e.preventDefault(); const w = $("#bwi").value.trim().toLowerCase(); if (!w) return; if (!D.banned.includes(w)) D.banned.push(w); $("#bwi").value = ""; draw(); test(); toast("Added “" + w + "” (preview)"); });
    $("#bwt").addEventListener("input", test);
    draw(); test(); wireToggles(v);
    table($("#bwh"), {
      rows: () => D.ads_list.filter((a) => a.status === "Flagged" || a.status === "Removed").slice(0, 14).map((a, i) => ({ a, word: D.banned[i % D.banned.length], where: ["Trade ad", "Trade ad", "Strategy", "Profile bio"][i % 4], action: ["Blocked", "Held for review", "Blocked", "Auto-muted"][i % 4] })),
      per: 8,
      cols: [
        { key: "who", label: "User", nosort: true, render: (r) => esc(r.a.user.discord) },
        { key: "where", label: "Where" },
        { key: "word", label: "Matched", render: (r) => `<span class="pill red">${esc(r.word)}</span>` },
        { key: "action", label: "Action", hide: true },
        { key: "t", label: "When", nosort: true, render: (r) => ago(r.a.posted) },
      ],
    });
  };

  // ROLES & PERMISSIONS
  R.roles = (v) => {
    const perms = ["View dashboard", "Remove trade ads", "Warn & mute", "Ban users", "Edit values", "Edit word filters", "Run giveaways", "Send announcements", "Manage admins"];
    const roles = { Owner: perms.map(() => true), Admin: [1, 1, 1, 1, 1, 1, 1, 1, 0], Moderator: [1, 1, 1, 0, 0, 1, 0, 0, 0], "Value team": [1, 0, 0, 0, 1, 0, 0, 0, 0], "Trusted trader": [0, 0, 0, 0, 0, 0, 0, 0, 0] };
    const staff = D.users.filter((u) => ["Admin", "Moderator", "Value team"].includes(u.role)).slice(0, 7);
    v.innerHTML = `<div class="phead"><div><h1>Roles &amp; permissions <span class="sample">Sample data</span></h1><p>Who can do what in this dashboard and with the bot's admin commands.</p></div><div class="acts"><button class="btn g-green" id="rsave" type="button">Save permissions</button></div></div>
      <section class="card flush"><div class="tw"><table class="t perm"><thead><tr><th scope="col">Permission</th>${Object.keys(roles).map((r) => `<th scope="col">${r}</th>`).join("")}</tr></thead><tbody>
      ${perms.map((p, i) => `<tr><td><b>${p}</b></td>${Object.entries(roles).map(([r, a]) => `<td><input type="checkbox" class="check" aria-label="${esc(r)}: ${esc(p)}" ${a[i] ? "checked" : ""} ${r === "Owner" ? "disabled" : ""}></td>`).join("")}</tr>`).join("")}
      </tbody></table></div></section>
      <div class="grid g2 mt"><section class="card"><div class="ch"><h2><img src="img/medal_gold.png" alt="">Staff</h2><button class="btn g-blue sm" id="radd" type="button">Add staff</button></div><div class="rows" id="rstaff"></div></section>
        <section class="card"><div class="ch"><h2><img src="img/discord_stud_white.png" alt="">Discord role rewards</h2></div><div class="rows">
          ${[["Level 10", "Sprout", "#33c46a"], ["Level 25", "Grower", "#4b8df8"], ["Level 40", "Gardener", "#b06ae6"], ["Verified Roblox", "Verified", "#f5c542"], ["Trusted trader", "Trusted", "#e07a10"]].map(([a, b]) => `<div class="row"><div class="grow"><b>${a}</b><small>Gives the @${b} role in servers that turn it on</small></div>${tog(a + " role reward", true)}</div>`).join("")}
        </div></section></div>`;
    const drawStaff = () => {
      $("#rstaff").innerHTML = `<div class="row"><span class="who"><img src="img/favicon.png" alt="" class="av32"></span><div class="grow"><b>Marcel</b><small>Owner</small></div><span class="pill purple">Owner</span></div>` + staff.map((u, i) => `<div class="row"><span class="who">${avatar(u)}</span><div class="grow"><b>${esc(u.discord)}</b><small>Added ${fdate(u.registered)}</small></div><select class="sel" data-i="${i}" aria-label="Role for ${esc(u.discord)}">${["Admin", "Moderator", "Value team", "Remove"].map((o) => `<option${o === u.role ? " selected" : ""}>${o}</option>`).join("")}</select></div>`).join("");
      $$("#rstaff .who img").forEach((i) => i.classList.add("av32"));
      $$("#rstaff select").forEach((s) => s.addEventListener("change", async () => {
        const u = staff[+s.dataset.i];
        if (s.value === "Remove") { if (await confirmBox({ title: "Remove " + u.discord + " from staff?", text: "They lose access to this dashboard right away.", ok: "Remove", danger: true })) { staff.splice(+s.dataset.i, 1); u.role = "Member"; drawStaff(); toast("Removed from staff (preview)", "warning"); } else s.value = u.role; }
        else { u.role = s.value; toast(u.discord + " is now " + s.value + " (preview)"); }
      }));
    };
    drawStaff(); wireToggles(v);
    $("#rsave").addEventListener("click", () => saved("Permissions saved"));
    $("#radd").addEventListener("click", async () => { const r = await formBox("Add staff", [{ label: "Discord name or ID" }, { label: "Role", type: "select", options: ["Admin", "Moderator", "Value team"], value: "Moderator" }], "Add"); if (r && r[0]) saved(r[0] + " added as " + r[1]); });
  };

  // SERVERS
  R.servers = (v) => {
    v.innerHTML = `<div class="phead"><div><h1>Server configuration <span class="sample">Sample data</span></h1><p>Bloombot is in ${full(1284)} servers. Here are the biggest ones.</p></div></div>
      <div class="grid g-21"><div><div class="filters"><label class="srch"><span class="sr">Search servers</span>${SRCH}<input class="inp" id="sq" placeholder="Search servers"></label><select class="sel" id="sst" aria-label="Setup"><option value="all">All servers</option><option value="ok">Set up</option><option value="no">Needs /setup</option></select></div><div id="stb"></div></div>
      <section class="card" id="scfg"></section></div>`;
    let q = "", ss = "all", sel = D.servers[0];
    const cfg = () => {
      $("#scfg").innerHTML = `<div class="ch"><div class="hl"><h2><img src="img/gear.png" alt="">${esc(sel.name)}</h2><p>${full(sel.members)} members · ID ${esc(sel.id)}</p></div>${sel.setup ? '<span class="st good"><i></i>Set up</span>' : '<span class="st warn"><i></i>Needs /setup</span>'}</div>
        <div class="field"><label for="sc1">Trade ads channel</label><select class="sel" id="sc1"><option>#trade-ads</option><option>#trading</option><option>#bloombot-ads</option><option>None</option></select></div>
        <div class="field"><label for="sc2">Value update ping role</label><select class="sel" id="sc2"><option>@Value Updates</option><option>@Traders</option><option>None</option></select></div>
        <div class="rows">${[["Global trade ads", true], ["Value update posts", true], ["Level-up messages", sel.feats > 5], ["Giveaways", sel.feats > 4], ["Invite tracking", sel.feats > 6], ["Strategies channel", sel.feats > 3]].map(([a, on]) => `<div class="row"><div class="grow"><b>${a}</b></div>${tog(a, on)}</div>`).join("")}</div>
        <div class="row mt"><button class="btn g-green" type="button" id="ssave">Save</button><button class="btn g-red" type="button" id="sleave">Leave server</button></div>`;
      wireToggles($("#scfg"));
      $("#ssave").addEventListener("click", () => saved(sel.name + " saved"));
      $("#sleave").addEventListener("click", async () => { if (await confirmBox({ title: "Make Bloombot leave " + sel.name + "?", text: "Its settings are kept for 30 days in case the bot is added again.", ok: "Leave server", danger: true, typed: sel.name })) toast("Left " + sel.name + " (preview only)", "lose"); });
    };
    const t = table($("#stb"), {
      rows: () => D.servers.filter((s) => (!q || s.name.toLowerCase().includes(q)) && (ss === "all" || s.setup === (ss === "ok"))), sort: "members", dir: -1, per: 10,
      onRow: (s) => { sel = s; cfg(); if (innerWidth < 1280) $("#scfg").scrollIntoView({ behavior: "smooth" }); },
      cols: [
        { key: "name", label: "Server", render: (s) => `<b>${esc(s.name)}</b>` },
        { key: "members", label: "Members", n: true, render: (s) => full(s.members) },
        { key: "cmds", label: "Commands (30d)", n: true, render: (s) => compact(s.cmds), hide: true },
        { key: "setup", label: "Setup", sort: (s) => +s.setup, render: (s) => (s.setup ? '<span class="st good"><i></i>Done</span>' : '<span class="st warn"><i></i>Needs /setup</span>') },
        { key: "joined", label: "Added", sort: (s) => s.joined.getTime(), render: (s) => ago(s.joined), hide: true },
      ],
    });
    $("#sq").addEventListener("input", (e) => { q = e.target.value.trim().toLowerCase(); t.reset(); });
    $("#sst").addEventListener("change", (e) => { ss = e.target.value; t.reset(); });
    cfg();
  };

  // GIVEAWAYS & EVENTS
  R.giveaways = (v) => {
    v.innerHTML = `<div class="phead"><div><h1>Giveaways &amp; events <span class="sample">Sample data</span></h1><p>Website popup giveaways and bot events.</p></div><div class="acts"><a class="btn g-dark" href="giveaway-admin.html"><img src="img/gift.png" alt="">Open giveaway manager</a><button class="btn g-purple" type="button" id="gnew"><img src="img/plus.png" alt="">New giveaway</button></div></div>
      <div class="grid g3" id="gw"></div>
      <div class="grid g2 mt"><section class="card"><div class="ch"><h2><img src="img/chart_up.png" alt="">Entries, last 14 days</h2></div><div id="gwc"></div></section>
      <section class="card"><div class="ch"><h2><img src="img/star.webp" alt="">Events</h2><button class="btn g-blue sm" type="button" id="enew">New event</button></div><div class="rows" id="ev"></div></section></div>`;
    const draw = () => {
      $("#gw").innerHTML = D.giveaways.map((g, i) => `<section class="card"><div class="row"><img src="${esc(g.img)}" alt="" class="gimg"><div class="grow"><b>${esc(g.title)}</b><small>${g.status === "Ended" ? "Ended " + ago(g.ends) : g.status === "Scheduled" ? "Starts soon · ends " + fdate(g.ends) : "Ends " + ago(g.ends)}</small></div>${statusPill(g.status)}</div>
        <div class="dl-grid mt"><div><small>Entries</small><b>${full(g.entries)}</b></div><div><small>Winners</small><b>${g.winners}</b></div></div>
        <div class="row">${g.status === "Live" ? `<button class="btn g-red sm" data-end="${i}" type="button">End now</button>` : g.status === "Ended" ? `<button class="btn g-yellow sm" data-rr="${i}" type="button">Reroll</button>` : `<button class="btn g-green sm" data-go="${i}" type="button">Start now</button>`}<button class="btn g-dark sm" data-ed="${i}" type="button">Edit</button></div></section>`).join("");
      $$(".gimg").forEach((i) => { i.width = 52; i.height = 52; });
      $$("[data-end]").forEach((b) => b.addEventListener("click", async () => { const g = D.giveaways[+b.dataset.end]; if (await confirmBox({ title: "End " + g.title + " now?", text: "A winner is drawn from " + full(g.entries) + " entries.", ok: "End and draw", danger: true })) { g.status = "Ended"; g.ends = new Date(); draw(); toast("Winner drawn: " + D.users[7].discord + " (preview)", "gift"); } }));
      $$("[data-rr]").forEach((b) => b.addEventListener("click", () => toast("New winner: " + D.users[11].discord + " (preview)", "gift")));
      $$("[data-go]").forEach((b) => b.addEventListener("click", () => { const g = D.giveaways[+b.dataset.go]; g.status = "Live"; draw(); toast(g.title + " is live (preview)", "gift"); }));
      $$("[data-ed]").forEach((b) => b.addEventListener("click", () => editGw(D.giveaways[+b.dataset.ed])));
      $("#ev").innerHTML = D.events.map((e) => `<div class="row"><div class="grow"><b>${esc(e.title)}</b><small>${esc(e.when)}</small></div>${statusPill(e.status)}</div>`).join("");
    };
    async function editGw(g) {
      const r = await formBox(g ? "Edit giveaway" : "New giveaway", [{ label: "Prize", value: g ? g.title : "" }, { label: "Winners", type: "number", value: g ? g.winners : 1 }, { label: "Ends", type: "datetime-local", value: "" }, { label: "Requirement", type: "select", options: ["None", "In support server", "Verified Roblox", "Live trade ad", "Level 5+"], value: "None" }], g ? "Save" : "Create");
      if (!r) return;
      if (g) { g.title = r[0] || g.title; g.winners = +r[1] || g.winners; }
      else D.giveaways.unshift({ title: r[0] || "New giveaway", img: "img/gift.png", ends: new Date(Date.now() + 3 * D.DAY), entries: 0, status: "Scheduled", winners: +r[1] || 1 });
      draw(); saved(g ? "Giveaway saved" : "Giveaway created");
    }
    draw();
    $("#gnew").addEventListener("click", () => editGw(null));
    $("#enew").addEventListener("click", async () => { const r = await formBox("New event", [{ label: "Name", value: "Double XP weekend" }, { label: "When", value: "" }, { label: "Effect", type: "select", options: ["Double XP", "Free bump every 2 min", "Giveaway entries x2"], value: "Double XP" }], "Create"); if (r) { D.events.unshift({ title: r[0], when: r[1] || "Not scheduled", status: "Scheduled" }); draw(); saved("Event created"); } });
    C.bars($("#gwc"), { labels: D.days.slice(-14).map(fshort), series: [{ name: "Entries", values: D.regs.slice(-14).map((x) => x * 3 + 40), color: "#9085e9" }], height: 220 });
  };

  // ANNOUNCEMENTS
  R.announce = (v) => {
    v.innerHTML = `<div class="phead"><div><h1>Bot announcements <span class="sample">Sample data</span></h1><p>Post to every server's announcement channel and the website banner.</p></div></div>
      <div class="grid g2"><section class="card"><div class="ch"><h2><img src="img/bell.png" alt="">New announcement</h2></div>
        <div class="field"><label for="ant">Title</label><input class="inp" id="ant" value="Double XP weekend!"></div>
        <div class="field"><label for="anb">Message</label><textarea class="inp" id="anb">This weekend every command gives **double XP**. Rank up and unlock new perks!</textarea><small id="anl"></small></div>
        <div class="field"><label for="anw">Send to</label><select class="sel" id="anw"><option>Discord + website banner</option><option>Discord servers only</option><option>Website banner only</option><option>Support server only</option></select></div>
        <div class="field"><label for="ans">When</label><input class="inp date-in" type="datetime-local" id="ans"><small>Leave empty to send now.</small></div>
        <div class="row"><button class="btn g-green" type="button" id="ango">Send</button><button class="btn g-dark" type="button" id="andr">Save draft</button></div></section>
        <section class="card"><div class="ch"><h2><img src="img/discord_stud_white.png" alt="">Preview in Discord</h2></div><div class="preview-dc" id="anp"></div><div class="ch mt"><h2>Past announcements</h2></div><div id="anlist"></div></section></div>`;
    const prev = () => {
      const t = $("#ant").value, b = $("#anb").value;
      $("#anp").innerHTML = `<b>${esc(t)}</b>\n` + esc(b).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>");
      $("#anl").textContent = b.length + " / 2000 characters";
    };
    const list = () => { $("#anlist").innerHTML = D.announcements.map((a) => `<div class="ann"><h4>${esc(a.title)} ${statusPill(a.status)}</h4><small>${esc(a.where)} · by ${esc(a.by)}${a.when ? " · " + (a.status === "Scheduled" ? "sends " : "") + ago(a.when) : ""}${a.reach ? " · reached " + full(a.reach) + " members" : ""}</small></div>`).join(""); };
    $("#ant").addEventListener("input", prev); $("#anb").addEventListener("input", prev);
    $("#ango").addEventListener("click", async () => {
      const when = $("#ans").value;
      if (await confirmBox({ title: when ? "Schedule this announcement?" : "Send to " + $("#anw").value.toLowerCase() + "?", text: when ? "It goes out at the time you picked." : "This posts in about 1,284 servers. It can't be unsent.", ok: when ? "Schedule" : "Send now", danger: !when })) {
        D.announcements.unshift({ title: $("#ant").value, where: $("#anw").value, by: "Marcel", when: when ? new Date(when) : new Date(), status: when ? "Scheduled" : "Sent", reach: when ? 0 : 18512 });
        list(); toast(when ? "Scheduled (preview)" : "Sent (preview only, nothing was posted)", "bell");
      }
    });
    $("#andr").addEventListener("click", () => { D.announcements.unshift({ title: $("#ant").value, where: $("#anw").value, by: "Marcel", when: null, status: "Draft", reach: 0 }); list(); saved("Draft saved"); });
    prev(); list();
  };

  // LOADING MESSAGES & ERRORS
  R.loading = (v) => {
    v.innerHTML = `<div class="phead"><div><h1>Loading messages &amp; errors <span class="sample">Sample data</span></h1><p>The text on the red loading bar while trade ads post, plus errors the bot reported.</p></div></div>
      <div class="grid g-12"><section class="card"><div class="ch"><h2><img src="img/clock.png" alt="">Loading messages</h2></div><div id="lml"></div><form class="row mt" id="lmf"><label class="sr" for="lmi">New loading message</label><input class="inp" id="lmi" placeholder="New message…"><button class="btn g-green" type="submit">Add</button></form>
        <div class="rows mt"><div class="row"><div class="grow"><b>Pick a random message</b><small>Off = show them in order</small></div>${tog("Random loading messages", true)}</div></div></section>
        <section class="card"><div class="ch"><div class="hl"><h2><img src="img/warning.png" alt="">Errors, last 14 days</h2></div></div><div id="erc"></div></section></div>
      <div class="filters mt"><div id="ertabs"></div><span class="sp"></span><button class="btn g-dark sm" type="button" id="erall">Mark all resolved</button></div><div id="ert"></div>`;
    const lm = () => {
      $("#lml").innerHTML = D.loadingMsgs.map((m, i) => `<div class="loadmsg"><span class="lb"><i></i></span><span>${esc(m)}</span><button class="mini-btn danger" type="button" data-i="${i}" aria-label="Remove">Remove</button></div>`).join("");
      $$("#lml button").forEach((b) => b.addEventListener("click", () => { D.loadingMsgs.splice(+b.dataset.i, 1); lm(); toast("Removed (preview)", "warning"); }));
    };
    lm(); wireToggles(v);
    $("#lmf").addEventListener("submit", (e) => { e.preventDefault(); const t = $("#lmi").value.trim(); if (t) { D.loadingMsgs.push(t); $("#lmi").value = ""; lm(); toast("Added (preview)"); } });
    const days = D.days.slice(-14);
    const per = (lvl) => days.map((d) => D.errors.filter((e) => e.level === lvl && e.time >= d && e.time < new Date(d.getTime() + D.DAY)).reduce((a, e) => a + e.count, 0) + (lvl === "Warning" ? 3 : 1));
    C.bars($("#erc"), { labels: days.map(fshort), series: [{ name: "Errors", values: per("Error"), color: "#e66767" }, { name: "Warnings", values: per("Warning"), color: "#c98500" }], stacked: true, height: 230 });
    let lv = "open";
    const t = table($("#ert"), {
      rows: () => D.errors.filter((e) => (lv === "open" ? !e.resolved : lv === "all" ? true : e.level === lv)), sort: "time", dir: -1, per: 10, cls: "log",
      cols: [
        { key: "time", label: "Time", sort: (e) => e.time.getTime(), render: (e) => fshort(e.time) + " " + ftime(e.time) },
        { key: "level", label: "Level", render: (e) => statusPill(e.level) },
        { key: "title", label: "Error", cls: "msg", render: (e) => `<b>${esc(e.title)}</b><br><span class="muted">${esc(e.where)} · ${esc(e.detail)}</span>` },
        { key: "count", label: "Count", n: true },
        { key: "r", label: "", nosort: true, render: (e) => (e.resolved ? '<span class="pill green">Resolved</span>' : `<button class="mini-btn" type="button" data-r="${D.errors.indexOf(e)}">Resolve</button>`) },
      ],
      after: (h) => $$("[data-r]", h).forEach((b) => b.addEventListener("click", () => { D.errors[+b.dataset.r].resolved = true; t.draw(); toast("Marked resolved"); })),
    });
    tabs($("#ertabs"), [["open", "Open"], ["Error", "Errors"], ["Warning", "Warnings"], ["all", "All"]], lv, (x) => { lv = x; t.reset(); });
    $("#ertabs").classList.add("tabs-inline");
    $("#erall").addEventListener("click", () => { D.errors.forEach((e) => { e.resolved = true; }); t.draw(); toast("All errors marked resolved"); });
  };

  // WEBSITE
  R.website = (v) => {
    v.innerHTML = `<div class="phead"><div><h1>Website management <span class="sample">Sample data</span></h1><p>bloombot-gtd.vercel.app</p></div><div class="acts"><a class="btn g-dark" href="./" target="_blank" rel="noopener"><img src="img/flower.png" alt="">Open website</a></div></div><div id="wtabs"></div><div id="wb"></div>`;
    const body = $("#wb");
    const show = (tab) => {
      if (tab === "stats") {
        body.innerHTML = `<div id="wk"></div><div class="grid g-21 mt"><section class="card"><div class="ch"><h2><img src="img/task_about.png" alt="">Views per page, 30 days</h2></div><div id="wpc"></div></section><section class="card"><div class="ch"><h2><img src="img/rbx_stud.png" alt="">Devices</h2></div><div id="wdev"></div></section></div><div class="mt" id="wpt"></div>`;
        const v30 = sum(D.visits.slice(-30));
        renderKpis($("#wk"), [
          kpi("Page views, 30 days", "chart_up", full(v30), v30, sum(D.visits.slice(-60, -30)), D.visits.slice(-30), "#3987e5"),
          kpi("Avg. time on site", "clock", "2m 41s", 161, 149, null, null),
          kpi("Bounce rate", "fall", "34%", 34, 37, null, null),
          kpi("Logged-in visitors", "login", "38%", 38, 33, null, null),
        ]);
        C.bars($("#wpc"), { labels: D.pages.map((p) => p.title), series: [{ name: "Views", values: D.pages.map((p) => Math.round(v30 * p.share / 100)), color: "#3987e5" }], horizontal: true, rowH: 26, labelW: 130 });
        C.donut($("#wdev"), { items: [{ name: "Phone", value: 58 }, { name: "Desktop", value: 36 }, { name: "Tablet", value: 6 }], center: "58%", sub: "on phones", unit: "visits", fmt: (x) => x + "%" });
        pageTable($("#wpt"));
      } else if (tab === "ann") {
        body.innerHTML = `<div class="grid g2"><section class="card"><div class="ch"><h2><img src="img/bell.png" alt="">Site banner</h2>${tog("Site banner", true)}</div>
          <div class="field"><label for="wbt">Banner text</label><input class="inp" id="wbt" value="Double XP weekend starts Saturday!"></div>
          <div class="field"><label for="wbc">Colour</label><select class="sel" id="wbc"><option>Green</option><option>Blue</option><option>Yellow</option><option>Purple</option><option>Red</option></select></div>
          <div class="field"><label for="wbl">Link (optional)</label><input class="inp" id="wbl" value="levels.html"></div>
          <div class="weld g-green" id="wbp">Double XP weekend starts Saturday!</div><div class="row mt"><button class="btn g-green" type="button" id="wbs">Publish banner</button></div></section>
          <section class="card"><div class="ch"><h2><img src="img/gift.png" alt="">Popups</h2></div><div class="rows">${[["Giveaway popup", "Bottom right on every page", true], ["Cookie consent", "Required in the EU, keep on", true], ["First-login welcome", "Asks new users to finish their profile", true], ["What's new popup", "Shown once after a site update", false]].map(([a, b, on]) => `<div class="row"><div class="grow"><b>${a}</b><small>${b}</small></div>${tog(a, on)}</div>`).join("")}</div></section></div>`;
        const pv = () => { const p = $("#wbp"); p.textContent = $("#wbt").value; p.className = "weld g-" + $("#wbc").value.toLowerCase(); };
        $("#wbt").addEventListener("input", pv); $("#wbc").addEventListener("change", pv);
        $("#wbp").classList.add("wbanner");
        $("#wbs").addEventListener("click", () => saved("Banner published"));
        wireToggles(body);
      } else if (tab === "content") {
        body.innerHTML = `<div class="grid g2"><section class="card"><div class="ch"><h2><img src="img/flower.png" alt="">Home page</h2></div>
          <div class="field"><label for="wc1">Headline</label><input class="inp" id="wc1" value="The trading bot for Garden Tower Defense"></div>
          <div class="field"><label for="wc2">Subtitle</label><textarea class="inp" id="wc2">Trade ads, live values, calculators and strategies, free in every server.</textarea></div>
          <div class="field"><label for="wc3">Main button</label><select class="sel" id="wc3"><option>Add to Discord</option><option>Browse values</option><option>Post a trade ad</option></select></div><button class="btn g-green" type="button" data-save>Save</button></section>
          <section class="card"><div class="ch"><h2><img src="img/task_about.png" alt="">Pages</h2></div><div class="rows">${D.pages.map((p) => `<div class="row"><div class="grow"><b>${esc(p.title)}</b><small>${esc(p.path)}</small></div><button class="mini-btn" type="button" data-save>Edit</button>${tog(p.title + " page", true, false)}</div>`).join("")}</div></section></div>`;
        $$("[data-save]", body).forEach((b) => b.addEventListener("click", () => saved("Content saved")));
        wireToggles(body);
      } else {
        body.innerHTML = `<div class="grid g2"><section class="card"><div class="ch"><h2><img src="img/bullseye.png" alt="">Search appearance</h2></div>
          <div class="field"><label for="seop">Page</label><select class="sel" id="seop">${D.pages.slice(0, 9).map((p) => `<option value="${esc(p.path)}">${esc(p.title)}</option>`).join("")}</select></div>
          <div class="field"><label for="seot">Title</label><input class="inp" id="seot"><small id="seotl"></small></div>
          <div class="field"><label for="seod">Description</label><textarea class="inp" id="seod"></textarea><small id="seodl"></small></div>
          <div class="seo-prev"><div class="u" id="sp1"></div><div class="h" id="sp2"></div><div class="d" id="sp3"></div></div><div class="row mt"><button class="btn g-green" type="button" id="seos">Save</button></div></section>
          <section class="card"><div class="ch"><h2><img src="img/verified_stud.png" alt="">SEO checks</h2></div><div class="rows">
          ${[["good", "Sitemap.xml", "11 pages listed"], ["good", "robots.txt", "Admin, profile and dashboard are hidden from Google"], ["good", "Page titles", "All unique"], ["warn", "Descriptions", "2 pages are over 160 characters"], ["good", "Social preview image", "og-v2.jpg, 1200×630"], ["warn", "Google Search Console", "Waiting for verification"], ["good", "Page speed (phone)", "94 / 100"]].map(([s, a, b]) => `<div class="row"><span class="st ${s}"><i></i></span><div class="grow"><b>${a}</b><small>${b}</small></div></div>`).join("")}
          </div></section></div>`;
        const meta = { "/values.html": ["GTD Values: Garden Tower Defense unit value list | Bloombot", "Live values, demand and price trends for every Garden Tower Defense unit."], "/": ["Bloombot: Garden Tower Defense trading bot", "Trade ads, live values, calculators and strategies for Roblox Garden Tower Defense, free in every Discord server."] };
        const load = () => { const p = D.pages.find((x) => x.path === $("#seop").value); const m = meta[p.path] || [p.title + " | Bloombot", "Bloombot " + p.title.toLowerCase() + " for Roblox Garden Tower Defense."]; $("#seot").value = m[0]; $("#seod").value = m[1]; pv(); };
        const pv = () => { const t = $("#seot").value, d = $("#seod").value; $("#sp1").textContent = "bloombot-gtd.vercel.app" + $("#seop").value.replace(/\/$/, "").replace(/^/, " › ").replace(" › /", " › "); $("#sp2").textContent = t.length > 60 ? t.slice(0, 58) + "…" : t; $("#sp3").textContent = d.length > 160 ? d.slice(0, 157) + "…" : d; $("#seotl").textContent = t.length + " / 60 characters" + (t.length > 60 ? " (too long, Google cuts it)" : ""); $("#seodl").textContent = d.length + " / 160 characters" + (d.length > 160 ? " (too long)" : ""); };
        $("#seop").addEventListener("change", load); $("#seot").addEventListener("input", pv); $("#seod").addEventListener("input", pv);
        $("#seos").addEventListener("click", () => saved("SEO saved"));
        load();
      }
    };
    tabs($("#wtabs"), [["stats", "Page statistics"], ["ann", "Announcements"], ["content", "Content"], ["seo", "SEO"]], "stats", show);
    show("stats");
  };

  // ACTIVITY LOGS
  R.logs = (v) => {
    v.innerHTML = `<div class="phead"><div><h1>Activity logs <span class="sample">Sample data</span></h1><p>Everything users and admins did, newest first.</p></div><div class="acts"><button class="btn g-dark" type="button" id="lexp"><img src="img/calculator.png" alt="">Export CSV</button></div></div>
      <div id="ltabs"></div><div class="filters"><label class="srch"><span class="sr">Search logs</span>${SRCH}<input class="inp" id="lq" placeholder="Search user or action"></label><select class="sel" id="lt" aria-label="Time"><option value="1">Last hour</option><option value="24" selected>Last 24 hours</option><option value="168">Last 7 days</option><option value="0">All</option></select></div><div id="ltb"></div>`;
    let ty = "all", q = "", hrs = 24;
    const rows = () => D.logs.filter((l) => (ty === "all" || l.type === ty) && (!q || l.text.toLowerCase().includes(q)) && (!hrs || Date.now() - l.time < hrs * 3600e3));
    const tt = table($("#ltb"), {
      rows, sort: "time", dir: -1, per: 15, cls: "log",
      cols: [
        { key: "time", label: "Time", sort: (l) => l.time.getTime(), render: (l) => fshort(l.time) + " " + ftime(l.time) },
        { key: "type", label: "Type", render: (l) => `<span class="pill ${{ registration: "blue", verification: "green", command: "gray", trade: "purple", admin: "yellow" }[l.type]}">${esc(l.type)}</span>` },
        { key: "title", label: "Event", render: (l) => esc(l.title), hide: true },
        { key: "text", label: "Details", cls: "msg", render: (l) => esc(l.text) },
      ],
    });
    const cnt = (t) => D.logs.filter((l) => t === "all" || l.type === t).length;
    tabs($("#ltabs"), [["all", "All"], ["registration", "Registrations"], ["verification", "Verifications"], ["command", "Commands"], ["trade", "Trades"], ["admin", "Admin actions (" + cnt("admin") + ")"]], ty, (x) => { ty = x; tt.reset(); });
    $("#lq").addEventListener("input", (e) => { q = e.target.value.trim().toLowerCase(); tt.reset(); });
    $("#lt").addEventListener("change", (e) => { hrs = +e.target.value; tt.reset(); });
    $("#lexp").addEventListener("click", () => downloadCsv("bloombot-activity.csv", ["time", "type", "event", "details"], rows().map((l) => [l.time.toISOString(), l.type, l.title, l.text])));
  };

  // SYSTEM HEALTH
  R.system = (v) => {
    const warn = D.services.filter((s) => s.st !== "good").length;
    v.innerHTML = `<div class="phead"><div><h1>System health <span class="sample">Sample data</span></h1><p>Bot uptime, APIs, response times and errors.</p></div><div class="acts"><button class="btn g-dark" type="button" id="sref"><img src="img/clock.png" alt="">Refresh</button></div></div>
      <section class="card"><div class="row"><span class="st ${warn ? "warn" : "good"} live"><i></i></span><div class="grow"><b>${warn ? "Running, " + warn + " services slow" : "All systems running"}</b><small class="muted">Checked ${ago(new Date(Date.now() - 40e3))}</small></div><span class="pill green">99.94% uptime, 30 days</span></div><div class="ubar" id="sup"></div><div class="row muted"><small>90 days ago</small><span class="grow"></span><small>Today</small></div></section>
      <div id="sk" class="mt"></div>
      <div class="grid g-21 mt"><section class="card"><div class="ch"><div class="hl"><h2><img src="img/lightning.png" alt="">Response times, last 24 hours</h2></div></div><div id="slat"></div></section>
        <section class="card"><div class="ch"><h2><img src="img/shield.png" alt="">Services</h2></div><div id="ssv"></div></section></div>
      <div class="grid g2 mt"><section class="card"><div class="ch"><h2><img src="img/gear.png" alt="">Host resources</h2></div><div class="rows" id="sres"></div></section>
        <section class="card"><div class="ch"><h2><img src="img/warning.png" alt="">Latest errors</h2><a href="#loading" class="muted">All errors</a></div><ul class="tl" id="serr"></ul></section></div>`;
    uptimeBar($("#sup"));
    renderKpis($("#sk"), [
      kpi("Bot uptime", "clock", "3d 4h", null, null, null, null, "since last restart"),
      kpi("Avg. response", "lightning", "118 ms", 118, 131, D.latency.map((l) => l.api), "#3987e5", "vs yesterday"),
      kpi("Errors, 24h", "warning", String(D.errors.filter((e) => Date.now() - e.time < D.DAY && e.level === "Error").length), null, null, null, null, "unresolved: " + D.errors.filter((e) => !e.resolved).length),
      kpi("Gateway ping", "discord_stud_white", "41 ms", null, null, null, null, "2 shards"),
    ]);
    const labs = D.latency.map((_, i) => { const d = new Date(Date.now() - (47 - i) * 30 * 60e3); return ftime(d); });
    C.line($("#slat"), { labels: labs, series: [{ name: "Bot commands", values: D.latency.map((l) => l.api + 60), color: "#3987e5" }, { name: "Database", values: D.latency.map((l) => l.db), color: "#d95926" }, { name: "Website", values: D.latency.map((l) => l.web), color: "#199e70" }], height: 260, fmt: (x) => x + " ms", yfmt: (x) => Math.round(x) + "ms", label: "Response times" });
    $("#ssv").innerHTML = D.services.map((s) => `<div class="svc"><span class="st ${s.st}"><i></i></span><div class="grow"><b>${esc(s.name)}</b><small>${esc(s.desc)}</small></div><span class="ms">${full(s.ms)} ms</span></div>`).join("");
    $("#sres").innerHTML = [["CPU", 23, ""], ["Memory", 61, ""], ["Disk (databases)", 78, "w"], ["Discord rate limit headroom", 88, ""]].map(([a, p, c]) => `<div class="row"><div class="grow"><b>${a}</b><div class="meter mt"><i class="${c}" data-w="${p}"></i></div></div><b>${p}%</b></div>`).join("");
    $$("#sres .meter i").forEach((i) => { i.style.width = i.dataset.w + "%"; });
    $("#serr").innerHTML = D.errors.slice(0, 5).map((e) => `<li class="${e.level === "Error" ? "b" : e.level === "Warning" ? "w" : ""}"><b>${esc(e.title)}</b><small>${esc(e.where)} · ${ago(e.time)}</small></li>`).join("");
    $("#sref").addEventListener("click", () => { busy(v, () => { $$(".chart", v).forEach((c) => c.classList.remove("busy")); toast("Status refreshed"); }); });
  };

  // REPORTS
  R.reports = (v) => {
    v.innerHTML = `<div class="phead"><div><h1>Reports <span class="sample">Sample data</span></h1><p>Download statistics as CSV or JSON for spreadsheets.</p></div></div>
      <div class="filters"><label for="rpr" class="muted">Period</label><select class="sel" id="rpr"><option value="7">Last 7 days</option><option value="30" selected>Last 30 days</option><option value="90">Last 90 days</option><option value="365">Last 12 months</option></select><select class="sel" id="rpf" aria-label="Format"><option>CSV</option><option>JSON</option></select></div>
      <div class="grid g2" id="rpl"></div>
      <section class="card mt"><div class="ch"><h2><img src="img/clock.png" alt="">Scheduled reports</h2></div><div class="rows">${[["Weekly summary", "Every Monday 09:00, to the dev log channel", true], ["Monthly growth report", "1st of every month, by DM to Marcel", true], ["Daily error digest", "Every day 08:00, only when there are errors", false]].map(([a, b, on]) => `<div class="row"><div class="grow"><b>${a}</b><small>${b}</small></div>${tog(a, on)}</div>`).join("")}</div></section>`;
    const REP = [
      ["Website traffic", "chart_up", "Page views, unique visitors per day", (n) => [["date", "page_views", "unique_visitors"], lastN(n).map((i) => [iso(D.days[i]), D.visits[i], D.uniques[i]])]],
      ["User growth", "task_user", "New accounts, verified accounts, active users", (n) => [["date", "registrations", "verified", "active_users"], lastN(n).map((i) => [iso(D.days[i]), D.regs[i], D.verified[i], D.active[i]])]],
      ["Command usage", "lightning", "Uses per command for the period", (n) => { const tot = sum(lastN(n).map((i) => D.cmds[i])); return [["command", "category", "uses", "share_percent"], D.COMMANDS.map((c) => [c.name, c.cat, Math.round(tot * c.share), (c.share * 100).toFixed(1)])]; }],
      ["Trading", "swap", "Trade ads posted and trades checked per day", (n) => [["date", "trade_ads", "trades_checked"], lastN(n).map((i) => [iso(D.days[i]), D.ads[i], D.trades[i]])]],
      ["Value lookups", "dollar", "Lookups per day plus the current value list", (n) => [["date", "value_lookups"], lastN(n).map((i) => [iso(D.days[i]), D.lookups[i]])]],
      ["Moderation", "shield", "Warnings, mutes and bans", () => [["discord", "warnings", "status"], D.users.filter((u) => u.warns).map((u) => [u.discord, u.warns, u.status])]],
    ];
    $("#rpl").innerHTML = REP.map(([t, i, d], k) => `<div class="rep"><img src="${ic(i)}" alt=""><div class="grow"><b>${t}</b><small>${d}</small></div><button class="btn g-blue sm" type="button" data-k="${k}">Download</button></div>`).join("");
    $$("#rpl [data-k]").forEach((b) => b.addEventListener("click", () => {
      const r = REP[+b.dataset.k], n = +$("#rpr").value, [head, rows] = r[3](n);
      const name = "bloombot-" + r[0].toLowerCase().replace(/\s+/g, "-") + "-" + n + "d";
      if ($("#rpf").value === "JSON") download(name + ".json", JSON.stringify(rows.map((row) => Object.fromEntries(head.map((h, i) => [h, row[i]]))), null, 2), "application/json");
      else downloadCsv(name + ".csv", head, rows);
    }));
    wireToggles(v);
  };
  const lastN = (n) => Array.from({ length: n }, (_, i) => N - n + i);
  function download(name, text, type) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([text], { type }));
    a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    toast("Downloaded " + name, "calculator");
  }
  function downloadCsv(name, head, rows) {
    const q = (x) => { const s = String(x == null ? "" : x); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
    download(name, [head, ...rows].map((r) => r.map(q).join(",")).join("\n"), "text/csv");
  }

  // ---------- router ----------
  function go() {
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
    const sh = $(".si.on"); if (sh && sh.scrollIntoViewIfNeeded) sh.scrollIntoViewIfNeeded();
    scrollTo(0, 0);
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
    // collapse + mobile menu
    const app = $(".app");
    try { if (localStorage.getItem("bb_admin_side") === "1") app.classList.add("collapsed"); } catch (e) { /* ignore */ }
    $("#collapse").addEventListener("click", () => {
      app.classList.toggle("collapsed");
      try { localStorage.setItem("bb_admin_side", app.classList.contains("collapsed") ? "1" : "0"); } catch (e) { /* ignore */ }
      setTimeout(() => window.dispatchEvent(new Event("resize")), 240);
    });
    $("#burger").addEventListener("click", () => app.classList.add("mopen"));
    $(".sideshade").addEventListener("click", () => app.classList.remove("mopen"));

    // notifications
    const np = $("#npop");
    const drawN = () => {
      const un = D.notifs.filter((n) => n.unread).length;
      $("#ndot").textContent = un; $("#ndot").hidden = !un;
      np.innerHTML = `<div class="ph">Notifications<button type="button" id="nall">Mark all read</button></div>` + D.notifs.map((n, i) => `<a class="pi${n.unread ? " unread" : ""}" href="#${n.go}" data-i="${i}"><img src="${ic(n.icon)}" alt=""><span class="grow"><span>${esc(n.t)}</span><small>${esc(n.s)} · ${n.ago} ago</small></span></a>`).join("");
      $("#nall").addEventListener("click", (e) => { e.stopPropagation(); D.notifs.forEach((n) => { n.unread = false; }); drawN(); });
      $$("a.pi", np).forEach((a) => a.addEventListener("click", () => { D.notifs[+a.dataset.i].unread = false; np.classList.remove("open"); drawN(); }));
    };
    drawN();
    popToggle($("#nbtn"), np);
    // profile
    popToggle($("#mebtn"), $("#mepop"));
    $$("#mepop [data-t]").forEach((b) => b.addEventListener("click", () => { $("#mepop").classList.remove("open"); toast(b.dataset.t, "gear"); }));
    document.addEventListener("click", (e) => { if (!e.target.closest(".pop")) $$(".pop.open").forEach((p) => p.classList.remove("open")); });

    // global search
    const inp = $("#gs"), res = $("#gres");
    let act = 0, items = [];
    const run = () => {
      const q = inp.value.trim().toLowerCase();
      if (!q) { res.classList.remove("open"); return; }
      const pages = Object.values(PAGES).filter((p) => p.label.toLowerCase().includes(q) || p.id.includes(q)).slice(0, 4).map((p) => ({ kind: "Pages", label: p.label, sub: p.group, icon: ic(p.icon), go: () => { location.hash = p.id; } }));
      const users = D.users.filter((u) => u.discord.includes(q) || u.roblox.toLowerCase().includes(q) || u.id.startsWith(q)).slice(0, 5).map((u) => ({ kind: "Users", label: u.discord, sub: u.verified ? "Roblox: " + u.roblox : "Not verified", icon: u.avatar, go: () => { if (location.hash !== "#users") location.hash = "users"; setTimeout(() => openUser(u), 60); } }));
      const units = D.values.filter((u) => u.name.toLowerCase().includes(q)).slice(0, 3).map((u) => ({ kind: "Units", label: u.name, sub: "Value " + full(u.value), icon: u.img, go: () => { location.hash = "values"; } }));
      const cmds = D.COMMANDS.filter((c) => c.name.includes(q)).slice(0, 3).map((c) => ({ kind: "Commands", label: c.name, sub: c.cat, icon: ic("lightning"), go: () => { location.hash = "commands"; } }));
      items = [...pages, ...users, ...units, ...cmds];
      act = 0;
      let last = "";
      res.innerHTML = items.length ? items.map((it, i) => `${it.kind !== last ? `<div class="lab">${(last = it.kind)}</div>` : ""}<button type="button" class="pi${i === 0 ? " act" : ""}" data-i="${i}" role="option"><img src="${esc(it.icon)}" alt=""><span><span>${esc(it.label)}</span><small>${esc(it.sub)}</small></span></button>`).join("") : '<div class="empty">No results for “' + esc(q) + '”</div>';
      $$("button.pi", res).forEach((b) => b.addEventListener("click", () => pickIt(+b.dataset.i)));
      res.classList.add("open");
    };
    const pickIt = (i) => { const it = items[i]; if (!it) return; res.classList.remove("open"); inp.value = ""; inp.blur(); it.go(); };
    inp.addEventListener("input", run);
    inp.addEventListener("focus", run);
    inp.addEventListener("keydown", (e) => {
      const bs = $$("button.pi", res);
      if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); act = (act + (e.key === "ArrowDown" ? 1 : -1) + bs.length) % Math.max(1, bs.length); bs.forEach((b, i) => b.classList.toggle("act", i === act)); if (bs[act]) bs[act].scrollIntoView({ block: "nearest" }); }
      if (e.key === "Enter") { e.preventDefault(); pickIt(act); }
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

  buildNav();
  initTop();
  addEventListener("hashchange", go);
  go();
})();
