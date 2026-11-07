/* Home page: live numbers, newest trade ads, biggest value moves, new strategies and the Discord demo. */
(() => {
  const $ = id => document.getElementById(id);
  const { el } = BB;

  function mover(it) {
    const a = el("a", "mover");
    a.href = "values.html#" + encodeURIComponent(it.name);
    a.append(BB.itemImg(it, "mv-img"));
    const n = el("div", "mv-name");
    n.append(el("strong", null, it.name), el("span", null, BB.fmt(it.est || it.value)));
    const ch = el("span", "chg " + (it.change_30d > 0 ? "up" : "down"), (it.change_30d > 0 ? "+" : "") + it.change_30d + "%");
    a.append(n, ch);
    return a;
  }

  function adRow(a) {
    const r = el("a", "had");
    r.href = "trades.html";
    const av = el("img", "had-av");
    av.alt = "";
    av.loading = "lazy";
    av.src = BB.safeUrl(a.discord_avatar) || "img/flower.png";
    av.onerror = () => { av.src = "img/flower.png"; };
    const b = el("div", "had-b");
    const top = el("div", "had-top");
    top.append(el("strong", null, BB.plain(a.discord_name || "") || "Trader"), el("span", null, BB.ago(a.created_at)));
    const t = el("p", "had-t");
    BB.mdInline(t, String(a.content || "").replace(/\n+/g, " "));
    b.append(top, t);
    r.append(av, b);
    return r;
  }

  /* Discord demo tabs */
  const HINTS = {
    post: "Your ad goes to every server running Bloombot, not just one.",
    wish: "Add units to your wishlist and get a DM the moment someone offers one.",
    check: "Right-click any trade message and pick Check trade. Uses live values.",
  };
  const tabs = [...document.querySelectorAll(".dtab")];
  const show = k => {
    for (const t of tabs) { const on = t.dataset.d === k; t.classList.toggle("on", on); t.setAttribute("aria-selected", on); }
    for (const p of document.querySelectorAll(".dpane")) p.hidden = p.dataset.d !== k;
    $("demo-hint").textContent = HINTS[k];
  };
  tabs.forEach((t, i) => {
    t.onclick = () => { show(t.dataset.d); clearInterval(auto); };
    t.onkeydown = e => {
      const d = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
      if (d) { const n = tabs[(i + d + tabs.length) % tabs.length]; n.focus(); n.click(); }
    };
  });
  let k = 0;
  const auto = matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : setInterval(() => {
    if (document.hidden) return;
    k = (k + 1) % tabs.length;
    show(tabs[k].dataset.d);
  }, 6000);

  /* Biggest moves: up / down switch */
  for (const b of document.querySelectorAll(".mv-tabs button")) {
    b.onclick = () => {
      for (const x of document.querySelectorAll(".mv-tabs button")) { const on = x === b; x.classList.toggle("on", on); x.setAttribute("aria-selected", on); }
      $("mv-up").hidden = b.dataset.m !== "up";
      $("mv-down").hidden = b.dataset.m !== "down";
    };
  }

  let started = false;
  BB.onAuth(async () => {
    if (started) return;
    started = true;
    BB.sb.rpc("site_stats").then(({ data }) => {
      if (!data) return;
      $("st-ads").textContent = data.ads;
      $("st-values").textContent = data.values;
      $("st-strats").textContent = data.strategies;
      const big = n => Number(n).toLocaleString("en-US");
      for (const k of ["servers", "users"]) {
        if (data[k] > 0) { $("st-" + k).textContent = big(data[k]); $("st-" + k).parentElement.hidden = false; }
      }
      $("stats").classList.add("ready");
    });
    try {
      const all = await BB.loadValues();
      const items = all.filter(i => i.change_30d != null && i.change_30d !== 0 && i.est >= 100 && i.category !== "gamepasses");
      const up = items.filter(i => i.change_30d > 0).sort((a, b) => b.change_30d - a.change_30d).slice(0, 5);
      const down = items.filter(i => i.change_30d < 0).sort((a, b) => a.change_30d - b.change_30d).slice(0, 5);
      $("mv-up").replaceChildren(...up.map(mover));
      $("mv-down").replaceChildren(...down.map(mover));
      if (up.length || down.length) { $("mv-box").hidden = false; $("now").hidden = false; }
      const favs = BB.favs.all();
      const watched = all.filter(i => favs.has(i.name)).sort((a, b) => b.est - a.est).slice(0, 12);
      if (watched.length) {
        $("wl").replaceChildren(...watched.map(it => {
          const a = mover(it);
          if (it.change_30d == null || it.change_30d === 0) a.querySelector(".chg").replaceWith(el("span", "chg flat", "steady"));
          return a;
        }));
        $("watch").hidden = false;
      }
    } catch (e) { /* values not synced yet */ }
    BB.sb.from("trade_ads").select("id,content,created_at,expires_at,discord_name,discord_avatar").order("created_at", { ascending: false }).limit(12).then(({ data }) => {
      const now = Date.now();
      const live = (data || []).filter(a => !a.expires_at || new Date(a.expires_at) > now).slice(0, 4);
      if (!live.length) return;
      $("hads").replaceChildren(...live.map(adRow));
      $("hads-box").hidden = false;
      $("now").hidden = false;
    });
    const { data: strats } = await BB.sb.from("strategies").select("id,title,category,author_name").order("id", { ascending: false }).limit(3);
    if (strats && strats.length) {
      $("hs-list").replaceChildren(...strats.map(s => {
        const a = el("a", "hs");
        a.href = "strategies.html";
        const t = el("strong");
        BB.mdInline(t, s.title.replace(/^#{1,3} /, ""));
        a.append(t, el("span", null, (s.author_name || "Bloombot player")));
        return a;
      }));
      $("hstrats").hidden = false;
    }
  });
})();
