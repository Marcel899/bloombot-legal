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

  /* The latest price move in the history, for when there's no clean 30-day trend. */
  function lastMove() {
    const h = (it.history || []).filter(p => p[1] > 0);
    for (let i = h.length - 1; i > 0; i--) {
      if (h[i][1] !== h[i - 1][1]) return { from: h[i - 1][1], to: h[i][1], date: h[i][0], pct: Math.round((h[i][1] - h[i - 1][1]) / h[i - 1][1] * 1000) / 10 };
    }
    return null;
  }
  const day = d => new Date(d).toLocaleDateString(undefined, { day: "numeric", month: "short" });

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
    if (it.category === "gamepasses") tags.append(el("span", "u-cat", "Gamepass"));
    const rank = all.filter(x => x.category === it.category && x.est > it.est).length + 1;
    if (it.est > 0) { const r = el("span", "u-rank", "#" + rank + " by value"); r.title = "#" + rank + " most valuable " + (it.category === "gamepasses" ? "gamepass" : "unit"); tags.append(r); }
    t.append(h, tags);
    head.append(img, t);

    const stats = el("div", "u-stats");
    const stat = (k, v, cls) => { const s = el("div", "u-stat" + (cls ? " " + cls : "")); s.append(el("span", null, k), v); return s; };
    const val = el("strong", "u-val", it.est > 0 ? BB.fmt(it.est) : (it.value_text || "N/A"));
    if (it.oc) { const oc = el("span", "oc", "O/C"); oc.title = "Owner's choice: no fixed value"; val.append(oc); }
    stats.append(stat("Value", val, "big"));
    const ch = it.change_30d, mv = ch == null ? lastMove() : null;
    if (ch != null) stats.append(stat("30 days", el("strong", "chg " + (ch > 0 ? "up" : ch < 0 ? "down" : "flat"), (ch > 0 ? "+" : "") + ch + "%")));
    else if (mv) {
      /* No clean 30-day trend (the list was catching up): show its latest move instead. */
      const v = el("div", "u-move");
      v.append(el("strong", "chg " + (mv.pct > 0 ? "up" : mv.pct < 0 ? "down" : "flat"), (mv.pct > 0 ? "+" : "") + mv.pct + "%"), el("small", null, day(mv.date)));
      stats.append(stat("Last change", v));
    } else stats.append(stat("30 days", el("strong", "u-none", "No changes yet")));
    stats.append(stat("Demand", demand(it.demand)));
    stats.append(stat("Status", el("strong", "vst st-" + statusKind(it.status), it.status || "?")));

    const acts = el("div", "u-acts");
    const calc = el("a", "brick green sm", "Check a trade");
    calc.href = "calculator.html#give=" + encodeURIComponent(it.name).replace(/%20/g, "_");
    /* Trade ad: "I have it" puts it on your side, "I want it" on theirs. */
    const ad = el("div", "u-adpick");
    ad.setAttribute("role", "group");
    ad.setAttribute("aria-label", "Post a trade ad");
    const have = el("a", null, "I have it");
    have.href = "trades.html#have=" + encodeURIComponent(it.name);
    have.title = "Post a trade ad offering " + it.name;
    const want = el("a", null, "I want it");
    want.href = "trades.html#want=" + encodeURIComponent(it.name);
    want.title = "Post a trade ad asking for " + it.name;
    ad.append(el("span", null, "Trade ad"), have, want);
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
    acts.append(calc, ad, star);
    const slot = el("div", "u-alert-slot");
    slot.id = "ualert";
    acts.append(slot);

    const when = el("p", "u-when");
    when.append((it.updated_at ? "Updated " + BB.ago(it.updated_at) + " · " : "") + "An estimate from the ");
    const a = el("a", null, "official Garden TD value list");
    a.href = "https://sites.google.com/view/garden-td-values/main-page";
    a.target = "_blank"; a.rel = "noopener";
    when.append(a, ".");
    c.append(head, stats, acts, when, BB.copyLinkBtn(location.origin + "/" + BB.unitUrl(it.name), it.name + " value · Bloombot"));
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
      q("Is " + it.name + " going up or down?", (() => {
        const mv = lastMove();
        const trend = it.change_30d != null ? "Over the last 30 days it moved " + (it.change_30d > 0 ? "+" : "") + it.change_30d + "%."
          : mv ? "Its last price change was " + (mv.pct > 0 ? "+" : "") + mv.pct + "% on " + day(mv.date) + " (" + BB.fmt(mv.from) + " → " + BB.fmt(mv.to) + ")."
          : "No price changes are recorded yet.";
        return trend + (it.status ? " The value list marks it as " + it.status.toLowerCase() + "." : "");
      })()),
    );
    $("uabout").replaceChildren(el("h2", null, "About " + it.name), list);
  }

  function missing() {
    const box = el("div", "u-miss");
    box.append(el("h1", null, "Unit not found"), el("p", "hint", "We couldn't find that unit on the value list. It may have been renamed or spelled differently."));
    /* "Did you mean": units sharing a word with the address */
    const words = slug.split("-").filter(w => w.length > 2);
    const near = all.map(x => [words.filter(w => BB.unitSlug(x.name).includes(w)).length, x]).filter(([n]) => n > 0)
      .sort((a, b) => b[0] - a[0] || b[1].est - a[1].est).slice(0, 6).map(([, x]) => x);
    if (near.length) {
      const g = el("div", "u-sim");
      near.forEach(x => {
        const a = el("a", "u-simc");
        a.href = BB.unitUrl(x.name);
        const t = el("span", "u-simt");
        t.append(el("strong", null, x.name), el("span", null, x.est > 0 ? BB.fmt(x.est) : x.value_text || ""));
        a.append(BB.itemImg(x, "u-simi"), t);
        g.append(a);
      });
      box.append(el("h2", "u-h", "Did you mean"), g);
    }
    const a = el("a", "brick blue sm", "Browse all values");
    a.href = "values.html";
    box.append(a);
    $("ucard").replaceChildren(box);
    $("ucrumb").textContent = "Not found";
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
