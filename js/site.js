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
  let box, input, list, tabs, count, clear, opts = [], idx = 0, data = null, tab = "all";
  const norm = s => String(s || "").toLowerCase().replace(/[^a-z0-9/ ]/g, "");
  /* Every word must match; earlier/whole-word hits rank higher. */
  const score = (name, q) => {
    const n = norm(name), words = q.split(" ").filter(Boolean);
    let s = 0;
    for (const w of words) {
      const v = n.startsWith(w) ? 4 : n.split(/[ /]/).some(x => x.startsWith(w)) ? 2 : n.includes(w) ? 1 : 0;
      if (!v) return 0;
      s += v;
    }
    return s + (n === q ? 10 : 0);
  };
  const TABS = [["all", "All"], ["Values", "Values"], ["Strategies", "Strategies"], ["Commands", "Commands"], ["Pages", "Pages"]];
  const RKEY = "bb_qs_recent";
  const recent = () => { try { return JSON.parse(localStorage.getItem(RKEY) || "[]").slice(0, 5); } catch (e) { return []; } };
  const remember = it => {
    try {
      const r = recent().filter(x => x.href !== it.href);
      r.unshift({ title: it.title, sub: it.sub || "", href: it.href, icon: it.icon || "", val: it.img ? it.img.name : "" });
      localStorage.setItem(RKEY, JSON.stringify(r.slice(0, 5)));
    } catch (e) { /* storage blocked */ }
  };

  async function load() {
    if (data) return data;
    data = { values: [], strats: [], cmds: [], done: false };
    await Promise.all([
      BB.loadValues().then(v => { data.values = v; }).catch(() => {}),
      BB.sb ? BB.sb.from("strategies").select("id,title,category").order("id", { ascending: false }).limit(500)
        .then(({ data: d }) => { data.strats = d || []; }) : null,
      fetch("data/commands.json").then(r => r.json()).then(c => { data.cmds = c; }).catch(() => {}),
    ]);
    data.done = true;
    return data;
  }

  function results(q) {
    q = norm(q).replace(/\s+/g, " ").trim();
    const one = tab !== "all", n = k => one ? 30 : k;
    const pick = (arr, name, k) => arr.map(x => [score(name(x), q), x]).filter(r => r[0]).sort((a, b) => b[0] - a[0] || (b[1].est || 0) - (a[1].est || 0)).slice(0, n(k)).map(r => r[1]);
    if (!q) {
      const vals = (data && data.values) || [];
      const r = recent().map(x => {
        const v = x.val && vals.find(v => v.name === x.val);
        return { ...x, img: v || null, icon: x.icon || "dollar", kind: "recent" };
      });
      const out = [];
      if (r.length && !one) out.push(["Recent", r]);
      out.push(["Jump to", PAGES.slice(0, one ? 16 : 8).map(page)]);
      return out;
    }
    const d = data || { values: [], strats: [], cmds: [] };
    const out = [
      ["Values", pick(d.values, v => v.name, 6).map(v => ({ img: v, title: v.name, sub: [v.rarity, v.category].filter(Boolean).join(" · "), tag: v.est > 0 ? BB.fmt(v.est) + (v.oc ? " O/C" : "") : (v.value_text || "") || null, href: "values.html#" + encodeURIComponent(v.name) }))],
      ["Commands", pick(d.cmds, c => c[0] + " " + c[1], 4).map(c => ({ icon: "gem", title: c[0], sub: c[1], href: "features.html#cmd=" + encodeURIComponent(c[0]), mono: true }))],
      ["Strategies", pick(d.strats, s => BB.plain(s.title), 4).map(s => ({ icon: "bullseye", title: BB.plain(s.title), sub: (s.category || "").replace("-", " "), href: "strategies.html#s-" + s.id }))],
      ["Pages", pick(PAGES, p => p[0], 4).map(page)],
    ];
    return out;
  }
  function page(p) { return { icon: p[2], title: p[0], href: p[1] }; }

  /* Bold the parts of the title that match what was typed. */
  function hl(text, q) {
    const f = document.createDocumentFragment(), words = norm(q).split(" ").filter(w => w.length);
    if (!words.length) { f.append(text); return f; }
    const low = text.toLowerCase(), marks = new Array(text.length).fill(false);
    for (const w of words) { const i = low.indexOf(w); if (i >= 0) for (let j = i; j < i + w.length; j++) marks[j] = true; }
    let i = 0;
    while (i < text.length) {
      let j = i;
      while (j < text.length && marks[j] === marks[i]) j++;
      f.append(marks[i] ? el("mark", null, text.slice(i, j)) : text.slice(i, j));
      i = j;
    }
    return f;
  }

  function draw() {
    const q = input.value;
    let groups = results(q);
    const counts = {};
    groups.forEach(g => { counts[g[0]] = g[1].length; });
    tabs.querySelectorAll("button").forEach(b => {
      const k = b.dataset.k, c = k === "all" ? null : counts[k];
      b.classList.toggle("on", k === tab);
      b.setAttribute("aria-selected", String(k === tab));
      b.querySelector("i").textContent = q.trim() && c != null ? c : "";
      b.classList.toggle("zero", !!q.trim() && c === 0);
    });
    if (tab !== "all" && q.trim()) groups = groups.filter(g => g[0] === tab);
    groups = groups.filter(g => g[1].length);
    opts = [];
    list.replaceChildren();
    for (const [name, items] of groups) {
      const g = el("div", "qs-group");
      g.append(el("span", null, name));
      if (name === "Recent") {
        const c = el("button", "qs-clr", "Clear");
        c.type = "button";
        c.onclick = e => { e.stopPropagation(); try { localStorage.removeItem(RKEY); } catch (err) { /* ignore */ } draw(); input.focus(); };
        g.append(c);
      }
      list.append(g);
      for (const it of items) {
        const a = el("a", "qs-item" + (it.kind === "recent" ? " rec" : ""));
        a.href = it.href;
        a.id = "qs-o" + opts.length;
        a.setAttribute("role", "option");
        const ic = el("span", "qs-ic");
        if (it.img) ic.append(BB.itemImg(it.img, "qs-img"));
        else { const i = el("img", "qs-img"); i.alt = ""; i.src = "img/" + it.icon + ".png"; i.onerror = () => { i.src = "img/flower.png"; }; ic.append(i); }
        a.append(ic);
        const t = el("span", "qs-t");
        const s = el("strong", it.mono ? "mono" : null);
        s.append(hl(it.title, q));
        t.append(s);
        if (it.sub) t.append(el("em", null, it.sub));
        a.append(t);
        if (it.tag) a.append(el("span", "qs-tag", it.tag));
        a.append(el("span", "qs-go", "↵"));
        a.onmousemove = () => { if (idx !== opts.indexOf(a)) { idx = opts.indexOf(a); mark(); } };
        a.onclick = () => { remember(it); close(true); };
        opts.push(a);
        list.append(a);
      }
    }
    if (!opts.length) {
      const none = el("div", "qs-none");
      if (data && data.done) {
        none.append(el("img", null), el("strong", null, "No results for “" + q.trim() + "”"), el("span", null, tab === "all" ? "Try a shorter word or check the spelling." : "Try the All tab."));
        none.firstChild.src = "img/bullseye.png"; none.firstChild.alt = "";
      } else for (let i = 0; i < 4; i++) none.append(el("div", "qs-sk"));
      list.append(none);
    }
    clear.hidden = !q;
    const n = opts.filter(o => !o.classList.contains("rec")).length;
    count.textContent = q.trim() ? (n === 1 ? "1 result" : n + " results") : "Type to search";
    idx = 0;
    mark();
  }
  function mark() {
    opts.forEach((o, i) => o.classList.toggle("on", i === idx));
    if (opts[idx]) { opts[idx].scrollIntoView({ block: "nearest" }); input.setAttribute("aria-activedescendant", opts[idx].id); }
    else input.removeAttribute("aria-activedescendant");
  }
  function setTab(k) { tab = k; draw(); list.scrollTop = 0; }

  function build() {
    box = el("div", "qs-wrap");
    box.hidden = true;
    const panel = el("div", "qs-box");
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-modal", "true");
    panel.setAttribute("aria-label", "Search");
    const top = el("div", "qs-top");
    top.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" d="M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15Zm5.4-2.1L21 21"/></svg>';
    input = el("input", "qs-input");
    input.type = "search";
    input.placeholder = innerWidth < 600 ? "Search units, guides, commands…" : "Search units, strategies, commands…";
    input.autocomplete = "off";
    input.spellcheck = false;
    input.enterKeyHint = "go";
    input.setAttribute("aria-label", "Search");
    input.setAttribute("role", "combobox");
    input.setAttribute("aria-expanded", "true");
    input.setAttribute("aria-controls", "qs-list");
    clear = el("button", "qs-x");
    clear.type = "button";
    clear.setAttribute("aria-label", "Clear search");
    clear.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path stroke="currentColor" stroke-width="2.6" stroke-linecap="round" d="M7 7l10 10M17 7 7 17"/></svg>';
    clear.onclick = () => { input.value = ""; draw(); input.focus(); };
    const esc = el("button", "qs-esc");
    esc.type = "button";
    esc.setAttribute("aria-label", "Close search");
    esc.append(el("kbd", null, "Esc"), el("span", null, "Cancel"));
    esc.onclick = () => close();
    top.append(input, clear, esc);
    tabs = el("div", "qs-tabs");
    tabs.setAttribute("role", "tablist");
    for (const [k, label] of TABS) {
      const b = el("button", null, label);
      b.type = "button";
      b.dataset.k = k;
      b.setAttribute("role", "tab");
      b.append(el("i"));
      b.onclick = () => { setTab(k); input.focus(); };
      tabs.append(b);
    }
    list = el("div", "qs-list");
    list.id = "qs-list";
    list.setAttribute("role", "listbox");
    const foot = el("div", "qs-foot");
    count = el("span", "qs-count");
    const keys = el("span", "qs-keys");
    keys.innerHTML = "<span><kbd>↑</kbd><kbd>↓</kbd> move</span><span><kbd>Tab</kbd> filter</span><span><kbd>↵</kbd> open</span>";
    foot.append(count, keys);
    panel.append(top, tabs, list, foot);
    box.append(panel);
    document.body.append(box);
    box.onmousedown = e => { if (e.target === box) close(); };
    input.oninput = () => { list.scrollTop = 0; draw(); };
    input.onkeydown = e => {
      if (e.key === "ArrowDown") { idx = Math.min(idx + 1, opts.length - 1); mark(); e.preventDefault(); }
      else if (e.key === "ArrowUp") { idx = Math.max(idx - 1, 0); mark(); e.preventDefault(); }
      else if (e.key === "Home" && e.ctrlKey) { idx = 0; mark(); e.preventDefault(); }
      else if (e.key === "Enter" && opts[idx]) { e.preventDefault(); opts[idx].click(); }
      else if (e.key === "Tab") {
        e.preventDefault();
        const i = TABS.findIndex(t => t[0] === tab);
        setTab(TABS[(i + (e.shiftKey ? TABS.length - 1 : 1)) % TABS.length][0]);
      }
    };
    panel.addEventListener("keydown", e => { if (e.key === "Escape") { e.stopPropagation(); close(); } });
  }
  function open(q) {
    if (!box) build();
    const was = !box.hidden;
    box.hidden = false;
    document.body.classList.add("noscroll");
    if (!was) { input.value = typeof q === "string" ? q : ""; tab = "all"; }
    draw();
    input.focus();
    input.select();
    load().then(() => { if (!box.hidden) draw(); });
  }
  function close(go) {
    if (!box || box.hidden) return;
    box.hidden = true;
    document.body.classList.remove("noscroll");
    if (!go) btn.focus();
  }
  btn.onclick = () => open();
  BB.search = open;
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
      const r = btn.getBoundingClientRect(), below = innerHeight - r.bottom - 14, above = r.top - 14;
      list.style.maxHeight = "";
      const full = list.offsetHeight, up = below < full && above > below;
      list.style.maxHeight = Math.max(120, Math.min(full, up ? above : below)) + "px";
      const h = list.offsetHeight;
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
      list.className = "dd-list" + (sel.dataset.pills ? " dd-pills" : "");
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
          const s = document.createElement("span");
          s.textContent = o.textContent;
          if (sel.dataset.pills && o.value) s.className = "rar r-" + o.value.toLowerCase().replace(/\W/g, "");
          li.append(s);
          if (o.dataset.count) { const n = document.createElement("em"); n.className = "dd-n"; n.textContent = o.dataset.count; li.append(n); }
          const ck = document.createElement("i");
          ck.className = "dd-ck";
          li.append(ck);
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

/* Calculator switcher: slide the highlight to the picked tab, then open that page. */
(() => {
  const nav = document.querySelector(".ctabs");
  if (!nav) return;
  nav.addEventListener("click", e => {
    const a = e.target.closest(".ctab");
    if (!a || a.classList.contains("on") || e.ctrlKey || e.metaKey || e.shiftKey || e.button) return;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    e.preventDefault();
    nav.dataset.tab = a.dataset.i;
    nav.querySelectorAll(".ctab").forEach(t => t.classList.toggle("on", t === a));
    setTimeout(() => { location.href = a.href; }, 260);
  });
})();

/* Top nav: one springy pill slides between tabs (stretches toward the target),
   a soft hover pill follows the mouse, then the page opens. Desktop only. */
(() => {
  const nav = document.getElementById("links");
  if (!nav) return;
  const tabs = [...nav.querySelectorAll(".nl")];
  if (!tabs.length) return;
  const ind = document.createElement("span");
  ind.className = "nl-ind";
  const hov = document.createElement("span");
  hov.className = "nl-hov";
  ind.setAttribute("aria-hidden", "true");
  hov.setAttribute("aria-hidden", "true");
  nav.prepend(hov, ind);
  const desk = matchMedia("(min-width:1181px)");
  const calm = matchMedia("(prefers-reduced-motion: reduce)");
  let cur = tabs.find(t => t.classList.contains("on"));
  const box = (el, t) => {
    el.style.left = t.offsetLeft + "px";
    el.style.right = (nav.clientWidth - t.offsetLeft - t.offsetWidth) + "px";
    el.style.top = t.offsetTop + "px";
    el.style.height = t.offsetHeight + "px";
  };
  const paint = t => {
    ind.className = "nl-ind g-" + t.dataset.g;
  };
  const place = () => {
    if (!cur) { ind.style.opacity = "0"; return; }
    ind.classList.add("snap");
    box(ind, cur); paint(cur);
    ind.style.opacity = "1";
    ind.offsetWidth;
    ind.classList.remove("snap");
  };
  const go = t => {
    const from = cur ? cur.offsetLeft : t.offsetLeft;
    const dir = t.offsetLeft >= from ? "r" : "l";
    ind.dataset.dir = dir;
    if (!cur) { ind.classList.add("snap"); box(ind, t); ind.offsetWidth; ind.classList.remove("snap"); }
    box(ind, t); paint(t);
    ind.style.opacity = "1";
    ind.classList.remove("pop"); ind.offsetWidth; ind.classList.add("pop");
    tabs.forEach(x => x.classList.toggle("on", x === t));
    cur = t;
  };
  nav.classList.add("has-ind");
  place();
  addEventListener("resize", place);
  desk.addEventListener?.("change", place);
  document.fonts && document.fonts.ready.then(place);
  addEventListener("pageshow", e => { if (e.persisted) { cur = tabs.find(t => t.classList.contains("on")) || cur; place(); } });

  let hovOn = false;
  tabs.forEach(t => {
    t.addEventListener("pointerenter", () => {
      if (!desk.matches) return;
      if (!hovOn) { hov.classList.add("snap"); box(hov, t); hov.offsetWidth; hov.classList.remove("snap"); }
      box(hov, t);
      hov.classList.toggle("over-on", t === cur);
      hov.style.opacity = "1";
      hovOn = true;
    });
  });
  nav.addEventListener("pointerleave", () => { hov.style.opacity = "0"; hovOn = false; });

  nav.addEventListener("click", e => {
    const a = e.target.closest(".nl");
    if (!a || !desk.matches || e.ctrlKey || e.metaKey || e.shiftKey || e.button) return;
    if (a === cur) return;
    if (calm.matches) return;
    e.preventDefault();
    go(a);
    setTimeout(() => { location.href = a.href; }, 300);
  });
})();
