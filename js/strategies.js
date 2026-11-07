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
    const pills = el("div", "sinfo-row");
    for (const p of parts.slice(1)) {
      const raw = p.lines.join("\n").trim();
      if (!raw) continue;
      if (p.key === "information" || p.key === "performance") {
        const rest = [];
        for (const l of p.lines) {
          const kv = l.trim().match(KV);
          if (!kv) { if (l.trim()) rest.push(l); continue; }
          if (/^created by$/i.test(kv[1].trim())) continue;
          const pill = el("span", "sinfo");
          pill.append(el("span", null, kv[1].trim()), el("b", null, kv[2].trim()));
          pills.append(pill);
        }
        if (rest.length) body.append(BB.md(rest.join("\n")));
        continue;
      }
      if (p.key === "required units" || p.key === "units") {
        const box = el("div", "strat-units");
        items(p.lines).forEach(n => box.append(unitChip(n)));
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
    if (pills.childElementCount) head.splice(head[0] && head[0].classList.contains("strat-tag") ? 1 : 0, 0, pills);
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

  /* sharing: the form fields are written into the same "## Section" layout the bot uses */
  const E = {
    title: "<:Clue:1510667485743943760>", info: "<:Casual:1510667491020374067>", units: "<:Sunflower:1510667399668437062>",
    alt: "<:Refresh:1510667407390146570>", desc: "<:Pencil:1510667414289780866>", early: "<:Seeds:1510667402478616577>",
    mid: "<:Damage:1510667457805684856>", late: "<:VIP:1510667379913527377>", tips: "<:Clue:1510667485743943760>", perf: "<:Stats:1510667394765553815>",
  };
  const MAX = 1500;
  let picked = [];
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
    if (val("f-alt")) out.push(h("alt", "Alternatives") + "\n" + bullets(val("f-alt").replace(/\s*(?:->|=>)\s*/g, " → ")));
    if (val("sd")) out.push(h("desc", "Description") + "\n" + val("sd"));
    for (const [k, id, name] of [["early", "f-early", "Early Game"], ["mid", "f-mid", "Mid Game"], ["late", "f-late", "Late Game"], ["tips", "f-tips", "Tips"]])
      if (val(id)) out.push(h(k, name) + "\n" + bullets(val(id)));
    const perf = kv([["Cost", val("f-cost")], ["Clear Speed", val("f-speed")]]);
    if (perf) out.push(h("perf", "Performance") + "\n" + perf);
    const text = out.join("\n\n");
    return emoji && text.length > MAX ? compose(false) : text;
  }
  function counters() {
    const t = val("st").length, d = compose().length, desc = val("sd").length;
    $("stc").textContent = `${t}/80`;
    $("sdc").textContent = `${d}/${MAX}`;
    $("stc").classList.toggle("bad", t > 0 && (t < 5 || t > 80));
    $("sdc").classList.toggle("bad", d > MAX);
    $("sd").classList.toggle("need", desc > 0 && desc < 10);
    $("sbtn").disabled = t < 5 || t > 80 || desc < 10 || d > MAX;
    $("f-ucount").textContent = `${picked.length}/10`;
    saveDraft();
  }
  /* the form is kept in this browser until it's shared */
  const FIELDS = ["st", "sc", "f-mode", "f-team", "f-diff", "f-map", "f-tag", "f-alt", "sd", "f-early", "f-mid", "f-late", "f-tips", "f-cost", "f-speed"];
  let draftReady = false;
  function saveDraft() {
    if (!draftReady) return;
    try { localStorage.setItem("bb_strat_draft", JSON.stringify({ f: Object.fromEntries(FIELDS.map(id => [id, $(id).value])), u: picked })); } catch (e) { /* blocked */ }
  }
  function loadDraft() {
    try {
      const d = JSON.parse(localStorage.getItem("bb_strat_draft") || "null");
      if (d && d.f) { FIELDS.forEach(id => { if (typeof d.f[id] === "string") $(id).value = d.f[id].slice(0, 1000); }); picked = (d.u || []).filter(x => typeof x === "string").slice(0, 10); }
    } catch (e) { /* ignore */ }
    draftReady = true;
  }
  function clearForm() {
    FIELDS.forEach(id => { $(id).value = id === "sc" ? "general" : ""; });
    picked = [];
    drawUnits();
    try { localStorage.removeItem("bb_strat_draft"); } catch (e) { /* blocked */ }
  }
  function drawUnits() {
    $("f-units").replaceChildren(...picked.map((n, i) => {
      const chip = unitChip(n);
      const x = el("button", "f-x", "×");
      x.type = "button"; x.title = "Remove " + n;
      x.onclick = () => { picked.splice(i, 1); drawUnits(); counters(); };
      chip.append(x);
      return chip;
    }));
  }
  (async () => {
    const m = await unitsP;
    const all = [...m.values()].filter(i => i.name && i.category !== "gamepass");
    const input = $("f-uq"), box = $("f-usug");
    const k = t => String(t || "").toLowerCase().replace(/[^a-z0-9]/g, "");
    let opts = [], idx = 0;
    const draw = () => {
      box.replaceChildren(...opts.map((it, i) => {
        const o = el("button", "sug" + (i === idx ? " on" : ""));
        o.type = "button";
        o.append(BB.itemImg(it, "sug-img"), el("span", null, it.name));
        o.onmousedown = e => { e.preventDefault(); choose(it.name); };
        return o;
      }));
      box.hidden = !opts.length;
    };
    const choose = name => {
      if (picked.length >= 10) BB.toast("Keep it to 10 units.", "info", { title: "That's a lot of units" });
      else if (!picked.includes(name)) picked.push(name);
      input.value = ""; opts = []; draw(); drawUnits(); counters(); input.focus();
    };
    input.oninput = () => {
      const q = k(input.value);
      const starts = [], has = [];
      if (q) for (const it of all) { const n = k(it.name); if (n.startsWith(q)) starts.push(it); else if (n.includes(q)) has.push(it); }
      opts = starts.concat(has).slice(0, 8); idx = 0; draw();
    };
    input.onkeydown = e => {
      if (e.key === "ArrowDown") { idx = Math.min(idx + 1, opts.length - 1); draw(); e.preventDefault(); }
      else if (e.key === "ArrowUp") { idx = Math.max(idx - 1, 0); draw(); e.preventDefault(); }
      else if (e.key === "Enter") { e.preventDefault(); if (opts[idx]) choose(opts[idx].name); else if (input.value.trim().length > 1) choose(input.value.trim().slice(0, 40)); }
      else if (e.key === "Escape") { opts = []; draw(); }
    };
    input.onblur = () => setTimeout(() => { opts = []; draw(); }, 120);
  })();
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
        preview(false);
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

  function preview(on) {
    $("sdw").classList.toggle("on", !on); $("sdw").setAttribute("aria-selected", String(!on));
    $("sdp").classList.toggle("on", on); $("sdp").setAttribute("aria-selected", String(on));
    $("sfields").hidden = on;
    $("sdprev").hidden = !on;
    if (on) {
      const d = compose();
      $("sdprev").replaceChildren(d ? card({ id: 0, title: val("st") || "Your strategy", description: d, category: $("sc").value, created_at: new Date().toISOString(), author_name: $("sname").textContent || "You" }) : el("p", "hint", "Nothing to preview yet."));
      const m = $("sdprev").querySelector(".more-btn"); if (m) m.click();
      $("sdprev").querySelectorAll(".strat-link,.del-btn").forEach(x => x.remove());
    }
  }
  $("sdw").onclick = () => preview(false);
  $("sdp").onclick = () => preview(true);
  /* formatting buttons: wrap the selection, or start the line with "# " / "- " */
  document.querySelectorAll(".md-tools [data-md]").forEach(b => b.onclick = () => {
    const t = $("sd"), m = b.dataset.md, a = t.selectionStart, z = t.selectionEnd, v = t.value;
    if (m.endsWith(" ")) {
      const ls = v.lastIndexOf("\n", a - 1) + 1;
      t.setRangeText(m, ls, ls, "end");
    } else {
      const sel = v.slice(a, z) || "text";
      t.setRangeText(m + sel + m, a, z, "select");
      t.setSelectionRange(a + m.length, a + m.length + sel.length);
    }
    t.focus();
    counters();
  });
  $("sopen").onclick = () => {
    const open = $("sform").hidden;
    $("sform").hidden = !open;
    $("sopen").setAttribute("aria-expanded", String(open));
    $("sopen").textContent = open ? "Close" : "Share a strategy";
    $("sopen").classList.toggle("green", !open);
    if (open) $("st").focus();
  };
  if (location.hash === "#share") setTimeout(() => { if (!$("sopen").hidden && $("sform").hidden) $("sopen").click(); }, 400);

  document.querySelectorAll(".chip[data-scat]").forEach(b => b.onclick = () => { cat = b.dataset.scat; render(); });
  $("ssort").value = sort;
  $("ssort").addEventListener("change", () => { sort = $("ssort").value; render(); });
  $("sclear").onclick = () => { cat = "all"; $("sq").value = ""; render(); $("sq").focus(); };
  $("sq").oninput = render;
  $("sform").addEventListener("input", e => { if (e.target.id !== "f-uq") counters(); });
  $("sform").addEventListener("change", counters);
  /* Ctrl+Enter shares from the form */
  $("sform").addEventListener("keydown", e => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey) && !$("sbtn").disabled) $("sform").requestSubmit(); });
  $("sform").onsubmit = submit;
  loadDraft();
  drawUnits();
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
