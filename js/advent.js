/* Advent calendar: countdown, doors and prizes.
   Doors open at 00:00 UTC, one a day, 1–24 December. Opening today's door gives XP
   (paid by the bot), a ticket for the Infectia draw and, if a hidden unit has dropped,
   that unit. Everything is checked by adv_status / adv_open / adv_draw (sql/advent.sql);
   the page only shows what the server says. Before December, or logged out, the
   doors are just for peeking. */
(() => {
  const $ = id => document.getElementById(id);
  const box = $("xmcd");
  if (!box) return;
  const { el } = BB;
  const pad = n => String(n).padStart(2, "0");
  const XP = d => (d === 24 ? 250 : 50);
  const cells = [...document.querySelectorAll(".xm-cell")];
  const cellOf = d => document.querySelector('.xm-cell[data-day="' + d + '"]');
  let markedDay = null, last = {};
  let st = null, me = null, imgs = {}, busy = false, coolUntil = 0, drew = false, reloadedFor;

  /* ── countdown (UTC, like the doors) ── */
  function mark(day, label) {
    if (markedDay === day + label) return;
    markedDay = day + label;
    document.querySelectorAll(".xm-cell.next").forEach(c => c.classList.remove("next"));
    document.querySelectorAll(".xm-flag").forEach(f => f.remove());
    const cell = cellOf(day);
    if (!cell) return;
    cell.classList.add("next");
    cell.append(el("span", "xm-flag", label));
  }
  function goal(now) {
    const y = now.getUTCFullYear(), m = now.getUTCMonth(), d = now.getUTCDate();
    const opened = st && st.opened && st.opened.some(o => o.day === d);
    if (m === 11 && d <= 24) mark(d, opened ? "Opened" : me ? "Open me!" : "Today");
    if (m === 11 && d <= 23) return { at: Date.UTC(y, 11, d + 1), title: "Door " + (d + 1) + " opens in" };
    if (m === 11 && d === 24) return { at: Date.UTC(y, 11, 25), title: "Infectia draw in" };
    if (m === 11) return { done: "Merry Christmas from Bloombot!" };
    mark(1, "Next");
    return { at: Date.UTC(y, 11, 1), title: "Door 1 opens in" };
  }
  function set(id, v) {
    if (last[id] === v) return;
    last[id] = v;
    const b = $(id);
    b.textContent = v;
    b.classList.remove("tick");
    void b.offsetWidth;
    b.classList.add("tick");
  }
  function tick() {
    const now = new Date(), g = goal(now);
    box.hidden = false;
    if (g.done) {
      $("xmcd-row").hidden = true;
      $("xmcd-h").textContent = "It's Christmas!";
      $("xmcd-x").hidden = false;
      $("xmcd-x").textContent = g.done;
      return;
    }
    $("xmcd-h").textContent = g.title;
    let s = Math.max(0, Math.floor((g.at - now) / 1000));
    const days = Math.floor(s / 86400); s -= days * 86400;
    const h = Math.floor(s / 3600); s -= h * 3600;
    const mi = Math.floor(s / 60); s -= mi * 60;
    $("xmcd-dt").hidden = $("xmcd-dc").hidden = days === 0;
    $("xmcd-dl").textContent = days === 1 ? "day" : "days";
    set("xmcd-d", String(days));
    set("xmcd-hh", pad(h));
    set("xmcd-mm", pad(mi));
    set("xmcd-ss", pad(s));
    box.setAttribute("aria-label", g.title + " " + (days ? days + (days === 1 ? " day, " : " days, ") : "") + h + " hours and " + mi + " minutes");
    /* a new door opened while the page was open */
    const cd = now.getUTCMonth() === 11 && now.getUTCDate() <= 24 ? now.getUTCDate() : null;
    if (st && cd !== st.today && cd !== reloadedFor && !busy) { reloadedFor = cd; load(); }
    if (coolUntil) drawHunt();
  }
  const tz = $("xmtz");
  if (tz) tz.textContent = new Date(Date.UTC(2026, 11, 1)).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) + " your time";

  /* ── peeking (any door that isn't today's to open) ── */
  const peek = (cell, on) => {
    cells.forEach(c => { if (c !== cell && c.classList.contains("peek")) { c.classList.remove("peek"); c.setAttribute("aria-pressed", "false"); } });
    cell.classList.toggle("peek", on);
    cell.setAttribute("aria-pressed", String(on));
  };
  function press(c) {
    const d = +c.dataset.day;
    if (st && st.today === d && !c.classList.contains("opened")) {
      if (!me) {
        BB.toast("Log in to open today's door and win prizes.", "info", { title: "Door " + d, action: { label: "Log in", run: () => BB.login() } });
        return peek(c, !c.classList.contains("peek"));
      }
      return openDoor(d, false);
    }
    if (!c.classList.contains("opened")) peek(c, !c.classList.contains("peek"));
  }
  cells.forEach(c => {
    c.addEventListener("click", () => press(c));
    c.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); press(c); } });
  });
  document.addEventListener("click", e => { if (!e.target.closest(".xm-cell")) cells.forEach(c => c.classList.contains("peek") && peek(c, false)); });

  /* ── data ── */
  const img = (name, cls) => BB.itemImg(imgs[name] || {}, cls);
  BB.loadValues && BB.loadValues().then(list => {
    (list || []).forEach(v => { imgs[v.name] = v; });
    if (st) draw();
  }).catch(() => {});

  async function load() {
    try {
      const { data, error } = await BB.sb.rpc("adv_status");
      st = error ? null : data;
    } catch (e) { st = null; }
    /* door 24 has closed: ask for the draw once (the server only draws once) */
    if (st && st.grand && !st.grand.winner && !drew && new Date(st.now) >= new Date(st.grand.draw_at)) {
      drew = true;
      try { await BB.sb.rpc("adv_draw"); } catch (e) { /* next visit */ }
      return load();
    }
    draw();
    /* XP being paid: look again shortly */
    clearTimeout(load.t);
    if (st && st.opened && st.opened.some(o => o.status === "pending" || o.status === "processing")) load.t = setTimeout(load, 3000);
  }

  const WHY = {
    verify: ["Verify your Roblox account to win units.", "Verify", "profile.html#edit"],
    level: ["Reach level 3 to win units. Doors still give XP.", "Get XP", "levels.html"],
    new: ["Your Bloombot account needs to be 7 days old to win units.", null, null],
    profile: ["Create your Bloombot account to open doors.", "Set up", "profile.html#edit"],
    won: ["You've won a unit! Doors still give XP and Infectia tickets.", null, null],
  };

  function draw() {
    if (!st) {
      $("xmme-b").replaceChildren(el("p", "xm-rs", "Prizes aren't switched on yet. Check back soon."));
      $("xmgrand").replaceChildren();
      return;
    }
    const opened = new Map((st.opened || []).map(o => [o.day, o]));
    const n = opened.size, today = st.today;
    /* doors */
    cells.forEach(c => {
      const d = +c.dataset.day, o = opened.get(d);
      c.classList.toggle("opened", !!o);
      c.classList.toggle("missed", !o && !!me && today != null && d < today);
      c.classList.toggle("can-open", !o && today === d);
      c.setAttribute("aria-label", "December " + d + (o ? ", opened" : today === d ? ", open today" : ""));
      let got = c.querySelector(".xm-got");
      if (o) {
        if (!got) { got = el("span", "xm-got"); c.querySelector(".xm-in").append(got); }
        got.textContent = o.status === "given" ? "+" + XP(d) + " XP" : o.status === "failed" ? "No XP" : "+" + XP(d) + " XP…";
        if (o.status === "failed" && o.reason) got.title = o.reason;
      } else if (got) got.remove();
      const pz = (st.prizes || []).find(p => p.day === d);
      let tag = c.querySelector(".xm-prz");
      if (pz) {
        if (!tag) { tag = el("span", "xm-prz"); c.append(tag); }
        tag.replaceChildren(img(pz.unit));
        tag.classList.toggle("won", pz.state === "won");
        tag.title = pz.unit + (pz.state === "won" ? " (found)" : " hidden here");
      } else if (tag) tag.remove();
    });
    markedDay = null;
    /* your card */
    const meB = $("xmme-b");
    if (!me) {
      const b = el("button", "brick green", "Log in to play");
      b.type = "button"; b.dataset.login = "";
      meB.replaceChildren(el("p", "xm-rs", "Log in with Discord to open doors, earn XP and win units."), b);
    } else {
      const big = el("p", "xm-big");
      big.append(el("b", null, String(n)), el("span", null, " / 24 doors"));
      const bar = el("div", "xm-pbar");
      bar.setAttribute("role", "progressbar");
      bar.setAttribute("aria-valuemin", "0"); bar.setAttribute("aria-valuemax", "24"); bar.setAttribute("aria-valuenow", String(n));
      bar.setAttribute("aria-label", "Doors opened");
      const fill = el("i"); fill.style.width = (n / 24 * 100) + "%";
      bar.append(fill);
      [[12, "xmas", "Advent"], [24, "xmasgold", "Golden"]].forEach(([at, k, name]) => {
        const m = el("span", "xm-mk" + (n >= at ? " on" : ""));
        m.style.left = (at / 24 * 100) + "%";
        const sw = el("span", "pban"); sw.dataset.banner = k;
        m.append(sw, el("em", null, name));
        m.title = name + " banner at " + at + " doors";
        bar.append(m);
      });
      const xp = [...opened.entries()].reduce((a, [d, o]) => a + (o.status !== "failed" ? XP(d) : 0), 0);
      const stats = el("ul", "xm-stats");
      [["XP earned", "+" + xp], ["Infectia tickets", String(n)], ["Banners", n >= 24 ? "2 unlocked" : n >= 12 ? "1 unlocked" : (12 - n) + " doors to go"]]
        .forEach(([k, v]) => { const li = el("li"); li.append(el("span", null, k), el("b", null, v)); stats.append(li); });
      const out = [big, bar, stats];
      if (n >= 12) { const a = el("a", "xm-link", "Use your banner"); a.href = "profile.html#edit"; out.push(a); }
      const w = st.why && WHY[st.why];
      if (w) {
        const p = el("p", "xm-why" + (st.why === "won" ? " ok" : ""), w[0] + " ");
        if (w[1]) { const a = el("a", null, w[1]); a.href = w[2]; p.append(a); }
        out.push(p);
      }
      if (today && !opened.has(today) && st.why !== "profile") {
        const b = el("button", "brick green", "Open door " + today);
        b.type = "button"; b.onclick = () => openDoor(today, false);
        out.push(b);
      }
      meB.replaceChildren(...out);
    }
    /* drops */
    const fmt = d => "Dec " + d;
    $("xmdrops").replaceChildren(...(st.prizes || []).map(p => {
      const li = el("li", "xm-d st-" + p.state + (p.mine ? " mine" : "") + (p.day === today && p.state === "hunt" ? " now" : ""));
      li.append(img(p.unit, "xm-di"), el("span", "xm-dn", p.unit));
      const chip = p.state === "won" ? (p.mine ? "You found it!" : "Found by " + (p.winner || "someone"))
        : p.state === "hunt" ? (p.day === today ? "Drops today" : "Still hidden")
        : p.state === "gone" ? "Not found" : "Coming";
      const sub = el("span", "xm-chip");
      sub.append(el("b", "xm-dd", fmt(p.day)), document.createTextNode(" · " + chip));
      li.append(sub);
      return li;
    }));
    drawHunt();
    /* Infectia */
    const g = st.grand;
    const gb = $("xmgrand");
    if (g) {
      const head = el("div", "xm-gh");
      const pic = el("div", "xm-gpic"); pic.append(img(g.unit));
      const t = el("div");
      t.append(el("strong", null, g.unit), el("span", "xm-rs", "Every door you open is one ticket."));
      head.append(pic, t);
      const rows = el("ul", "xm-stats");
      const when = new Date(g.draw_at);
      [["Your tickets", me ? String(n) : "Log in"], ["Players", String(g.players || 0)],
       ["Draw", g.winner ? "Done" : when.toLocaleString([], { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })]]
        .forEach(([k, v]) => { const li = el("li"); li.append(el("span", null, k), el("b", null, v)); rows.append(li); });
      const out = [head, rows];
      if (g.winner) out.push(el("p", "xm-why ok", g.mine ? "You won the Infectia! Check your Discord DMs." : "Won by " + g.winner + ". Merry Christmas!"));
      gb.replaceChildren(...out);
    }
  }

  /* "Look for the drop": today's door is open, a unit is still hidden and you can win */
  function drawHunt() {
    const h = $("xmhunt");
    if (!h) return;
    const today = st && st.today;
    const ok = st && me && today && !st.why && (st.opened || []).some(o => o.day === today) && (st.prizes || []).some(p => p.state === "hunt");
    if (!ok) { h.replaceChildren(); coolUntil = 0; return; }
    const left = Math.ceil((coolUntil - Date.now()) / 1000);
    let b = h.querySelector("button");
    if (!b) {
      b = el("button", "brick yellow");
      b.type = "button";
      b.onclick = () => openDoor(today, true);
      h.replaceChildren(b);
    }
    b.disabled = left > 0 || busy;
    b.textContent = left > 0 ? "Look again in " + left + "s" : "Look for the drop";
    if (left <= 0) coolUntil = 0;
  }

  async function openDoor(day, again) {
    if (busy) return;
    busy = true;
    const c = cellOf(day);
    if (c && !again) c.classList.add("opening");
    let res;
    try {
      const { data, error } = await BB.sb.rpc("adv_open", { p_day: day });
      if (error) throw error;
      res = data;
    } catch (e) {
      busy = false;
      if (c) c.classList.remove("opening");
      const m = (e && e.message) || "";
      if (/adv:slow/.test(m)) { coolUntil = Date.now() + 20000; drawHunt(); return; }
      BB.toast(/adv:profile/.test(m) ? "Create your Bloombot account first." : /adv:login/.test(m) ? "Log in again and retry."
        : /adv:not_today|adv:closed/.test(m) ? "That door isn't open today." : /function|schema/i.test(m) ? "Prizes aren't switched on yet. Try again later." : "Couldn't open it. Try again.", "bad", { title: "Door not opened" });
      load();
      return;
    }
    busy = false;
    coolUntil = Date.now() + 20000;
    if (c) {
      c.classList.remove("opening");
      peek(c, false);
      if (res && res.opened) { c.classList.add("opened", "pop"); setTimeout(() => c.classList.remove("pop"), 900); }
    }
    if (res && res.won) win(res.won);
    else if (res && res.opened) BB.toast("+" + XP(day) + " XP and 1 Infectia ticket.", "ok", { title: "Door " + day + " opened" });
    else BB.toast("No unit yet. It drops at a secret time today, so check back later.", "info", { title: "Nothing here yet" });
    load();
  }

  /* you found a unit */
  function win(unit) {
    const d = el("dialog", "xm-win");
    d.setAttribute("aria-labelledby", "xmwin-h");
    const pic = el("div", "xm-wpic"); pic.append(img(unit));
    const h = el("h2", null, "You found a " + unit + "!"); h.id = "xmwin-h";
    const b = el("button", "brick green", "Yay!"); b.type = "button";
    b.onclick = () => d.close();
    d.append(pic, h, el("p", null, "Bloombot will DM you on Discord. Someone from the Bloombot team trades it to your verified Roblox account, so keep your DMs open."), b);
    d.addEventListener("close", () => d.remove());
    document.body.append(d);
    d.showModal();
  }

  BB.onAuth(s => { me = s && BB.user(s).id; load(); });
  tick();
  setTimeout(() => { tick(); setInterval(tick, 1000); }, 1000 - (Date.now() % 1000));
})();
