/* Crate calculator: chances, average crates and currency for one unit from a crate (summon).
   Every crate is an independent roll. Chance of at least one copy in n crates = 1 - (1 - p)^n.
   Pity: the crate at the pity count always gives a unit of that rarity. */
(() => {
  const $ = id => document.getElementById(id);
  const el = (window.BB && BB.el) || ((t, c, x) => { const e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; });

  /* ── crates (from the in-game shop) ────────────────────────────── */
  const CUR = {
    candy: { name: "Candy", icon: "img/candy.png" },
    seeds: { name: "Seeds", icon: "img/seeds.png" },
    custom: { name: "currency", icon: "img/crate.png" },
  };
  // [name, stars, drop %, pity] ; pity = [count, progress] shared by the rarity
  const CRATES = [
    { id: "skull", name: "Skull Summon", tag: "Limited", cur: "candy", price: 666, pack: [13, 6666], units: [
      ["Lanternwood", 1, 45], ["Cyclopsia", 2, 35], ["Draculaflora", 3, 15.8], ["Vitalily", 4, 2.64],
      ["Skeleton Dragon", 4, 1.2], ["Coffinroot", 5, 0.26], ["Stringshade", 5, 0.095], ["Grim Gardener", 5, 0.005]] },
    { id: "mushroom", name: "Mushroom Summon", cur: "seeds", price: 300, pack: [10, 2700], units: [
      ["Pine Tree", 0, 45], ["Groundbreaker", 1, 35], ["Gooseberries", 2, 14], ["Fragpetal", 3, 4.75],
      ["Rosemire", 4, 1], ["Rangeleaf", 5, 0.24], ["Fungal Barrage", 5, 0.01]] },
    { id: "classic", name: "Classic Summon", tag: "Rotates", cur: "seeds", price: 100, pack: [10, 900], units: [
      ["Tomato", 0, 15.513], ["Farmer", 1, 13.186], ["Gnome", 1, 12.411], ["Pineapple Cannon", 1, 11.635],
      ["Chili Pepper", 2, 8.532], ["Rose Trap", 2, 7.757], ["Palm Tree", 3, 15.317, 50], ["Broccoli", 3, 12.254, 50],
      ["Watermelon", 4, 1.691, 500], ["Sunflower", 4, 1.674, 500], ["Bloodvine", 5, 0.03, 50000]] },
    { id: "custom", name: "Custom", cur: "custom", units: [] },
  ];
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
  const crate = () => CRATES.find(c => c.id === S.crate) || CRATES[0];

  function drawCrates() {
    const box = $("kcrates");
    box.textContent = "";
    for (const c of CRATES) {
      const b = el("button", "kcrate" + (c.id === S.crate ? " on" : ""));
      b.type = "button";
      const ic = el("img"); ic.alt = ""; ic.src = c.id === "custom" ? "img/gear.png" : CUR[c.cur].icon;
      ic.onerror = () => { ic.src = "img/crate.png"; };
      const t = el("span", "kc-t");
      t.append(el("strong", null, c.name));
      t.append(el("small", null, c.id === "custom" ? "Type your own numbers" : `${commas(c.price)} ${CUR[c.cur].name}` + (c.pack ? ` · ${c.pack[0]} for ${commas(c.pack[1])}` : "")));
      b.append(ic, t);
      if (c.tag) b.append(el("em", "kc-tag", c.tag));
      b.onclick = () => pickCrate(c.id);
      box.append(b);
    }
  }

  function unitImg(name) {
    const it = values.get(name.toLowerCase());
    if (it && window.BB && BB.itemImg) return BB.itemImg(it, "ku-img");
    const i = el("img", "ku-img"); i.alt = ""; i.src = "img/crate.png"; return i;
  }

  function drawUnits() {
    const c = crate(), box = $("kunits");
    box.textContent = "";
    $("kunits-wrap").hidden = !c.units.length;
    c.units.forEach((u, i) => {
      const [name, stars, drop, pity] = u;
      const b = el("button", "kunit " + STAR_CLASS[stars] + (i === S.unit ? " on" : ""));
      b.type = "button";
      b.setAttribute("aria-pressed", i === S.unit ? "true" : "false");
      const st = el("span", "ku-stars", stars ? "★".repeat(stars) : "");
      b.append(st, unitImg(name), el("span", "ku-name", name), el("span", "ku-pct", drop + "%"));
      if (pity) b.append(el("span", "ku-pity", "Pity " + commas(pity)));
      b.onclick = () => pickUnit(i);
      box.append(b);
    });
    $("knote").textContent = c.id === "classic" ? "The Classic Summon's units change every hour. These are one example rotation, so type the drop chance you see in game." : c.id === "skull" ? "Skull Summon is a limited crate. It leaves the shop when the timer ends." : "";
    $("knote").hidden = !$("knote").textContent;
  }

  function pickCrate(id, keepInputs) {
    S.crate = id;
    const c = crate();
    if (!keepInputs) {
      if (c.id !== "custom") {
        $("kp").value = c.price;
        $("kpn").value = c.pack ? c.pack[0] : "";
        $("kpp").value = c.pack ? c.pack[1] : "";
        $("kpk").checked = !!c.pack;
        S.unit = c.units.length - 1; // the rarest one
        fillUnit();
      } else {
        S.unit = -1;
        $("kunitname").textContent = "your unit";
      }
    }
    document.querySelectorAll("[data-cur]").forEach(n => { n.textContent = CUR[c.cur].name; });
    document.querySelectorAll("[data-curimg]").forEach(n => { n.src = CUR[c.cur].icon; n.hidden = c.cur === "custom"; });
    drawCrates();
    drawUnits();
    if (!keepInputs) update();
  }

  function fillUnit() {
    const c = crate(), u = c.units[S.unit];
    if (!u) return;
    $("kd").value = u[2];
    $("kunitname").textContent = u[0];
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

  function pityFields() {
    $("kpity").hidden = !$("kpy").checked;
    $("kyr-wrap").hidden = $("kyt").value !== "tier";
  }

  function setLuck(v) {
    $("kl").value = v;
    document.querySelectorAll("[data-luck]").forEach(b => b.classList.toggle("on", Number(b.dataset.luck) === Number(num(v))));
  }

  function stat(id, big, small) {
    const n = $(id);
    n.querySelector("strong").textContent = big;
    n.querySelector("span").textContent = small;
  }

  let last = null;
  function update(fromCost) {
    pityFields();
    setLuck($("kl").value);
    const M = model();
    const err = $("kerr");
    if (!M.ok) {
      err.hidden = false;
      err.textContent = !(M.base > 0) ? "Type the unit's drop chance, like 0.005%." : M.base > 1 ? "A drop chance can't be over 100%." : "Luck has to be more than 0.";
      $("kout").classList.add("dim");
      return;
    }
    err.hidden = true;
    $("kout").classList.remove("dim");

    // crates in the chance box
    let n = Math.floor(num($("kn").value) || 0);
    if (fromCost) { n = M.afford(num($("kc").value) || 0); $("kn").value = n; }
    const budgetN = M.afford(M.budget);

    // a first solve tells us the scale for the chart
    const pre = solve(M, []);
    const n99 = Math.min(isFinite(pre.need(0.99)) ? pre.need(0.99) : CAP, CAP);
    let xmax = Math.max(n99, 10);
    if (budgetN > xmax && budgetN < xmax * 3) xmax = budgetN;
    xmax = Math.ceil(xmax * 1.04);
    const samples = [];
    for (let i = 0; i <= 120; i++) samples.push(Math.round(xmax * i / 120));
    const R = M.pity && !M.pity.exact ? solve(M, samples.concat([n, budgetN])) : pre;
    last = { M, R };

    const p = M.p;
    stat("ks-chance", pct(p), p >= 1 ? "Every crate" : "1 in " + short(1 / p) + (M.luck !== 1 ? ` (${pct(M.base)} × ${M.luck} luck)` : " per crate"));
    const E = R.expected, med = R.need(0.5);
    stat("ks-avg", isFinite(E) ? (E < 100 ? String(Math.round(E * 10) / 10) : short(E)) : "Too many", isFinite(med) ? "Half of players need " + short(med) + " or fewer" : "");
    stat("ks-cost", isFinite(E) ? short(E * M.per) : "–", M.per > 0 ? short(M.per) + " per crate" + (M.usePacks ? " (in packs)" : "") : "Add a crate price");
    $("ks-pity").classList.toggle("sure", !!R.guarantee);
    if (R.guarantee) stat("ks-pity", short(R.guarantee), "crates from now, " + short(M.cost(R.guarantee)) + " " + CUR[crate().cur].name);
    else {
      const left = 1 - R.got(Math.round(E * 3) || 1);
      stat("ks-pity", "Never", M.pity ? "Pity gives a random unit of this rarity, so nothing is certain" : isFinite(left) ? `Even after 3× the average, ${pct(left)} of players still have none` : "No pity on this crate");
    }

    // budget
    const bline = $("kbudget");
    if (M.budget > 0 && budgetN > 0) {
      const g = R.got(budgetN);
      bline.hidden = false;
      bline.className = "kbudget " + (g >= 0.9 ? "good" : g >= 0.5 ? "mid" : "bad");
      bline.querySelector("strong").textContent = pct(g);
      bline.querySelector("span").textContent = `With ${short(M.budget)} ${CUR[crate().cur].name} you can open ${commas(budgetN)} crates. That's your chance to get ${$("kunitname").textContent}.`;
    } else if (M.budget > 0) {
      bline.hidden = false;
      bline.className = "kbudget bad";
      bline.querySelector("strong").textContent = "0%";
      bline.querySelector("span").textContent = "That's not enough for one crate.";
    } else bline.hidden = true;

    // chance box
    if (!fromCost) $("kc").value = n > 0 ? Math.round(M.cost(n)) : "";
    const g = n > 0 ? R.got(n) : 0;
    $("kres").textContent = pct(g);
    $("kres").className = "kbig " + (g >= 0.9 ? "good" : g >= 0.5 ? "mid" : "bad");
    const copies = n * p, oneIn = g > 0 ? 1 / g : Infinity;
    $("kresline").textContent = n > 0
      ? (g >= 1 ? `Everyone opening ${commas(n)} crates gets it.` : g >= 0.995 ? `Almost every player opening ${commas(n)} crates gets at least one.` : g >= 0.01
        ? `Out of 100 players opening ${commas(n)} crates, about ${Math.round(g * 100)} get at least one.`
        : `Only about 1 in ${short(oneIn)} players opening ${commas(n)} crates gets one.`)
        + ` On average that's ${copies >= 10 ? short(copies) : copies >= 0.01 ? Math.round(copies * 100) / 100 : "less than 0.01"} ${copies === 1 ? "copy" : "copies"}.`
      : "Type how many crates you'll open, or how much you'll spend.";

    // milestones
    const tb = $("kmiles");
    $("kmiles").closest("table").classList.toggle("nobudget", !(M.budget > 0));
    tb.textContent = "";
    for (const t of MILESTONES) {
      const need = R.need(t);
      const tr = el("tr");
      if (isFinite(need) && M.budget > 0) tr.className = need <= budgetN ? "yes" : "no";
      tr.append(el("td", "km-p", pct(t)));
      tr.append(el("td", null, isFinite(need) ? commas(need) : "Over " + short(CAP)));
      tr.append(el("td", null, isFinite(need) ? short(M.cost(need)) : "–"));
      const td = el("td", "km-b");
      td.textContent = !(M.budget > 0) || !isFinite(need) ? "" : need <= budgetN ? "✓ You can" : "Need " + short(M.cost(need) - M.budget) + " more";
      tr.append(td);
      tb.append(tr);
    }
    chart(R, samples, xmax, isFinite(E) ? E : null, budgetN, n);
    save();
  }

  /* ── chart ────────────────────────────────────────────────────── */
  const NS = "http://www.w3.org/2000/svg";
  const svgEl = (t, a) => { const e = document.createElementNS(NS, t); for (const k in a) e.setAttribute(k, a[k]); return e; };
  function chart(R, samples, xmax, avg, budgetN, mine) {
    const box = $("kchart");
    box.textContent = "";
    const W = 640, H = 220, L = 44, B = 26, T = 10, Rr = 12;
    const x = n => L + (n / xmax) * (W - L - Rr), y = v => T + (1 - v) * (H - T - B);
    const svg = svgEl("svg", { viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": "Chance to get the unit by crates opened" });
    for (const v of [0, 0.25, 0.5, 0.75, 1]) {
      svg.append(svgEl("line", { x1: L, x2: W - Rr, y1: y(v), y2: y(v), class: "kg" }));
      const t = svgEl("text", { x: L - 8, y: y(v) + 4, class: "kt", "text-anchor": "end" }); t.textContent = v * 100 + "%"; svg.append(t);
    }
    for (const f of [0, 0.5, 1]) {
      const t = svgEl("text", { x: x(xmax * f), y: H - 6, class: "kt", "text-anchor": f === 0 ? "start" : f === 1 ? "end" : "middle" });
      t.textContent = short(Math.round(xmax * f)) + (f === 1 ? " crates" : "");
      svg.append(t);
    }
    const pts = samples.map(n => [x(n), y(Math.max(0, Math.min(1, R.got(n) || 0)))]);
    const d = pts.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join("");
    svg.append(svgEl("path", { d: d + `L${x(xmax)} ${y(0)}L${x(0)} ${y(0)}Z`, class: "ka" }));
    svg.append(svgEl("path", { d, class: "kl" }));
    const mark = (n, cls, label) => {
      if (!(n > 0) || n > xmax) return;
      svg.append(svgEl("line", { x1: x(n), x2: x(n), y1: T, y2: H - B, class: "km " + cls }));
      const t = svgEl("text", { x: Math.min(x(n) + 5, W - 90), y: T + 12 + (cls === "kmb" ? 14 : cls === "kmn" ? 28 : 0), class: "kt " + cls }); t.textContent = label; svg.append(t);
    };
    mark(avg, "kma", "Average");
    mark(budgetN, "kmb", "Your budget");
    if (mine && mine !== budgetN) mark(mine, "kmn", "Your crates");
    const dot = svgEl("circle", { r: 5, class: "kdot", cx: -20, cy: -20 });
    svg.append(dot);
    box.append(svg);
    const tip = el("div", "ktip"); tip.hidden = true; box.append(tip);
    const move = e => {
      const rect = svg.getBoundingClientRect();
      const px = ((e.touches ? e.touches[0].clientX : e.clientX) - rect.left) / rect.width * W;
      const i = Math.max(0, Math.min(samples.length - 1, Math.round((px - L) / (W - L - Rr) * (samples.length - 1))));
      const n = samples[i], v = R.got(n) || 0;
      dot.setAttribute("cx", pts[i][0]); dot.setAttribute("cy", pts[i][1]);
      tip.hidden = false;
      tip.textContent = `${commas(n)} crates: ${pct(v)}`;
      tip.style.left = Math.min(rect.width - 150, Math.max(0, pts[i][0] / W * rect.width - 70)) + "px";
    };
    svg.addEventListener("mousemove", move);
    svg.addEventListener("touchmove", move, { passive: true });
    svg.addEventListener("mouseleave", () => { tip.hidden = true; dot.setAttribute("cx", -20); });
  }

  /* ── share link ───────────────────────────────────────────────── */
  const FIELDS = ["kd", "kl", "kp", "kpn", "kpp", "kb", "kn", "kyn", "kyk", "kyr"];
  function save() {
    const q = new URLSearchParams();
    q.set("c", S.crate);
    if (S.unit >= 0) q.set("u", S.unit);
    for (const f of FIELDS) if ($(f).value !== "") q.set(f.slice(1), $(f).value);
    q.set("pk", $("kpk").checked ? 1 : 0);
    q.set("py", $("kpy").checked ? 1 : 0);
    q.set("yt", $("kyt").value);
    history.replaceState(null, "", "#" + q.toString());
  }
  function restore() {
    const q = new URLSearchParams(location.hash.slice(1));
    if (!q.has("c") || !CRATES.some(c => c.id === q.get("c"))) return false;
    S.crate = q.get("c");
    S.unit = q.has("u") ? Number(q.get("u")) : -1;
    for (const f of FIELDS) if (q.has(f.slice(1))) $(f).value = q.get(f.slice(1)).slice(0, 20);
    $("kpk").checked = q.get("pk") === "1";
    $("kpy").checked = q.get("py") === "1";
    $("kyt").value = q.get("yt") === "tier" ? "tier" : "exact";
    const u = crate().units[S.unit];
    $("kunitname").textContent = u ? u[0] : "your unit";
    pickCrate(S.crate, true);
    return true;
  }

  /* ── wire up ──────────────────────────────────────────────────── */
  document.querySelectorAll("[data-luck]").forEach(b => { b.onclick = () => { setLuck(b.dataset.luck); update(); }; });
  ["kd", "kl", "kp", "kpn", "kpp", "kb", "kyn", "kyk", "kyr"].forEach(f => $(f).addEventListener("input", () => update()));
  ["kpk", "kpy", "kyt"].forEach(f => $(f).addEventListener("change", () => update()));
  $("kn").addEventListener("input", () => update());
  $("kc").addEventListener("input", () => update(true));
  document.querySelectorAll("[data-n]").forEach(b => { b.onclick = () => { $("kn").value = b.dataset.n === "budget" ? model().afford(model().budget) : b.dataset.n; update(); }; });
  $("kcopy").onclick = () => (window.BB && BB.share ? BB.share(location.href, "Bloombot crate calculator", "Link copied") : navigator.clipboard.writeText(location.href));
  $("kreset").onclick = () => { history.replaceState(null, "", location.pathname); $("kb").value = ""; $("kn").value = 13; setLuck(1); pickCrate("skull"); };

  if (!restore()) { setLuck(1); pickCrate("skull"); }
  else update();

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
