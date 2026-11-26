/* Collection: the units you own, what they're worth together and how that moved in 30 days.
   collection.html is yours; collection.html?id=<discord id> is someone else's, read-only,
   and only if they made it public. Saved through the col_* functions (sql/collections.sql). */
(() => {
  const $ = id => document.getElementById(id);
  const { el } = BB;
  const asked = new URLSearchParams(location.search).get("id");
  const ERR = {
    "col:login": "Log in to keep a collection.",
    "col:profile": "Create your Bloombot account first.",
    "col:bad_item": "That unit isn't on the value list.",
    "col:full": "Your collection is full (500 different units).",
    "col:bad_user": "That trader doesn't exist.",
  };
  const codeOf = e => (String((e && e.message) || e || "").match(/col:[a-z_]+/) || [])[0];
  const errText = e => ERR[codeOf(e)] || "Something went wrong. Try again.";
  const rpc = async (fn, args) => { const { data, error } = await BB.sb.rpc(fn, args || {}); if (error) throw error; return data; };

  let me = null, mine = false, values = [], byName = new Map(), rows = [], pub = false, started = false;
  let order = [];               // row order: sorted by worth on load, then kept while you edit
  const picked = new Set();
  const timers = new Map();

  /* Value 30 days ago from the price history: the last point on or before then. */
  function past(it) {
    const h = (it.history || []).filter(p => p[1] > 0);
    if (!h.length) return it.est;
    const cut = Date.now() - 30 * 864e5;
    let v = null;
    for (const [d, x] of h) if (new Date(d).getTime() <= cut) v = x;
    return v == null ? h[0][1] : v;
  }

  function summary() {
    let now = 0, then = 0, n = 0, kinds = 0;
    for (const r of rows) {
      n += r.qty; kinds++;
      const it = byName.get(r.name);
      if (!it || !(it.est > 0)) continue;
      now += it.est * r.qty;
      then += (it.oc ? it.est : past(it)) * r.qty;
    }
    $("ctotal").textContent = BB.fmt(now);
    const ch = then > 0 ? Math.round((now - then) / then * 1000) / 10 : null;
    const c = $("cchange");
    c.className = "chg " + (ch > 0 ? "up" : ch < 0 ? "down" : "flat");
    c.textContent = ch == null ? "–" : (ch > 0 ? "+" : "") + ch + "%";
    $("cchange-v").textContent = ch == null || !then ? "" : (now >= then ? "+" : "−") + BB.fmt(Math.abs(now - then));
    $("ccount").textContent = n.toLocaleString();
    $("ckinds").textContent = kinds === 1 ? "1 unit type" : kinds.toLocaleString() + " different";
  }

  function save(name, qty) {
    clearTimeout(timers.get(name));
    timers.set(name, setTimeout(async () => {
      timers.delete(name);
      try { await rpc("col_set", { p_item: name, p_qty: qty }); }
      catch (e) { BB.toast(errText(e), "bad", { title: "Not saved" }); await load(); }
    }, 450));
  }

  function setQty(name, qty) {
    qty = Math.max(0, Math.min(9999, Math.round(qty) || 0));
    const r = rows.find(x => x.name === name);
    if (!r) return;
    if (qty === 0) {
      rows = rows.filter(x => x !== r);
      picked.delete(name);
      save(name, 0);
      draw();
      const undo = r.qty;
      BB.toast(name, "info", { title: "Removed from your collection", action: { label: "Undo", run: () => { if (!rows.some(x => x.name === name)) rows.push({ name, qty: undo }); save(name, undo); draw(); } } });
      return;
    }
    r.qty = qty;
    save(name, qty);
    draw();
  }

  function row(r) {
    const it = byName.get(r.name);
    const d = el("div", "col-row" + (picked.has(r.name) ? " on" : ""));
    if (mine) {
      const pick = el("label", "col-pick");
      const cb = el("input");
      cb.type = "checkbox";
      cb.checked = picked.has(r.name);
      cb.setAttribute("aria-label", "Select " + r.name + " for a trade ad");
      cb.dataset.f = r.name + "|pick";
      cb.onchange = () => { if (cb.checked) picked.add(r.name); else picked.delete(r.name); d.classList.toggle("on", cb.checked); bar(); };
      pick.append(cb, el("i"));
      d.append(pick);
    }
    const a = el("a", "col-unit");
    a.href = BB.unitUrl(r.name);
    a.append(BB.itemImg(it || { name: r.name }, "col-img"));
    const t = el("span", "col-t");
    t.append(el("strong", null, r.name));
    const sub = el("span", "col-sub");
    if (it && it.rarity) sub.append(el("span", "rar r-" + it.rarity.toLowerCase().replace(/\W/g, ""), it.rarity));
    sub.append(el("span", null, it && it.est > 0 ? BB.fmt(it.est) + " each" : "No value listed"));
    t.append(sub);
    a.append(t);
    d.append(a);
    if (mine) {
      const q = el("div", "col-qty");
      const minus = el("button", "col-qb", "−"); minus.type = "button"; minus.setAttribute("aria-label", "One less " + r.name);
      const plus = el("button", "col-qb", "+"); plus.type = "button"; plus.setAttribute("aria-label", "One more " + r.name);
      const n = el("input", "col-qn");
      n.type = "number"; n.min = "0"; n.max = "9999"; n.value = r.qty; n.inputMode = "numeric";
      n.setAttribute("aria-label", "How many " + r.name);
      minus.dataset.f = r.name + "|minus"; plus.dataset.f = r.name + "|plus"; n.dataset.f = r.name + "|qty";
      minus.onclick = () => setQty(r.name, r.qty - 1);
      plus.onclick = () => setQty(r.name, r.qty + 1);
      n.onchange = () => setQty(r.name, parseInt(n.value, 10));
      q.append(minus, n, plus);
      d.append(q);
    } else d.append(el("span", "col-x", "×" + r.qty));
    d.append(el("strong", "col-sum", it && it.est > 0 ? BB.fmt(it.est * r.qty) : "–"));
    if (mine) {
      const x = el("button", "col-del");
      x.type = "button";
      x.title = "Remove";
      x.setAttribute("aria-label", "Remove " + r.name);
      x.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path stroke="currentColor" stroke-width="2.6" stroke-linecap="round" d="M7 7l10 10M17 7 7 17"/></svg>';
      x.dataset.f = r.name + "|del";
      x.onclick = () => setQty(r.name, 0);
      d.append(x);
    }
    return d;
  }

  const worth = r => { const it = byName.get(r.name); return it && it.est > 0 ? it.est * r.qty : -1; };
  function draw() {
    const q = $("cfilter").value.trim().toLowerCase();
    const pos = n => { const i = order.indexOf(n); return i < 0 ? -1 : i; };   // new ones first
    const list = rows.filter(r => !q || r.name.toLowerCase().includes(q)).sort((a, b) => pos(a.name) - pos(b.name));
    /* Redrawing replaces the buttons, so put keyboard focus back on the same control. */
    const was = document.activeElement && document.activeElement.closest && document.activeElement.closest("#clist") ? document.activeElement.dataset.f : null;
    const wasRow = was ? [...$("clist").children].indexOf(document.activeElement.closest(".col-row")) : -1;
    $("clist").replaceChildren(...list.map(row));
    if (was) {
      const back = $("clist").querySelector('[data-f="' + CSS.escape(was) + '"]');
      if (back) back.focus();
      else {
        /* that row was removed: move to the same control on the next row, or the search box */
        const rowsNow = $("clist").querySelectorAll(".col-row");
        const next = wasRow >= 0 ? rowsNow[Math.min(wasRow, rowsNow.length - 1)] : null;
        const f = next && next.querySelector('[data-f$="|' + was.split("|")[1] + '"]');
        if (f) f.focus(); else if (mine) $("cq").focus();
      }
    }
    $("cempty").hidden = rows.length > 0;
    $("cstats").hidden = !rows.length;
    $("cnomatch").hidden = !rows.length || list.length > 0;
    $("cfilter").hidden = rows.length < 8;
    summary();
    bar();
  }

  /* "Trade these away": opens a new trade ad with the selected units on your side. */
  function bar() {
    if (!mine) return;
    const sel = rows.filter(r => picked.has(r.name));
    $("ctip").hidden = !rows.length || sel.length > 0;
    $("cbar").hidden = !sel.length;
    $("cbar-n").textContent = sel.length === 1 ? "1 unit selected" : sel.length + " units selected";
    const have = sel.slice(0, 15).map(r => encodeURIComponent(r.name) + (r.qty > 1 ? "*" + r.qty : "")).join(",");
    $("cbar-go").href = "trades.html#have=" + have;
    $("cbar-calc").href = "calculator.html#give=" + sel.map(r => encodeURIComponent(r.name).replace(/%20/g, "_") + (r.qty > 1 ? "~" + r.qty : "")).join("!");
  }

  /* add-a-unit search, same feel as the trade calculator's */
  function picker() {
    const input = $("cq"), list = $("csug");
    let opts = [], idx = 0;
    const find = t => {
      const s = t.trim().toLowerCase();
      return values.filter(v => v.name.toLowerCase().includes(s))
        .sort((a, b) => (b.name.toLowerCase().startsWith(s) - a.name.toLowerCase().startsWith(s)) || b.est - a.est).slice(0, 8);
    };
    const drawSug = () => {
      list.replaceChildren(...opts.map((it, i) => {
        const o = el("button", "sug" + (i === idx ? " on" : ""));
        o.type = "button";
        const have = rows.find(r => r.name === it.name);
        o.append(BB.itemImg(it, "sug-img"), el("span", null, it.name), el("em", null, have ? "You have " + have.qty : it.est > 0 ? BB.fmt(it.est) : (it.value_text || "N/A")));
        o.onmousedown = e => { e.preventDefault(); choose(it); };
        return o;
      }));
      list.hidden = !opts.length;
    };
    const choose = it => {
      const have = rows.find(r => r.name === it.name);
      if (have) setQty(it.name, have.qty + 1);
      else { rows.push({ name: it.name, qty: 1 }); order = [it.name].concat(order.filter(n => n !== it.name)); save(it.name, 1); draw(); }
      BB.toast(it.name, "ok", { title: have ? "One more added" : "Added to your collection" });
      input.value = ""; opts = []; drawSug(); input.focus();
    };
    /* Empty box: the most traded units you don't own yet, to get started quickly. */
    const popular = () => {
      const dem = d => { const m = String(d || "").match(/[\d.]+/); return m ? parseFloat(m[0]) : -1; };
      return values.filter(v => v.est > 0 && v.category !== "gamepasses" && !rows.some(r => r.name === v.name))
        .sort((a, b) => dem(b.demand) - dem(a.demand) || b.est - a.est).slice(0, 8);
    };
    input.onfocus = () => { if (!input.value.trim()) { opts = popular(); idx = 0; drawSug(); } };
    input.oninput = () => { opts = input.value.trim() ? find(input.value) : popular(); idx = 0; drawSug(); };
    input.onkeydown = e => {
      if (e.key === "ArrowDown") { idx = Math.min(idx + 1, opts.length - 1); drawSug(); e.preventDefault(); }
      else if (e.key === "ArrowUp") { idx = Math.max(idx - 1, 0); drawSug(); e.preventDefault(); }
      else if (e.key === "Enter" && opts[idx]) { choose(opts[idx]); e.preventDefault(); }
      else if (e.key === "Escape") { opts = []; drawSug(); }
    };
    input.onblur = () => setTimeout(() => { opts = []; drawSug(); }, 120);
  }

  async function load() {
    const res = await rpc("col_get", { p_user: asked && asked !== me ? asked : null });
    mine = !!res.mine;
    pub = !!res.public;
    rows = (res.items || []).map(x => ({ name: x.name, qty: x.qty }));
    order = rows.slice().sort((a, b) => worth(b) - worth(a) || a.name.localeCompare(b.name)).map(r => r.name);
    return res;
  }

  async function start() {
    $("cload").hidden = false;
    let res;
    try {
      [values] = await Promise.all([BB.loadValues()]);
      values = values.filter(v => v.name);
      byName = new Map(values.map(v => [v.name, v]));
      res = await load();
    } catch (e) {
      $("cload").hidden = true;
      const box = $("cmsg");
      box.hidden = false;
      box.replaceChildren(el("p", null, errText(e)));
      if (codeOf(e) === "col:profile") { const a = el("a", "brick green sm", "Create your account"); a.href = "profile.html#edit"; box.append(a); }
      return;
    }
    $("cload").hidden = true;
    if (!mine && !res.public) {
      const box = $("cmsg");
      box.hidden = false;
      box.replaceChildren(el("p", null, "This collection is private."));
      return;
    }
    $("cmain").hidden = false;
    document.body.classList.toggle("col-mine", mine);
    $("cadd").hidden = !mine;
    $("cpub-row").hidden = !mine;
    $("cempty-own").hidden = !mine;
    $("cempty-other").hidden = mine;
    if (mine) {
      $("cpub").checked = pub;
      const pubHint = () => { $("cpub-row").querySelector("span:last-child > span").textContent = $("cpub").checked ? "On: traders see it on your profile." : "Off: only you can see it."; };
      pubHint();
      $("cpub").addEventListener("change", pubHint);
      $("cpub").onchange = async () => {
        const on = $("cpub").checked;
        $("cpub").disabled = true;
        try {
          await rpc("col_set_public", { p_on: on });
          BB.toast(on ? "Traders can see it on your profile." : "Only you can see it now.", "ok", { title: on ? "Collection is public" : "Collection is private" });
        } catch (e) { $("cpub").checked = !on; pubHint(); BB.toast(errText(e), "bad"); }
        $("cpub").disabled = false;
      };
      picker();
      $("cbar-x").onclick = () => { picked.clear(); draw(); };
    } else {
      const { data: p } = await BB.sb.from("profiles").select("discord_name,discord_avatar").eq("discord_id", asked).maybeSingle();
      const name = BB.plain((p && p.discord_name) || "") || "Trader";
      $("ch").textContent = name + "'s collection";
      $("csub").textContent = "Units " + name + " owns, valued with the live value list.";
      document.title = name + "'s collection · Bloombot";
      const back = $("cwho");
      back.hidden = false;
      back.href = "profile.html?id=" + encodeURIComponent(asked);
      back.dataset.name = name;
    }
    $("cfilter").oninput = draw;
    draw();
  }

  BB.onAuth(s => {
    const u = s ? BB.user(s) : null;
    $("clogin").hidden = !!(u && u.id);
    if (!s) { $("cmain").hidden = true; return; }
    if (!u.id) { BB.requireDiscord(); return; }
    if (started && me === u.id) return;
    started = true;
    me = u.id;
    start();
  });
  addEventListener("beforeunload", () => { /* flush pending saves */ timers.forEach((t, name) => { clearTimeout(t); const r = rows.find(x => x.name === name); BB.sb.rpc("col_set", { p_item: name, p_qty: r ? r.qty : 0 }); }); });
})();
