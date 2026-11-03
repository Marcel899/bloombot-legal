/* Home page: live numbers, biggest value moves and the newest strategies. */
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

  let started = false;
  BB.onAuth(async () => {
    if (started) return;
    started = true;
    BB.sb.rpc("site_stats").then(({ data }) => {
      if (!data) return;
      $("st-ads").textContent = data.ads;
      $("st-values").textContent = data.values;
      $("st-strats").textContent = data.strategies;
      $("stats").classList.add("ready");
    });
    try {
      const items = (await BB.loadValues()).filter(i => i.change_30d != null && i.change_30d !== 0 && i.est >= 100 && i.category !== "gamepasses");
      const up = items.filter(i => i.change_30d > 0).sort((a, b) => b.change_30d - a.change_30d).slice(0, 5);
      const down = items.filter(i => i.change_30d < 0).sort((a, b) => a.change_30d - b.change_30d).slice(0, 5);
      $("mv-up").replaceChildren(...up.map(mover));
      $("mv-down").replaceChildren(...down.map(mover));
      $("movers").hidden = !(up.length || down.length);
    } catch (e) { /* values not synced yet */ }
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
