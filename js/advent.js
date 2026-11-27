/* Advent calendar (design only): a live countdown in the header, and a glow on the
   next door (before December) or today's door (1–24 December). Nothing opens.
   Before December it counts to door 1, in December to the next door, on the 24th
   to Christmas Day. */
(() => {
  const $ = id => document.getElementById(id);
  const box = $("xmcd");
  if (!box) return;
  const pad = n => String(n).padStart(2, "0");
  let markedDay = null, last = {};

  function mark(day, label) {
    if (markedDay === day + label) return;
    markedDay = day + label;
    document.querySelectorAll(".xm-cell.next").forEach(c => c.classList.remove("next"));
    document.querySelectorAll(".xm-flag").forEach(f => f.remove());
    const cell = document.querySelector('.xm-cell[data-day="' + day + '"]');
    if (!cell) return;
    cell.classList.add("next");
    const f = document.createElement("span");
    f.className = "xm-flag";
    f.textContent = label;
    cell.append(f);
  }
  /* what we're counting to right now */
  function goal(now) {
    const y = now.getFullYear(), m = now.getMonth(), d = now.getDate();
    if (m === 11 && d <= 23) { mark(d, "Today"); return { at: new Date(y, 11, d + 1), title: "Door " + (d + 1) + " opens in" }; }
    if (m === 11 && d === 24) { mark(24, "Today"); return { at: new Date(y, 11, 25), title: "Christmas Day in" }; }
    if (m === 11) return { done: "Merry Christmas from Bloombot!" };
    mark(1, "Next");
    return { at: new Date(y, 11, 1), title: "Door 1 opens in" };
  }
  function set(id, v) {
    if (last[id] === v) return;
    last[id] = v;
    const b = $(id);
    b.textContent = v;
    /* little pop on the number that changed */
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
  }
  /* Peek behind a door: hover on a computer, tap on a phone, Enter or Space with a
     keyboard. Only one stays open at a time; it's just a look, nothing is claimed. */
  const cells = [...document.querySelectorAll(".xm-cell")];
  const peek = (cell, on) => {
    cells.forEach(c => { if (c !== cell && c.classList.contains("peek")) { c.classList.remove("peek"); c.setAttribute("aria-pressed", "false"); } });
    cell.classList.toggle("peek", on);
    cell.setAttribute("aria-pressed", String(on));
  };
  cells.forEach(c => {
    c.addEventListener("click", () => peek(c, !c.classList.contains("peek")));
    c.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); peek(c, !c.classList.contains("peek")); } });
  });
  document.addEventListener("click", e => { if (!e.target.closest(".xm-cell")) cells.forEach(c => c.classList.contains("peek") && peek(c, false)); });

  tick();
  /* tick right on the second */
  setTimeout(() => { tick(); setInterval(tick, 1000); }, 1000 - (Date.now() % 1000));
})();
