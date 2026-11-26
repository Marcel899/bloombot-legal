/* One unit's own page: /units/<slug> (or unit.html?u=<slug>).
   Value, demand, status and price history from the value list, live trade ads
   with the unit, and units worth about the same. The deploy build pre-renders a
   copy per unit with its name and value baked in for search engines; this
   script then draws the live version over it. */
(() => {
  const $ = id => document.getElementById(id);
  const { el } = BB;
  const cap = s => (s || "").replace(/[-_]+/g, " ").replace(/\b\w/g, c => c.toUpperCase());
  const demandNum = d => { const m = String(d || "").match(/[\d.]+/); return m ? parseFloat(m[0]) : -1; };
  const statusKind = st => {
    const s = String(st || "").toLowerCase();
    return /ris|up|incr/.test(s) ? "up" : /drop|fall|down|decr/.test(s) ? "down" : /over|infl/.test(s) ? "over" : /under/.test(s) ? "under" : /stab/.test(s) ? "stable" : "other";
  };
  const fromPath = (location.pathname.match(/\/units\/([a-z0-9-]+)\/?$/) || [])[1];
  const slug = fromPath || new URLSearchParams(location.search).get("u") || "";
  let it = null, all = [];

  function setMeta(name, value) {
    document.title = name + " value in Garden Tower Defense · Bloombot";
    const d = document.querySelector('meta[name="description"]');
    if (d) d.setAttribute("content", name + " is worth " + value + " in Garden Tower Defense trades. Live value, demand, 30-day trend and trade ads on Bloombot.");
  }

  function demand(d) {
    const n = demandNum(d), box = el("div", "u-dem");
    if (n >= 0 && n <= 10) {
      const pips = el("span", "pips " + (n >= 7 ? "hi" : n >= 4 ? "mid" : "lo"));
      for (let i = 1; i <= 10; i++) pips.append(el("i", i <= Math.round(n) ? "on" : null));
      box.append(pips, el("b", null, Math.round(n * 10) / 10 + "/10"));
    } else box.append(el("b", null, d || "?"));
    return box;
  }

  function card() {
    const c = $("ucard");
    c.replaceChildren();
    const head = el("div", "u-head");
    const img = BB.itemImg(it, "u-img");
    img.loading = "eager";
    const t = el("div", "u-title");
    const h = el("h1", null, it.name);
    const tags = el("div", "u-tags");
    if (it.rarity) tags.append(el("span", "rar r-" + it.rarity.toLowerCase().replace(/\W/g, ""), cap(it.rarity)));
    tags.append(el("span", "u-cat", it.category === "gamepasses" ? "Gamepass" : "Unit"));
    const rank = all.filter(x => x.category === it.category && x.est > it.est).length + 1;
    if (it.est > 0) tags.append(el("span", "u-rank", "#" + rank + " most valuable " + (it.category === "gamepasses" ? "gamepass" : "unit")));
    t.append(h, tags);
    head.append(img, t);

    const stats = el("div", "u-stats");
    const stat = (k, v, cls) => { const s = el("div", "u-stat" + (cls ? " " + cls : "")); s.append(el("span", null, k), v); return s; };
    const val = el("strong", "u-val", it.est > 0 ? BB.fmt(it.est) : (it.value_text || "N/A"));
    if (it.oc) { const oc = el("span", "oc", "O/C"); oc.title = "Owner's choice: no fixed value"; val.append(oc); }
    stats.append(stat("Value", val, "big"));
    const ch = it.change_30d;
    stats.append(stat("30 days", el("strong", "chg " + (ch > 0 ? "up" : ch < 0 ? "down" : "flat"), ch == null ? "–" : (ch > 0 ? "+" : "") + ch + "%")));
    stats.append(stat("Demand", demand(it.demand)));
    stats.append(stat("Status", el("strong", "vst st-" + statusKind(it.status), it.status || "?")));

    const acts = el("div", "u-acts");
    const calc = el("a", "brick green sm", "Check a trade");
    calc.href = "calculator.html#give=" + encodeURIComponent(it.name).replace(/%20/g, "_");
    const have = el("a", "brick purple sm", "Trade it away");
    have.href = "trades.html#have=" + encodeURIComponent(it.name);
    have.title = "Start a trade ad offering " + it.name;
    const want = el("a", "brick blue sm", "Look for it");
    want.href = "trades.html#want=" + encodeURIComponent(it.name);
    want.title = "Start a trade ad asking for " + it.name;
    const star = el("button", "brick yellow sm");
    star.type = "button";
    const label = () => {
      const i = el("img"); i.src = "img/wish_star.png"; i.alt = "";
      star.replaceChildren(i, BB.favs.has(it.name) ? "Watching" : "Watch");
      star.classList.toggle("on", BB.favs.has(it.name));
    };
    label();
    star.onclick = () => {
      const on = BB.favs.toggle(it.name);
      label();
      BB.toast(it.name, on ? "ok" : "info", { title: on ? "Added to your watchlist" : "Removed from your watchlist" });
    };
    const share = el("button", "brick dark sm", "Copy link");
    share.type = "button";
    share.onclick = () => BB.share(location.origin + "/" + BB.unitUrl(it.name), it.name + " value · Bloombot");
    acts.append(calc, have, want, star, share);
    const slot = el("div", "u-alert-slot");
    slot.id = "ualert";
    acts.append(slot);

    const when = el("p", "u-when");
    if (it.updated_at) when.append("Value list checked " + BB.ago(it.updated_at) + ". ");
    when.append("Values are estimates from the ");
    const a = el("a", null, "official Garden TD value list");
    a.href = "https://sites.google.com/view/garden-td-values/main-page";
    a.target = "_blank"; a.rel = "noopener";
    when.append(a, ".");
    c.append(head, stats, acts, when);
    c.classList.add("ready");
    document.dispatchEvent(new CustomEvent("bb:unit", { detail: it }));
  }

  function chart() {
    BB.interactiveChart($("uchart"), it.history);
    const box = $("uchanges");
    box.replaceChildren();
    const hist = (it.history || []).filter(p => p[1] > 0);
    if (hist.length < 2) { box.append(el("p", "hint", "No price changes recorded yet.")); return; }
    const ul = el("ul", "u-changes");
    for (let i = hist.length - 1; i > 0 && ul.childElementCount < 6; i--) {
      const [d, v] = hist[i], prev = hist[i - 1][1];
      const pct = Math.round((v - prev) / prev * 1000) / 10;
      const li = el("li");
      li.append(el("span", null, new Date(d).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })),
        el("strong", null, BB.fmt(prev) + " → " + BB.fmt(v)), el("em", pct >= 0 ? "up" : "down", (pct > 0 ? "+" : "") + pct + "%"));
      ul.append(li);
    }
    box.append(ul);
  }

  function similar() {
    const pool = all.filter(x => x !== it && x.category === it.category && x.est > 0);
    const near = it.est > 0 ? pool.sort((a, b) => Math.abs(a.est - it.est) - Math.abs(b.est - it.est)).slice(0, 8).sort((a, b) => b.est - a.est) : pool.slice(0, 8);
    $("usim").replaceChildren(...near.map(x => {
      const a = el("a", "u-simc");
      a.href = BB.unitUrl(x.name);
      const t = el("span", "u-simt");
      t.append(el("strong", null, x.name), el("span", null, BB.fmt(x.est)));
      const d = x.est - it.est;
      a.append(BB.itemImg(x, "u-simi"), t, el("em", d > 0 ? "up" : d < 0 ? "down" : "flat", d === 0 ? "same" : (d > 0 ? "+" : "−") + BB.fmt(Math.abs(d))));
      return a;
    }));
    $("usim-sec").hidden = !near.length;
  }

  /* Trade ads are only shown to logged-in traders, same as the trade ads page. */
  async function ads(session) {
    const box = $("uads");
    $("uadsn").textContent = it.name;
    $("uadsall").href = "trades.html?q=" + encodeURIComponent(it.name);
    if (!session) {
      const p = el("p", "hint", "Log in to see live trade ads with " + it.name + ".");
      const b = el("button", "brick discord sm", "Log in");
      b.type = "button";
      b.onclick = () => BB.login();
      box.replaceChildren(p, b);
      return;
    }
    const id = (String(it.icon_url || "").match(/emojis\/(\d{15,22})/) || [])[1];
    const name = it.name.toLowerCase();
    const { data } = await BB.sb.from("trade_ads").select("id,discord_id,discord_name,discord_avatar,content,created_at,expires_at")
      .order("created_at", { ascending: false }).limit(500);
    const now = Date.now();
    const hits = (data || []).filter(a => (!a.expires_at || new Date(a.expires_at) > now) &&
      ((id && String(a.content).includes(id)) || String(a.content).toLowerCase().replace(/_/g, " ").includes(name))).slice(0, 6);
    if (!hits.length) {
      box.replaceChildren(el("p", "hint", "No live trade ads with " + it.name + " right now."));
      return;
    }
    box.replaceChildren(...hits.map(a => {
      const c = el("a", "u-ad");
      c.href = "profile.html?id=" + encodeURIComponent(a.discord_id);
      c.dataset.name = a.discord_name || "";
      const av = el("img", "u-adav");
      av.alt = "";
      av.src = BB.safeUrl(a.discord_avatar) || "img/flower.png";
      av.onerror = () => { av.src = "img/flower.png"; };
      const t = el("div", "u-adt");
      const top = el("div", "u-adtop");
      top.append(el("strong", null, BB.plain(a.discord_name || "") || "Trader"), el("span", null, BB.ago(a.created_at)));
      t.append(top, BB.md(a.content, { cls: "tc-text" }));
      c.append(av, t);
      return c;
    }));
  }

  function about() {
    const n = demandNum(it.demand);
    const q = (h, p) => { const d = el("div", "guide-q"); d.append(el("h3", null, h), el("p", null, p)); return d; };
    const list = el("div", "guide-list");
    list.append(
      q("How much is " + it.name + " worth?", it.name + " is worth about " + (it.est > 0 ? BB.fmt(it.est) : it.value_text || "an unlisted amount") +
        " in Garden Tower Defense trades" + (it.oc ? ", but it's owner's choice, so sellers set their own price." : ".")),
      q("Is " + it.name + " in demand?", n >= 0 ? "Its demand is " + Math.round(n * 10) / 10 + " out of 10, which is " +
        (n >= 7 ? "high: it trades fast." : n >= 4 ? "medium: you'll find takers with some patience." : "low: expect to wait or add more.") : "There is no demand rating for it yet."),
      q("Is " + it.name + " going up or down?", (it.change_30d == null ? "There isn't 30 days of history yet." :
        "Over the last 30 days it moved " + (it.change_30d > 0 ? "+" : "") + it.change_30d + "%.") + (it.status ? " The value list marks it as " + it.status.toLowerCase() + "." : "")),
    );
    $("uabout").replaceChildren(el("h2", null, "About " + it.name), list);
  }

  function missing() {
    $("ucard").replaceChildren(el("h1", null, "Unit not found"),
      el("p", "hint", "We couldn't find that unit on the value list. It may have been renamed."));
    const a = el("a", "brick blue sm", "Browse all values");
    a.href = "values.html";
    $("ucard").append(a);
    ["usec", "usim-sec", "uabout"].forEach(id => { $(id).hidden = true; });
    document.title = "Unit not found · Bloombot";
  }

  let session = null, drawn = false;
  BB.onAuth(async s => {
    session = s;
    if (!drawn) {
      drawn = true;
      try { all = await BB.loadValues(); } catch (e) { $("uline") && ($("uline").textContent = "Couldn't load values. Try again in a minute."); return; }
      it = all.find(x => BB.unitSlug(x.name) === slug);
      if (!it) { missing(); return; }
      setMeta(it.name, it.est > 0 ? BB.fmt(it.est) : it.value_text || "N/A");
      $("ucrumb").textContent = it.name;
      card();
      chart();
      similar();
      about();
    }
    if (it) ads(session).catch(() => { $("uads").replaceChildren(el("p", "hint", "Couldn't load trade ads.")); });
  });
})();
