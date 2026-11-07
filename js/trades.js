/* Trade ads page: live ads for logged-in users, and posting an ad from the site. */
(() => {
  const $ = id => document.getElementById(id);
  const { el } = BB;
  let ads = [], me = null, maxAds = 1, timer = null, units = [], shown = 24;
  const PAGE = 24;

  /* Unit names in the ad text get their icon, longest names first. */
  let unitRe = null, unitMap = new Map();
  function prepUnits(items) {
    units = items.filter(i => i.name && i.name.length >= 4);
    unitMap = new Map(units.map(i => [i.name.toLowerCase(), i]));
    const names = units.map(i => i.name).sort((a, b) => b.length - a.length)
      .map(n => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
    unitRe = names.length ? new RegExp("\\b(" + names.join("|") + ")\\b", "gi") : null;
  }
  /* Plain text pieces of an ad: unit names get their picture. */
  function chips(parent, text) {
    if (!unitRe) { parent.append(text); return; }
    let last = 0;
    text.replace(unitRe, (m, _g, i) => {
      if (i > last) parent.append(text.slice(last, i));
      const it = unitMap.get(m.toLowerCase());
      const chip = el("span", "uchip");
      chip.title = it.value > 0 ? `${it.name} · ${BB.fmt(it.value)}` : it.name;
      chip.append(BB.itemImg(it, "uimg"), document.createTextNode(m));
      parent.append(chip);
      last = i + m.length;
      return m;
    });
    if (last < text.length) parent.append(text.slice(last));
  }
  const adText = text => BB.md(text, { cls: "tc-text", onText: chips });
  const left = t => {
    const h = (new Date(t) - Date.now()) / 36e5;
    if (!(h > 0)) return "";
    return h < 1 ? Math.max(1, Math.round(h * 60)) + "m left" : Math.round(h) + "h left";
  };

  const NS = "http://www.w3.org/2000/svg";
  function icon(kind) {
    const svg = document.createElementNS(NS, "svg");
    svg.setAttribute("viewBox", kind === "discord" ? "0 0 24 24" : "0 0 24 24");
    svg.setAttribute("class", "tc-ico");
    svg.setAttribute("aria-hidden", "true");
    const path = document.createElementNS(NS, "path");
    path.setAttribute("fill", "currentColor");
    path.setAttribute("d", kind === "discord"
      ? "M20.3 4.4A19.8 19.8 0 0 0 15.4 3l-.6 1.3a18.4 18.4 0 0 0-5.6 0L8.6 3a19.7 19.7 0 0 0-4.9 1.4C.6 9 0 13.6.3 18.1a19.9 19.9 0 0 0 6 3l1.3-2a13 13 0 0 1-2-1l.5-.4a14.2 14.2 0 0 0 12.2 0l.5.4-2 1 1.3 2a19.8 19.8 0 0 0 6-3c.5-5.2-.8-9.7-3.8-13.7ZM8.5 15.3c-1.2 0-2.2-1.1-2.2-2.4s1-2.4 2.2-2.4 2.2 1.1 2.2 2.4-1 2.4-2.2 2.4Zm7 0c-1.2 0-2.2-1.1-2.2-2.4s1-2.4 2.2-2.4 2.2 1.1 2.2 2.4-1 2.4-2.2 2.4Z"
      : "M6.3 1 1 18.7 17.7 23 23 5.3 6.3 1Zm7.9 14.2-4.1-1.1 1.1-4.1 4.1 1.1-1.1 4.1Z");
    svg.append(path);
    return svg;
  }
  /* A labelled account pill: icon, which app, and the name. Links when we have a safe link. */
  function account(kind, name, href) {
    const a = el(href ? "a" : "span", "acc " + kind);
    if (href) { a.href = href; a.target = "_blank"; a.rel = "noopener nofollow"; }
    const t = el("span", "acc-t");
    t.append(el("em", null, kind === "discord" ? "Discord" : "Roblox"), el("strong", null, name));
    a.append(icon(kind), t);
    return a;
  }

  function card(a) {
    const own = a.discord_id === me;
    const c = el("article", "tcard" + (own ? " own" : ""));
    const head = el("div", "tc-head");
    const av = el("img", "tc-av");
    av.alt = "";
    av.src = BB.safeUrl(a.discord_avatar) || "img/flower.png";
    av.onerror = () => { av.src = "img/flower.png"; };
    const who = el("div", "tc-who");
    who.append(el("strong", null, BB.plain(a.discord_name || "") || "Trader"),
      el("span", null, BB.ago(a.created_at) + (a.expires_at && left(a.expires_at) ? " · " + left(a.expires_at) : "")));
    const prof = el("a", "tc-prof");
    prof.href = "profile.html?id=" + encodeURIComponent(a.discord_id);
    prof.title = "See " + (a.discord_name || "this trader") + "'s profile";
    prof.append(av, who);
    head.append(prof);
    if (own) {
      const del = el("button", "del-btn", "Delete");
      del.type = "button";
      del.title = "Delete this trade ad";
      del.onclick = async () => {
        del.disabled = true;
        if (await BB.deleteMine("trade_ad", a.id)) { ads = ads.filter(x => x.id !== a.id); render(); }
        else del.disabled = false;
      };
      head.append(el("span", "tag", "Yours"), del);
    }
    c.append(head, adText(a.content));
    const img = BB.safeUrl(a.image_url);
    if (img) {
      const i = el("img", "tc-img");
      i.alt = "Trade ad picture";
      i.loading = "lazy";
      i.src = img;
      i.onerror = () => i.remove();
      c.append(i);
    }
    const users = el("div", "tc-users");
    const did = /^\d{5,25}$/.test(String(a.discord_id || "")) ? String(a.discord_id) : null;
    users.append(account("discord", a.discord_name || (did ? "User " + did.slice(-4) : "Unknown"), did ? "https://discord.com/users/" + did : null));
    const r = BB.safeUrl(a.roblox_url);
    if (a.roblox_name || r) users.append(account("roblox", a.roblox_name || "Profile", r));
    else users.append(account("roblox", "Not linked", null));
    c.append(users);
    return c;
  }

  function render() {
    const v = $("adq").value.trim().toLowerCase(), mine = $("mine").checked, now = Date.now();
    const list = ads.filter(a => (!a.expires_at || new Date(a.expires_at) > now) && (!mine || a.discord_id === me) &&
      (!v || (a.content + " " + (a.discord_name || "") + " " + (a.roblox_name || "")).toLowerCase().includes(v)));
    const sort = $("adsort").value;
    if (sort === "old") list.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    else if (sort === "ending") list.sort((a, b) => new Date(a.expires_at || 8e15) - new Date(b.expires_at || 8e15));
    else list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    $("tlist").replaceChildren(...list.slice(0, shown).map(card));
    $("more").hidden = list.length <= shown;
    $("tnone").hidden = list.length > 0;
    $("tnone").textContent = mine ? "You have no live trade ads. Post one above!" : ads.length ? "No trade ad matches that." : "No trade ads right now.";
    $("count").textContent = list.length + " live trade ad" + (list.length === 1 ? "" : "s");
    slots();
  }

  async function load() {
    const { data, error } = await BB.sb.from("trade_ads").select("*").order("created_at", { ascending: false }).limit(1000);
    if (error) {
      $("tnone").hidden = false;
      $("tnone").textContent = "Couldn't load trade ads. Try again in a minute.";
      return;
    }
    ads = data || [];
    render();
  }

  /* ── posting ─────────────────────────────────────────────── */
  const MIN = 7, MAX = 200;
  function counter() {
    const n = $("adtext").value.trim().length;
    $("adcount").textContent = `${n}/${MAX}`;
    $("adcount").classList.toggle("bad", n > MAX || (n > 0 && n < MIN));
    $("postbtn").disabled = busy;
    $("postbtn").classList.toggle("ready", n >= MIN && n <= MAX);
    preview();
  }
  function preview() {
    const t = $("adtext").value.trim();
    $("adempty").hidden = !!t;
    $("adprevbody").hidden = !t;
    if (t) $("adprevbody").replaceChildren(adText(t));
    else $("adprevbody").replaceChildren();
  }
  function status(kind, text) {
    const s = $("poststatus");
    s.hidden = !text;
    s.className = "post-status " + kind;
    s.textContent = text || "";
  }

  /* Composer: pick units for each side and the ad text writes itself. */
  const pick = { have: [], want: [], tags: new Set() };
  const qty = r => (r.bulk ? "bulk " : r.qty > 1 ? r.qty + "x " : "");
  function compose() {
    const side = (list, extra) => {
      const parts = list.map(r => qty(r) + r.item.name);
      let t = parts.length > 2 ? parts.slice(0, -1).join(", ") + " and " + parts[parts.length - 1] : parts.join(" and ");
      if (extra) t += (t ? " + " : "") + extra;
      return t;
    };
    const haveExtra = pick.tags.has("have-big") ? "big add" : pick.tags.has("have-small") ? "small add" : pick.tags.has("have-add") ? "add" : "";
    let have = side(pick.have, haveExtra);
    const wantBits = [];
    if (pick.tags.has("want-overpay")) wantBits.push("overpay");
    let want = side(pick.want, pick.tags.has("want-add") ? "add" : "");
    if (!want && pick.tags.has("want-any")) want = "any";
    if (!want && (pick.tags.has("want-offers") || pick.have.length)) want = "offers";
    if (wantBits.length) want = want ? want + " (" + wantBits.join(", ") + ")" : wantBits.join(", ");
    let text = "";
    if (have && want) text = have + " for " + want;
    else if (have) text = "trading " + have;
    else if (pick.want.length) text = "LF " + want;
    $("adtext").value = text;
    counter();
  }
  /* Picked units as tiles: picture, name, amount stepper, bulk toggle. */
  const EMPTY = { have: "Search a unit below to add it.", want: "Leave empty to ask for offers." };
  function drawChips() {
    for (const [key, box, worth] of [["have", "hchips", "hworth"], ["want", "wchips", "wworth"]]) {
      const list = pick[key];
      let total = 0;
      for (const r of list) if (!r.bulk && r.item.est > 0) total += r.item.est * r.qty;
      $(worth).textContent = total > 0 ? "\u2248 " + BB.fmt(total) : "";
      if (!list.length) { $(box).replaceChildren(el("p", "cz-none", EMPTY[key])); continue; }
      $(box).replaceChildren(...list.map(r => {
        const c = el("div", "pchip" + (r.bulk ? " bulk" : "") + (r.fresh ? " fresh" : ""));
        r.fresh = false;
        c.title = r.item.est > 0 ? r.item.name + " \u00b7 " + BB.fmt(r.item.est) + " each" : r.item.name;
        const x = el("button", "px", "\u00d7");
        x.type = "button";
        x.setAttribute("aria-label", "Remove " + r.item.name);
        x.onclick = () => { list.splice(list.indexOf(r), 1); drawChips(); compose(); };
        const pic = el("div", "pic");
        pic.append(BB.itemImg(r.item, "pimg"));
        if (r.bulk || r.qty > 1) pic.append(el("b", "pbadge", r.bulk ? "BULK" : "\u00d7" + r.qty));
        c.append(x, pic, el("span", "pname", r.item.name));
        const amt = el("div", "pamt");
        const minus = el("button", "pq", "\u2212"), plus = el("button", "pq", "+");
        minus.type = plus.type = "button";
        minus.setAttribute("aria-label", "One less");
        plus.setAttribute("aria-label", "One more");
        const n = el("input", "pnum");
        n.type = "number"; n.min = "1"; n.max = "999"; n.inputMode = "numeric";
        n.value = r.qty;
        n.setAttribute("aria-label", "Amount of " + r.item.name);
        n.disabled = minus.disabled = plus.disabled = !!r.bulk;
        const set = (v, redraw) => { r.qty = Math.max(1, Math.min(999, Math.round(v) || 1)); n.value = r.qty; if (redraw) drawChips(); compose(); };
        minus.onclick = () => set(r.qty - 1, true);
        plus.onclick = () => set(r.qty + 1, true);
        n.oninput = () => { if (n.value !== "") set(+n.value); };
        n.onchange = n.onblur = () => set(+n.value, true);
        amt.append(minus, n, plus);
        const bulk = el("button", "pbulk" + (r.bulk ? " on" : ""));
        bulk.type = "button";
        bulk.setAttribute("aria-pressed", r.bulk ? "true" : "false");
        const bi = el("img"); bi.src = "img/bulk.png"; bi.alt = "";
        bulk.append(bi, "Bulk");
        bulk.title = "Trading or wanting lots of this unit";
        bulk.onclick = () => { r.bulk = !r.bulk; drawChips(); compose(); };
        c.append(amt, bulk);
        return c;
      }));
    }
  }
  /* "Edit text": the ad writes itself, but you can open the box and change it. */
  function editText(open, focus) {
    $("adtext").hidden = !open;
    $("adedit").setAttribute("aria-expanded", open ? "true" : "false");
    $("adedit").textContent = open ? "Done" : "Edit text";
    if (open && focus) { const t = $("adtext"); t.focus(); t.setSelectionRange(t.value.length, t.value.length); }
  }
  $("adedit").onclick = () => editText($("adtext").hidden, true);
  $("adwrite").onclick = () => editText(true, true);
  /* Live ads at once by level: 1, 2 at level 5, 3 at level 10 (Rank.max_trade_ads in the bot). */
  const adsForLevel = lv => lv >= 10 ? 3 : lv >= 5 ? 2 : 1;
  async function loadLimit() {
    try {
      const { data: p } = await BB.sb.from("profiles").select("level, xp").eq("discord_id", me).maybeSingle();
      const lv = p ? Number(p.level) || (p.xp != null ? BB.levelFromXp(p.xp).level : 1) : 1;
      maxAds = adsForLevel(lv);
    } catch (_) { maxAds = 1; }
    slots();
  }
  function slots() {
    const now = Date.now();
    const n = ads.filter(a => a.discord_id === me && (!a.expires_at || new Date(a.expires_at) > now)).length;
    const s = $("slots");
    s.querySelectorAll("i").forEach((d, i) => { d.hidden = i >= maxAds; d.classList.toggle("on", i < n); });
    s.querySelector("b").textContent = Math.min(n, maxAds) + "/" + maxAds + " live";
    s.classList.toggle("full", n >= maxAds);
    s.title = "You can have " + maxAds + " live trade ad" + (maxAds === 1 ? "" : "s") + " at once" +
      (maxAds < 3 ? " (" + (maxAds + 1) + " at level " + (maxAds === 1 ? 5 : 10) + ")" : "") + ". Posting more replaces your oldest.";
  }
  const norm = t => String(t || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  function find(q) {
    const k = norm(q);
    if (!k) return [];
    const starts = [], has = [];
    for (const it of units) { const n = norm(it.name); if (n.startsWith(k)) starts.push(it); else if (n.includes(k)) has.push(it); }
    return starts.concat(has).slice(0, 8);
  }
  function picker(key, inputId, listId) {
    const input = $(inputId), list = $(listId);
    let opts = [], idx = 0;
    const draw = () => {
      list.replaceChildren(...opts.map((it, i) => {
        const o = el("button", "sug" + (i === idx ? " on" : ""));
        o.type = "button";
        o.append(BB.itemImg(it, "sug-img"), el("span", null, it.name), el("em", null, it.est > 0 ? BB.fmt(it.est) : ""));
        o.onmousedown = e => { e.preventDefault(); choose(it); };
        return o;
      }));
      list.hidden = !opts.length;
    };
    const choose = it => {
      const have = pick[key].find(r => r.item.name === it.name);
      if (have) have.qty = Math.min(999, have.qty + 1);
      else if (pick[key].length < 15) pick[key].push({ item: it, qty: 1, bulk: false, fresh: true });
      else BB.toast("Keep it to 15 per side.", "info", { title: "That\u2019s a lot of units" });
      if (key === "want") { pick.tags.delete("want-offers"); pick.tags.delete("want-any"); syncTags(); }
      input.value = ""; opts = []; draw(); drawChips(); compose(); input.focus();
    };
    input.oninput = () => { opts = find(input.value); idx = 0; draw(); };
    input.onkeydown = e => {
      if (e.key === "ArrowDown") { idx = Math.min(idx + 1, opts.length - 1); draw(); e.preventDefault(); }
      else if (e.key === "ArrowUp") { idx = Math.max(idx - 1, 0); draw(); e.preventDefault(); }
      else if (e.key === "Enter") { e.preventDefault(); if (opts[idx]) choose(opts[idx]); }
      else if (e.key === "Escape") { opts = []; draw(); }
    };
    input.onblur = () => setTimeout(() => { opts = []; draw(); }, 120);
  }
  function syncTags() { document.querySelectorAll(".tagb").forEach(b => b.classList.toggle("on", pick.tags.has(b.dataset.tag))); }
  document.querySelectorAll(".tagb").forEach(b => b.onclick = () => {
    const t = b.dataset.tag;
    const on = !pick.tags.has(t);
    if (b.dataset.group) document.querySelectorAll(`.tagb[data-group="${b.dataset.group}"]`).forEach(x => pick.tags.delete(x.dataset.tag));
    if (on) pick.tags.add(t); else pick.tags.delete(t);
    if ((t === "want-offers" || t === "want-any") && on) pick.want = [];
    syncTags(); drawChips(); compose();
  });
  /* trades.html#post&have=Witchleaf*2&want=Corn fills the composer (from the calculator). */
  function prefill(values) {
    const p = new URLSearchParams(location.hash.slice(1));
    if (!p.has("have") && !p.has("want")) return;
    const by = new Map(values.map(v => [v.name, v]));
    for (const key of ["have", "want"]) for (const part of (p.get(key) || "").split(",").filter(Boolean)) {
      const [name, q] = part.split("*");
      const it = by.get(name);
      if (it && pick[key].length < 15) pick[key].push({ item: it, qty: Math.max(1, Math.min(999, parseInt(q) || 1)), bulk: false });
    }
    drawChips();
    compose();
    history.replaceState(null, "", location.pathname + "#post");
  }
  function clearComposer() {
    pick.have = []; pick.want = []; pick.tags.clear();
    syncTags(); drawChips();
    $("adtext").value = "";
    editText(false);
    counter();
  }

  let busy = false;
  async function post(e) {
    if (e) e.preventDefault();
    const content = $("adtext").value.trim();
    if (busy) return;
    if (content.length < MIN || content.length > MAX) {
      status("bad", content.length < MIN ? "Your ad is too short. Add a unit or write a bit more." : "Your ad is too long (200 characters max).");
      return;
    }
    if (!BB.sb || !BB.session) { status("bad", "You're logged out. Log in again and retry."); return; }
    if (!BB.requireDiscord()) { status("bad", "Connect Discord to post trade ads."); return; }
    busy = true;
    counter();
    status("wait", "Sending your trade ad to Bloombot…");
    const tt = BB.toast("Sending it to Bloombot…", "wait", { title: "Posting your trade ad" });
    let data, error;
    try {
      ({ data, error } = await BB.sb.from("ad_submissions").insert({ content }).select("id").single());
    } catch (err) {
      error = { message: (err && err.message) || "network error" };
    }
    if (error) {
      busy = false;
      const why = /row-level security|violates/i.test(error.message)
        ? "You already have a trade ad waiting. Give it a few seconds."
        : /JWT|token|auth/i.test(error.message) ? "Your login expired. Log out and in again, then retry."
        : "Couldn't send it: " + error.message;
      status("bad", why);
      tt.update(why, "bad", { title: "Trade ad not posted" });
      counter();
      return;
    }
    const started = Date.now();
    const done = (kind, text) => { busy = false; status(kind, text); counter(); };
    const poll = async () => {
      let row = null;
      try { ({ data: row } = await BB.sb.from("ad_submissions").select("status,reason,servers").eq("id", data.id).single()); } catch (err) { /* retry */ }
      if (row && row.status === "posted") {
        clearComposer();
        done("ok", row.reason || `Posted to ${row.servers} server${row.servers === 1 ? "" : "s"}! It's on the board below.`);
        tt.update(`It's live in ${row.servers} server${row.servers === 1 ? "" : "s"} and on the board.`, "ok", { title: "Trade ad posted!" });
        load();
        return;
      }
      if (row && row.status === "rejected") { done("bad", row.reason || "Bloombot couldn't post that trade ad."); tt.update(row.reason || "Bloombot couldn't post that trade ad.", "bad", { title: "Trade ad not posted" }); return; }
      if (Date.now() - started > 90000) {
        done("wait", "Bloombot hasn't picked it up yet. If the bot is offline it will post when it's back.");
        tt.update("Bloombot seems busy or offline. It will post your ad when it's back.", "info", { title: "Still waiting" });
        return;
      }
      status("wait", row && row.status === "processing" ? "Posting to every server…" : "Waiting for Bloombot…");
      if (row && row.status === "processing" && tt.text !== "Posting to every server…") tt.update("Posting to every server…", "wait", { title: "Posting your trade ad" });
      setTimeout(poll, 2500);
    };
    setTimeout(poll, 1500);
  }

  function show(session) {
    $("loading").hidden = true;
    if (BB.loginError) { $("loginerr").hidden = false; $("loginerr").textContent = "Login failed: " + BB.loginError; }
    if (!session) {
      $("login").hidden = false; $("board").hidden = true;
      clearInterval(timer);
      return;
    }
    const u = BB.user(session);
    if (me === u.id && timer) return; // same login fired twice
    me = u.id;
    $("meav").src = u.avatar;
    $("mename").textContent = u.name;
    $("login").hidden = true; $("board").hidden = false;
    if (new URLSearchParams(location.search).get("mine")) $("mine").checked = true;
    if (location.hash.startsWith("#post")) setTimeout(() => { $("post").scrollIntoView({ block: "center" }); $("hq").focus(); }, 50);
    BB.loadValues().then(v => { prepUnits(v); render(); preview(); prefill(v); }).catch(() => {});
    load();
    loadLimit();
    clearInterval(timer);
    timer = setInterval(load, 60000);
  }

  const reset = () => { shown = PAGE; render(); };
  $("adq").oninput = reset;
  $("mine").onchange = reset;
  $("adsort").onchange = reset;
  $("more").onclick = () => { shown += PAGE; render(); };
  document.querySelectorAll("[data-q]").forEach(b => b.onclick = () => { $("adq").value = b.dataset.q; reset(); });
  $("adtext").oninput = counter;
  $("adtext").onkeydown = e => { if (e.key === "Enter" && !e.shiftKey && !e.isComposing) { e.preventDefault(); post(); } };
  $("postform").onsubmit = post;
  $("adclear").onclick = () => { clearComposer(); status("", ""); };
  picker("have", "hq", "hsug");
  picker("want", "wq", "wsug");
  drawChips();
  counter();
  BB.onAuth(show);
})();
