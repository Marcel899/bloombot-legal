/* Price alerts: "tell me when Grim Gardener goes above 60k".
   BB.alertDialog(item) opens the set-up dialog (unit pages, values pop-up);
   on alerts.html this also draws your list of alerts. Saved through the
   alert_* functions (sql/alerts.sql); the bot sends them by Discord DM or email. */
(() => {
  const { el } = BB;
  const ERR = {
    "alert:login": "Log in to set price alerts.",
    "alert:profile": "Create your Bloombot account first.",
    "alert:bad_item": "That unit isn't on the value list.",
    "alert:bad_target": "Type a price, like 60k.",
    "alert:no_email": "Your login has no email address. Pick Discord DM instead.",
    "alert:full": "You have 25 alerts already. Remove one first.",
  };
  const codeOf = e => (String((e && e.message) || e || "").match(/alert:[a-z_]+/) || [])[0];
  const errText = e => ERR[codeOf(e)] || "Something went wrong. Try again.";
  const rpc = async (fn, args) => { const { data, error } = await BB.sb.rpc(fn, args || {}); if (error) throw error; return data; };
  const KIND = { above: "Goes above", below: "Drops below", change: "Any change" };
  const describe = a => a.kind === "change" ? "Any price change" : (a.kind === "above" ? "Above " : "Below ") + BB.fmt(Number(a.target));
  const roundNice = n => { if (!(n > 0)) return ""; const p = Math.pow(10, Math.max(0, Math.floor(Math.log10(n)) - 1)); return BB.fmt(Math.round(n / p) * p); };

  function ready() {
    if (!BB.session) { BB.login(); return false; }
    if (!BB.user(BB.session).id) { BB.requireDiscord(); return false; }
    return true;
  }

  /* The dialog: pick when, the price, and how to hear about it. */
  BB.alertDialog = async (it, done) => {
    if (!it || !ready()) return;
    let data;
    try { data = await rpc("alert_list"); }
    catch (e) {
      BB.toast(errText(e), "bad", codeOf(e) === "alert:profile" ? { title: "No account yet", action: { label: "Create it", run: () => { location.href = "profile.html#edit"; } } } : {});
      return;
    }
    const mine = (data.alerts || []).filter(a => a.item === it.name);
    const now = it.est > 0 ? it.est : null;
    const back = el("div", "wm-back");
    const box = el("form", "wm panel al-dlg");
    box.setAttribute("role", "dialog");
    box.setAttribute("aria-modal", "true");
    box.setAttribute("aria-labelledby", "al-h");
    const opener = document.activeElement;
    const close = () => { back.remove(); document.removeEventListener("keydown", esc); if (opener && opener.focus) opener.focus({ preventScroll: true }); };
    const esc = e => { if (e.key === "Escape") close(); };
    document.addEventListener("keydown", esc);
    back.onclick = e => { if (e.target === back) close(); };

    const head = el("div", "al-head");
    const hi = BB.itemImg(it, "al-img");
    const ht = el("div");
    const h = el("h2", null, "Price alert");
    h.id = "al-h";
    ht.append(h, el("p", null, it.name + (now ? " · now " + BB.fmt(now) : "")));
    const x = el("button", "dms-x");
    x.type = "button";
    x.setAttribute("aria-label", "Close");
    x.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path stroke="currentColor" stroke-width="2.6" stroke-linecap="round" d="M7 7l10 10M17 7 7 17"/></svg>';
    x.onclick = close;
    head.append(hi, ht, x);

    const kinds = el("div", "al-kinds");
    kinds.setAttribute("role", "radiogroup");
    kinds.setAttribute("aria-label", "Tell me when it");
    let kind = "above";
    const price = el("input", "al-price");
    price.type = "text";
    price.inputMode = "decimal";
    price.autocomplete = "off";
    price.setAttribute("aria-label", "Price");
    const priceRow = el("label", "al-row");
    priceRow.append(el("span", null, "Price"), price);
    const hint = el("p", "al-hint");
    const fill = () => {
      kinds.querySelectorAll("button").forEach(b => { b.setAttribute("aria-checked", String(b.dataset.k === kind)); });
      priceRow.hidden = kind === "change";
      const have = mine.find(a => a.kind === kind);
      if (kind !== "change") price.value = have ? BB.fmt(Number(have.target)) : roundNice(now ? now * (kind === "above" ? 1.1 : 0.9) : 0);
      hint.textContent = kind === "change" ? "Every time the value list changes its price." :
        "Once when it " + (kind === "above" ? "rises to" : "falls to") + " that price. It re-arms if the price goes back.";
      save.textContent = have ? "Update alert" : "Set alert";
    };
    Object.entries(KIND).forEach(([k, label]) => {
      const b = el("button", "al-kind", label);
      b.type = "button";
      b.dataset.k = k;
      b.setAttribute("role", "radio");
      b.onclick = () => { kind = k; fill(); if (k !== "change") price.focus(); };
      kinds.append(b);
    });

    const via = el("div", "al-via");
    via.setAttribute("role", "radiogroup");
    via.setAttribute("aria-label", "Send it by");
    let how = (mine[0] && mine[0].via) || "dm";
    const viaBtn = (k, label, ok) => {
      const b = el("button", "al-kind", label);
      b.type = "button";
      b.dataset.v = k;
      b.setAttribute("role", "radio");
      if (!ok) { b.disabled = true; b.title = "Your login has no email address"; }
      b.onclick = () => { how = k; via.querySelectorAll("button").forEach(y => y.setAttribute("aria-checked", String(y.dataset.v === how))); };
      return b;
    };
    via.append(el("span", null, "Send it by"), viaBtn("dm", "Discord DM", true), viaBtn("email", "Email", !!data.has_email));
    via.querySelectorAll("button").forEach(y => y.setAttribute("aria-checked", String(y.dataset.v === how)));

    const list = el("div", "al-have");
    const drawHave = () => {
      list.replaceChildren();
      if (!mine.length) return;
      list.append(el("span", "al-have-h", "Your alerts for " + it.name));
      mine.forEach(a => {
        const r = el("div", "al-have-r");
        r.append(el("span", null, describe(a) + " · " + (a.via === "email" ? "email" : "Discord DM")));
        const d = el("button", "al-del", "Remove");
        d.type = "button";
        d.onclick = async () => {
          d.disabled = true;
          try { await rpc("alert_delete", { p_id: a.id }); mine.splice(mine.indexOf(a), 1); drawHave(); fill(); if (done) done(); }
          catch (e) { d.disabled = false; BB.toast(errText(e), "bad"); }
        };
        r.append(d);
        list.append(r);
      });
    };

    const save = el("button", "brick green", "Set alert");
    save.type = "submit";
    box.onsubmit = async e => {
      e.preventDefault();
      let target = null;
      if (kind !== "change") {
        target = BB.parseValue(price.value.replace(/\s+/g, ""));
        if (!(target > 0)) { price.focus(); BB.toast(ERR["alert:bad_target"], "info"); return; }
      }
      save.disabled = true;
      try {
        await rpc("alert_set", { p_item: it.name, p_kind: kind, p_target: target, p_via: how });
        close();
        BB.toast(describe({ kind, target }) + " · " + (how === "email" ? "by email" : "by Discord DM"), "ok", { title: "Alert set for " + it.name });
        if (done) done();
      } catch (err) { save.disabled = false; BB.toast(errText(err), "bad"); }
    };
    fill();
    box.append(head, el("span", "al-label", "Tell me when it"), kinds, priceRow, hint, via, list, save);
    drawHave();
    back.append(box);
    document.body.append(back);
    setTimeout(() => price.focus(), 50);
  };

  /* A bell button for a unit (unit page, values pop-up). */
  BB.alertButton = it => {
    const b = el("button", "brick dark sm al-btn");
    b.type = "button";
    const i = el("img"); i.src = "img/bell.png"; i.alt = "";
    b.append(i, "Alert me");
    b.onclick = () => BB.alertDialog(it);
    return b;
  };
  document.addEventListener("bb:unit", e => {
    const slot = document.getElementById("ualert");
    if (slot && e.detail) slot.replaceChildren(BB.alertButton(e.detail));
  });

  /* ── alerts.html: your alerts ── */
  const page = document.getElementById("alist");
  if (!page) return;
  let values = [], byName = new Map();
  async function drawList() {
    let data;
    try { data = await rpc("alert_list"); }
    catch (e) {
      page.replaceChildren(el("p", "hint", errText(e)));
      if (codeOf(e) === "alert:profile") { const a = el("a", "brick green sm", "Create your account"); a.href = "profile.html#edit"; page.append(a); }
      return;
    }
    const list = data.alerts || [];
    document.getElementById("acount").textContent = list.length + " / 25";
    if (!list.length) {
      const e = el("div", "col-empty");
      const i = el("img"); i.src = "img/bell.png"; i.alt = "";
      e.append(i, el("strong", null, "No price alerts yet"), el("span", null, "Search a unit above, or press Alert me on any unit's page."));
      page.replaceChildren(e);
      return;
    }
    page.replaceChildren(...list.map(a => {
      const it = byName.get(a.item) || { name: a.item };
      const r = el("div", "al-item");
      const u = el("a", "col-unit");
      u.href = BB.unitUrl(a.item);
      u.append(BB.itemImg(it, "col-img"));
      const t = el("span", "col-t");
      t.append(el("strong", null, a.item));
      const sub = el("span", "col-sub");
      sub.append(el("span", null, "Now " + (a.now > 0 ? BB.fmt(Number(a.now)) : "–")));
      if (a.fired_at) sub.append(el("span", null, "· last sent " + BB.ago(a.fired_at)));
      t.append(sub);
      u.append(t);
      const cond = el("span", "al-cond " + a.kind, describe(a));
      const via = el("span", "al-viac", a.via === "email" ? "Email" : "Discord DM");
      const edit = el("button", "brick dark sm", "Edit");
      edit.type = "button";
      edit.onclick = () => BB.alertDialog(it, drawList);
      const del = el("button", "col-del");
      del.type = "button";
      del.title = "Remove";
      del.setAttribute("aria-label", "Remove alert for " + a.item);
      del.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path stroke="currentColor" stroke-width="2.6" stroke-linecap="round" d="M7 7l10 10M17 7 7 17"/></svg>';
      del.onclick = async () => {
        del.disabled = true;
        try { await rpc("alert_delete", { p_id: a.id }); BB.toast(a.item, "info", { title: "Alert removed" }); drawList(); }
        catch (e) { del.disabled = false; BB.toast(errText(e), "bad"); }
      };
      r.append(u, cond, via, edit, del);
      return r;
    }));
  }
  function search() {
    const input = document.getElementById("aq"), sug = document.getElementById("asug");
    let opts = [], idx = 0;
    const drawSug = () => {
      sug.replaceChildren(...opts.map((it, i) => {
        const o = el("button", "sug" + (i === idx ? " on" : ""));
        o.type = "button";
        o.append(BB.itemImg(it, "sug-img"), el("span", null, it.name), el("em", null, it.est > 0 ? BB.fmt(it.est) : (it.value_text || "N/A")));
        o.onmousedown = e => { e.preventDefault(); input.value = ""; opts = []; drawSug(); BB.alertDialog(it, drawList); };
        return o;
      }));
      sug.hidden = !opts.length;
    };
    input.oninput = () => {
      const s = input.value.trim().toLowerCase();
      opts = s ? values.filter(v => v.name.toLowerCase().includes(s)).sort((a, b) => (b.name.toLowerCase().startsWith(s) - a.name.toLowerCase().startsWith(s)) || b.est - a.est).slice(0, 8) : [];
      idx = 0;
      drawSug();
    };
    input.onkeydown = e => {
      if (e.key === "ArrowDown") { idx = Math.min(idx + 1, opts.length - 1); drawSug(); e.preventDefault(); }
      else if (e.key === "ArrowUp") { idx = Math.max(idx - 1, 0); drawSug(); e.preventDefault(); }
      else if (e.key === "Enter" && opts[idx]) { const it = opts[idx]; input.value = ""; opts = []; drawSug(); BB.alertDialog(it, drawList); e.preventDefault(); }
      else if (e.key === "Escape") { opts = []; drawSug(); }
    };
    input.onblur = () => setTimeout(() => { opts = []; drawSug(); }, 120);
  }
  let started = false;
  BB.onAuth(async s => {
    const u = s ? BB.user(s) : null;
    document.getElementById("alogin").hidden = !!(u && u.id);
    document.getElementById("amain").hidden = !(u && u.id);
    if (!s) return;
    if (!u.id) { BB.requireDiscord(); return; }
    if (started) return;
    started = true;
    try { values = (await BB.loadValues()).filter(v => v.name); byName = new Map(values.map(v => [v.name, v])); } catch (e) { /* list still works */ }
    search();
    drawList();
  });
})();
