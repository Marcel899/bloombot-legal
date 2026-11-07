/* Crate calculator: chances, average crates and currency for one unit from a crate (summon).
   Every crate is an independent roll. Chance of at least one copy in n crates = 1 - (1 - p)^n.
   Pity: the crate at the pity count always gives a unit of that rarity. */
(() => {
  const $ = id => document.getElementById(id);
  const el = (window.BB && BB.el) || ((t, c, x) => { const e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; });

  /* ── crates (from the in-game shop) ────────────────────────────── */
  let CUR = {
    candy: { name: "Candy", icon: "img/cur/candy-2.webp" },
    seeds: { name: "Seeds", icon: "img/cur/seeds.webp" },
    custom: { name: "currency", icon: "img/crate.png" },
  };
  // [name, stars, drop %, pity] ; pity = [count, progress] shared by the rarity
  let CRATES = [
    { id: "skull", name: "Skull Summon", kind: "limited", tag: "Limited", cur: "candy", price: 666, pack: [13, 6666], units: [
      ["Lanternwood", 1, 45], ["Cyclopsia", 2, 35], ["Draculaflora", 3, 15.8], ["Vitalily", 4, 2.64],
      ["Skeleton Dragon", 4, 1.2], ["Coffinroot", 5, 0.26], ["Stringshade", 5, 0.095], ["Grim Gardener", 5, 0.005]] },
    { id: "mushroom", name: "Mushroom Summon", cur: "seeds", price: 300, pack: [10, 2700], units: [
      ["Pine Tree", 0, 45], ["Groundbreaker", 1, 35], ["Gooseberries", 2, 14], ["Fragpetal", 3, 4.75],
      ["Rosemire", 4, 1], ["Rangeleaf", 5, 0.24], ["Fungal Barrage", 5, 0.01]] },
    { id: "classic", name: "Classic Summon", tag: "Rotates", cur: "seeds", price: 100, pack: [10, 900], units: [
      ["Tomato", 0, 15.513], ["Farmer", 1, 13.186], ["Gnome", 1, 12.411], ["Pineapple Cannon", 1, 11.635],
      ["Chili Pepper", 2, 8.532], ["Rose Trap", 2, 7.757], ["Palm Tree", 3, 15.317, 50], ["Broccoli", 3, 12.254, 50],
      ["Watermelon", 4, 1.691, 500], ["Sunflower", 4, 1.674, 500], ["Bloodvine", 5, 0.03, 50000]] },
  ];
  const CUSTOM = { id: "custom", name: "Custom", cur: "custom", units: [] };
  const KINDS = [["limited", "Limited time"], ["normal", "In the shop"], ["event", "Events"], ["removed", "Old crates"]];
  const FOLDED = new Set(["event", "removed"]); // shown behind "Show event and old crates"
  const STAR_CLASS = ["s0", "s1", "s2", "s3", "s4", "s5"];
  const MILESTONES = [0.1, 0.25, 0.5, 0.75, 0.9, 0.95, 0.99];
  const CAP = 2e7; // most crates the pity maths walks through

  const S = { crate: "skull", unit: 7, luck: 1 };
  let values = new Map();

  /* ── formatting ───────────────────────────────────────────────── */
  const commas = n => Math.round(n).toLocaleString("en-US");
  const short = n => {
    if (!isFinite(n)) return "∞";
    const a = Math.abs(n), t = x => (Math.round(x * 100) / 100).toString();
    if (a >= 1e12) return t(n / 1e12) + "t";
    if (a >= 1e9) return t(n / 1e9) + "b";
    if (a >= 1e6) return t(n / 1e6) + "m";
    return commas(n);
  };
  const pct = x => {
    if (!(x > 0)) return "0%";
    if (x >= 1) return "100%";
    const v = x * 100;
    if (v >= 99.99) return (Math.floor(v * 1000) / 1000) + "%";
    if (v >= 10) return (Math.round(v * 10) / 10) + "%";
    if (v >= 0.1) return (Math.round(v * 100) / 100) + "%";
    return Number(v.toPrecision(2)) + "%";
  };
  const num = v => {
    const t = String(v == null ? "" : v).trim().toLowerCase().replace(/[, _%x×]/g, "");
    const m = t.match(/^(\d*\.?\d+(?:e-?\d+)?)([kmb]?)$/);
    if (!m) return NaN;
    return parseFloat(m[1]) * ({ k: 1e3, m: 1e6, b: 1e9 }[m[2]] || 1);
  };
  // "0.005%" or "1/20000" or "1 in 20000"
  const chance = v => {
    const t = String(v || "").trim().toLowerCase();
    const m = t.match(/^1\s*(?:\/|in)\s*([\d,.]+\s*[km]?)$/);
    if (m) { const d = num(m[1]); return d > 0 ? 100 / d : NaN; }
    return num(t);
  };

  /* ── the maths ────────────────────────────────────────────────── */
  function model() {
    const base = chance($("kd").value) / 100;
    const luck = Math.max(0, num($("kl").value) || 0);
    const price = num($("kp").value) || 0;
    const packN = Math.floor(num($("kpn").value) || 0), packP = num($("kpp").value) || 0;
    const usePacks = $("kpk").checked && packN > 1 && packP > 0;
    const budget = num($("kb").value) || 0;
    const p = Math.min(1, base * luck);
    const M = { base, luck, p, price, packN, packP, usePacks, budget, ok: base > 0 && base <= 1 && luck > 0 };
    M.per = usePacks ? packP / packN : price;
    M.cost = n => {
      if (!(n > 0)) return 0;
      if (!usePacks) return n * price;
      const full = Math.floor(n / packN), rem = n - full * packN;
      return full * packP + (rem ? (price > 0 ? Math.min(rem * price, packP) : packP) : 0);
    };
    M.afford = b => {
      if (!(b > 0)) return 0;
      if (!usePacks) return price > 0 ? Math.floor(b / price) : 0;
      const full = Math.floor(b / packP), left = b - full * packP;
      return full * packN + (price > 0 ? Math.min(packN - 1, Math.floor(left / price)) : 0);
    };
    // pity
    M.pity = null;
    if ($("kpy").checked) {
      const N = Math.floor(num($("kyn").value) || 0);
      const done = Math.max(0, Math.floor(num($("kyk").value) || 0));
      const exact = $("kyt").value === "exact";
      const tier = Math.min(1, (chance($("kyr").value) / 100) * luck);
      if (N >= 1) {
        const R = Math.max(1, N - Math.min(done, N - 1));
        // a rarity chance that isn't above the unit's own chance means the pity can only be this unit
        const only = exact || !(tier > p);
        const q = only ? p : tier;
        M.pity = { N, R, exact: only, q, s: only ? 1 : p / q };
      }
    }
    return M;
  }

  /* Walks crate by crate with the pity counter. h(n) = no copy in n crates from a fresh counter,
     H(n) = the same from where you are now. Sums keep it O(n) with a ring buffer of size N. */
  function pityRun(M, want) {
    const { N, R, q, s } = M.pity;
    const r = 1 - q, a = q * (1 - s), b = 1 - s;
    const rN1 = Math.pow(r, N - 1), rR1 = Math.pow(r, R - 1);
    const size = N + 1, h = new Float64Array(size);
    const at = n => h[n % size];
    h[0] = 1;
    let T = 0, U = 0, rn = 1, H = 1, expected = 1, n = 0;
    const out = { H: new Map([[0, 1]]), first: new Map(), expected: NaN, capped: false };
    const qs = want.ns.slice().sort((x, y) => x - y);
    const ts = want.ts.slice().sort((x, y) => x - y);
    let qi = 0, ti = 0;
    while (qi < qs.length && qs[qi] <= 0) qi++;
    const last = qs.length ? qs[qs.length - 1] : 0;
    while (n < CAP) {
      n++;
      rn *= r;
      const hPrev = at(n - 1);
      const hN = n >= N ? at(n - N) : 0;
      const hR = n >= R ? at(n - R) : 0;
      T = hPrev + r * T - (n >= N ? rN1 * hN : 0);
      U = hPrev + r * U - (n >= R ? rR1 * hR : 0);
      const hn = Math.max(0, a * T + (n < N ? rn : rN1 * b * hN));
      H = Math.max(0, a * U + (n < R ? rn : rR1 * b * hR));
      h[n % size] = hn;
      while (qi < qs.length && qs[qi] === n) { out.H.set(n, H); qi++; }
      while (ti < ts.length && 1 - H >= ts[ti]) { out.first.set(ts[ti], n); ti++; }
      expected += H;
      if (H < 1e-12 && qi >= qs.length && ti >= ts.length && n >= last) { out.expected = expected; break; }
    }
    if (n >= CAP) out.capped = true;
    if (isNaN(out.expected) && H < 1e-6) out.expected = expected;
    while (qi < qs.length) { out.H.set(qs[qi], H); qi++; }
    return out;
  }

  function solve(M, extraNs) {
    const p = M.p, R = { M };
    if (!M.ok) return null;
    if (!M.pity || (M.pity.exact && M.pity.R <= 0)) {
      const lq = Math.log1p(-Math.min(p, 1 - 1e-16));
      R.got = n => (p >= 1 ? (n >= 1 ? 1 : 0) : 1 - Math.exp(n * lq));
      R.need = t => (p >= 1 ? 1 : Math.max(1, Math.ceil(Math.log(1 - t) / lq - 1e-9)));
      R.expected = 1 / p;
      R.guarantee = p >= 1 ? 1 : null;
      return R;
    }
    if (M.pity.exact) {
      const Rn = M.pity.R, lq = Math.log1p(-Math.min(p, 1 - 1e-16));
      R.got = n => (n >= Rn || p >= 1 ? (n >= 1 ? 1 : 0) : 1 - Math.exp(n * lq));
      R.need = t => Math.min(Rn, p >= 1 ? 1 : Math.max(1, Math.ceil(Math.log(1 - t) / lq - 1e-9)));
      R.expected = p >= 1 ? 1 : (1 - Math.exp(Rn * lq)) / p;
      R.guarantee = Rn;
      return R;
    }
    // pity gives a random unit of this rarity: walk it
    const run = pityRun(M, { ns: extraNs, ts: MILESTONES });
    R.got = n => 1 - (run.H.has(n) ? run.H.get(n) : NaN);
    R.need = t => run.first.get(t) || Infinity;
    R.expected = run.expected;
    R.guarantee = null;
    R.capped = run.capped;
    return R;
  }

  /* ── page ─────────────────────────────────────────────────────── */
  const crate = () => (S.crate === "custom" ? CUSTOM : CRATES.find(c => c.id === S.crate) || CRATES[0]);
  const cur = c => CUR[c.cur] || { name: c.cur || "currency", icon: "img/crate.png" };

  function crateBtn(c) {
    const b = el("button", "kcrate" + (c.id === S.crate ? " on" : ""));
    b.type = "button";
    // the crate's rarest unit stands in for crate art
    const rare = c.units && c.units.length ? c.units.reduce((m, u) => (u[2] < m[2] ? u : m)) : null;
    const ic = el("img", "kc-art"); ic.alt = ""; ic.loading = "lazy";
    ic.src = c.id === "custom" ? "img/gear.png" : c.img || (rare && rare[4]) || "img/crate.png";
    ic.onerror = () => { ic.src = "img/crate.png"; };
    const t = el("span", "kc-t");
    t.append(el("strong", null, c.name));
    const sm = el("small");
    if (c.id === "custom") sm.textContent = "Type your own numbers";
    else {
      const ci = el("img", "kc-cur"); ci.alt = ""; ci.src = cur(c).icon; ci.onerror = () => ci.remove();
      sm.append(ci, c.price ? commas(c.price) : "?", c.pack ? ` · ${c.pack[0]} for ${commas(c.pack[1])}` : "");
    }
    t.append(sm);
    b.append(ic, t);
    if (c.tag) b.append(el("em", "kc-tag" + (c.kind ? " k-" + c.kind : ""), c.tag));
    b.onclick = () => pickCrate(c.id);
    return b;
  }
  function drawCrates() {
    const box = $("kcrates");
    box.textContent = "";
    const many = CRATES.length > 6;
    box.classList.toggle("many", many);
    const fold = el("details", "kc-more");
    const foldN = CRATES.filter(c => FOLDED.has(c.kind)).length;
    fold.append(el("summary", null, `Show event and old crates (${foldN})`));
    if (FOLDED.has(crate().kind)) fold.open = true;
    for (const [kind, label] of KINDS) {
      const list = CRATES.filter(c => (c.kind || "normal") === kind);
      if (!list.length) continue;
      if (many) {
        const g = el("div", "kc-group");
        g.append(el("h3", "kc-gh", label + " (" + list.length + ")"));
        const row = el("div", "kc-row");
        list.forEach(c => row.append(crateBtn(c)));
        if (kind === "normal") row.append(crateBtn(CUSTOM));
        g.append(row);
        (FOLDED.has(kind) ? fold : box).append(g);
      } else list.forEach(c => box.append(crateBtn(c)));
    }
    if (many && foldN) box.append(fold);
    if (!many) box.append(crateBtn(CUSTOM));
  }

  function unitImg(u) {
    const it = values.get(u[0].toLowerCase());
    const srcs = [u[4], it && it.icon_url, it && it.image_url].filter(x => typeof x === "string" && (/^https:\/\//.test(x) || /^img\//.test(x)));
    srcs.push("img/crate.png");
    const i = el("img", "su-img"); i.alt = ""; i.loading = "lazy";
    let k = 0;
    i.src = srcs[0];
    i.onerror = () => { if (++k < srcs.length) i.src = srcs[k]; };
    return i;
  }

  /* ── the summon window (looks like the in-game shop) ──────────────── */
  const SIM = { id: null, got: {}, opened: 0, spent: 0, pity: {} };
  function simReset() { SIM.id = S.crate; SIM.got = {}; SIM.opened = 0; SIM.spent = 0; SIM.pity = {}; }
  // Pity is shared by each rarity that shows one; the counter resets when you pull that rarity.
  const pityTiers = c => { const t = {}; c.units.forEach(u => { if (u[3]) t[u[1]] = u[3]; }); return t; };

  // Classic's units change every hour, on the hour (UTC); the game shows the time left as the title
  function rotationTitle() {
    const left = Math.max(0, 3600 - Math.floor(Date.now() / 1000) % 3600);
    const two = v => String(v).padStart(2, "0");
    return `New units in 00:${two(Math.floor(left / 60))}:${two(left % 60)}`;
  }
  setInterval(() => { if (S.crate === "classic" && !document.hidden) $("swtitle").textContent = rotationTitle(); }, 1000);

  // names and pity lines stay on one line like in game: shrink the ones that don't fit
  function fitText() {
    document.querySelectorAll("#kunits .su-name, #kunits .su-pity").forEach(t => {
      t.style.fontSize = "";
      t.classList.remove("two");
      let fs = parseFloat(getComputedStyle(t).fontSize);
      const fits = () => t.scrollWidth <= t.clientWidth + 1;
      while (!fits() && fs > 9) { fs -= 0.5; t.style.fontSize = fs + "px"; }
      // tiny cards: a name with spaces may use two lines; single words keep shrinking
      if (!fits() && t.classList.contains("su-name") && t.textContent.includes(" ")) t.classList.add("two");
      while (!fits() && fs > 6) { fs -= 0.5; t.style.fontSize = fs + "px"; }
    });
  }
  let fitT = 0;
  addEventListener("resize", () => { clearTimeout(fitT); fitT = setTimeout(fitText, 120); });
  if (document.fonts) { document.fonts.ready.then(fitText); document.fonts.addEventListener && document.fonts.addEventListener("loadingdone", fitText); }

  function drawUnits() {
    const c = crate(), box = $("kunits");
    if (SIM.id !== S.crate) simReset();
    box.textContent = "";
    $("sw").hidden = !c.units.length;
    $("swtitle").textContent = c.id === "classic" ? rotationTitle() : c.name;
    $("swsub").textContent = c.sub || (c.kind === "limited" ? "Limited time crate" : c.kind === "event" ? "Event crate" : c.kind === "removed" ? "No longer in the shop" : "");
    $("swsub").hidden = !$("swsub").textContent;
    box.className = "sw-grid" + (c.units.length > 8 ? " wide" : "");
    const tiers = pityTiers(c);
    c.units.forEach((u, i) => {
      const [name, stars, drop] = u;
      const cell = el("div", "su-cell");
      const b = el("button", "su s" + Math.max(0, Math.min(6, stars)) + (i === S.unit ? " on" : ""));
      b.type = "button";
      b.dataset.i = i;
      b.setAttribute("aria-pressed", i === S.unit ? "true" : "false");
      b.setAttribute("aria-label", `${name}, ${drop}%`);
      const art = el("span", "su-art");
      const st = el("span", "su-stars");
      for (let k = 0; k < (stars > 0 && stars < 6 ? stars : 0); k++) { const si = el("img"); si.src = "img/star.webp"; si.alt = ""; st.append(si); }
      if (stars > 0 && stars < 6) st.setAttribute("aria-label", stars + " stars");
      art.append(st);
      if (c.kind && c.kind !== "normal") { const lim = el("img", "su-lim"); lim.alt = "Limited"; lim.src = "img/limited.png"; art.append(lim); }
      art.append(unitImg(u), el("span", "su-name", name));
      const n = SIM.got[name];
      if (n) art.append(el("span", "su-got", "x" + commas(n)));
      b.append(art, el("span", "su-pct", drop + "%"));
      b.onclick = () => { pickUnit(i); showAnswer(); };
      cell.append(b);
      if (tiers[stars]) cell.append(el("span", "su-pity", `PITY ${SIM.pity[stars] || 0}/${tiers[stars]}`));
      else if (Object.keys(tiers).length) cell.append(el("span", "su-pity none", "\u00a0"));
      box.append(cell);
    });
    const ci = cur(c);
    $("buy1").hidden = !c.price;
    $("buy1n").textContent = "Buy 1 -";
    $("buy1p").textContent = c.price ? String(c.price) : "";
    $("buyn").hidden = !c.pack;
    if (c.pack) { $("buynn").textContent = `Buy ${c.pack[0]} -`; $("buynp").textContent = String(c.pack[1]); }
    document.querySelectorAll(".sw-btn img").forEach(im => { im.src = ci.icon; });
    simLine();
    requestAnimationFrame(fitText);
    $("knote").textContent = c.note || "";
    $("knote").hidden = !$("knote").textContent;
  }

  function simLine() {
    const c = crate();
    $("swstat").hidden = !SIM.opened;
    $("swopened").textContent = commas(SIM.opened);
    $("swspent").textContent = short(SIM.spent) + " " + cur(c).name;
    const u = c.units[S.unit];
    $("swmine").textContent = u ? `${u[0]}: ${commas(SIM.got[u[0]] || 0)}` : "";
  }

  // Luck boosts every unit but the most common one, which shrinks to make room.
  function rollWeights(c, luck) {
    const top = c.units.reduce((m, u, i) => (u[2] > c.units[m][2] ? i : m), 0);
    const w = c.units.map((u, i) => (i === top ? 0 : u[2] * luck));
    const rest = w.reduce((a, b) => a + b, 0);
    w[top] = Math.max(0, 100 - rest);
    return w;
  }
  function pickFrom(units, w) {
    const tot = w.reduce((a, b) => a + b, 0);
    let r = Math.random() * tot;
    for (let i = 0; i < units.length; i++) { r -= w[i]; if (r < 0) return i; }
    return units.length - 1;
  }
  function buy(count, cost) {
    const c = crate();
    if (!c.units.length) return;
    const luck = Math.max(0, num($("kl").value) || 1);
    const w = rollWeights(c, luck), tiers = pityTiers(c), pulled = [];
    for (let k = 0; k < count; k++) {
      // a rarity whose pity is full gives one of its units now
      const due = Object.keys(tiers).map(Number).filter(t => (SIM.pity[t] || 0) + 1 >= tiers[t]).sort((a, b) => b - a)[0];
      let i;
      if (due != null) {
        const idx = c.units.map((u, j) => j).filter(j => c.units[j][1] === due);
        i = idx[pickFrom(idx.map(j => c.units[j]), idx.map(j => c.units[j][2]))];
      } else i = pickFrom(c.units, w);
      const u = c.units[i];
      for (const t of Object.keys(tiers)) SIM.pity[t] = Number(t) === u[1] ? 0 : (SIM.pity[t] || 0) + 1;
      SIM.got[u[0]] = (SIM.got[u[0]] || 0) + 1;
      pulled.push(i);
    }
    SIM.opened += count;
    SIM.spent += cost;
    drawUnits();
    // flash what came out, rarest first
    const box = $("swpull");
    box.textContent = "";
    const seen = new Map();
    pulled.forEach(i => seen.set(i, (seen.get(i) || 0) + 1));
    [...seen.entries()].sort((a, b) => c.units[b[0]][1] - c.units[a[0]][1] || c.units[a[0]][2] - c.units[b[0]][2]).forEach(([i, n]) => {
      const u = c.units[i];
      const chip = el("span", "sw-pchip s" + Math.max(0, Math.min(6, u[1])));
      chip.append(unitImg(u), el("span", null, (n > 1 ? n + "x " : "") + u[0]));
      box.append(chip);
      const card = document.querySelector(`.su[data-i="${i}"]`);
      if (card) { card.classList.remove("hit"); void card.offsetWidth; card.classList.add("hit"); }
    });
    box.hidden = false;
    const best = pulled.map(i => c.units[i]).reduce((m, u) => (u[2] < m[2] ? u : m));
    if (best[2] < 0.5 && window.BB && BB.toast) BB.toast(`${best[0]}, a 1 in ${short(100 / best[2])} pull!`, "ok", { title: "Wow, lucky!" });
  }

  function pickCrate(id, keepInputs) {
    S.crate = id;
    const c = crate();
    if (!keepInputs) {
      if (c.id !== "custom") {
        $("kp").value = c.price || "";
        $("kpn").value = c.pack ? c.pack[0] : "";
        $("kpp").value = c.pack ? c.pack[1] : "";
        $("kpk").checked = !!c.pack;
        S.unit = c.units.length - 1; // the rarest one
        fillUnit();
      } else {
        S.unit = -1;
        $("kunitname").textContent = "your unit";
        $("kmore").open = true;
      }
    }
    document.querySelectorAll("[data-cur]").forEach(n => { n.textContent = cur(c).name; });
    document.querySelectorAll("[data-curimg]").forEach(n => { n.src = cur(c).icon; n.hidden = c.cur === "custom"; });
    drawCrates();
    drawUnits();
    if (!keepInputs) update();
  }

  function fillUnit() {
    const c = crate(), u = c.units[S.unit];
    if (!u) return;
    $("kd").value = u[2];
    if (u[3]) {
      $("kpy").checked = true;
      $("kyn").value = u[3];
      $("kyk").value = 0;
      const same = c.units.filter(x => x[1] === u[1] && x[3]);
      const tier = same.reduce((s, x) => s + x[2], 0);
      $("kyt").value = same.length > 1 ? "tier" : "exact";
      $("kyr").value = Math.round(tier * 1000) / 1000;
    } else $("kpy").checked = false;
    pityFields();
  }
  function pickUnit(i) { S.unit = i; fillUnit(); drawUnits(); update(); }
  // phones stack the steps, so the answer is far below the window: bring it into view after a tap
  function showAnswer() {
    if (!matchMedia("(max-width:1000px)").matches) return;
    const t = $("kb").value.trim() ? $("kout") : document.querySelector(".kform");
    if (!t) return;
    const r = t.getBoundingClientRect();
    if (r.top > 70 && r.top < innerHeight * 0.6) return;
    const still = matchMedia("(prefers-reduced-motion:reduce)").matches;
    setTimeout(() => t.scrollIntoView({ behavior: still ? "auto" : "smooth", block: "start" }), 180);
  }

  function pityFields() {
    $("kpity").hidden = !$("kpy").checked;
    $("kyr-wrap").hidden = $("kyt").value !== "tier";
  }

  function setLuck(v) {
    $("kl").value = v;
    document.querySelectorAll("[data-luck]").forEach(b => b.classList.toggle("on", Number(b.dataset.luck) === Number(num(v))));
  }

  // "**bold** text" as DOM nodes
  function rich(node, text) {
    node.textContent = "";
    String(text).split("**").forEach((part, i) => { if (part) node.append(i % 2 ? el("b", null, part) : part); });
  }

  let last = null;
  function update() {
    pityFields();
    setLuck($("kl").value);
    const M = model();
    const err = $("kerr");
    if (!M.ok) {
      err.hidden = false;
      err.textContent = !(M.base > 0) ? "Type the unit's drop chance, like 0.005%." : M.base > 1 ? "A drop chance can't be over 100%." : "Luck has to be more than 0.";
      $("kout").classList.add("dim");
      if (!(M.base > 0) || M.base > 1) $("kmore").open = true;
      return;
    }
    err.hidden = true;
    $("kout").classList.remove("dim");

    const budgetN = M.afford(M.budget);
    const R = solve(M, [budgetN]);
    last = { M, R };
    const p = M.p, c = crate(), cn = cur(c).name, u = c.units[S.unit];
    const uname = u ? u[0] : "your unit";
    const tone = g => (g >= 0.9 ? "good" : g >= 0.5 ? "mid" : g >= 0.2 ? "low" : "bad");
    const money = v => short(v) + " " + cn;
    const compact = v => (v >= 1e4 && v < 1e6 ? Math.round(v / 100) / 10 + "k" : short(v));

    // head
    $("kunitname").textContent = uname;
    $("krsub").textContent = (c.id === "custom" ? "Your own numbers" : c.name) + (M.luck !== 1 ? ` · ${M.luck}x luck` : "");
    const im = $("krimg"), src = (u && u[4]) || ((values.get(uname.toLowerCase()) || {}).icon_url) || "img/crate.png";
    if (im.getAttribute("src") !== src) { im.src = src; im.onerror = () => { im.src = "img/crate.png"; im.onerror = null; }; }

    // your chance
    const gB = M.budget > 0 ? R.got(budgetN) : null;
    $("kryou").className = "kr-you " + (gB == null ? "empty" : tone(gB));
    $("kt3").textContent = gB == null ? "?" : pct(gB);
    $("krmeter").hidden = gB == null;
    if (gB != null) {
      $("krbar").style.width = Math.max(gB * 100, gB > 0 ? 1.5 : 0) + "%";
      $("krbar").className = tone(gB);
    }
    let line;
    if (gB == null) line = `Type how many **${cn}** you have in step 2.`;
    else if (budgetN < 1) line = `That's not enough for 1 crate. One costs **${money(M.cost(1))}**.`;
    else {
      const opens = `With **${money(M.budget)}** you can open **${commas(budgetN)} crate${budgetN === 1 ? "" : "s"}**. `;
      line = opens + (gB >= 1 ? `That's enough to **always** get ${uname}.`
        : gB >= 0.995 ? `Almost **everyone** gets ${uname} with that.`
        : gB >= 0.01 ? `About **${Math.round(gB * 100)} out of 100** players get ${uname} with that.`
        : `Only about **1 in ${short(1 / gB)}** players get ${uname} with that.`);
    }
    rich($("krline"), line);

    // how much you need: lucky, normal, unlucky (and guaranteed with pity)
    const box = $("kneed");
    box.textContent = "";
    const rows = [
      ["lucky", "Lucky", 0.25, "1 in 4 players have it by then"],
      ["normal", "Normal", 0.5, "Half of players have it by then"],
      ["unlucky", "Unlucky", 0.9, "9 in 10 players have it by then"],
    ].map(([k, t, q, s]) => [k, t, R.need(q), s]);
    if (R.guarantee) rows.push(["sure", "Guaranteed", R.guarantee, "Pity gives it to everyone"]);
    rows.forEach(([k, t, need, small]) => {
      const ok = isFinite(need);
      const have = ok && M.budget > 0 && budgetN >= need;
      const card = el("div", "kn-card kn-" + k + (have ? " have" : ""));
      card.append(el("span", "kn-t", t));
      const big = el("strong", null, ok ? (c.cur === "custom" ? money(M.cost(need)) : compact(M.cost(need))) : "Too many");
      if (ok && c.cur !== "custom") { const ci = el("img"); ci.alt = ""; ci.src = cur(c).icon; ci.onerror = () => ci.remove(); big.prepend(ci); }
      card.append(big, el("em", null, ok ? commas(need) + " crate" + (need === 1 ? "" : "s") : ""), el("small", null, small));
      if (have) card.append(el("b", "kn-have", "✓ You have this"));
      box.append(card);
    });

    // small print
    const each = p >= 1 ? "Every crate gives it" : `Each crate: **1 in ${short(1 / p)}** (${pct(p)})`;
    const pityTxt = R.guarantee ? ` Pity guarantees it by crate **${commas(R.guarantee)}**.`
      : M.pity ? ` Pity gives a unit of this rarity every ${commas(M.pity.N)} crates, but only ${pct(M.pity.s)} of the time this one.`
      : " No pity, so it's all luck.";
    rich($("krnote"), each + (M.luck !== 1 ? ` with ${M.luck}x luck.` : ".") + pityTxt);

    // show more: the plain numbers and every milestone
    const E = R.expected;
    $("kx1").textContent = p >= 1 ? "Every crate" : `1 in ${short(1 / p)} (${pct(p)})`;
    $("kx2").textContent = isFinite(E) ? commas(Math.round(E)) : "Too many";
    $("kx3").textContent = isFinite(E) && M.per > 0 ? money(E * M.per) : "–";
    const tb = $("kxtable");
    tb.textContent = "";
    MILESTONES.forEach(t => {
      const need = R.need(t), ok = isFinite(need);
      const have = ok && M.budget > 0 && budgetN >= need;
      const row = el("div", "kx-row" + (have ? " have" : ""));
      row.append(el("span", "kx-p", pct(t)), el("span", "kx-c", ok ? money(M.cost(need)) : "Too many"), el("span", "kx-n", ok ? commas(need) + " crates" : ""), el("span", "kx-ok", have ? "✓" : ""));
      tb.append(row);
    });
    save();
  }

  /* ── share link ───────────────────────────────────────────────── */
  const FIELDS = ["kd", "kl", "kp", "kpn", "kpp", "kb", "kyn", "kyk", "kyr"];
  function save() {
    const q = new URLSearchParams();
    q.set("c", S.crate);
    const u = crate().units[S.unit];
    if (u) q.set("u", u[0]);
    for (const f of FIELDS) if ($(f).value !== "") q.set(f.slice(1), $(f).value);
    q.set("pk", $("kpk").checked ? 1 : 0);
    q.set("py", $("kpy").checked ? 1 : 0);
    q.set("yt", $("kyt").value);
    history.replaceState(null, "", "#" + q.toString());
  }
  function restore() {
    const q = new URLSearchParams(location.hash.slice(1));
    if (!q.has("c") || !(q.get("c") === "custom" || CRATES.some(c => c.id === q.get("c")))) return false;
    S.crate = q.get("c");
    S.unit = q.has("u") ? crate().units.findIndex(x => x[0] === q.get("u")) : -1;
    for (const f of FIELDS) if (q.has(f.slice(1))) $(f).value = q.get(f.slice(1)).slice(0, 20);
    $("kpk").checked = q.get("pk") === "1";
    $("kpy").checked = q.get("py") === "1";
    $("kyt").value = q.get("yt") === "tier" ? "tier" : "exact";
    if (!q.has("d")) { // short link: use the crate's own numbers
      const want = S.unit;
      pickCrate(S.crate);
      if (want >= 0) pickUnit(want);
      return true;
    }
    const u = crate().units[S.unit];
    $("kunitname").textContent = u ? u[0] : "your unit";
    pickCrate(S.crate, true);
    return true;
  }

  /* ── wire up ──────────────────────────────────────────────────── */
  document.querySelectorAll("[data-luck]").forEach(b => { b.onclick = () => { setLuck(b.dataset.luck); update(); }; });
  ["kd", "kl", "kp", "kpn", "kpp", "kb", "kyn", "kyk", "kyr"].forEach(f => $(f).addEventListener("input", () => update()));
  ["kpk", "kpy", "kyt"].forEach(f => $(f).addEventListener("change", () => update()));
  $("kshow").onclick = () => {
    const open = $("kextra").hidden;
    $("kextra").hidden = !open;
    $("kshow").setAttribute("aria-expanded", open);
    $("kshow").firstChild.textContent = open ? "Show less" : "Show more";
    if (open) { $("kextra").classList.remove("pop"); void $("kextra").offsetWidth; $("kextra").classList.add("pop"); }
  };
  $("kcopy").onclick = () => (window.BB && BB.share ? BB.share(location.href, "Bloombot crate calculator", "Link copied") : navigator.clipboard.writeText(location.href));
  $("kreset").onclick = () => { history.replaceState(null, "", location.pathname); $("kb").value = ""; setLuck(1); pickCrate(CRATES[0].id); };
  const buyPack = () => { const c = crate(); if (c.pack) buy(c.pack[0], c.pack[1]); };
  const buyOne = () => { const c = crate(); if (c.price) buy(1, c.price); };
  $("buy1").onclick = buyOne;
  $("buyn").onclick = buyPack;
  $("swreset").onclick = $("swx").onclick = () => { simReset(); $("swpull").hidden = true; drawUnits(); };
  // E and T buy, like in game
  document.addEventListener("keydown", e => {
    if (e.ctrlKey || e.metaKey || e.altKey || e.repeat || /^(INPUT|TEXTAREA|SELECT)$/.test((e.target || {}).tagName || "")) return;
    if ($("sw").hidden || document.querySelector(".qs-box:not([hidden])")) return;
    const k = e.key.toLowerCase();
    if (k === "e") buyOne(); else if (k === "t") buyPack();
  });

  async function start() {
    try {
      const r = await fetch($("main").dataset.crates, { cache: "no-cache" });
      if (r.ok) {
        const d = await r.json();
        if (Array.isArray(d.crates) && d.crates.length) CRATES = d.crates.filter(c => c && c.id && Array.isArray(c.units));
        if (d.currencies) CUR = Object.assign({}, CUR, d.currencies);
      }
    } catch (e) { /* the built-in crates still work */ }
    if (!restore()) { setLuck(1); pickCrate(CRATES[0].id); }
    else update();
  }
  start();

  // unit pictures from the value list, when it loads
  if (window.BB && BB.onAuth) {
    let started = false;
    BB.onAuth(async () => {
      if (started) return;
      started = true;
      try {
        const list = await BB.loadValues();
        values = new Map(list.filter(i => i.category !== "gamepasses").map(i => [i.name.toLowerCase(), i]));
        drawUnits();
      } catch (e) { /* pictures are optional */ }
    });
  }
})();
