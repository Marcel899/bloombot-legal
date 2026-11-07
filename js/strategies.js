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
    const body = BB.md(text, { cls: "strat-body" });
    c.append(top, h, body);
    if (BB.plain(s.description).length > 320 || s.description.split("\n").filter(l => l.trim()).length > 9) {
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

  /* sharing */
  function counters() {
    const t = $("st").value.trim().length, d = $("sd").value.trim().length;
    $("stc").textContent = `${t}/80`;
    $("sdc").textContent = `${d}/1500`;
    $("stc").classList.toggle("bad", t > 0 && (t < 5 || t > 80));
    $("sdc").classList.toggle("bad", d > 0 && (d < 20 || d > 1500));
    $("sbtn").disabled = t < 5 || t > 80 || d < 20 || d > 1500;
  }
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
    const row = { title: $("st").value.trim(), description: $("sd").value.trim(), category: $("sc").value };
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
        $("st").value = ""; $("sd").value = "";
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
    $("sd").hidden = on;
    $("sdprev").hidden = !on;
    document.querySelector(".md-tools").classList.toggle("off", on);
    if (on) {
      const v = $("sd").value.trim();
      $("sdprev").replaceChildren(v ? BB.md(v) : el("p", "hint", "Nothing to preview yet."));
    } else $("sd").focus();
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
  $("st").oninput = counters;
  $("sd").oninput = counters;
  /* Ctrl+Enter shares from the form */
  $("sform").addEventListener("keydown", e => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey) && !$("sbtn").disabled) $("sform").requestSubmit(); });
  $("sform").onsubmit = submit;
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
