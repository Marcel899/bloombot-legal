/* Sitewide giveaway popup (bottom right). Entries are checked in the database. */
(() => {
  const TASKS = [
    { key: "join", label: "Join the giveaway", pts: 1, icon: "plus" },
    { key: "trade_ad", label: "Have a live trade ad", pts: 4, icon: "trading", href: "trades.html#post", go: "Post one" },
    { key: "strategy", label: "Share a strategy", pts: 3, icon: "bullseye", href: "strategies.html", go: "Share" },
    { key: "server_link", label: "Add your private server link", pts: 1, icon: "gear", href: "profile.html#edit", go: "Add" },
  ];
  let list = [], cur = 0, mine = new Set(), totals = {}, root = null, timer = null, busy = false;
  const store = (k, v) => { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } };
  const el = (...a) => BB.el(...a);

  /* full-page confetti burst */
  function confetti(n) {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const c = document.createElement("canvas"), x = c.getContext("2d"), d = Math.min(devicePixelRatio || 1, 2);
    c.className = "confetti";
    const W = innerWidth, H = innerHeight;
    c.width = W * d; c.height = H * d; x.scale(d, d);
    document.body.append(c);
    const cols = ["#28a828", "#14aeea", "#f5c83c", "#a94fff", "#dc3232", "#e07a10", "#ffffff"];
    const ps = [];
    for (let i = 0; i < n; i++) {
      const left = i % 2 === 0, a = 0.85 + Math.random() * 0.55;
      const sp = 9 + Math.random() * 11;
      ps.push({ x: left ? -10 : W + 10, y: H * (0.55 + Math.random() * 0.4), vx: (left ? 1 : -1) * Math.cos(a) * sp, vy: -Math.sin(a) * sp,
        w: 6 + Math.random() * 6, h: 4 + Math.random() * 6, r: Math.random() * 6, vr: (Math.random() - 0.5) * 0.4,
        c: cols[i % cols.length], f: Math.random() * 6 });
    }
    for (let i = 0; i < n / 2; i++) ps.push({ x: Math.random() * W, y: -20 - Math.random() * H * 0.5, vx: (Math.random() - 0.5) * 2, vy: 2 + Math.random() * 3,
      w: 6 + Math.random() * 6, h: 4 + Math.random() * 6, r: Math.random() * 6, vr: (Math.random() - 0.5) * 0.3, c: cols[i % cols.length], f: Math.random() * 6 });
    const t0 = performance.now();
    (function tick(t) {
      const age = t - t0;
      x.clearRect(0, 0, W, H);
      x.globalAlpha = age > 2600 ? Math.max(0, 1 - (age - 2600) / 900) : 1;
      for (const p of ps) {
        p.vx *= 0.985; p.vy = p.vy * 0.985 + 0.32; p.x += p.vx; p.y += p.vy; p.r += p.vr; p.f += 0.15;
        x.save(); x.translate(p.x, p.y); x.rotate(p.r); x.scale(1, Math.cos(p.f));
        x.fillStyle = p.c; x.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); x.restore();
      }
      if (age < 3500) requestAnimationFrame(tick); else c.remove();
    })(t0);
  }

  function left(t) {
    let s = Math.max(0, Math.floor((new Date(t) - Date.now()) / 1000));
    const d = Math.floor(s / 86400); s %= 86400;
    const p = n => String(n).padStart(2, "0");
    return (d ? d + "d " : "") + p(Math.floor(s / 3600)) + ":" + p(Math.floor(s % 3600 / 60)) + ":" + p(s % 60);
  }

  async function load() {
    const { data } = await BB.sb.from("giveaways").select("id,title,subtitle,image_url,ends_at").is("winner_id", null)
      .gt("ends_at", new Date().toISOString()).order("ends_at").limit(3);
    list = data || [];
    if (!list.length) { if (root) root.remove(); root = null; return; }
    cur = Math.min(cur, list.length - 1);
    await Promise.all(list.map(async g => {
      const { data: n } = await BB.sb.rpc("giveaway_total", { gid: g.id });
      totals[g.id] = n || 0;
    }));
    mine = new Set();
    if (BB.session) {
      const { data: e } = await BB.sb.from("giveaway_entries").select("giveaway_id,task").in("giveaway_id", list.map(g => g.id));
      (e || []).forEach(r => mine.add(r.giveaway_id + ":" + r.task));
    }
    render();
    autoCheck();
  }

  let auto = false;
  async function autoCheck() {
    if (auto || !BB.session) return;
    auto = true;
    let got = 0;
    for (const g of list) {
      if (!mine.has(g.id + ":join")) continue;
      for (const t of TASKS) {
        if (t.key === "join" || mine.has(g.id + ":" + t.key)) continue;
        try { const { data } = await BB.sb.rpc("claim_giveaway_task", { gid: g.id, t: t.key }); if (data === "ok") got += t.pts; } catch (e) { /* skip */ }
      }
    }
    if (got) { BB.toast(`Giveaway: +${got} entries added`); confetti(90); load(); }
  }

  async function claim(g, t, btn) {
    if (busy) return;
    if (!BB.session) { BB.login(); return; }
    busy = true; btn.disabled = true; btn.textContent = "Checking…";
    let res, error;
    try { ({ data: res, error } = await BB.sb.rpc("claim_giveaway_task", { gid: g.id, t: t.key })); }
    catch (e) { error = e; }
    busy = false;
    if (error || res !== "ok") {
      const msg = error ? "Couldn't reach Bloombot. Try again." : res;
      BB.toast(msg);
      if (/account first/.test(msg || "")) setTimeout(() => { location.href = "profile.html#edit"; }, 1200);
      render();
      return;
    }
    BB.toast(t.key === "join" ? "You're in! Good luck" : `+${t.pts} entries`);
    confetti(t.key === "join" ? 180 : 90);
    load();
  }

  function render() {
    if (!root) {
      root = el("aside", "gw");
      root.setAttribute("aria-label", "Giveaway");
      document.body.append(root);
    }
    const g = list[cur];
    const saved = store("bb_gw_min_" + g.id);
    const min = saved === "1" || (saved === null && matchMedia("(max-width:600px)").matches);
    root.className = "gw" + (min ? " min" : "");
    root.replaceChildren();
    if (min) {
      const b = el("button", "brick purple gw-pill");
      b.type = "button";
      const i = el("img"); i.src = "img/gem.png"; i.alt = "";
      b.append(i, el("span", null, "Giveaway"), el("em", "gw-cd", left(g.ends_at)));
      b.onclick = () => { store("bb_gw_min_" + g.id, "0"); render(); };
      root.append(b);
      tick();
      return;
    }
    const top = el("div", "gw-top");
    top.append(el("span", "gw-kicker", "Sitewide giveaway"));
    const x = el("button", "gw-x", "×");
    x.type = "button"; x.setAttribute("aria-label", "Minimize giveaway");
    x.onclick = () => { store("bb_gw_min_" + g.id, "1"); render(); };
    top.append(x);
    const head = el("div", "gw-head");
    const pic = el("img", "gw-pic"); pic.alt = ""; pic.src = BB.safeUrl(g.image_url) || "img/gem.png";
    pic.onerror = () => { pic.src = "img/gem.png"; };
    const ht = el("div");
    const meta = el("div", "gw-meta");
    const done = TASKS.filter(t => mine.has(g.id + ":" + t.key));
    const my = done.reduce((s, t) => s + t.pts, 0);
    meta.append(el("span", "gw-cd", "Ends in " + left(g.ends_at)), el("span", null, (totals[g.id] || 0).toLocaleString() + " entries"));
    ht.append(el("h3", null, g.title));
    if (g.subtitle) ht.append(el("p", "gw-sub", g.subtitle));
    ht.append(meta);
    head.append(pic, ht);
    root.append(top, head);
    if (list.length > 1) {
      const tabs = el("div", "gw-tabs");
      list.forEach((o, i) => { const b = el("button", "gw-tab" + (i === cur ? " on" : ""), o.title); b.type = "button"; b.onclick = () => { cur = i; render(); }; tabs.append(b); });
      root.append(tabs);
    }
    const joined = mine.has(g.id + ":join");
    if (joined) {
      const prog = el("div", "gw-prog");
      const bar = el("div", "gw-bar"); const fill = el("i"); fill.style.width = (done.length / TASKS.length * 100) + "%"; bar.append(fill);
      const max = TASKS.reduce((s, t) => s + t.pts, 0);
      const tot = Math.max(totals[g.id] || 0, my);
      const chance = tot ? (my / tot * 100) : 0;
      const info = el("div", "gw-pinfo");
      info.append(el("span", null, `${my}/${max} entries`), el("span", null, "Your chance " + (chance >= 10 ? chance.toFixed(0) : chance.toFixed(1)) + "%"));
      prog.append(info, bar);
      root.append(prog);
    }
    const ul = el("div", "gw-tasks");
    for (const t of TASKS) {
      const ok = mine.has(g.id + ":" + t.key);
      const row = el("div", "gw-task" + (ok ? " done" : ""));
      const dot = el("span", "gw-dot", ok ? "✓" : "");
      const lab = el("span", "gw-lab");
      lab.append(el("strong", null, t.label), el("span", "gw-pts", `+${t.pts} ${t.pts === 1 ? "entry" : "entries"}`));
      row.append(dot, lab);
      if (!ok) {
        if (!BB.session && t.key === "join") {
          const b = el("button", "brick blue sm gw-btn", "Sign in"); b.type = "button"; b.onclick = () => BB.login(); row.append(b);
        } else if (t.key === "join" || joined) {
          const b = el("button", "brick sm gw-btn " + (t.key === "join" ? "green" : "dark"), t.key === "join" ? "Join" : "Check");
          b.type = "button"; b.onclick = () => claim(g, t, b);
          if (t.href) { const a = el("a", "gw-go", t.go); a.href = t.href; row.append(a); }
          row.append(b);
        } else row.classList.add("locked");
      }
      ul.append(row);
    }
    root.append(ul);
    const open = TASKS.filter(t => t.key !== "join" && !mine.has(g.id + ":" + t.key));
    if (joined && open.length) {
      const all = el("button", "brick blue gw-all", "Check all tasks");
      all.type = "button";
      all.onclick = async () => {
        if (busy) return;
        busy = true; all.disabled = true; all.textContent = "Checking…";
        let got = 0;
        for (const t of open) {
          try { const { data } = await BB.sb.rpc("claim_giveaway_task", { gid: g.id, t: t.key }); if (data === "ok") got += t.pts; } catch (e) { /* skip */ }
        }
        busy = false;
        BB.toast(got ? `+${got} entries` : "Nothing new yet. Finish a task, then check again.");
        load();
      };
      root.append(all);
    }
    const foot = el("p", "gw-foot", BB.session
      ? (joined ? `You have ${my} ${my === 1 ? "entry" : "entries"}. Do more tasks for extra entries.` : "You need a Bloombot account to join.")
      : "Log in with Discord and have a Bloombot account to join.");
    root.append(foot);
    tick();
  }

  function tick() {
    clearInterval(timer);
    timer = setInterval(() => {
      const g = list[cur];
      if (!g || !root) return clearInterval(timer);
      if (new Date(g.ends_at) <= Date.now()) { clearInterval(timer); load(); return; }
      root.querySelectorAll(".gw-cd").forEach(c => { c.textContent = (c.closest(".gw-pill") ? "" : "Ends in ") + left(g.ends_at); });
    }, 1000);
  }

  let last;
  BB.onAuth(s => {
    if (!BB.sb) return;
    const id = s ? BB.user(s).id : null;
    if (last === id) return;
    last = id;
    load().catch(() => {});
  });
})();
