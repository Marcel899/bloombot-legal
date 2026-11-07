/* Cookie notice: shown once on the first visit. The choice is kept in localStorage bb_consent
   ("all" or "essential"). Essential-only turns off optional storage (recent searches, remembered popups). */
(() => {
  const KEY = "bb_consent", OPTIONAL = [/^bb_qs_recent$/, /^bb_gw_min_/];
  const get = () => { try { return localStorage.getItem(KEY); } catch (e) { return "essential"; } };
  window.BB_CONSENT = { get, optional: () => get() === "all", open };
  let box = null;

  function save(v) {
    try {
      localStorage.setItem(KEY, v);
      if (v !== "all") Object.keys(localStorage).filter(k => OPTIONAL.some(r => r.test(k))).forEach(k => localStorage.removeItem(k));
    } catch (e) { /* storage blocked: nothing is stored anyway */ }
    close();
  }
  function close() {
    if (!box) return;
    const b = box; box = null;
    document.documentElement.classList.remove("ck-open");
    b.classList.add("out");
    setTimeout(() => b.remove(), 220);
  }
  function open() {
    if (box) return;
    const btn = (cls, txt, v) => {
      const x = document.createElement("button");
      x.type = "button"; x.className = "brick sm " + cls; x.textContent = txt;
      x.addEventListener("click", () => save(v));
      return x;
    };
    box = document.createElement("section");
    box.className = "ck";
    box.setAttribute("role", "dialog");
    box.setAttribute("aria-label", "Cookies");
    const icon = document.createElement("img");
    icon.src = "/img/cookie.png?v=2"; icon.alt = ""; icon.className = "ck-ico";
    const txt = document.createElement("div");
    txt.className = "ck-txt";
    const h = document.createElement("h2"); h.textContent = "We use cookies";
    const p = document.createElement("p");
    p.append("Only to keep you logged in and remember your settings. No ads, no tracking. ");
    const a = document.createElement("a"); a.href = "/privacy.html#cookies"; a.textContent = "Learn more";
    p.append(a);
    txt.append(h, p);
    const row = document.createElement("div");
    row.className = "ck-btns";
    row.append(btn("dark", "Essential only", "essential"), btn("green", "Accept all", "all"));
    box.append(icon, txt, row);
    document.body.append(box);
    document.documentElement.classList.add("ck-open");
  }
  function boot() {
    document.querySelectorAll("[data-cookies]").forEach(l => l.addEventListener("click", e => { e.preventDefault(); open(); }));
    if (!get() && !/(^|\/)gsi\.html$/.test(location.pathname)) open();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();
