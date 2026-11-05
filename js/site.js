/* Small page behaviours: scroll progress, back to top, command search, "On this page" highlight. */
(() => {
  const p = document.querySelector(".progress"), t = document.querySelector(".totop");
  if (p && t) {
    const f = () => {
      const h = document.documentElement, max = h.scrollHeight - h.clientHeight;
      p.style.transform = `scaleX(${max > 0 ? h.scrollTop / max : 0})`;
      t.classList.toggle("show", h.scrollTop > 600);
      document.body.classList.toggle("scrolled", h.scrollTop > 24);
    };
    addEventListener("scroll", f, { passive: true });
    f();
  }

  const q = document.getElementById("cmdq"), none = document.getElementById("cmdnone");
  if (q) q.addEventListener("input", () => {
    const v = q.value.trim().toLowerCase();
    let any = 0;
    document.querySelectorAll(".cmd-group").forEach(g => {
      let n = 0;
      g.querySelectorAll(".cmd").forEach(li => { const ok = !v || li.dataset.q.includes(v); li.hidden = !ok; n += ok; });
      g.hidden = !n;
      any += n;
    });
    none.hidden = !!any;
  });

  const links = [...document.querySelectorAll(".toc-box a")];
  if (links.length && "IntersectionObserver" in window) {
    const map = new Map(links.map(a => [a.getAttribute("href").slice(1), a]));
    const io = new IntersectionObserver(es => es.forEach(e => {
      if (!e.isIntersecting) return;
      links.forEach(a => a.classList.remove("on"));
      const a = map.get(e.target.id);
      if (a) a.classList.add("on");
    }), { rootMargin: "-90px 0px -70% 0px" });
    map.forEach((a, id) => { const el = document.getElementById(id); if (el) io.observe(el); });
  }
  const d = document.querySelector(".mtoc");
  if (d) d.querySelectorAll("a").forEach(a => a.addEventListener("click", () => { d.open = false; }));
})();

/* Quick search (Ctrl+K or /): pages, values, strategies and commands in one box. */
(() => {
  const btn = document.getElementById("qs");
  if (!btn || !window.BB) return;
  const { el } = BB;
  const invite = (document.querySelector(".brick.add") || {}).href || "features.html";
  const PAGES = [
    ["Home", "./", "flower"], ["Values", "values.html", "dollar"], ["Trade calculator", "calculator.html", "calculator"], ["Crate calculator", "crates.html", "crate"],
    ["Trade ads", "trades.html", "trading"], ["Post a trade ad", "trades.html#post", "plus"], ["Strategies", "strategies.html", "bullseye"],
    ["Share a strategy", "strategies.html#share", "bullseye"], ["Features and commands", "features.html", "gem"],
    ["My watchlist", "values.html#watchlist", "wish_star"], ["My profile", "profile.html", "medal_gold"], ["Profile settings", "profile.html#edit", "gear"], ["Server dashboard", "dashboard.html", "shield"], ["Add Bloombot to Discord", invite, "envelope"],
    ["Privacy Policy", "privacy.html", "shield"], ["Terms of Service", "terms.html", "scale"],
  ];
  let box, input, list, opts = [], idx = 0, data = null;
  const norm = s => String(s || "").toLowerCase().replace(/[^a-z0-9/ ]/g, "");
  const score = (name, q) => { const n = norm(name); return n.startsWith(q) ? 3 : n.split(/[ /]/).some(w => w.startsWith(q)) ? 2 : n.includes(q) ? 1 : 0; };

  async function load() {
    if (data) return data;
    data = { values: [], strats: [], cmds: [] };
    await Promise.all([
      BB.loadValues().then(v => { data.values = v; }).catch(() => {}),
      BB.sb ? BB.sb.from("strategies").select("id,title,category").order("id", { ascending: false }).limit(500)
        .then(({ data: d }) => { data.strats = d || []; }) : null,
      fetch("data/commands.json").then(r => r.json()).then(c => { data.cmds = c; }).catch(() => {}),
    ]);
    return data;
  }

  function results(q) {
    q = norm(q).trim();
    const pick = (arr, name, n) => arr.map(x => [score(name(x), q), x]).filter(r => r[0]).sort((a, b) => b[0] - a[0] || (b[1].est || 0) - (a[1].est || 0)).slice(0, n).map(r => r[1]);
    if (!q) return [["Pages", PAGES.slice(0, 8).map(page)]];
    const d = data || { values: [], strats: [], cmds: [] };
    const out = [
      ["Values", pick(d.values, v => v.name, 6).map(v => ({ img: v, title: v.name, sub: v.est > 0 ? BB.fmt(v.est) + (v.oc ? " O/C" : "") : (v.value_text || ""), href: "values.html#" + encodeURIComponent(v.name) }))],
      ["Commands", pick(d.cmds, c => c[0] + " " + c[1], 4).map(c => ({ icon: "gem", title: c[0], sub: c[1], href: "features.html#cmd=" + encodeURIComponent(c[0]) }))],
      ["Strategies", pick(d.strats, s => BB.plain(s.title), 4).map(s => ({ icon: "bullseye", title: BB.plain(s.title), sub: s.category.replace("-", " "), href: "strategies.html#s-" + s.id }))],
      ["Pages", pick(PAGES, p => p[0], 4).map(page)],
    ];
    return out.filter(g => g[1].length);
  }
  function page(p) { return { icon: p[2], title: p[0], href: p[1] }; }

  function draw() {
    const groups = results(input.value);
    opts = [];
    list.replaceChildren();
    for (const [name, items] of groups) {
      list.append(el("div", "qs-group", name));
      for (const it of items) {
        const a = el("a", "qs-item");
        a.href = it.href;
        a.id = "qs-o" + opts.length;
        a.setAttribute("role", "option");
        if (it.img) a.append(BB.itemImg(it.img, "qs-img"));
        else { const i = el("img", "qs-img"); i.alt = ""; i.src = "img/" + it.icon + ".png"; a.append(i); }
        const t = el("span", "qs-t");
        t.append(el("strong", null, it.title));
        if (it.sub) t.append(el("em", null, it.sub));
        a.append(t);
        a.onmousemove = () => { if (idx !== opts.indexOf(a)) { idx = opts.indexOf(a); mark(); } };
        a.onclick = () => close();
        opts.push(a);
        list.append(a);
      }
    }
    if (!opts.length) list.append(el("p", "qs-none", data ? "Nothing found." : "Loading…"));
    idx = 0;
    mark();
  }
  function mark() {
    opts.forEach((o, i) => o.classList.toggle("on", i === idx));
    if (opts[idx]) { opts[idx].scrollIntoView({ block: "nearest" }); input.setAttribute("aria-activedescendant", opts[idx].id); }
  }

  function build() {
    box = el("div", "qs-wrap");
    box.hidden = true;
    const panel = el("div", "qs-box");
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-modal", "true");
    panel.setAttribute("aria-label", "Search");
    input = el("input", "qs-input");
    input.type = "search";
    input.placeholder = "Search units, strategies, commands, pages…";
    input.setAttribute("aria-label", "Search");
    input.setAttribute("role", "combobox");
    input.setAttribute("aria-controls", "qs-list");
    list = el("div", "qs-list");
    list.id = "qs-list";
    list.setAttribute("role", "listbox");
    const foot = el("div", "qs-foot");
    foot.append(el("span", null, "↑↓ to move"), el("span", null, "Enter to open"), el("span", null, "Esc to close"));
    panel.append(input, list, foot);
    box.append(panel);
    document.body.append(box);
    box.onclick = e => { if (e.target === box) close(); };
    input.oninput = draw;
    input.onkeydown = e => {
      if (e.key === "ArrowDown") { idx = Math.min(idx + 1, opts.length - 1); mark(); e.preventDefault(); }
      else if (e.key === "ArrowUp") { idx = Math.max(idx - 1, 0); mark(); e.preventDefault(); }
      else if (e.key === "Enter" && opts[idx]) { e.preventDefault(); opts[idx].click(); }
      else if (e.key === "Escape") close();
    };
  }
  function open() {
    if (!box) build();
    box.hidden = false;
    document.body.classList.add("noscroll");
    input.value = "";
    draw();
    input.focus();
    load().then(draw);
  }
  function close() {
    if (!box || box.hidden) return;
    box.hidden = true;
    document.body.classList.remove("noscroll");
    btn.focus();
  }
  btn.onclick = open;
  document.addEventListener("keydown", e => {
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName) || document.activeElement.isContentEditable;
    if ((e.key === "k" && (e.ctrlKey || e.metaKey)) || (e.key === "/" && !typing)) { e.preventDefault(); open(); }
  });
  /* features.html#cmd=/value fills the command search. */
  const m = location.hash.match(/^#cmd=(.+)$/), cq = document.getElementById("cmdq");
  if (m && cq) {
    cq.value = decodeURIComponent(m[1]);
    cq.dispatchEvent(new Event("input"));
    setTimeout(() => document.getElementById("commands").scrollIntoView({ block: "start" }), 50);
  }
})();

/* The trade icon comes from Discord through the site; fall back to the local one if that fails. */
(() => {
  const fix = img => { if (!img.dataset.fb) { img.dataset.fb = 1; img.src = "img/swap.png"; } };
  const watch = img => {
    if (img.complete && img.naturalWidth === 0) fix(img);
    else img.addEventListener("error", () => fix(img), { once: true });
  };
  document.querySelectorAll('img[src$="trading.png"]').forEach(watch);
  new MutationObserver(ms => ms.forEach(m => m.addedNodes.forEach(n => {
    if (n.nodeType !== 1) return;
    if (n.matches('img[src$="trading.png"]')) watch(n);
    n.querySelectorAll && n.querySelectorAll('img[src$="trading.png"]').forEach(watch);
  }))).observe(document.body, { childList: true, subtree: true });
})();

/* Dropdowns: every <select> on the page gets a nicer, animated menu. The real <select>
   stays underneath, so forms and page code keep reading .value and getting "change". */
(() => {
  const VDESC = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value");
  const IDESC = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "selectedIndex");
  let openDD = null;

  function enhance(sel) {
    if (sel.dataset.dd || sel.multiple || sel.size > 1 || sel.closest("[data-native]")) return;
    sel.dataset.dd = "1";
    const wrap = document.createElement("span");
    wrap.className = "dd";
    sel.classList.forEach(c => { if (c !== "search") wrap.classList.add("dd-" + c); });
    sel.parentNode.insertBefore(wrap, sel);
    wrap.append(sel);
    sel.tabIndex = -1;
    sel.setAttribute("aria-hidden", "true");
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "dd-btn";
    btn.setAttribute("aria-haspopup", "listbox");
    btn.setAttribute("aria-expanded", "false");
    const lab = sel.getAttribute("aria-label");
    if (lab) btn.setAttribute("aria-label", lab);
    else if (sel.id) { const l = document.querySelector(`label[for="${sel.id}"]`) || sel.closest("label"); if (l) btn.setAttribute("aria-label", (l.firstChild && l.firstChild.textContent || "").trim()); }
    const txt = document.createElement("span");
    txt.className = "dd-txt";
    const chev = document.createElement("i");
    chev.className = "dd-chev";
    btn.append(txt, chev);
    wrap.append(btn);

    const sync = () => {
      const o = sel.options[IDESC.get.call(sel)];
      const t = o ? o.textContent : "";
      if (txt.textContent !== t) txt.textContent = t;
      btn.dataset.v = o ? o.value : "";
    };
    Object.defineProperty(sel, "value", { configurable: true, get() { return VDESC.get.call(this); }, set(v) { VDESC.set.call(this, v); sync(); } });
    Object.defineProperty(sel, "selectedIndex", { configurable: true, get() { return IDESC.get.call(this); }, set(v) { IDESC.set.call(this, v); sync(); } });
    sel.addEventListener("change", sync);
    sel.addEventListener("focus", () => btn.focus());
    new MutationObserver(sync).observe(sel, { childList: true, subtree: true, characterData: true });
    sync();

    function choose(i) {
      const before = IDESC.get.call(sel);
      if (i !== before) {
        IDESC.set.call(sel, i);
        sync();
        sel.dispatchEvent(new Event("input", { bubbles: true }));
        sel.dispatchEvent(new Event("change", { bubbles: true }));
        btn.classList.remove("pop"); void btn.offsetWidth; btn.classList.add("pop");
      }
      close(true);
    }

    let list = null, act = -1, items = [];
    function place() {
      if (!list) return;
      const r = btn.getBoundingClientRect(), h = list.offsetHeight, below = innerHeight - r.bottom;
      const up = below < h + 12 && r.top > below;
      list.classList.toggle("up", up);
      list.style.left = Math.max(8, Math.min(r.left, innerWidth - list.offsetWidth - 8)) + "px";
      list.style.top = (up ? r.top - h - 6 : r.bottom + 6) + "px";
      list.style.minWidth = r.width + "px";
    }
    function setAct(i, scroll) {
      items.forEach((li, k) => li.classList.toggle("act", k === i));
      act = i;
      if (scroll && items[i]) items[i].scrollIntoView({ block: "nearest" });
    }
    function open() {
      if (openDD) openDD.close();
      list = document.createElement("ul");
      list.className = "dd-list";
      list.setAttribute("role", "listbox");
      if (btn.getAttribute("aria-label")) list.setAttribute("aria-label", btn.getAttribute("aria-label"));
      items = [];
      let n = 0;
      [...sel.children].forEach(ch => {
        const opts = ch.tagName === "OPTGROUP" ? [...ch.children] : [ch];
        if (ch.tagName === "OPTGROUP") { const g = document.createElement("li"); g.className = "dd-group"; g.textContent = ch.label; list.append(g); }
        opts.forEach(o => {
          const idx = o.index, li = document.createElement("li");
          li.className = "dd-opt" + (o.selected ? " on" : "") + (o.disabled ? " off" : "");
          li.setAttribute("role", "option");
          li.setAttribute("aria-selected", o.selected ? "true" : "false");
          li.style.setProperty("--i", Math.min(n++, 14));
          if (sel.dataset.dots && o.value) { const d = document.createElement("b"); d.className = "dd-dot r-" + o.value.toLowerCase().replace(/\W/g, ""); li.append(d); }
          const s = document.createElement("span");
          s.textContent = o.textContent;
          const ck = document.createElement("i");
          ck.className = "dd-ck";
          li.append(s, ck);
          if (!o.disabled) {
            li.addEventListener("click", () => choose(idx));
            li.addEventListener("pointermove", () => setAct(items.indexOf(li)));
          }
          li._idx = idx;
          items.push(li);
          list.append(li);
        });
      });
      document.body.append(list);
      wrap.classList.add("open");
      btn.setAttribute("aria-expanded", "true");
      place();
      setAct(Math.max(0, items.findIndex(li => li.classList.contains("on"))), true);
      openDD = { close, wrap };
    }
    function close(focus) {
      if (!list) return;
      const l = list;
      list = null;
      l.classList.add("bye");
      setTimeout(() => l.remove(), 120);
      wrap.classList.remove("open");
      btn.setAttribute("aria-expanded", "false");
      if (openDD && openDD.wrap === wrap) openDD = null;
      if (focus) btn.focus();
    }
    btn.addEventListener("click", () => (list ? close() : open()));
    btn.addEventListener("keydown", e => {
      const k = e.key;
      if (!list) {
        if (k === "ArrowDown" || k === "ArrowUp" || k === "Enter" || k === " ") { e.preventDefault(); open(); }
        return;
      }
      const usable = i => items[i] && !items[i].classList.contains("off");
      if (k === "Escape") { e.preventDefault(); close(true); }
      else if (k === "Tab") close();
      else if (k === "ArrowDown" || k === "ArrowUp") {
        e.preventDefault();
        let i = act, d = k === "ArrowDown" ? 1 : -1;
        do { i += d; } while (i >= 0 && i < items.length && !usable(i));
        if (usable(i)) setAct(i, true);
      } else if (k === "Home" || k === "End") { e.preventDefault(); setAct(k === "Home" ? 0 : items.length - 1, true); }
      else if (k === "Enter" || k === " ") { e.preventDefault(); if (usable(act)) choose(items[act]._idx); }
      else if (k.length === 1) {
        const c = k.toLowerCase(), start = act + 1;
        for (let j = 0; j < items.length; j++) { const i = (start + j) % items.length; if (usable(i) && items[i].textContent.trim().toLowerCase().startsWith(c)) { setAct(i, true); break; } }
      }
    });
    wrap._dd = { place: () => place(), close };
  }

  document.addEventListener("pointerdown", e => {
    if (openDD && !openDD.wrap.contains(e.target) && !e.target.closest(".dd-list")) openDD.close();
  });
  addEventListener("resize", () => openDD && openDD.close());
  addEventListener("scroll", () => openDD && openDD.wrap._dd.place(), { passive: true, capture: true });

  window.BB = window.BB || {};
  BB.dropdown = enhance;
  document.querySelectorAll("select").forEach(enhance);
})();
