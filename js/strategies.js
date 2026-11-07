/* Strategies page: community strategies (the same ones as /home in Discord), and sharing one. */
(() => {
  const $ = id => document.getElementById(id);
  const { el } = BB;
  const CATS = { "meta-units": "Meta units", "map-specific": "Map-specific", "general": "General" };
  let list = [], cat = "all", sort = "new", me = null;
  const norm = t => BB.plain(t || "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
  /* ?cat=…&q=…&sort=… keeps filters when you share or reload the page */
  const qs = new URLSearchParams(location.search);
  if (qs.get("q")) $("sq").value = qs.get("q").slice(0, 80);
  if (["meta-units", "map-specific", "general", "mine"].includes(qs.get("cat"))) cat = qs.get("cat");
  if (["old", "az", "long"].includes(qs.get("sort"))) sort = qs.get("sort");

  /* Strategies made with the form (or the bot's template) have "## Heading" sections.
     Information/Performance become pills, units get their pictures, the rest stays text. */
  const unitsP = BB.loadValues().then(v => new Map(v.map(i => [i.name.toLowerCase(), i]))).catch(() => new Map());
  const KV = /^\*\*(.+?):\*\*\s*`?([^`]*?)`?\s*$/;
  function unitChip(name) {
    const chip = el("span", "uchip");
    const img = el("img", "uimg");
    img.alt = ""; img.src = "img/flower.png";
    chip.append(img, document.createTextNode(name));
    unitsP.then(m => {
      const it = m.get(name.toLowerCase());
      if (!it) return;
      img.replaceWith(BB.itemImg(it, "uimg"));
      if (it.value > 0) chip.title = `${it.name} · ${BB.fmt(it.value)}`;
    });
    return chip;
  }
  const items = lines => lines.map(l => l.replace(/^\s*(?:[-*•]|\d+\.)\s*/, "").trim()).filter(Boolean);
  function sections(text) {
    const parts = [{ name: "", lines: [] }];
    for (const l of text.split("\n")) {
      const m = l.match(/^##\s+(.+)$/);
      if (m) parts.push({ name: m[1], key: BB.plain(m[1]).toLowerCase().trim(), lines: [] });
      else parts[parts.length - 1].lines.push(l);
    }
    if (parts.length === 1) return { head: [], body: BB.md(text, { cls: "strat-body" }) };
    const head = [], body = el("div", "strat-body strat-secs");
    const intro = parts[0].lines.join("\n").trim();
    if (intro) {
      const tag = intro.match(/^>\s*(.+)$/);
      if (tag && !intro.includes("\n")) { const p = el("p", "strat-tag"); BB.mdInline(p, tag[1]); head.push(p); }
      else body.append(BB.md(intro));
    }
    const meta = [];
    for (const p of parts.slice(1)) {
      const raw = p.lines.join("\n").trim();
      if (!raw) continue;
      if (p.key === "information" || p.key === "performance") {
        const rest = [];
        for (const l of p.lines) {
          const kv = l.trim().match(KV);
          if (!kv) { if (l.trim()) rest.push(l); continue; }
          const k = kv[1].trim().toLowerCase(), v = kv[2].trim();
          if (!v || k === "created by" || k === "last updated") continue;
          meta.push(k === "cost" ? v + " cost" : k === "clear speed" ? v + " clear" : v);
        }
        if (rest.length) body.append(BB.md(rest.join("\n")));
        continue;
      }
      if (p.key === "required units" || p.key === "units") {
        const box = el("div", "strat-units");
        items(p.lines).forEach(n => box.append(unitChip(n)));
        if (!box.childElementCount) continue;
        head.push(box);
        continue;
      }
      const sec = el("section", "ssec");
      const h4 = el("h4");
      BB.mdInline(h4, p.name);
      if (p.key === "alternatives") {
        const box = el("div", "strat-alts");
        items(p.lines).forEach(a => {
          const [x, y] = a.split(/\s*(?:→|->|=>)\s*/);
          const row = el("span", "salt");
          if (y) row.append(unitChip(x), el("i", null, "→"), unitChip(y)); else row.append(a);
          box.append(row);
        });
        sec.append(h4, box);
      } else sec.append(h4, BB.md(raw.replace(/^-(?=[^\s-])/gm, "- ")));
      body.append(sec);
    }
    if (meta.length) {
      const row = el("div", "smeta");
      meta.forEach(m => row.append(el("span", null, m)));
      head.splice(head[0] && head[0].classList.contains("strat-tag") ? 1 : 0, 0, row);
    }
    return { head, body };
  }

  function card(s) {
    const c = el("article", "strat c-l-" + s.category);
    c.id = "s-" + s.id;
    const top = el("div", "strat-top");
    top.append(el("span", "stag c-" + s.category, CATS[s.category] || s.category));
    if (s.created_at) top.append(el("span", "strat-date", BB.ago(s.created_at)));
    const words = BB.plain(s.description).split(/\s+/).length;
    if (words > 120) top.append(el("span", "strat-date", Math.ceil(words / 200) + " min read"));
    const link = el("button", "strat-link", "Copy link");
    link.type = "button";
    link.onclick = () => BB.share(location.origin + location.pathname + "#s-" + s.id, BB.plain(s.title) + " · Bloombot", "Link to this strategy copied");
    top.append(link);
    if (me && s.author_id === me) {
      const del = el("button", "del-btn", "Delete");
      del.type = "button";
      del.title = "Delete your strategy";
      del.onclick = async () => {
        del.disabled = true;
        if (await BB.deleteMine("strategy", s.id)) { list = list.filter(x => x.id !== s.id); render(); }
        else del.disabled = false;
      };
      top.append(del);
    }
    // Bot strategies often start with "# <emoji> Title": don't show the title twice.
    const lines = s.description.split("\n");
    const first = lines[0].match(/^#{1,3} (.+)$/);
    const text = first && norm(first[1]) === norm(s.title) ? lines.slice(1).join("\n").replace(/^\s*\n/, "") : s.description;
    const h = el("h3");
    BB.mdInline(h, text === s.description ? s.title.replace(/^#{1,3} /, "") : first[1]);
    const { head, body } = sections(text);
    c.append(top, h, ...head, body);
    if (BB.plain(body.textContent).length > 320 || body.querySelectorAll("li,p,.md-h").length > 9) {
      body.classList.add("clamp");
      const more = el("button", "more-btn", "Read more");
      more.type = "button";
      more.onclick = () => { const open = body.classList.toggle("clamp"); more.textContent = open ? "Read more" : "Show less"; };
      c.append(more);
    }
    const by = el("div", "strat-by");
    const av = el("img");
    av.alt = "";
    av.src = BB.safeUrl(s.author_avatar) || "img/flower.png";
    av.onerror = () => { av.src = "img/flower.png"; };
    if (s.author_id) {
      const a = el("a", "strat-author");
      a.href = "profile.html?id=" + encodeURIComponent(s.author_id);
      a.append(av, el("span", null, s.author_name || "Bloombot player"));
      by.append(a);
    } else by.append(av, el("span", null, s.author_name || "Bloombot player"));
    c.append(by);
    return c;
  }

  const sorters = {
    new: (a, b) => b.id - a.id,
    old: (a, b) => a.id - b.id,
    az: (a, b) => norm(a.title).localeCompare(norm(b.title)),
    long: (a, b) => b.description.length - a.description.length,
  };
  const inCat = (s, c) => c === "all" || (c === "mine" ? me && s.author_id === me : s.category === c);
  function render() {
    const q = norm($("sq").value);
    const hit = s => !q || q.split(" ").every(w => norm(s.title + " " + s.description + " " + (s.author_name || "")).includes(w));
    const found = list.filter(hit);
    const shown = found.filter(s => inCat(s, cat)).sort(sorters[sort]);
    document.querySelectorAll(".chip[data-scat]").forEach(b => {
      b.classList.toggle("on", b.dataset.scat === cat);
      b.querySelector("i").textContent = found.filter(s => inCat(s, b.dataset.scat)).length;
    });
    $("slist").replaceChildren(...shown.map(card));
    $("snone").hidden = shown.length > 0 || !loaded;
    $("snonet").textContent = !list.length ? "No strategies yet. Be the first to share one!" : cat === "mine" && !q ? "You haven't shared a strategy yet." : "No strategies match that.";
    $("sclear").hidden = !list.length || (cat === "all" && !q);
    $("scount").textContent = shown.length + " strateg" + (shown.length === 1 ? "y" : "ies");
    const p = new URLSearchParams();
    if (cat !== "all") p.set("cat", cat);
    if ($("sq").value.trim()) p.set("q", $("sq").value.trim());
    if (sort !== "new") p.set("sort", sort);
    const u = location.pathname + (p.toString() ? "?" + p : "") + location.hash;
    if (u !== location.pathname + location.search + location.hash) history.replaceState(null, "", u);
  }

  async function load() {
    const { data, error } = await BB.sb.from("strategies").select("*").order("id", { ascending: false }).limit(500);
    $("sloading").hidden = true;
    if (error) { $("snone").hidden = false; $("snonet").textContent = "Couldn't load strategies. Try again in a minute."; $("sclear").hidden = true; return; }
    list = data || [];
    loaded = true;
    render();
    focusHash();
  }
  /* strategies.html#s-12 jumps to that strategy and opens it. */
  function focusHash() {
    const m = location.hash.match(/^#s-(\d+)$/);
    if (!m) return;
    if (!document.getElementById("s-" + m[1])) { cat = "all"; $("sq").value = ""; render(); }
    const c = document.getElementById("s-" + m[1]);
    if (!c) return;
    const body = c.querySelector(".strat-body.clamp");
    if (body) { body.classList.remove("clamp"); const b = c.querySelector(".more-btn"); if (b) b.textContent = "Show less"; }
    c.scrollIntoView({ block: "center", behavior: "smooth" });
    c.classList.remove("flash"); void c.offsetWidth; c.classList.add("flash");
  }
  addEventListener("hashchange", () => { if (list.length) focusHash(); });

  /* sharing: a 4-step form, written into the same "## Section" layout the bot uses */
  const E = {
    info: "<:Casual:1510667491020374067>", units: "<:Sunflower:1510667399668437062>",
    alt: "<:Refresh:1510667407390146570>", desc: "<:Pencil:1510667414289780866>", early: "<:Seeds:1510667402478616577>",
    mid: "<:Damage:1510667457805684856>", late: "<:VIP:1510667379913527377>", tips: "<:Clue:1510667485743943760>", perf: "<:Stats:1510667394765553815>",
  };
  const MAX = 1500;
  let picked = [], alts = [], step = 0, seen = 0;
  const val = id => $(id).value.trim();
  const bullets = t => t.split("\n").map(l => l.trim()).filter(Boolean).map(l => /^(?:[-*•]|\d+\.)\s/.test(l) ? l.replace(/^[*•]\s/, "- ") : "- " + l.replace(/^-(?=\S)/, "")).join("\n");
  function compose(emoji = true) {
    const h = (k, name) => "## " + (emoji ? E[k] + " " : "") + name;
    const kv = pairs => pairs.filter(p => p[1]).map(([k, v]) => `**${k}:** \`${v}\``).join("  \n");
    const out = [];
    if (val("f-tag")) out.push("> " + val("f-tag").replace(/\n/g, " "));
    const info = kv([["Gamemode", val("f-mode")], ["Team Size", val("f-team")], ["Difficulty", val("f-diff")], ["Map", val("f-map")]]);
    if (info) out.push(h("info", "Information") + "\n" + info);
    if (picked.length) out.push(h("units", "Required Units") + "\n" + picked.map(u => "- " + u).join("\n"));
    if (alts.length) out.push(h("alt", "Alternatives") + "\n" + alts.map(([x, y]) => `- ${x} → ${y}`).join("\n"));
    if (val("sd")) out.push(h("desc", "Description") + "\n" + val("sd"));
    for (const [k, id, name] of [["early", "f-early", "Early Game"], ["mid", "f-mid", "Mid Game"], ["late", "f-late", "Late Game"], ["tips", "f-tips", "Tips"]])
      if (val(id)) out.push(h(k, name) + "\n" + bullets(val(id)));
    const perf = kv([["Cost", val("f-cost")], ["Clear Speed", val("f-speed")]]);
    if (perf) out.push(h("perf", "Performance") + "\n" + perf);
    const text = out.join("\n\n");
    return emoji && text.length > MAX ? compose(false) : text;
  }
  const okTitle = () => val("st").length >= 5 && val("st").length <= 80;
  const okDesc = () => val("sd").length >= 10;
  function counters() {
    const d = compose().length;
    $("sdc").textContent = d > MAX * 0.8 ? `${d}/${MAX} characters` : "";
    $("sdc").classList.toggle("bad", d > MAX);
    $("f-ucount").textContent = picked.length ? `${picked.length}/10` : "";
    $("sbtn").disabled = !okTitle() || !okDesc() || d > MAX;
    if (okTitle()) $("st-err").hidden = true;
    if (okDesc()) $("sd-err").hidden = true;
    if (step === 3) drawPreview();
    saveDraft();
  }

  /* steps */
  function go(n) {
    if (n > step) {
      if (step === 0 && !okTitle()) { $("st-err").hidden = false; $("st").focus(); return; }
      if (n >= 3 && !okDesc()) { if (step !== 2) go(2); $("sd-err").hidden = false; $("sd").focus(); return; }
    }
    step = n; seen = Math.max(seen, n);
    document.querySelectorAll(".spane").forEach(p => { p.hidden = +p.dataset.step !== n; });
    document.querySelectorAll("#ssteps li").forEach(li => {
      const i = +li.dataset.step;
      li.className = i === n ? "on" : i < n || i <= seen ? "done" : "";
      li.querySelector("button").disabled = i > seen;
    });
    $("sback").style.visibility = n ? "visible" : "hidden";
    $("snext").hidden = n === 3;
    $("sbtn").hidden = n !== 3;
    if (n === 3) drawPreview();
    const top = $("ssteps").getBoundingClientRect().top;
    if (top < 80) scrollBy({ top: top - 100, behavior: "smooth" });
    const first = document.querySelector(`.spane[data-step="${n}"] input:not([type=hidden]),.spane[data-step="${n}"] textarea`);
    if (first && document.activeElement && $("sform").contains(document.activeElement)) first.focus({ preventScroll: true });
  }
  $("snext").onclick = () => go(step + 1);
  $("sback").onclick = () => go(Math.max(0, step - 1));
  document.querySelectorAll("#ssteps li").forEach(li => { li.querySelector("button").onclick = () => go(+li.dataset.step); });
  function drawPreview() {
    const d = compose();
    $("sdprev").replaceChildren(card({ id: 0, title: val("st") || "Your strategy", description: d || "…", category: $("sc").value, created_at: new Date().toISOString(), author_name: $("sname").textContent || "You" }));
    const m = $("sdprev").querySelector(".more-btn"); if (m) m.click();
    $("sdprev").querySelectorAll(".strat-link,.del-btn,.more-btn").forEach(x => x.remove());
    $("sdprev").querySelector(".strat").removeAttribute("id");
  }

  /* button groups (category, players, difficulty, cost, speed) write into a hidden input */
  function syncSegs() {
    document.querySelectorAll(".seg").forEach(g => {
      const v = $(g.dataset.for).value;
      g.querySelectorAll("button").forEach(b => { const on = b.dataset.v === v; b.classList.toggle("on", on); b.setAttribute("aria-checked", String(on)); b.setAttribute("role", "radio"); });
    });
  }
  document.querySelectorAll(".seg button").forEach(b => b.onclick = () => {
    const inp = $(b.parentElement.dataset.for);
    /* optional groups: click the chosen one again to clear it */
    inp.value = inp.value === b.dataset.v && inp.id !== "sc" ? "" : b.dataset.v;
    syncSegs(); counters();
  });

  /* the form is kept in this browser until it's shared */
  const FIELDS = ["st", "sc", "f-mode", "f-team", "f-diff", "f-map", "f-tag", "sd", "f-early", "f-mid", "f-late", "f-tips", "f-cost", "f-speed"];
  let draftReady = false;
  function saveDraft() {
    if (!draftReady) return;
    try { localStorage.setItem("bb_strat_draft", JSON.stringify({ f: Object.fromEntries(FIELDS.map(id => [id, $(id).value])), u: picked, a: alts })); } catch (e) { /* blocked */ }
  }
  function loadDraft() {
    try {
      const d = JSON.parse(localStorage.getItem("bb_strat_draft") || "null");
      if (d && d.f) {
        FIELDS.forEach(id => { if (typeof d.f[id] === "string") $(id).value = d.f[id].slice(0, 1000); });
        if (!["general", "meta-units", "map-specific"].includes($("sc").value)) $("sc").value = "general";
        picked = (d.u || []).filter(x => typeof x === "string").slice(0, 10);
        alts = (d.a || []).filter(x => Array.isArray(x) && x.length === 2 && x.every(y => typeof y === "string")).slice(0, 6);
      }
    } catch (e) { /* ignore */ }
    draftReady = true;
  }
  function clearForm() {
    FIELDS.forEach(id => { $(id).value = id === "sc" ? "general" : ""; });
    picked = []; alts = []; seen = 0;
    drawUnits(); drawAlts(); syncSegs();
    try { localStorage.removeItem("bb_strat_draft"); } catch (e) { /* blocked */ }
  }
  const removable = (chip, label, onX) => {
    const x = el("button", "f-x", "×");
    x.type = "button"; x.title = "Remove " + label; x.setAttribute("aria-label", "Remove " + label);
    x.onclick = onX;
    chip.append(x);
    return chip;
  };
  function drawUnits() {
    const box = $("f-units");
    if (!picked.length) { box.replaceChildren(el("p", "hint f-empty", "No units yet. Type a name above and press Enter.")); return; }
    box.replaceChildren(...picked.map((n, i) => removable(unitChip(n), n, () => { picked.splice(i, 1); drawUnits(); counters(); })));
  }
  function drawAlts() {
    $("f-alts").replaceChildren(...alts.map(([x, y], i) => {
      const row = el("div", "salt");
      row.append(unitChip(x), el("i", null, "→"), unitChip(y));
      return removable(row, x + " → " + y, () => { alts.splice(i, 1); drawAlts(); counters(); });
    }));
  }

  /* unit search boxes */
  const kk = t => String(t || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  function picker(input, box, onPick, allowFree) {
    let opts = [], idx = 0, all = [];
    unitsP.then(m => { all = [...m.values()].filter(i => i.name && i.category !== "gamepass"); });
    const draw = () => {
      box.replaceChildren(...opts.map((it, i) => {
        const o = el("button", "sug" + (i === idx ? " on" : ""));
        o.type = "button";
        o.append(BB.itemImg(it, "sug-img"), el("span", null, it.name));
        o.onmousedown = e => { e.preventDefault(); pick(it.name); };
        return o;
      }));
      box.hidden = !opts.length;
    };
    const pick = name => { opts = []; draw(); onPick(name); };
    input.oninput = () => {
      const q = kk(input.value), starts = [], has = [];
      if (q) for (const it of all) { const n = kk(it.name); if (n.startsWith(q)) starts.push(it); else if (n.includes(q)) has.push(it); }
      opts = starts.concat(has).slice(0, 8); idx = 0; draw();
    };
    input.onkeydown = e => {
      if (e.key === "ArrowDown") { idx = Math.min(idx + 1, opts.length - 1); draw(); e.preventDefault(); }
      else if (e.key === "ArrowUp") { idx = Math.max(idx - 1, 0); draw(); e.preventDefault(); }
      else if (e.key === "Enter") { e.preventDefault(); if (opts[idx]) pick(opts[idx].name); else if (allowFree && input.value.trim().length > 1) pick(input.value.trim().slice(0, 40)); }
      else if (e.key === "Escape") { opts = []; draw(); }
    };
    input.onblur = () => setTimeout(() => { opts = []; draw(); }, 120);
  }
  picker($("f-uq"), $("f-usug"), name => {
    if (picked.length >= 10) BB.toast("Keep it to 10 units.", "info", { title: "That's a lot of units" });
    else if (!picked.includes(name)) picked.push(name);
    $("f-uq").value = ""; drawUnits(); counters(); $("f-uq").focus();
  }, true);
  picker($("f-aq1"), $("f-asug1"), name => { $("f-aq1").value = name; $("f-aq2").focus(); }, false);
  picker($("f-aq2"), $("f-asug2"), name => { $("f-aq2").value = name; addAlt(); }, false);
  function addAlt() {
    const x = val("f-aq1").slice(0, 40), y = val("f-aq2").slice(0, 40);
    if (!x || !y) { (x ? $("f-aq2") : $("f-aq1")).focus(); return; }
    if (alts.length >= 6) { BB.toast("Keep it to 6 swaps.", "info", { title: "That's a lot of swaps" }); return; }
    alts.push([x, y]);
    $("f-aq1").value = ""; $("f-aq2").value = "";
    drawAlts(); counters(); $("f-aq1").focus();
  }
  $("f-aadd").onclick = addAlt;

  function status(kind, text) {
    const s = $("sstatus");
    s.hidden = !text;
    s.className = "post-status " + kind;
    s.textContent = text || "";
  }
  async function submit(e) {
    e.preventDefault();
    if (!BB.requireDiscord()) return;
    $("sbtn").disabled = true;
    status("wait", "Sending your strategy to Bloombot…");
    const tt = BB.toast("Bloombot is checking it…", "wait", { title: "Sharing your strategy" });
    const row = { title: val("st"), description: compose(), category: $("sc").value };
    const { data, error } = await BB.sb.from("strategy_submissions").insert(row).select("id").single();
    if (error) {
      const why = /row-level security/i.test(error.message) ? "Your last strategy is still being checked. Give it a few seconds." : "Couldn't send it: " + error.message;
      status("bad", why);
      tt.update(why, "bad", { title: "Strategy not shared" });
      counters();
      return;
    }
    const started = Date.now();
    const poll = async () => {
      const { data: r } = await BB.sb.from("strategy_submissions").select("status,reason").eq("id", data.id).single();
      if (r && r.status === "posted") {
        status("ok", "Shared! It's on the list below and in /home → Strategies in Discord.");
        tt.update("It's on the list and in /home → Strategies in Discord.", "ok", { title: "Strategy shared!" });
        clearForm();
        go(0);
        counters();
        setTimeout(load, 1500);
        return;
      }
      if (r && r.status === "rejected") { status("bad", r.reason || "Bloombot couldn't add that strategy."); tt.update(r.reason || "Bloombot couldn't add that strategy.", "bad", { title: "Strategy not shared" }); counters(); return; }
      if (Date.now() - started > 90000) { status("wait", "Bloombot is busy. It will show up soon."); tt.update("Bloombot is busy. It will show up soon.", "info", { title: "Still waiting" }); counters(); return; }
      setTimeout(poll, 2500);
    };
    setTimeout(poll, 1500);
  }

  $("sopen").onclick = () => {
    const open = $("sform").hidden;
    $("sform").hidden = !open;
    $("sopen").setAttribute("aria-expanded", String(open));
    $("sopen").textContent = open ? "Close" : "Share a strategy";
    $("sopen").classList.toggle("green", !open);
    if (open) { go(0); $("st").focus(); }
  };
  if (location.hash === "#share") setTimeout(() => { if (!$("sopen").hidden && $("sform").hidden) $("sopen").click(); }, 400);

  document.querySelectorAll(".chip[data-scat]").forEach(b => b.onclick = () => { cat = b.dataset.scat; render(); });
  $("ssort").value = sort;
  $("ssort").addEventListener("change", () => { sort = $("ssort").value; render(); });
  $("sclear").onclick = () => { cat = "all"; $("sq").value = ""; render(); $("sq").focus(); };
  $("sq").oninput = render;
  $("sform").addEventListener("input", e => { if (!/^f-(uq|aq)/.test(e.target.id)) counters(); });
  $("sform").addEventListener("change", e => { if (!/^f-(uq|aq)/.test(e.target.id)) counters(); });
  /* Enter in a one-line box goes to the next step; Ctrl+Enter shares */
  $("sform").addEventListener("keydown", e => {
    if (e.key !== "Enter" || e.defaultPrevented) return;
    if (e.ctrlKey || e.metaKey) { e.preventDefault(); if (!$("sbtn").disabled) $("sform").requestSubmit(); else go(3); return; }
    if (e.target.tagName === "INPUT" && !/^f-(uq|aq)/.test(e.target.id)) { e.preventDefault(); if (step < 3) go(step + 1); }
  });
  $("sform").onsubmit = e => { if (step !== 3) { e.preventDefault(); go(step + 1); return; } submit(e); };
  loadDraft();
  drawUnits(); drawAlts(); syncSegs();
  go(0);
  counters();

  let started = false, loaded = false;
  BB.onAuth(session => {
    if (!session) $("sform").hidden = true;
    $("sopen").hidden = !session;
    $("slogbtn").hidden = !!session;
    $("shint").textContent = session ? "Share it with every Bloombot server. It shows up in /home in Discord too." : "Log in to share it with every Bloombot server.";
    document.querySelector('.chip[data-scat="mine"]').hidden = !session;
    if (session) $("sname").textContent = BB.user(session).name;
    const id = session ? BB.user(session).id : null;
    const changed = id !== me;
    me = id;
    if (!me && cat === "mine") cat = "all";
    if (!started) { started = true; load(); }
    else if (changed) render();
  });
})();
