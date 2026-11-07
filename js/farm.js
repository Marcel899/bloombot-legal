/* Farm calculator: Seeds and Fertilizer per hour from one run.
   One cycle = run time + time between runs (loading, voting, lobby).
   Per hour uses the average (3600 / cycle runs). Play sessions and goals only
   count finished runs, because rewards come at the end of a run. */
(() => {
  const $ = id => document.getElementById(id);
  const EX = { t: "12:00", s: "70950", f: "38" }; // shown as the example when a box is empty

  /* ── formatting ───────────────────────────────────────────────── */
  const commas = n => Math.round(n).toLocaleString("en-US");
  const short = n => {
    const a = Math.abs(n);
    if (a >= 1e9) return +(n / 1e9).toFixed(2) + "b";
    if (a >= 1e6) return +(n / 1e6).toFixed(2) + "m";
    if (a >= 1e4) return +(n / 1e3).toFixed(1) + "k";
    return commas(n);
  };
  const one = n => (Math.round(n * 10) / 10).toLocaleString("en-US");
  const dur = sec => {
    sec = Math.round(sec);
    if (sec < 60) return sec + "s";
    const d = Math.floor(sec / 86400), h = Math.floor(sec % 86400 / 3600), m = Math.floor(sec % 3600 / 60), s = sec % 60;
    if (d) return d + "d" + (h ? " " + h + "h" : "");
    if (h) return h + "h" + (m ? " " + m + "m" : "");
    return m + "m" + (s ? " " + s + "s" : "");
  };
  const clock = sec => {
    sec = Math.round(sec);
    const h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60), s = sec % 60;
    const p = n => String(n).padStart(2, "0");
    return h ? `${h}:${p(m)}:${p(s)}` : `${m}:${p(s)}`;
  };

  /* ── parsing ──────────────────────────────────────────────────── */
  // 70950, 70,950, 70.9k, 1.2m
  const num = v => {
    v = String(v || "").trim().toLowerCase().replace(/[\s,_]/g, "");
    const m = v.match(/^(\d*\.?\d+)([kmb]?)$/);
    if (!m) return NaN;
    return parseFloat(m[1]) * ({ "": 1, k: 1e3, m: 1e6, b: 1e9 })[m[2]];
  };
  // 12 (minutes), 12.5, 12:30, 1:02:30, 12m 30s, 90s, 1h 5m
  const time = (v, unit = 60) => {
    v = String(v || "").trim().toLowerCase().replace(/,/g, ".");
    if (!v) return NaN;
    if (/^\d*\.?\d+$/.test(v)) return parseFloat(v) * unit;
    if (/^\d+(:\d{1,2}){1,2}$/.test(v)) return v.split(":").reduce((a, x) => a * 60 + +x, 0);
    const re = /(\d*\.?\d+)\s*(h|hr|hrs|hours?|m|min|mins|minutes?|s|sec|secs|seconds?)/g;
    let total = 0, used = "", m;
    while ((m = re.exec(v))) { total += parseFloat(m[1]) * ({ h: 3600, m: 60, s: 1 })[m[2][0]]; used += m[0]; }
    return used.replace(/\s/g, "") === v.replace(/\s/g, "") ? total : NaN;
  };

  /* ── state ────────────────────────────────────────────────────── */
  const S = { gap: 10, play: 3600, gcur: "s", x2s: false, x2f: false };
  const inputs = ["ft", "fs", "ff", "fg", "fp", "fgoal"].map($);

  const setChips = (sel, attr, val) => document.querySelectorAll(sel).forEach(c => c.classList.toggle("on", +c.dataset[attr] === val));

  function read() {
    const ex = !$("ft").value.trim() && !$("fs").value.trim() && !$("ff").value.trim();
    const t = time($("ft").value || EX.t);
    const s = $("fs").value.trim() ? num($("fs").value) : ex ? num(EX.s) : 0;
    const f = $("ff").value.trim() ? num($("ff").value) : ex ? num(EX.f) : 0;
    const g = $("fg").value.trim() ? time($("fg").value, 1) : 0;
    const p = $("fp").value.trim() ? time($("fp").value, 3600) : S.play;
    const goal = $("fgoal").value.trim() ? num($("fgoal").value) : NaN;
    return { ex, t, s: s * (S.x2s ? 2 : 1), f: f * (S.x2f ? 2 : 1), g, p, goal };
  }

  function err(msg) {
    $("ferr").textContent = msg;
    $("ferr").hidden = !msg;
    $("fout").classList.toggle("dim", !!msg);
  }

  function card(cls, g, icon, label, big, small) {
    return `<div class="fstat ${cls}"><div class="fs-head weld ${g}">${label}</div><div class="fs-body"><span class="fs-ico"><img src="${icon}" alt=""></span><div class="fs-num"><strong>${big}</strong><small>${small}</small></div></div></div>`;
  }
  function mini(icon, label, big, small, k) {
    return `<div class="kn-card" style="--k:${k}"><span class="kn-t">${label}</span><strong>${icon ? `<img src="${icon}" alt="">` : ""}${big}</strong><small>${small}</small></div>`;
  }
  const SEED = "img/cur/seeds.webp", FERT = "img/cur/fertilizer.webp", CLOCK = "img/clock.png";

  function calc() {
    const v = read();
    $("fex").hidden = !v.ex;
    if (!(v.t >= 10)) return err(isNaN(v.t) ? "That run time doesn't look right. Try 12:30 or 12m 30s." : "A run has to take at least 10 seconds.");
    if (v.t > 36000) return err("That run is over 10 hours long. Check the run time.");
    if (isNaN(v.s) || isNaN(v.f)) return err("Type rewards as numbers, like 70950 or 70.9k.");
    if (isNaN(v.g) || v.g < 0) return err("That time between runs doesn't look right. Try 10 or 0:30.");
    if (!(v.s > 0 || v.f > 0)) return err("Type how many Seeds or Fertilizer one run gives.");
    err("");

    const cycle = v.t + v.g, perH = 3600 / cycle;
    const sH = v.s * perH, fH = v.f * perH;
    $("fstats").innerHTML =
      card("seeds", "g-green", SEED, "Seeds per hour", commas(sH), `${short(v.s / cycle * 60)} a minute`) +
      card("fert", "g-purple", FERT, "Fertilizer per hour", commas(fH), `${one(v.f / cycle * 60)} a minute`) +
      card("runs", "g-blue", CLOCK, "Runs per hour", one(perH), `One every ${clock(cycle)}`);
    $("fline").innerHTML =
      `<div class="fc-bar"><span class="fc-run" style="flex-grow:${v.t}"><img src="${CLOCK}" alt="">Run ${clock(v.t)}</span>` +
      (v.g ? `<span class="fc-gap" style="flex-grow:${v.g}">+${dur(v.g)}</span>` : "") + `</div>` +
      `<p>${v.g ? `${clock(v.t)} run + ${dur(v.g)} waiting = <b>${clock(cycle)}</b> each` : `No waiting, so one run every <b>${clock(cycle)}</b>`}. That's <b>${one(perH)} runs</b> an hour.</p>`;

    // play session: only finished runs pay, and the last run needs no break after it
    if (!(v.p > 0)) { $("fplay").innerHTML = `<p class="kr-note">Type how long you play, like 2h or 90m.</p>`; }
    else {
      const runs = Math.max(0, Math.floor((v.p + v.g) / cycle + 1e-9));
      const left = v.p - (runs ? runs * v.t + (runs - 1) * v.g : 0);
      $("fplay").innerHTML =
        mini(SEED, "Seeds", commas(runs * v.s), `${runs} × ${short(v.s)}`, "#3fd13f") +
        mini(FERT, "Fertilizer", commas(runs * v.f), `${runs} × ${commas(v.f)}`, "#a94fff") +
        mini(CLOCK, "Finished runs", commas(runs), runs ? `${dur(left)} left over` : "Not enough time for one run", "#14aeea");
    }

    // goal
    const per = S.gcur === "s" ? v.s : v.f, name = S.gcur === "s" ? "Seeds" : "Fertilizer";
    if (isNaN(v.goal) || v.goal <= 0) {
      $("fgoalout").innerHTML = `<p class="kr-note">Type how many ${name} you want, like 500k.</p>`;
    } else if (!(per > 0)) {
      $("fgoalout").innerHTML = `<p class="kr-note">Your run gives no ${name}, so you can't farm it here.</p>`;
    } else {
      const runs = Math.ceil(v.goal / per - 1e-9);
      const sec = runs * v.t + (runs - 1) * v.g;
      const done = new Date(Date.now() + sec * 1000);
      const sameDay = done.toDateString() === new Date().toDateString();
      const at = done.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      $("fgoalout").innerHTML =
        mini(CLOCK, "Play time", dur(sec), `${commas(runs)} run${runs === 1 ? "" : "s"} back to back`, "#14aeea") +
        mini("", "Done at", sameDay ? at : done.toLocaleDateString([], { weekday: "short" }) + " " + at, "If you start now and don't stop", "#f5c83c") +
        mini(S.gcur === "s" ? FERT : SEED, S.gcur === "s" ? "Fertilizer too" : "Seeds too", commas(runs * (S.gcur === "s" ? v.f : v.s)), "What you get on the way", S.gcur === "s" ? "#a94fff" : "#3fd13f");
    }

    // show more: speed-ups and longer periods
    const rows = [30, 60, 120].filter(c => v.t - c >= 10).map(c => {
      const ph = 3600 / (cycle - c);
      return `<div class="fx-row"><span>${clock(v.t - c)} <em>(${dur(c)} faster)</em></span><b>+${short((ph - perH) * v.s)}</b><b>+${one((ph - perH) * v.f)}</b></div>`;
    }).join("");
    $("fxfast").innerHTML = rows ? `<div class="fx-row fx-h"><span>Run time</span><b><img src="${SEED}" alt="">Seeds/h</b><b><img src="${FERT}" alt="">Fert/h</b></div>` + rows : `<p class="kr-note">Your run is already very short.</p>`;
    $("fx1").textContent = `${short(v.s)} · ${commas(v.f)}`;
    $("fx2").textContent = `${short(sH * 24)} · ${commas(fH * 24)}`;
    $("fx3").textContent = v.g ? Math.round(v.g / cycle * 100) + "%" : "0%";

    save();
  }

  /* ── link ─────────────────────────────────────────────────────── */
  function save() {
    const q = new URLSearchParams();
    [["t", "ft"], ["s", "fs"], ["f", "ff"], ["g", "fg"], ["p", "fp"], ["goal", "fgoal"]].forEach(([k, id]) => { const x = $(id).value.trim(); if (x) q.set(k, x); });
    if (S.gcur === "f") q.set("gc", "f");
    if (S.x2s) q.set("x2s", "1");
    if (S.x2f) q.set("x2f", "1");
    const h = q.toString();
    history.replaceState(null, "", h ? "#" + h : location.pathname);
  }
  function load() {
    const q = new URLSearchParams(location.hash.slice(1));
    [["t", "ft"], ["s", "fs"], ["f", "ff"], ["g", "fg"], ["p", "fp"], ["goal", "fgoal"]].forEach(([k, id]) => { if (q.has(k)) $(id).value = q.get(k).slice(0, 20); });
    if (!q.has("g")) $("fg").value = String(S.gap);
    S.gcur = q.get("gc") === "f" ? "f" : "s";
    S.x2s = q.get("x2s") === "1"; S.x2f = q.get("x2f") === "1";
    $("fx2s").checked = S.x2s; $("fx2f").checked = S.x2f;
    $("fgc").value = S.gcur;
    syncChips();
  }
  function syncChips() {
    setChips("[data-gap]", "gap", $("fg").value.trim() ? time($("fg").value, 1) : 0);
    setChips("[data-play]", "play", $("fp").value.trim() ? time($("fp").value, 3600) : S.play);
  }

  /* ── events ───────────────────────────────────────────────────── */
  inputs.forEach(i => i.addEventListener("input", () => { syncChips(); calc(); }));
  document.querySelectorAll("[data-gap]").forEach(c => c.onclick = () => { $("fg").value = c.dataset.gap; syncChips(); calc(); });
  document.querySelectorAll("[data-play]").forEach(c => c.onclick = () => {
    const h = +c.dataset.play / 3600;
    $("fp").value = h >= 1 ? h + "h" : h * 60 + "m";
    syncChips(); calc();
  });
  $("fgc").onchange = () => { S.gcur = $("fgc").value === "f" ? "f" : "s"; calc(); };
  $("fx2s").onchange = () => { S.x2s = $("fx2s").checked; calc(); };
  $("fx2f").onchange = () => { S.x2f = $("fx2f").checked; calc(); };
  $("fshow").onclick = () => {
    const open = $("fextra").hidden;
    $("fextra").hidden = !open;
    $("fshow").setAttribute("aria-expanded", open);
    $("fshow").querySelector("span").textContent = open ? "Show less" : "Show more";
    if (open) { $("fextra").classList.remove("pop"); void $("fextra").offsetWidth; $("fextra").classList.add("pop"); }
  };
  $("fcopy").onclick = () => (window.BB && BB.share ? BB.share(location.href, "Bloombot farm calculator", "Link copied") : navigator.clipboard.writeText(location.href));
  $("freset").onclick = () => {
    inputs.forEach(i => { i.value = ""; });
    $("fg").value = String(S.gap);
    S.gcur = "s"; S.x2s = S.x2f = false;
    $("fgc").value = "s"; $("fx2s").checked = $("fx2f").checked = false;
    history.replaceState(null, "", location.pathname);
    syncChips(); calc();
  };

  load();
  calc();
})();
