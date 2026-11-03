/* Trade calculator: add units to both sides and see if the trade is a win, fair or a loss. */
(() => {
  const $ = id => document.getElementById(id);
  const { el } = BB;
  const FAIR_SHARE = 0.05; // same rule as the bot's trade checker
  let items = [], byName = new Map();
  const sides = { give: [], get: [] };

  const key = s => String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  function find(q, limit = 8) {
    const k = key(q);
    if (!k) return [];
    const starts = [], has = [];
    for (const it of items) {
      const n = key(it.name);
      if (n.startsWith(k)) starts.push(it);
      else if (n.includes(k)) has.push(it);
    }
    return starts.concat(has).slice(0, limit);
  }

  function add(side, item, qty = 1) {
    const row = sides[side].find(r => r.item.name === item.name);
    if (row) row.qty = Math.min(99, row.qty + qty);
    else if (sides[side].length < 12) sides[side].push({ item, qty });
    update();
  }

  function rowEl(side, r) {
    const row = el("div", "crow");
    row.append(BB.itemImg(r.item, "cimg"));
    const n = el("div", "cname");
    n.append(el("strong", null, r.item.name), el("span", null, r.item.est > 0 ? BB.fmt(r.item.est) + " each" + (r.item.oc ? " (owner's choice)" : "") : "No value (" + (r.item.value_text || "N/A") + ")"));
    const q = el("div", "cqty");
    const minus = el("button", "qb", "−"), plus = el("button", "qb", "+");
    minus.type = plus.type = "button";
    minus.setAttribute("aria-label", "One less");
    plus.setAttribute("aria-label", "One more");
    minus.onclick = () => { r.qty -= 1; if (r.qty < 1) sides[side].splice(sides[side].indexOf(r), 1); update(); };
    plus.onclick = () => { r.qty = Math.min(99, r.qty + 1); update(); };
    q.append(minus, el("span", null, "×" + r.qty), plus);
    const x = el("button", "cx", "×");
    x.type = "button";
    x.setAttribute("aria-label", "Remove");
    x.onclick = () => { sides[side].splice(sides[side].indexOf(r), 1); update(); };
    row.append(n, q, x);
    return row;
  }

  const total = side => sides[side].reduce((s, r) => s + (r.item.est || 0) * r.qty, 0);

  function update() {
    for (const side of ["give", "get"]) {
      $(side + "list").replaceChildren(...sides[side].map(r => rowEl(side, r)));
      $(side + "empty").hidden = sides[side].length > 0;
      $(side + "total").textContent = BB.fmt(total(side));
    }
    const give = total("give"), get = total("get");
    const v = $("verdict");
    const diff = get - give;
    $("fairadds").replaceChildren();
    if (give <= 0 || get <= 0) {
      v.className = "verdict";
      v.querySelector("strong").textContent = "Add units to both sides";
      v.querySelector("span").textContent = "Search a unit or type a value like 4k.";
      $("meter").style.setProperty("--p", "50%");
    } else {
      const share = diff / give;
      const kind = Math.abs(share) <= FAIR_SHARE ? "fair" : diff > 0 ? "win" : "lose";
      v.className = "verdict " + kind;
      v.querySelector("strong").textContent = { fair: "Fair trade", win: "You win", lose: "You lose" }[kind];
      v.querySelector("span").textContent = kind === "fair"
        ? `Within 5%. Difference ${BB.fmt(Math.abs(diff))}.`
        : `You ${diff > 0 ? "get" : "give"} ${BB.fmt(Math.abs(diff))} more (${Math.round(Math.abs(share) * 100)}%).`;
      $("meter").style.setProperty("--p", (get / (give + get) * 100).toFixed(1) + "%");
      if (kind !== "fair") suggest(Math.abs(diff), diff > 0 ? "give" : "get");
    }
    save();
  }

  /* Single units worth about the difference, most wanted first. */
  function suggest(short, side) {
    const used = new Set([...sides.give, ...sides.get].map(r => r.item.name));
    const dem = d => { const m = String(d || "").match(/[\d.]+/); return m ? parseFloat(m[0]) : 0; };
    const picks = items.filter(it => it.value > 0 && !used.has(it.name) && Math.abs(it.value - short) <= short * 0.15)
      .sort((a, b) => dem(b.demand) - dem(a.demand) || Math.abs(a.value - short) - Math.abs(b.value - short)).slice(0, 4);
    if (!picks.length) return;
    const box = $("fairadds");
    box.append(el("span", "fa-label", side === "get" ? "To even it, ask for:" : "To even it, add:"));
    picks.forEach(it => {
      const b = el("button", "fa-chip");
      b.type = "button";
      b.append(BB.itemImg(it, "fa-img"), el("span", null, `${it.name} · ${BB.fmt(it.value)}`));
      b.onclick = () => add(side, it);
      box.append(b);
    });
  }

  function save() {
    const enc = side => sides[side].map(r => encodeURIComponent(r.item.name) + (r.qty > 1 ? "*" + r.qty : "")).join(",");
    const h = `give=${enc("give")}&get=${enc("get")}`;
    history.replaceState(null, "", h === "give=&get=" ? location.pathname : "#" + h);
  }
  function restore() {
    const p = new URLSearchParams(location.hash.slice(1));
    for (const side of ["give", "get"]) {
      for (const part of (p.get(side) || "").split(",").filter(Boolean)) {
        const [name, qty] = part.split("*");
        const it = byName.get(name) || customValue(name);
        if (it) sides[side].push({ item: it, qty: Math.max(1, Math.min(99, parseInt(qty) || 1)) });
      }
    }
  }
  function customValue(text) {
    const n = BB.parseValue(text);
    return n ? { name: BB.fmt(n) + " value", value: n, est: n, value_text: BB.fmt(n), custom: true } : null;
  }

  function picker(side) {
    const input = $(side + "q"), list = $(side + "sug");
    let opts = [], idx = 0;
    const draw = () => {
      list.replaceChildren(...opts.map((it, i) => {
        const o = el("button", "sug" + (i === idx ? " on" : ""));
        o.type = "button";
        o.append(BB.itemImg(it, "sug-img"), el("span", null, it.name), el("em", null, it.est > 0 ? BB.fmt(it.est) + (it.oc ? " O/C" : "") : (it.value_text || "N/A")));
        o.onmousedown = e => { e.preventDefault(); choose(it); };
        return o;
      }));
      list.hidden = !opts.length;
    };
    const choose = it => { add(side, it); input.value = ""; opts = []; draw(); input.focus(); };
    input.oninput = () => {
      const custom = customValue(input.value);
      opts = custom ? [custom] : find(input.value);
      idx = 0;
      draw();
    };
    input.onkeydown = e => {
      if (e.key === "ArrowDown") { idx = Math.min(idx + 1, opts.length - 1); draw(); e.preventDefault(); }
      else if (e.key === "ArrowUp") { idx = Math.max(idx - 1, 0); draw(); e.preventDefault(); }
      else if (e.key === "Enter" && opts[idx]) { choose(opts[idx]); e.preventDefault(); }
      else if (e.key === "Escape") { opts = []; draw(); }
    };
    input.onblur = () => setTimeout(() => { opts = []; draw(); }, 100);
  }

  /* Sharing: the link holds the trade; the text is ready to paste in Discord. */
  $("copylink").onclick = () => {
    if (!sides.give.length && !sides.get.length) { BB.toast("Add some units first", "bad"); return; }
    BB.share(location.href, "Trade check · Bloombot", "Link copied. Anyone who opens it sees this trade.");
  };
  $("copytext").onclick = () => {
    if (!sides.give.length || !sides.get.length) { BB.toast("Add units to both sides first", "bad"); return; }
    const line = side => sides[side].map(r => (r.qty > 1 ? r.qty + "x " : "") + r.item.name).join(", ") + " (" + BB.fmt(total(side)) + ")";
    const v = $("verdict");
    BB.copy(`**I give:** ${line("give")}\n**I get:** ${line("get")}\n**Result:** ${v.querySelector("strong").textContent}. ${v.querySelector("span").textContent}\n-# Checked on ${location.host || "Bloombot"}`, "Copied. Paste it in Discord.");
  };
  $("swap").onclick = () => { [sides.give, sides.get] = [sides.get, sides.give]; update(); };
  $("clear").onclick = () => { sides.give = []; sides.get = []; update(); };
  picker("give");
  picker("get");

  let started = false;
  BB.onAuth(async () => {
    if (started) return;
    started = true;
    try {
      items = await BB.loadValues();
    } catch (e) {
      $("cloading").textContent = "Couldn't load values. Try again in a minute.";
      return;
    }
    $("cloading").hidden = true;
    byName = new Map(items.map(i => [i.name, i]));
    restore();
    update();
  });
})();
