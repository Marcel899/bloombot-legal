/* Advent calendar: countdown, doors and prizes.
   Doors open at 00:00 UTC, one a day, 1–24 December. Opening today's door gives XP
   (paid by the bot), a ticket for the Infectia draw and, if a hidden unit has dropped,
   that unit. Everything is checked by adv_status / adv_open / adv_draw (sql/advent.sql);
   the page only shows what the server says. Only today's door opens: the others
   wiggle and say when they open (or that they were missed). */
(() => {
  const $ = id => document.getElementById(id);
  const box = $("xmcd");
  if (!box) return;
  const { el } = BB;
  const pad = n => String(n).padStart(2, "0");
  const XP = d => (d === 24 ? 250 : 50);
  const YEAR = 2026;  // the doors are 1-24 December 2026 (sql/advent.sql)
  const doorOfClock = now => (now.getUTCFullYear() === YEAR && now.getUTCMonth() === 11 && now.getUTCDate() <= 24 ? now.getUTCDate() : null);
  const isOver = now => now.getTime() >= Date.UTC(YEAR, 11, 25);
  const cells = [...document.querySelectorAll(".xm-cell")];
  const cellOf = d => document.querySelector('.xm-cell[data-day="' + d + '"]');
  let markedDay = null, last = {};
  let st = null, me = null, imgs = {}, busy = false, coolUntil = 0, drew = false, reloadedFor, grandShown = false;

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
    const waiting = me && st && st.today === d && !opened;
    if (m === 11 && d <= 23) return { at: Date.UTC(y, 11, d + 1), title: waiting ? "Door " + d + " closes in" : "Door " + (d + 1) + " opens in" };
    if (m === 11 && d === 24) return { at: Date.UTC(y, 11, 25), title: waiting ? "Door 24 closes in" : "Infectia draw in" };
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

  /* ── doors: only today's opens; the others wiggle and say when they open ── */
  const opensAt = d => {
    const t = new Date(Date.UTC(YEAR, 11, d));
    return t.toLocaleDateString([], { weekday: "long", day: "numeric", month: "long" }) + " at " + t.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };
  let doorToast = null;
  function nope(c, text, title) {
    c.classList.remove("nope");
    void c.offsetWidth;
    c.classList.add("nope");
    /* one door message at a time: the next door's replaces it */
    if (doorToast) doorToast.close();
    doorToast = BB.toast(text, "info", { title });
  }
  function press(c) {
    const d = +c.dataset.day, now = new Date();
    if (c.classList.contains("opened")) return;
    const today = st ? st.today : doorOfClock(now);
    if (today === d) {
      if (!me) return BB.toast("Log in to open today's door and win prizes.", "info", { title: "Door " + d, action: { label: "Log in", run: () => BB.login() } });
      return openDoor(d, false);
    }
    if (isOver(now)) return nope(c, "The advent calendar is over. Merry Christmas!", "Door " + d);
    if (today != null && d < today) return nope(c, "Each door can only be opened on its own day.", "Door " + d + " was missed");
    nope(c, "It opens on " + opensAt(d) + ".", "Door " + d + " is still locked");
  }
  cells.forEach(c => {
    c.addEventListener("click", () => press(c));
    c.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); press(c); } });
    c.addEventListener("animationend", e => { if (e.animationName === "xmNope") c.classList.remove("nope"); });
  });

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

  /* What it takes to win a unit, in the order adv_why_not checks it: the server
     names the first thing missing, so the ones before it are done and the ones
     after it aren't checked yet. */
  const CHECKS = [
    ["profile", "Bloombot account", "Set up", "profile.html#edit"],
    ["verify", "Verified Roblox account", "Verify", "profile.html#edit"],
    ["level", "Level 3 or higher", "Get XP", "levels.html"],
    ["new", "Account at least 7 days old", null, null],
  ];
  const WHY_SHORT = {
    profile: "Create your Bloombot account first.", verify: "Verify your Roblox account to win units.",
    level: "Reach level 3 to win units.", new: "Your Bloombot account needs to be 7 days old to win units.",
  };
  function canWin(why) {
    if (why === "won") {
      return el("p", "xm-why ok", "You found a unit! It's one per person, but doors still give XP and Infectia tickets.");
    }
    const at = CHECKS.findIndex(c => c[0] === why);
    const box = el("div", "xm-can" + (at < 0 ? " all" : ""));
    box.append(el("p", "xm-can-h", at < 0 ? "You can win units" : "To win units you need"));
    const ul = el("ul");
    CHECKS.forEach(([, label, act, href], i) => {
      const state = at < 0 || i < at ? "ok" : i === at ? "no" : "todo";
      const li = el("li", "c-" + state);
      li.append(el("span", "xm-ck"), el("span", null, label));
      if (state === "no" && act) { const a = el("a", null, act); a.href = href; li.append(a); }
      ul.append(li);
    });
    box.append(ul);
    return box;
  }

  /* ── confetti ── */
  const CONF = ["#ffd24a", "#e33a48", "#3ddc84", "#4fb3ff", "#ffffff", "#ff8fd0"];
  function confetti(host, n, spread) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, r = spread * (0.45 + Math.random() * 0.55);
      const p = el("i");
      p.style.setProperty("--x", Math.round(Math.cos(a) * r) + "px");
      p.style.setProperty("--y", Math.round(Math.sin(a) * r * 0.8 - spread * 0.25) + "px");
      p.style.setProperty("--r", Math.round(Math.random() * 720 - 360) + "deg");
      p.style.setProperty("--c", CONF[i % CONF.length]);
      p.style.setProperty("--d", Math.round(Math.random() * 120) + "ms");
      if (i % 3 === 0) p.className = "dot";
      host.append(p);
    }
    return host;
  }
  /* a burst out of a door that just opened */
  function burst(c) {
    const b = confetti(el("span", "xm-burst"), 22, 110);
    c.classList.add("fx");
    c.append(b);
    setTimeout(() => { b.remove(); c.classList.remove("fx"); }, 1400);
  }

  function draw() {
    if (!st) {
      $("xmme-b").replaceChildren(el("p", "xm-rs", "Prizes aren't switched on yet. Check back soon."));
      $("xmgrand").replaceChildren();
      return;
    }
    const opened = new Map((st.opened || []).map(o => [o.day, o]));
    const n = opened.size, today = st.today;
    /* doors */
    const over = isOver(new Date(st.now));
    cells.forEach(c => {
      const d = +c.dataset.day, o = opened.get(d);
      const missed = !o && (over || (today != null && d < today));
      const locked = !o && !missed && today !== d;
      c.classList.toggle("opened", !!o);
      c.classList.toggle("missed", missed && !!me);
      c.classList.toggle("locked", locked);
      c.classList.toggle("can-open", !o && today === d);
      const state = o ? "opened" : today === d ? "open today" : missed ? (me ? "missed" : "closed") : "opens " + opensAt(d);
      c.setAttribute("aria-label", "December " + d + ", " + state);
      c.title = state.charAt(0).toUpperCase() + state.slice(1);
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
      [["XP earned", "+" + xp], ["Banners", n >= 24 ? "2 unlocked" : n >= 12 ? "1 unlocked" : (12 - n) + " doors to go"]]
        .forEach(([k, v]) => { const li = el("li"); li.append(el("span", null, k), el("b", null, v)); stats.append(li); });
      const out = [big, bar, stats];
      if (n >= 12) { const a = el("a", "xm-link", "Use your banner"); a.href = "profile.html#edit"; out.push(a); }
      out.push(canWin(st.why));
      if (today && !opened.has(today) && st.why !== "profile") {
        const b = el("button", "brick green", "Open door " + today);
        b.type = "button"; b.onclick = () => openDoor(today, false);
        out.push(b);
      }
      meB.replaceChildren(...out);
    }
    /* hidden units: one card per unit, with the days it drops */
    const groups = [];
    (st.prizes || []).forEach(p => {
      let g = groups.find(x => x.unit === p.unit);
      if (!g) groups.push(g = { unit: p.unit, days: [] });
      g.days.push(p);
    });
    $("xmdrops").replaceChildren(...groups.map(g => {
      const live = g.days.some(p => p.state === "hunt" && p.day === today);
      const li = el("li", "xm-u" + (g.days.some(p => p.mine) ? " xm-you" : "") + (live ? " xm-live" : ""));
      const found = g.days.filter(p => p.state === "won").length;
      const head = el("div", "xm-uh"), name = el("div");
      name.append(el("strong", null, g.unit), el("span", null, found + " of " + g.days.length + " found"));
      head.append(img(g.unit, "xm-ui"), name);
      const days = el("ul", "xm-ud");
      g.days.forEach(p => {
        const now = p.state === "hunt" && p.day === today;
        const text = p.state === "won" ? (p.mine ? "You found it!" : "Found by " + (p.winner || "someone"))
          : p.state === "hunt" ? (now ? "Drops today" : "Still hidden") : p.state === "gone" ? "Not found" : "Coming";
        const row = el("li", "st-" + p.state + (p.mine ? " xm-you" : "") + (now ? " now" : ""));
        row.title = "Dec " + p.day + ": " + text;
        row.append(el("b", null, "Dec " + p.day), el("span", null, text));
        days.append(row);
      });
      li.append(head, days);
      return li;
    }));
    drawHunt();
    drawGet();
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
      if (!g.winner) out.push(el("p", "xm-rs xm-gtip", "Open every door for the most tickets. The same rules as the units decide who can win."));
      if (g.winner) out.push(el("p", "xm-why ok", g.mine ? "You won the Infectia! Check your Discord DMs." : "Won by " + g.winner + ". Merry Christmas!"));
      gb.replaceChildren(...out);
      if (g.mine && me && !grandShown) {
        grandShown = true;
        const k = "bb_adv_infectia_" + me;
        let seen = null;
        try { seen = localStorage.getItem(k); } catch (e) { /* storage blocked */ }
        if (!seen) {
          try { localStorage.setItem(k, "1"); } catch (e) { /* show it anyway */ }
          win(g.unit, { grand: true });
        }
      }
    }
  }

  /* "What you can get": the real unit pictures once the value list has them */
  function drawGet() {
    const units = [...new Set((st && st.prizes || []).map(p => p.unit))].filter(u => imgs[u]);
    const box = $("xmg-units");
    if (box && units.length) {
      box.classList.add("many");
      box.replaceChildren(...units.slice(0, 4).map(u => img(u)));
    }
    const inf = $("xmg-inf"), g = st && st.grand;
    if (inf && g && imgs[g.unit]) { inf.classList.add("unit"); inf.replaceChildren(img(g.unit)); }
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
    const fresh = !!(res && res.opened);
    if (c) {
      c.classList.remove("opening");
      if (fresh) { c.classList.add("opened", "pop"); burst(c); setTimeout(() => c.classList.remove("pop"), 900); }
    }
    await load();
    if (res && res.won) win(res.won, { day, fresh });
    else if (fresh) setTimeout(() => reveal(day), 450);
    else BB.toast("No unit yet. It drops at a secret time today, so check back later.", "info", { title: "Nothing here yet" });
  }

  function dialog(cls, label) {
    const d = el("dialog", cls);
    d.setAttribute("aria-labelledby", label);
    d.addEventListener("close", () => d.remove());
    d.addEventListener("click", e => { if (e.target === d) d.close(); });
    return d;
  }
  const icon = src => { const i = el("img"); i.src = src; i.alt = ""; return i; };
  const an = name => (/^[aeiou]/i.test(name) ? "an " : "a ") + name;

  /* the card after opening a door: what you got and what's next */
  function reveal(day) {
    const n = Math.max(1, (st && st.opened || []).length);
    const d = dialog("xm-pop", "xmpop-h");
    const tag = el("div", "xm-pop-n", String(day));
    const h = el("h2", null, day === 24 ? "Merry Christmas Eve!" : "Door " + day + " opened!"); h.id = "xmpop-h";
    const got = el("ul", "xm-pop-got");
    [["img/lightning.png", "+" + XP(day) + " XP", "added in a few seconds"], ["img/cur/tickets-2.webp", "+1 ticket", "for the Infectia draw"]]
      .forEach(([src, big, small]) => { const li = el("li"); li.append(icon(src), el("b", null, big), el("span", null, small)); got.append(li); });
    const next = n < 12 ? [12, "the Advent banner"] : n < 24 ? [24, "the Golden Advent banner"] : null;
    const bar = el("div", "xm-pbar xm-pop-bar"); const fill = el("i"); fill.style.width = (n / 24 * 100) + "%"; bar.append(fill);
    const prog = el("p", "xm-pop-prog");
    prog.append(el("b", null, n + " / 24 doors"), document.createTextNode(next ? " · " + (next[0] - n) + " more for " + next[1] : " · both banners are yours!"));
    const out = [tag, h, got, prog, bar];
    const hunt = (st && st.prizes || []).find(p => p.state === "hunt" && p.day === day);
    const why = st && st.why;
    if (hunt && !why) {
      const p = el("p", "xm-pop-hint");
      p.append(img(hunt.unit, "xm-pop-u"), el("span", null, "There's " + an(hunt.unit) + " hidden behind this door. It drops at a secret time today: come back and press Look for the drop."));
      out.push(p);
    } else if (why && why !== "won" && WHY_SHORT[why]) {
      const p = el("p", "xm-pop-hint");
      const c = CHECKS.find(x => x[0] === why);
      p.append(el("span", null, WHY_SHORT[why] + " "));
      if (c && c[2]) { const a = el("a", null, c[2]); a.href = c[3]; p.append(a); }
      out.push(p);
    } else if (!hunt) out.push(el("p", "xm-pop-hint quiet", "No unit is hidden behind this door. See you tomorrow!"));
    const b = el("button", "brick green", "Nice!"); b.type = "button"; b.onclick = () => d.close();
    out.push(b);
    d.append(...out);
    document.body.append(d);
    d.showModal();
  }

  /* you found a unit (or won the Infectia) */
  function win(unit, o = {}) {
    const d = dialog("xm-win", "xmwin-h");
    const fx = confetti(el("div", "xm-fx"), 46, 230);
    const pic = el("div", "xm-wpic"); pic.append(el("i", "xm-rays"), img(unit));
    const kick = el("p", "xm-kick", o.grand ? "Christmas Eve draw" : "Hidden unit found" + (o.day ? " · door " + o.day : ""));
    const h = el("h2", null, (o.grand ? "You won the " + unit : "You found " + an(unit)) + "!"); h.id = "xmwin-h";
    const out = [fx, pic, kick, h];
    if (o.fresh) {
      const chips = el("ul", "xm-wchips");
      [["img/lightning.png", "+" + XP(o.day) + " XP"], ["img/cur/tickets-2.webp", "+1 Infectia ticket"]]
        .forEach(([src, t]) => { const li = el("li"); li.append(icon(src), el("span", null, t)); chips.append(li); });
      out.push(chips);
    }
    const steps = el("ol", "xm-steps");
    [["img/discord_stud.png", "Bloombot sends you a DM on Discord."],
     ["img/rbx_stud.png", "The Bloombot team trades the " + unit + " to your verified Roblox account."],
     ["img/envelope.png", "Keep your Discord DMs open so they can reach you."]]
      .forEach(([src, t]) => { const li = el("li"); li.append(icon(src), el("span", null, t)); steps.append(li); });
    out.push(el("p", "xm-steps-h", "What happens now"), steps);
    const b = el("button", "brick green", "Yay!"); b.type = "button"; b.onclick = () => d.close();
    out.push(b);
    d.append(...out);
    document.body.append(d);
    d.showModal();
  }

  BB.onAuth(s => { me = s && BB.user(s).id; load(); });
  tick();
  setTimeout(() => { tick(); setInterval(tick, 1000); }, 1000 - (Date.now() % 1000));
})();
