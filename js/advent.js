/* Advent calendar (design only): a countdown chip in the header and a glow on
   the next door (before December) or today's door (1–24 December). Nothing opens. */
(() => {
  const chip = document.getElementById("xmcount"), text = document.getElementById("xmcount-t");
  if (!chip || !text) return;
  const now = new Date(), y = now.getFullYear();
  const midnight = d => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const mark = (day, label) => {
    const cell = document.querySelector('.xm-cell[data-day="' + day + '"]');
    if (!cell) return;
    cell.classList.add("next");
    const f = document.createElement("span");
    f.className = "xm-flag";
    f.textContent = label;
    cell.append(f);
  };
  let msg = "";
  if (now.getMonth() === 11 && now.getDate() <= 24) {
    const d = now.getDate();
    msg = d === 24 ? "It's Christmas Eve!" : 24 - d === 1 ? "1 day until Christmas Eve" : (24 - d) + " days until Christmas Eve";
    mark(d, "Today");
  } else if (now.getMonth() === 11) {
    msg = "Merry Christmas!";
  } else if (now.getMonth() >= 9) {
    const days = Math.round((midnight(new Date(y, 11, 1)) - midnight(now)) / 864e5);
    msg = days === 1 ? "Door 1 opens tomorrow" : "Door 1 opens in " + days + " days";
    mark(1, "Next");
  }
  if (!msg) return;
  text.textContent = msg;
  chip.hidden = false;
})();
