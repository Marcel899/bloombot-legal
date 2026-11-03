/* Values page: every unit and gamepass with its picture, value, demand and trend. */
(() => {
  const $ = id => document.getElementById(id);
  const { el } = BB;
  let items = [], cat = "all";
  const RARITY_ORDER = ["leaderboard", "exclusive", "godly", "secret", "mythic", "legendary", "epic", "rare", "uncommon", "common", "item"];
  const cap = s => (s || "").replace(/\b\w/g, c => c.toUpperCase());
  const demandNum = d => { const m = String(d || "").match(/[\d.]+/); return m ? parseFloat(m[0]) : -1; };

  function changeBadge(ch) {
    if (ch == null) return null;
    const b = el("span", "chg " + (ch > 0 ? "up" : ch < 0 ? "down" : "flat"), (ch > 0 ? "+" : "") + ch + "%");
    b.title = "Change in the last 30 days";
    return b;
  }

  function card(it) {
    const c = el("button", "vcard");
    c.type = "button";
    c.onclick = () => open(it);
    const top = el("div", "vtop");
    top.append(BB.itemImg(it, "vimg"));
    const t = el("div", "vtitle");
    t.append(el("strong", null, it.name));
    if (it.rarity) t.append(el("span", "rar r-" + it.rarity.toLowerCase().replace(/\W/g, ""), cap(it.rarity)));
    top.append(t);
    const val = el("div", "vval");
    val.append(el("span", "vnum", it.est > 0 ? BB.fmt(it.est) : (it.value_text || "N/A")));
    if (it.oc) val.append(el("span", "oc", "O/C"));
    const badge = changeBadge(it.change_30d);
    if (badge) val.append(badge);
    const meta = el("div", "vmeta");
    meta.append(el("span", null, "Demand " + (it.demand || "?")), el("span", null, it.status || ""));
    const spark = el("div", "spark");
    spark.innerHTML = BB.chart(it.history, 200, 40);
    c.append(top, val, meta, spark);
    return c;
  }

  function render() {
    const q = $("vq").value.trim().toLowerCase(), r = $("vrar").value, sort = $("vsort").value;
    let list = items.filter(it => (cat === "all" || it.category === cat) && (!r || (it.rarity || "").toLowerCase() === r) &&
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
    $("vgrid").replaceChildren(...list.map(card));
    $("vnone").hidden = list.length > 0;
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
    ch.innerHTML = BB.chart(it.history, 600, 200, { labels: true, pad: 6 }) || "<p class='empty'>No price history yet.</p>";
    const acts = el("div", "vm-acts");
    const add = el("a", "brick green sm", "Add to trade calculator");
    add.href = "calculator.html#give=" + encodeURIComponent(it.name);
    acts.append(add);
    body.append(head, stats, ch, acts);
    m.hidden = false;
    document.body.classList.add("noscroll");
    $("vmclose").focus();
  }
  function close() { $("vmodal").hidden = true; document.body.classList.remove("noscroll"); }
  $("vmclose").onclick = close;
  $("vmodal").onclick = e => { if (e.target.id === "vmodal") close(); };
  document.addEventListener("keydown", e => { if (e.key === "Escape" && !$("vmodal").hidden) close(); });

  document.querySelectorAll(".chip[data-cat]").forEach(b => b.onclick = () => {
    cat = b.dataset.cat;
    document.querySelectorAll(".chip[data-cat]").forEach(x => x.classList.toggle("on", x === b));
    render();
  });
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
      $("vloading").textContent = "Couldn't load values. Try again in a minute.";
      return;
    }
    $("vloading").hidden = true;
    const rars = [...new Set(items.map(i => (i.rarity || "").toLowerCase()).filter(Boolean))]
      .sort((a, b) => (RARITY_ORDER.indexOf(a) + 99) % 99 - (RARITY_ORDER.indexOf(b) + 99) % 99);
    rars.forEach(r => { const o = el("option", null, cap(r)); o.value = r; $("vrar").append(o); });
    const newest = items.map(i => i.updated_at).filter(Boolean).sort().pop();
    if (newest) $("vupdated").textContent = "Synced " + BB.ago(newest);
    render();
  });
})();
