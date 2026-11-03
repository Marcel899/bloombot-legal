/* Trade ads page: live ads for logged-in users, and posting an ad from the site. */
(() => {
  const $ = id => document.getElementById(id);
  const { el } = BB;
  let ads = [], me = null, timer = null, units = [], shown = 24;
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
    head.append(av, who);
    if (own) head.append(el("span", "tag", "Yours"));
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
    $("postbtn").disabled = busy || n < MIN || n > MAX;
    preview();
  }
  function preview() {
    const t = $("adtext").value.trim();
    $("adprev").hidden = !t;
    if (t) $("adprevbody").replaceChildren(adText(t));
  }
  function status(kind, text) {
    const s = $("poststatus");
    s.hidden = !text;
    s.className = "post-status " + kind;
    s.textContent = text || "";
  }

  /* Composer: pick units for each side and the ad text writes itself. */
  const pick = { have: [], want: [], tags: new Set() };
  const qty = r => (r.qty > 1 ? r.qty + "x " : "");
  function compose() {
    const side = (list, extra) => {
      const parts = list.map(r => qty(r) + r.item.name);
      let t = parts.length > 2 ? parts.slice(0, -1).join(", ") + " and " + parts[parts.length - 1] : parts.join(" and ");
      if (extra) t += (t ? " + " : "") + extra;
      return t;
    };
    const haveExtra = pick.tags.has("have-add") ? "add" : "";
    let have = side(pick.have, haveExtra);
    if (pick.tags.has("have-bulk") && have) have = "bulk " + have;
    const wantBits = [];
    if (pick.tags.has("want-overpay")) wantBits.push("overpay");
    let want = side(pick.want, pick.tags.has("want-add") ? "add" : "");
    if (!want && (pick.tags.has("want-offers") || pick.have.length)) want = "offers";
    if (wantBits.length) want = want ? want + " (" + wantBits.join(", ") + ")" : wantBits.join(", ");
    let text = "";
    if (have && want) text = have + " for " + want;
    else if (have) text = "trading " + have;
    else if (pick.want.length) text = "LF " + want;
    $("adtext").value = text;
    counter();
  }
  function drawChips() {
    for (const [key, box] of [["have", "hchips"], ["want", "wchips"]]) {
      $(box).replaceChildren(...pick[key].map(r => {
        const c = el("span", "pchip");
        c.append(BB.itemImg(r.item, "pimg"), el("span", null, r.item.name));
        const q = el("button", "pq", "×" + r.qty);
        q.type = "button";
        q.title = "Change amount";
        q.onclick = () => { r.qty = r.qty >= 9 ? 1 : r.qty + 1; drawChips(); compose(); };
        const x = el("button", "px", "×");
        x.type = "button";
        x.setAttribute("aria-label", "Remove " + r.item.name);
        x.onclick = () => { pick[key].splice(pick[key].indexOf(r), 1); drawChips(); compose(); };
        c.append(q, x);
        return c;
      }));
    }
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
      if (have) have.qty = Math.min(9, have.qty + 1);
      else if (pick[key].length < 6) pick[key].push({ item: it, qty: 1 });
      if (key === "want") pick.tags.delete("want-offers"), syncTags();
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
    if (pick.tags.has(t)) pick.tags.delete(t); else pick.tags.add(t);
    if (t === "want-offers" && pick.tags.has(t)) pick.want = [];
    syncTags(); drawChips(); compose();
  });
  function clearComposer() {
    pick.have = []; pick.want = []; pick.tags.clear();
    syncTags(); drawChips();
    $("adtext").value = "";
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
    busy = true;
    counter();
    status("wait", "Sending your trade ad to Bloombot…");
    let data, error;
    try {
      ({ data, error } = await BB.sb.from("ad_submissions").insert({ content }).select("id").single());
    } catch (err) {
      error = { message: (err && err.message) || "network error" };
    }
    if (error) {
      busy = false;
      status("bad", /row-level security|violates/i.test(error.message)
        ? "You already have a trade ad waiting. Give it a few seconds."
        : /JWT|token|auth/i.test(error.message) ? "Your login expired. Log out and in again, then retry."
        : "Couldn't send it: " + error.message);
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
        BB.toast("Trade ad posted!");
        load();
        return;
      }
      if (row && row.status === "rejected") { done("bad", row.reason || "Bloombot couldn't post that trade ad."); return; }
      if (Date.now() - started > 90000) {
        done("wait", "Bloombot hasn't picked it up yet. If the bot is offline it will post when it's back.");
        return;
      }
      status("wait", row && row.status === "processing" ? "Posting to every server…" : "Waiting for Bloombot…");
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
    if (location.hash === "#post") setTimeout(() => { $("post").scrollIntoView({ block: "center" }); $("adtext").focus(); }, 50);
    BB.loadValues().then(v => { prepUnits(v); render(); preview(); }).catch(() => {});
    load();
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
  counter();
  BB.onAuth(show);
})();
