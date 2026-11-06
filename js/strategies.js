/* Strategies page: community strategies (the same ones as /home in Discord), and sharing one. */
(() => {
  const $ = id => document.getElementById(id);
  const { el } = BB;
  const CATS = { "meta-units": "Meta units", "map-specific": "Map-specific", "general": "General" };
  let list = [], cat = "all", me = null;

  function card(s) {
    const c = el("article", "strat");
    c.id = "s-" + s.id;
    const top = el("div", "strat-top");
    top.append(el("span", "stag c-" + s.category, CATS[s.category] || s.category));
    if (s.created_at) top.append(el("span", "strat-date", BB.ago(s.created_at)));
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
    const text = first && BB.plain(first[1]).toLowerCase() === BB.plain(s.title).toLowerCase() ? lines.slice(1).join("\n") : s.description;
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

  function render() {
    const q = $("sq").value.trim().toLowerCase();
    const shown = list.filter(s => (cat === "all" || s.category === cat) && (!q || BB.plain(s.title + " " + s.description).toLowerCase().includes(q)));
    $("slist").replaceChildren(...shown.map(card));
    $("snone").hidden = shown.length > 0;
    $("scount").textContent = shown.length + " strateg" + (shown.length === 1 ? "y" : "ies");
  }

  async function load() {
    const { data, error } = await BB.sb.from("strategies").select("*").order("id", { ascending: false }).limit(500);
    $("sloading").hidden = true;
    if (error) { $("sloading").hidden = true; $("snone").hidden = false; $("snone").textContent = "Couldn't load strategies."; return; }
    list = data || [];
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

  document.querySelectorAll(".chip[data-scat]").forEach(b => b.onclick = () => {
    cat = b.dataset.scat;
    document.querySelectorAll(".chip[data-scat]").forEach(x => x.classList.toggle("on", x === b));
    render();
  });
  $("sq").oninput = render;
  $("st").oninput = counters;
  $("sd").oninput = counters;
  $("sform").onsubmit = submit;
  counters();

  let loaded = false;
  BB.onAuth(session => {
    $("sform").hidden = !session;
    $("slogin").hidden = !!session;
    if (session) $("sname").textContent = BB.user(session).name;
    const id = session ? BB.user(session).id : null;
    const changed = id !== me;
    me = id;
    if (!loaded) { loaded = true; load(); }
    else if (changed) render();
  });
})();
