/* News list (news.html): tag filter chips, kept in the URL (#tag=update).
   Post pages (news/*.html): Share button. The unread dot and "New" badges are in js/site.js. */
(() => {
  const $ = id => document.getElementById(id);

  const chips = [...document.querySelectorAll(".nw-chips .chip")];
  if (chips.length) {
    const top = document.querySelector(".nw-top"), grid = $("nw-grid");
    const cards = [...grid.querySelectorAll(".nw-card")];
    const restCount = cards.filter(c => !c.hasAttribute("data-first")).length;
    const plural = n => n + (n === 1 ? " post" : " posts");
    const apply = (t, push) => {
      if (!chips.some(c => c.dataset.t === t)) t = "all";
      const all = t === "all";
      for (const c of chips) { const on = c.dataset.t === t; c.classList.toggle("on", on); c.setAttribute("aria-pressed", on); }
      /* filtered: one plain list, newest first, including the top post */
      top.hidden = !all;
      let n = 0;
      for (const c of cards) {
        const show = all ? !c.hasAttribute("data-first") : c.dataset.tag === t;
        c.hidden = !show;
        if (show) n++;
      }
      const label = chips.find(c => c.dataset.t === t);
      $("nw-h").textContent = all ? "Earlier posts" : label.firstChild.textContent + " posts";
      $("nw-n").textContent = plural(all ? restCount : n);
      $("nw-none").hidden = n > 0;
      if (push) history.replaceState(null, "", all ? location.pathname : "#tag=" + t);
    };
    for (const c of chips) c.onclick = () => apply(c.dataset.t, true);
    const fromHash = () => { const m = location.hash.match(/^#tag=([\w-]+)/); apply(m ? decodeURIComponent(m[1]) : "all"); };
    addEventListener("hashchange", fromHash);
    fromHash();
  }

  const share = $("nw-share");
  if (share) share.onclick = () => {
    const url = location.origin + location.pathname;
    if (window.BB && BB.share) BB.share(url, share.dataset.title);
    else if (navigator.clipboard) navigator.clipboard.writeText(url);
  };
})();
