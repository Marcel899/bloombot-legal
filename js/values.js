/* Values page: every unit and gamepass with its picture, value, demand and trend. */
(() => {
  const $ = id => document.getElementById(id);
  const { el } = BB;
  let items = [], cat = "all", favs = BB.favs.all();
  const RARITY_ORDER = ["leaderboard", "exclusive", "godly", "secret", "mythic", "legendary", "epic", "rare", "uncommon", "common", "item"];
  const cap = s => (s || "").replace(/[-_]+/g, " ").replace(/\b\w/g, c => c.toUpperCase());
  const demandNum = d => { const m = String(d || "").match(/[\d.]+/); return m ? parseFloat(m[0]) : -1; };

  function changeBadge(ch) {
    if (ch == null) return null;
    const b = el("span", "chg " + (ch > 0 ? "up" : ch < 0 ? "down" : "flat"), (ch > 0 ? "+" : "") + ch + "%");
    b.title = "Change in the last 30 days";
    return b;
  }

  const statusKind = st => {
    const s = String(st || "").toLowerCase();
    return /ris|up|incr/.test(s) ? "up" : /drop|fall|down|decr/.test(s) ? "down" : /over/.test(s) ? "over" : /under/.test(s) ? "under" : /stab/.test(s) ? "stable" : "other";
  };
  function demandBar(d) {
    const n = demandNum(d), box = el("span", "vdem");
    box.append(el("span", "vdem-l", "Demand"));
    if (n >= 0 && n <= 10) {
      const pips = el("span", "pips " + (n >= 7 ? "hi" : n >= 4 ? "mid" : "lo"));
      for (let i = 1; i <= 10; i++) pips.append(el("i", i <= Math.round(n) ? "on" : null));
      pips.title = "Demand " + d;
      box.append(pips, el("b", null, Math.round(n * 10) / 10 + "/10"));
    } else box.append(el("b", null, d || "?"));
    return box;
  }

  function card(it, rank) {
    const c = el("button", "vcard");
    c.type = "button";
    c.onclick = () => open(it);
    if (rank) c.append(el("span", "vrank" + (rank <= 3 ? " top" + rank : ""), "#" + rank));
    const top = el("div", "vtop");
    top.append(BB.itemImg(it, "vimg"));
    const t = el("div", "vtitle");
    t.append(el("strong", null, it.name));
    if (it.rarity) t.append(el("span", "rar r-" + it.rarity.toLowerCase().replace(/\W/g, ""), cap(it.rarity)));
    top.append(t);
    if (favs.has(it.name)) { const st = el("span", "vstar", "★"); st.title = "On your watchlist"; top.append(st); }
    const val = el("div", "vval");
    val.append(el("span", "vnum", it.est > 0 ? BB.fmt(it.est) : (it.value_text || "N/A")));
    if (it.oc) { const oc = el("span", "oc", "O/C"); oc.title = "Owner's choice: no fixed value"; val.append(oc); }
    const badge = changeBadge(it.change_30d);
    if (badge) val.append(badge);
    if (it.status) val.append(el("span", "vst st-" + statusKind(it.status), it.status));
    const meta = el("div", "vmeta");
    meta.append(demandBar(it.demand));
    const spark = el("div", "spark");
    spark.innerHTML = BB.chart(it.history, 200, 40);
    c.append(top, val, meta, spark);
    return c;
  }

  let view = "grid";
  try { view = localStorage.getItem("bb-vview") === "list" ? "list" : "grid"; } catch (e) { /* blocked */ }
  function setView(v) {
    view = v;
    $("vgrid").classList.toggle("list", v === "list");
    document.querySelectorAll("[data-view]").forEach(b => { b.classList.toggle("on", b.dataset.view === v); b.setAttribute("aria-pressed", b.dataset.view === v); });
    try { localStorage.setItem("bb-vview", v); } catch (e) { /* blocked */ }
  }
  setView(view);
  document.querySelectorAll("[data-view]").forEach(b => { b.onclick = () => setView(b.dataset.view); });

  const PAGE = 60;
  let shown = PAGE, lastKey = "";
  function render() {
    const q = $("vq").value.trim().toLowerCase(), r = $("vrar").value, sort = $("vsort").value;
    let list = items.filter(it => (cat === "all" || it.category === cat || (cat === "fav" && favs.has(it.name))) && (!r || (it.rarity || "").toLowerCase() === r) &&
      (!q || it.name.toLowerCase().includes(q)));
    const by = {
      value: (a, b) => b.est - a.est,
      low: (a, b) => (a.est || 1e12) - (b.est || 1e12),
      name: (a, b) => a.name.localeCompare(b.name),
      demand: (a, b) => demandNum(b.demand) - demandNum(a.demand) || b.est - a.est,
      up: (a, b) => (b.change_30d ?? -1e9) - (a.change_30d ?? -1e9),
      down: (a, b) => (a.change_30d ?? 1e9) - (b.change_30d ?? 1e9),
    }[sort];
    list.sort(by);
    const key = [q, r, sort, cat].join("|");
    if (key !== lastKey) { shown = PAGE; lastKey = key; }
    const ranked = sort === "value";
    $("vgrid").replaceChildren(...list.slice(0, shown).map((it, i) => card(it, ranked ? i + 1 : 0)));
    const more = $("vmore");
    more.hidden = list.length <= shown;
    more.innerHTML = `<span>Show ${Math.min(PAGE, list.length - shown)} more</span><em>${list.length - shown} left</em><i aria-hidden="true">▾</i>`;
    more.onclick = () => { shown += PAGE; render(); };
    $("vnone").hidden = list.length > 0;
    $("vnone").textContent = cat === "fav" && !favs.size ? "Your watchlist is empty. Open a unit and press Watch to add it." : "No unit matches that.";
    $("vcount").textContent = `${list.length} of ${items.length}`;
  }

  function open(it) {
    const m = $("vmodal");
    const body = $("vmbody");
    body.replaceChildren();
    const head = el("div", "vm-head");
    head.append(BB.itemImg(it, "vm-img"));
    const t = el("div");
    t.append(el("h2", null, it.name));
    if (it.rarity) t.append(el("span", "rar r-" + it.rarity.toLowerCase().replace(/\W/g, ""), cap(it.rarity)));
    head.append(t);
    const stats = el("div", "vm-stats");
    const stat = (k, v) => { const s = el("div", "vm-stat"); s.append(el("span", null, k), el("strong", null, v)); return s; };
    stats.append(stat("Value", it.value_text || BB.fmt(it.est)), stat("Demand", it.demand || "?"), stat("Status", it.status || "?"),
      stat("30 days", it.change_30d == null ? "–" : (it.change_30d > 0 ? "+" : "") + it.change_30d + "%"));
    const ch = el("div", "vm-chart");
    BB.interactiveChart(ch, it.history);
    const changes = el("div", "vm-changes");
    const hist = (it.history || []).filter(p => p[1] > 0);
    if (hist.length > 1) {
      changes.append(el("h3", null, "Recent price changes"));
      const ul = el("ul");
      for (let i = hist.length - 1; i > 0 && ul.childElementCount < 6; i--) {
        const [d, v] = hist[i], prev = hist[i - 1][1];
        const pct = Math.round((v - prev) / prev * 1000) / 10;
        const li = el("li");
        li.append(el("span", null, new Date(d).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })),
          el("strong", null, BB.fmt(prev) + " → " + BB.fmt(v)), el("em", pct >= 0 ? "up" : "down", (pct > 0 ? "+" : "") + pct + "%"));
        ul.append(li);
      }
      changes.append(ul);
    }
    const acts = el("div", "vm-acts");
    const add = el("a", "brick green sm", "Add to trade calculator");
    add.href = "calculator.html#give=" + encodeURIComponent(it.name);
    const star = el("button", "brick yellow sm");
    star.type = "button";
    const label = () => {
      const i = el("img"); i.src = "img/wish_star.png"; i.alt = "";
      star.replaceChildren(i, favs.has(it.name) ? "Watching" : "Watch");
      star.classList.toggle("on", favs.has(it.name));
    };
    label();
    star.onclick = () => {
      const on = BB.favs.toggle(it.name);
      favs = BB.favs.all();
      label();
      BB.toast(it.name, on ? "ok" : "info", { title: on ? "Added to your watchlist" : "Removed from your watchlist",
        action: { label: "Undo", run: () => { BB.favs.toggle(it.name); favs = BB.favs.all(); label(); render(); } } });
      render();
    };
    const share = el("button", "brick dark sm", "Copy link");
    share.type = "button";
    share.onclick = () => BB.share(location.origin + location.pathname + "#" + encodeURIComponent(it.name), it.name + " value · Bloombot");
    acts.append(add, star, share);
    body.append(head, stats, ch, changes, acts);
    m.hidden = false;
    document.body.classList.add("noscroll");
    $("vmclose").focus();
  }
  function close() {
    $("vmodal").hidden = true;
    document.body.classList.remove("noscroll");
    if (location.hash && location.hash !== "#watchlist") history.replaceState(null, "", location.pathname);
  }
  function setCat(c) {
    cat = c;
    document.querySelectorAll(".chip[data-cat]").forEach(x => x.classList.toggle("on", x.dataset.cat === c));
    render();
  }
  function fromHash() {
    if (location.hash === "#watchlist") { setCat("fav"); return; }
    let want = location.hash.slice(1);
    try { want = decodeURIComponent(want); } catch (e) { return; }
    const hit = want && items.find(i => i.name === want);
    if (hit) open(hit);
  }
  addEventListener("hashchange", () => { if (items.length) fromHash(); });
  $("vmclose").onclick = close;
  $("vmodal").onclick = e => { if (e.target.id === "vmodal") close(); };
  document.addEventListener("keydown", e => { if (e.key === "Escape" && !$("vmodal").hidden) close(); });

  document.querySelectorAll(".chip[data-cat]").forEach(b => b.onclick = () => setCat(b.dataset.cat));
  $("vq").oninput = render;
  $("vrar").onchange = render;
  $("vsort").onchange = render;

  let started = false;
  BB.onAuth(async () => {
    if (started) return;
    started = true;
    try {
      items = await BB.loadValues();
    } catch (e) {
      $("vloading").className = "loading";
      $("vloading").textContent = "Couldn't load values. Try again in a minute.";
      return;
    }
    $("vloading").hidden = true;
    /* charts draw in on the first render only, not on every search keystroke */
    $("vgrid").classList.add("intro");
    setTimeout(() => $("vgrid").classList.remove("intro"), 1200);
    const rars = [...new Set(items.map(i => (i.rarity || "").toLowerCase()).filter(Boolean))]
      .sort((a, b) => (RARITY_ORDER.indexOf(a) + 99) % 99 - (RARITY_ORDER.indexOf(b) + 99) % 99);
    rars.forEach(r => { const o = el("option", null, cap(r)); o.value = r; o.dataset.count = items.filter(i => (i.rarity || "").toLowerCase() === r).length; $("vrar").append(o); });
    $("vrar").options[0].dataset.count = items.length;
    const newest = items.map(i => i.updated_at).filter(Boolean).sort().pop();
    if (newest) $("vupdated").textContent = "Synced " + BB.ago(newest);
    render();
    fromHash();
  });
})();
