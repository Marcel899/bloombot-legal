/* Advent calendar card on the home page (section#xmc, built by xmas_card() in build.py).
   November: countdown to door 1. 1-24 December: today's door and when it closes; logged in,
   your opened doors from adv_status (sql/advent.sql). 25-31 December: Merry Christmas.
   Hidden the rest of the year. Ticks once a minute and stops while the tab is hidden. */
(() => {
  const box = document.getElementById("xmc");
  if (!box) return;
  const $ = id => document.getElementById(id);
  const YEAR = 2026;   // same as js/advent.js
  const pad = n => String(n).padStart(2, "0");
  let st = null, timer = 0, asked = false;

  function view(now) {
    const y = now.getUTCFullYear(), m = now.getUTCMonth(), d = now.getUTCDate();
    if (y === YEAR && m === 10) return { kind: "soon", at: Date.UTC(YEAR, 11, 1), door: 1 };
    if (y === YEAR && m === 11 && d <= 24) return { kind: "live", at: Date.UTC(YEAR, 11, d + 1), door: d };
    if (y === YEAR && m === 11) return { kind: "done" };
    return null;
  }

  function draw() {
    const now = new Date(), v = view(now);
    if (!v) { box.hidden = true; return; }
    box.hidden = false;
    box.dataset.kind = v.kind;
    const opened = st && Array.isArray(st.opened) ? st.opened : [];
    const doneToday = v.kind === "live" && opened.some(o => o.day === v.door);
    const set = (id, t) => { const n = $(id); if (n.textContent !== t) n.textContent = t; };
    set("xmc-n", v.kind === "done" ? "25" : String(v.door));
    if (v.kind === "soon") {
      set("xmc-h", "Door 1 opens in");
      set("xmc-sub", "24 doors of XP, banners and 13 free units, including an Infectia.");
      set("xmc-go", "See the calendar");
    } else if (v.kind === "live") {
      set("xmc-h", doneToday ? "You opened door " + v.door + "! Next door in" : "Door " + v.door + " is open! It closes in");
      set("xmc-sub", st && st.me
        ? (doneToday ? "Come back tomorrow for the next one. " : "Open it for XP and a ticket for the Infectia. ") + opened.length + " of 24 opened."
        : "Open today's door for XP, a ticket for the Infectia and a shot at a hidden unit.");
      set("xmc-go", doneToday ? "See the calendar" : "Open door " + v.door);
    } else {
      set("xmc-h", "Merry Christmas from Bloombot!");
      set("xmc-sub", "The doors are closed. See who won the Infectia and the hidden units.");
      set("xmc-go", "See the winners");
    }
    box.classList.toggle("is-done", doneToday);

    const dots = $("xmc-dots");
    dots.hidden = !(st && st.me && v.kind !== "soon");
    if (!dots.hidden) {
      const have = new Set(opened.map(o => o.day));
      for (const i of dots.children) {
        const n = +i.dataset.d;
        i.className = have.has(n) ? "y" : v.kind === "live" && n === v.door ? "t" : n < (v.door || 25) ? "m" : "";
      }
    }

    $("xmc-cd").hidden = !v.at;
    if (v.at) {
      let s = Math.max(0, Math.floor((v.at - now) / 1000));
      const days = Math.floor(s / 86400); s -= days * 86400;
      const h = Math.floor(s / 3600); s -= h * 3600;
      const mi = Math.floor(s / 60);
      $("xmc-dw").hidden = days === 0;
      set("xmc-d", String(days));
      set("xmc-dl", days === 1 ? "day" : "days");
      set("xmc-hh", pad(h));
      set("xmc-mm", pad(mi));
      $("xmc-cd").setAttribute("aria-label", (days ? days + (days === 1 ? " day, " : " days, ") : "") + h + " hours and " + mi + " minutes");
    }
    /* a new door just opened: ask the server again */
    if (st && v.kind === "live" && st.today !== v.door && !asked) { asked = true; load(); }
  }

  /* next tick right after the minute changes, so the minutes never lag */
  function loop() {
    clearTimeout(timer);
    if (document.hidden) return;
    draw();
    timer = setTimeout(loop, 60000 - (Date.now() % 60000) + 50);
  }
  document.addEventListener("visibilitychange", loop);

  async function load() {
    try {
      const { data, error } = await BB.sb.rpc("adv_status");
      if (!error && data) { st = data; asked = false; }
    } catch (e) { /* the card still works without it */ }
    draw();
  }

  loop();
  /* your doors only matter in December, so November visitors cost no request */
  if (window.BB && BB.onAuth) BB.onAuth(s => {
    const v = view(new Date());
    if (!s) { st = null; draw(); return; }
    if (v && v.kind !== "soon") load();
  });
})();
