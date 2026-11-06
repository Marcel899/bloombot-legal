/* Levels page: your level bar, ranks, every perk, and one-time XP tasks (claim_xp_task in Supabase). */
(() => {
  const $ = id => document.getElementById(id);
  const { el } = BB;
  const calm = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const invite = (document.querySelector(".brick.add") || {}).href || "features.html";
  const support = (document.querySelector('a[href^="https://discord.gg/"]') || {}).href || "https://discord.gg/tGuXfcJxwf";

  /* What each rank adds. Discord perks come from bot/leveling.py RANKS; website ones are checked by Supabase. */
  const PERKS = {
    1: [["web", "Rank badge on your profile"], ["dc", "Earn XP from commands and trade ads"]],
    5: [["dc", "2s command cooldown (instead of 3s)"], ["web", "Aurora profile banner"]],
    10: [["dc", "Trade ads stay up for 36h (instead of 24h)"], ["dc", "Your trade ad is bumped every 30 minutes"], ["web", "Share a strategy every 5 minutes (instead of 10)"], ["web", "Lava profile banner"]],
    20: [["dc", "2x winning chance in Discord giveaways"], ["dc", "Auto-bump every 20 minutes"], ["web", "Glowing rank ring on your profile"], ["web", "Galaxy profile banner"]],
    35: [["dc", "1s command cooldown"], ["dc", "Trade ads stay up for 48h"], ["dc", "Auto-bump every 10 minutes"], ["web", "Share a strategy every 2 minutes"], ["web", "Royal profile banner"]],
    50: [["dc", "3x winning chance in Discord giveaways"], ["dc", "Auto-bump every 5 minutes"], ["web", "Golden shining name on your profile"], ["web", "Animated Ancient profile banner"]],
  };
  const BANNER_AT = { 5: "aurora", 10: "lava", 20: "galaxy", 35: "royal", 50: "ancient" };

  /* One-time tasks. XP must match xp_task_amount() in Supabase and XP_TASKS in the bot. */
  const TASKS = [
    { k: "account", t: "Create your Bloombot account", d: "Pick your Roblox name once. Takes 10 seconds.", xp: 50, ic: "task_user", go: "profile.html#edit", gl: "Set up" },
    { k: "roblox", t: "Verify your Roblox account", d: "Prove it's you with a short code in your Roblox About.", xp: 300, ic: "shield", go: "#verify", gl: "Verify" },
    { k: "in_server", t: "Join the official Bloombot Discord", d: "Our own server: news, giveaways and other traders. Counts after about 2 minutes.", xp: 200, ic: "envelope", go: support, gl: "Join", ext: true },
    { k: "add_bot", t: "Add Bloombot to your server", d: "Any server you own or run. Shows up within 3 minutes.", xp: 300, ic: "task_addbot", go: invite, gl: "Add", ext: true },
    { k: "google", t: "Connect a Google login", d: "Log in with Google next time. Handy on your phone.", xp: 150, ic: "task_google", run: () => BB.addGoogle(), gl: "Connect" },
    { k: "trade_ad", t: "Post a trade ad", d: "From the website or any Bloombot server.", xp: 150, ic: "trading", go: "trades.html#post", gl: "Post" },
    { k: "strategy", t: "Share a strategy", d: "Help other players beat a map.", xp: 200, ic: "bullseye", go: "strategies.html#share", gl: "Share" },
    { k: "server_link", t: "Add your private server link", d: "So traders can join you straight away.", xp: 100, ic: "task_link", go: "profile.html#edit", gl: "Add" },
    { k: "about", t: "Write an About me", d: "Ten characters or more in profile settings.", xp: 75, ic: "task_about", go: "profile.html#edit", gl: "Write" },
    { k: "banner", t: "Pick a profile banner", d: "Any colour you like. Some unlock with your rank.", xp: 50, ic: "task_banner", go: "profile.html#edit", gl: "Pick" },
    { k: "giveaway", t: "Enter a website giveaway", d: "Look for the gift in the bottom corner.", xp: 50, ic: "gift", run: openGiveaway, gl: "Open" },
  ];
  const TASK_TOTAL = TASKS.reduce((a, t) => a + t.xp, 0);

  let me = null, prof = null, claims = {}, shown = null, polling = null;

  function openGiveaway() {
    const b = document.querySelector(".gw-pill, .gw button");
    if (b) { b.click(); return; }
    BB.toast("No giveaway is running right now. Check back soon!", "info", { title: "No giveaway" });
  }
  const img = (src, cls) => {
    const i = el("img", cls); i.alt = ""; i.src = src;
    i.onerror = () => { if (i.src.indexOf("img/shield.png") < 0) i.src = "img/shield.png"; };
    return i;
  };
  const icon = n => img("img/" + n + ".png");
  const fmt = n => Math.round(n).toLocaleString();

  /* ── the big level card ── */
  function card(xp, opts = {}) {
    const L = BB.levelFromXp(xp), r = BB.rankFor(L.level);
    const nr = BB.RANKS.find(x => x.level > L.level);
    const c = $("lvcard");
    c.replaceChildren();
    c.style.setProperty("--rk", r.color);
    c.classList.toggle("demo", !!opts.demo);
    c.classList.toggle("ancient", r.level >= 50);

    const top = el("div", "lv-top");
    const em = el("div", "lv-em");
    em.append(el("span", "lv-em-ring"), img(r.icon, "lv-em-i"));
    const who = el("div", "lv-who");
    const name = el("div", "lv-rank");
    name.append(el("span", "lv-rank-n", r.name), el("span", "lv-rank-s", "rank"));
    const big = el("div", "lv-big");
    const num = el("strong", "lv-num", String(L.level));
    big.append(el("span", null, "Level"), num);
    who.append(name, big);
    top.append(em, who);
    const side = el("div", "lv-next");
    if (nr) {
      const left = BB.xpAtLevel(nr.level) - L.total;
      side.append(img(nr.icon, "lv-next-i"), el("span", null, "Next rank"), el("strong", null, nr.name), el("em", null, fmt(left) + " XP to go"));
    } else side.append(img(r.icon, "lv-next-i"), el("span", null, "Top rank"), el("strong", null, "Maxed out"), el("em", null, "Legend status"));
    top.append(side);
    c.append(top);

    const bar = el("div", "lv-bar");
    bar.setAttribute("role", "progressbar");
    bar.setAttribute("aria-label", "XP to level " + (L.level + 1));
    bar.setAttribute("aria-valuemin", "0");
    bar.setAttribute("aria-valuemax", String(L.need));
    bar.setAttribute("aria-valuenow", String(L.into));
    const fill = el("div", "lv-fill");
    fill.append(el("span", "lv-shine"), el("span", "lv-spark"));
    const ticks = el("div", "lv-ticks");
    for (let i = 1; i < 4; i++) ticks.append(el("i"));
    const motes = el("div", "lv-motes");
    if (!calm) for (let i = 0; i < 14; i++) {
      const m = el("i");
      m.style.left = (Math.random() * 100).toFixed(1) + "%";
      m.style.animationDelay = (Math.random() * 3.2).toFixed(2) + "s";
      m.style.animationDuration = (2.4 + Math.random() * 1.8).toFixed(2) + "s";
      motes.append(m);
    }
    bar.append(fill, ticks, motes);
    const legend = el("div", "lv-leg");
    const cur = el("strong", null, "0");
    legend.append(el("span", "lv-leg-a", "Level " + L.level), el("span", "lv-leg-x"), el("span", "lv-leg-b", "Level " + (L.level + 1)));
    legend.children[1].append(cur, document.createTextNode(" / " + fmt(L.need) + " XP"));
    c.append(bar, legend);

    const stats = el("div", "lv-stats");
    const st = (v, l, ic) => { const s = el("div", "lv-st"); s.append(icon(ic), el("strong", null, v), el("span", null, l)); return s; };
    const doneN = Object.values(claims).filter(x => x.status !== "failed").length;
    stats.append(st(fmt(L.total), "Total XP", "lightning"), st(Math.round(100 * L.into / L.need) + "%", "To next level", "chart_up"),
      st(doneN + "/" + TASKS.length, "Tasks done", "medal_gold"));
    c.append(stats);
    if (opts.demo) {
      const o = el("div", "lv-demo");
      const b = el("button", "brick green", "Log in to see your level");
      b.type = "button"; b.dataset.login = "";
      o.append(el("p", null, "This is an example. Log in with Discord to see your own level and claim XP."), b);
      c.append(o);
    }
    if (opts.noXp) c.append(el("p", "hint lv-wait", "Your exact XP shows up here a few minutes after your next command in Discord."));

    /* animate in: fill + count-up */
    const pct = 100 * L.into / L.need;
    const from = opts.from != null ? BB.levelFromXp(opts.from) : null;
    const start = from && from.level === L.level ? 100 * from.into / from.need : 0;
    fill.style.width = start + "%";
    const t0 = performance.now(), dur = calm ? 1 : 1400;
    const a0 = from && from.level === L.level ? from.into : 0;
    requestAnimationFrame(() => setTimeout(() => {
      fill.style.width = pct.toFixed(2) + "%";
      (function tick(t) {
        const k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3);
        cur.textContent = fmt(a0 + (L.into - a0) * e);
        if (k < 1) requestAnimationFrame(tick);
      })(performance.now());
    }, 80));
    if (pct > 92) bar.classList.add("close");
    shown = L;
    road(L.level);
  }

  /* level-up / XP gain show */
  function celebrate(fromXp, toXp, label) {
    const a = BB.levelFromXp(fromXp), b = BB.levelFromXp(toXp);
    const pop = el("div", "lv-gain", "+" + fmt(toXp - fromXp) + " XP");
    const c = $("lvcard");
    if (b.level > a.level) {
      /* fill to the end first, then flip to the new level */
      const f = c.querySelector(".lv-fill");
      if (f) f.style.width = "100%";
      c.append(pop);
      setTimeout(() => {
        card(toXp);
        const up = el("div", "lv-up");
        const rank = BB.rankFor(b.level), newRank = rank !== BB.rankFor(a.level);
        up.append(el("strong", null, newRank ? "New rank!" : "Level up!"), el("span", null, newRank ? rank.name + " unlocked" : "Level " + b.level));
        $("lvcard").append(up);
        setTimeout(() => up.remove(), 2600);
        if (BB.confetti) BB.confetti(newRank ? 200 : 120);
        if (newRank) BB.toast("You reached " + rank.name + ". Check your new perks below.", "ok", { title: "New rank" });
      }, calm ? 10 : 900);
    } else {
      card(toXp, { from: fromXp });
      $("lvcard").append(pop);
      if (BB.confetti) BB.confetti(60);
    }
    setTimeout(() => pop.remove(), 1900);
    if (label) BB.toast(label, "ok", { title: "+" + fmt(toXp - fromXp) + " XP" });
  }

  /* ── rank road ── */
  function road(level) {
    const box = $("lvroad");
    box.replaceChildren();
    const line = el("div", "rd-line"), done = el("i");
    line.append(done);
    box.append(line);
    let reachedIdx = 0;
    BB.RANKS.forEach((r, i) => {
      const got = level >= r.level;
      if (got) reachedIdx = i;
      const n = el("a", "rd-node" + (got ? " got" : ""));
      n.href = "#perks-" + r.level;
      n.style.setProperty("--rk", r.color);
      const ib = el("span", "rd-ic");
      ib.append(img(r.icon));
      n.append(ib, el("strong", null, r.name), el("span", null, "Level " + r.level));
      box.append(n);
    });
    const cur = BB.rankFor(level), idx = BB.RANKS.indexOf(cur), nxt = BB.RANKS[idx + 1];
    box.children[idx + 1].classList.add("here");
    /* line runs from the first to the last node; partly into the next segment */
    const seg = nxt ? (level - cur.level) / (nxt.level - cur.level) : 0;
    const frac = (reachedIdx + Math.min(1, seg)) / (BB.RANKS.length - 1);
    requestAnimationFrame(() => setTimeout(() => { done.style.setProperty("--p", Math.min(1, frac).toFixed(3)); }, 200));
  }

  /* ── perks ── */
  function perks() {
    const box = $("lvperks");
    box.replaceChildren();
    const lv = shown ? shown.level : 0;
    BB.RANKS.forEach(r => {
      const row = el("article", "pk-row" + (me && lv >= r.level ? " got" : ""));
      row.id = "perks-" + r.level;
      row.style.setProperty("--rk", r.color);
      const head = el("div", "pk-head");
      head.append(img(r.icon), el("strong", null, r.name), el("span", null, "Level " + r.level + "+"));
      if (me) head.append(el("em", "pk-st", lv >= r.level ? "Unlocked" : "Locked"));
      const list = el("ul", "pk-list");
      PERKS[r.level].forEach(([where, text]) => {
        const li = el("li", "pk-" + where);
        li.append(el("span", "pk-where", where === "dc" ? "Discord" : "Website"), el("span", null, text));
        list.append(li);
      });
      row.append(head);
      if (BANNER_AT[r.level]) {
        const sw = el("span", "pk-ban pban");
        BB.paintBanner(sw, BANNER_AT[r.level], "x");
        row.append(sw);
      }
      row.append(list);
      box.append(row);
    });
  }

  /* ── tasks ── */
  function tasks() {
    const box = $("lvtasks");
    box.replaceChildren();
    const got = TASKS.filter(t => claims[t.k] && claims[t.k].status !== "failed").reduce((a, t) => a + t.xp, 0);
    $("lvtsum").textContent = me ? fmt(got) + " / " + fmt(TASK_TOTAL) + " XP claimed" : "Up to " + fmt(TASK_TOTAL) + " XP";
    const order = [...TASKS].sort((a, b) => (!!claims[a.k] - !!claims[b.k]));
    order.forEach(t => {
      const c = claims[t.k];
      const state = !c ? "open" : c.status === "failed" ? "failed" : "done";
      const row = el("article", "tk st-" + state);
      row.dataset.k = t.k;
      const ic = el("span", "tk-ic"); ic.append(icon(t.ic));
      const txt = el("div", "tk-txt");
      txt.append(el("strong", null, t.t), el("span", null, state === "failed" && c.reason ? c.reason : t.d));
      const xp = el("span", "tk-xp", "+" + t.xp + " XP");
      const acts = el("div", "tk-acts");
      if (state === "done") acts.append(el("span", "tk-done", "Claimed"));
      else if (state === "wait") acts.append(el("span", "tk-wait", "Adding XP…"));
      else if (!me) {
        const b = el("button", "brick dark sm", "Log in"); b.type = "button"; b.dataset.login = ""; acts.append(b);
      } else if (t.k === "google" && !BB.googleReady) {
        acts.append(el("span", "tk-soon", "Coming soon"));
      } else {
        const go = el(t.go ? "a" : "button", "tk-go", t.gl);
        if (t.go) { go.href = t.go; if (t.ext) { go.target = "_blank"; go.rel = "noopener"; } }
        else { go.type = "button"; go.onclick = t.run; }
        const cl = el("button", "brick green sm tk-claim", "Claim");
        cl.type = "button";
        cl.onclick = () => claim(t, cl);
        acts.append(go, cl);
      }
      row.append(ic, txt, xp, acts);
      box.append(row);
    });
  }

  async function claim(t, btn) {
    btn.disabled = true;
    btn.classList.add("busy");
    const tt = BB.toast("Checking " + t.t.toLowerCase() + "…", "wait", { title: "Claiming XP" });
    const { data, error } = await BB.sb.rpc("claim_xp_task", { t: t.k });
    btn.disabled = false;
    btn.classList.remove("busy");
    if (error) {
      tt.update(/function|schema|exist/i.test(error.message) ? "XP tasks aren't switched on yet. Try again later." : "Couldn't claim: " + error.message, "bad", { title: "Not claimed" });
      return;
    }
    if (data === "ok" || data === "done") {
      tt.close();
      const before = shownXp();
      const fresh = !claims[t.k];
      claims[t.k] = claims[t.k] || { task: t.k, status: "pending", xp: t.xp };
      await claimFx(btn.closest(".tk"), t.xp);
      tasks();
      if (fresh) { celebrate(before, shownXp(), t.t + " done."); perks(); }
      watch();
      return;
    }
    const act = t.go || t.run ? { label: t.gl, run: () => { if (t.run) t.run(); else if (t.ext) open(t.go, "_blank", "noopener"); else location.href = t.go; } } : null;
    tt.update(String(data || "Not done yet."), "bad", { title: "Not done yet", action: act });
  }

  /* Claim show: the row stamps "Claimed", XP orbs fly from the task into the level bar. */
  function claimFx(row, xp) {
    if (!row || calm) return Promise.resolve();
    row.classList.add("claiming");
    const stamp = el("span", "tk-stamp");
    stamp.append(el("b", null, "+" + xp + " XP"));
    row.append(stamp);
    const bar = document.querySelector("#lvcard .lv-bar");
    const from = row.querySelector(".tk-xp").getBoundingClientRect();
    const sx = from.left + from.width / 2, sy = from.top + from.height / 2;
    let tx = innerWidth / 2, ty = 40;
    if (bar) {
      const b = bar.getBoundingClientRect();
      const f = bar.querySelector(".lv-fill").getBoundingClientRect();
      tx = Math.min(b.right - 10, Math.max(b.left + 10, f.right));
      ty = b.top + b.height / 2;
    }
    const n = Math.max(6, Math.min(14, Math.round(xp / 25)));
    const flights = [];
    for (let i = 0; i < n; i++) {
      const o = el("i", "xp-orb");
      o.style.left = sx + "px";
      o.style.top = sy + "px";
      document.body.append(o);
      const dx = tx - sx, dy = ty - sy;
      const bend = (Math.random() - 0.5) * 220, lift = -80 - Math.random() * 120;
      const a = o.animate([
        { transform: "translate(-50%,-50%) scale(.3)", opacity: 0 },
        { transform: `translate(calc(-50% + ${bend * 0.6}px),calc(-50% + ${lift}px)) scale(1.15)`, opacity: 1, offset: 0.25 },
        { transform: `translate(calc(-50% + ${dx * 0.6 + bend}px),calc(-50% + ${dy * 0.55 + lift}px)) scale(1)`, opacity: 1, offset: 0.6 },
        { transform: `translate(calc(-50% + ${dx}px),calc(-50% + ${dy}px)) scale(.5)`, opacity: 0.9 },
      ], { duration: 900 + i * 45, delay: i * 55, easing: "cubic-bezier(.45,.05,.3,1)", fill: "forwards" });
      flights.push(a.finished.then(() => {
        o.remove();
        if (bar) { bar.classList.remove("hit"); void bar.offsetWidth; bar.classList.add("hit"); }
      }, () => o.remove()));
    }
    return new Promise(res => setTimeout(res, 650)).then(() => { Promise.all(flights).then(() => { if (bar) setTimeout(() => bar.classList.remove("hit"), 400); }); });
  }

  /* XP shown = the bot's total + claims it hasn't added yet, so a claim counts straight away. */
  const pendingXp = () => Object.values(claims).filter(c => c.status === "pending" || c.status === "processing").reduce((a, c) => a + (c.xp || 0), 0);
  const baseXp = () => prof && prof.xp != null ? Number(prof.xp) : BB.xpAtLevel((prof && prof.level) || 1);
  const shownXp = () => baseXp() + pendingXp();

  /* In the background, wait for the bot to confirm (about 10s) and quietly line the numbers up. */
  function watch() {
    if (polling) return;
    let tries = 0;
    polling = setInterval(async () => {
      tries++;
      const { data } = await BB.sb.from("xp_task_claims").select("task,status,xp,reason").eq("discord_id", me);
      const next = Object.fromEntries((data || []).map(r => [r.task, r]));
      const failed = Object.keys(next).filter(k => next[k].status === "failed" && (!claims[k] || claims[k].status !== "failed"));
      const given = Object.keys(next).some(k => next[k].status === "given" && claims[k] && claims[k].status !== "given");
      const before = shownXp();
      claims = next;
      if (given) {
        const p = (await BB.sb.from("profiles").select("*").eq("discord_id", me).maybeSingle()).data;
        if (p && p.xp != null && (prof == null || prof.xp == null || Number(p.xp) >= Number(prof.xp))) prof = p;
      }
      if (failed.length) {
        failed.forEach(k => BB.toast(next[k].reason || "Bloombot couldn't add this XP.", "bad", { title: "XP not added" }));
        tasks();
      }
      const after = shownXp();
      if (after !== before) card(after, { from: before, noXp: !(prof && prof.xp != null) });
      const waiting = pendingXp() > 0;
      if (!waiting || tries > 40) { clearInterval(polling); polling = null; }
    }, 2500);
  }

  async function load() {
    const [p, c] = await Promise.all([
      BB.sb.from("profiles").select("*").eq("discord_id", me).maybeSingle(),
      BB.sb.from("xp_task_claims").select("task,status,xp,reason").eq("discord_id", me),
    ]);
    prof = p.data;
    claims = Object.fromEntries(((c && c.data) || []).map(r => [r.task, r]));
    $("lvloading").hidden = true;
    $("lvcard").hidden = false;
    card(shownXp(), { noXp: !!prof && prof.xp == null });
    if (!prof) $("lvcard").append(el("p", "hint lv-wait", "You don't have a Bloombot account yet. Claim the first task below to make one and start levelling."));
    perks();
    tasks();
    if (pendingXp() > 0) watch();
  }

  function demo() {
    me = null; prof = null; claims = {};
    $("lvloading").hidden = true;
    $("lvcard").hidden = false;
    card(BB.xpAtLevel(12) + 410, { demo: true });
    perks();
    tasks();
  }

  BB.onAuth(session => {
    if (!session) { demo(); return; }
    const id = BB.user(session).id;
    if (!id) { demo(); BB.requireDiscord(); return; }
    if (id === me) return;
    me = id;
    load();
  });
  /* Back from another tab (e.g. after joining the server): refresh the task list. */
  document.addEventListener("visibilitychange", () => { if (!document.hidden && me && !polling) load(); });
})();
