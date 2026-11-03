/* Trade ads page: live ads for logged-in users, and posting an ad from the site. */
(() => {
  const $ = id => document.getElementById(id);
  const { el } = BB;
  let ads = [], me = null, timer = null, units = [], shown = 24;
  const PAGE = 24;

  /* Unit names in the ad text get their icon, longest names first. */
  let unitRe = null, unitMap = new Map();
  function prepUnits(items) {
    units = items.filter(i => i.name && i.name.length >= 4);
    unitMap = new Map(units.map(i => [i.name.toLowerCase(), i]));
    const names = units.map(i => i.name).sort((a, b) => b.length - a.length)
      .map(n => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
    unitRe = names.length ? new RegExp("\\b(" + names.join("|") + ")\\b", "gi") : null;
  }
  function adText(text) {
    const p = el("p", "ad-text");
    if (!unitRe) { p.textContent = text; return p; }
    let last = 0;
    text.replace(unitRe, (m, _g, i) => {
      if (i > last) p.append(document.createTextNode(text.slice(last, i)));
      const it = unitMap.get(m.toLowerCase());
      const chip = el("span", "uchip");
      chip.title = it.value > 0 ? `${it.name} · ${BB.fmt(it.value)}` : it.name;
      chip.append(BB.itemImg(it, "uimg"), document.createTextNode(m));
      p.append(chip);
      last = i + m.length;
      return m;
    });
    if (last < text.length) p.append(document.createTextNode(text.slice(last)));
    return p;
  }
  const left = t => {
    const h = (new Date(t) - Date.now()) / 36e5;
    if (!(h > 0)) return "";
    return h < 1 ? Math.max(1, Math.round(h * 60)) + "m left" : Math.round(h) + "h left";
  };

  function card(a) {
    const c = el("article", "ad" + (a.discord_id === me ? " own" : ""));
    const head = el("div", "ad-head");
    const av = el("img", "ad-av");
    av.alt = "";
    av.src = BB.safeUrl(a.discord_avatar) || "img/flower.png";
    av.onerror = () => { av.src = "img/flower.png"; };
    const who = el("div", "ad-who");
    who.append(el("strong", null, a.discord_name || "Trader"),
      el("span", null, BB.ago(a.created_at) + (a.expires_at ? " · " + left(a.expires_at) : "")));
    head.append(av, who);
    if (a.discord_id === me) head.append(el("span", "tag", "Yours"));
    c.append(head, adText(a.content));
    const img = BB.safeUrl(a.image_url);
    if (img) {
      const i = el("img", "ad-img");
      i.alt = "Trade ad picture";
      i.loading = "lazy";
      i.src = img;
      i.onerror = () => i.remove();
      c.append(i);
    }
    const links = el("div", "ad-links");
    if (/^\d+$/.test(a.discord_id) && a.discord_id !== me) {
      const d = el("a", "brick discord sm", "Message");
      d.href = "https://discord.com/users/" + a.discord_id;
      d.target = "_blank"; d.rel = "noopener";
      links.append(d);
    }
    const r = BB.safeUrl(a.roblox_url);
    if (r) {
      const b = el("a", "brick dark sm", "Roblox: " + (a.roblox_name || "profile"));
      b.href = r; b.target = "_blank"; b.rel = "noopener";
      links.append(b);
    }
    c.append(links);
    return c;
  }

  function render() {
    const v = $("adq").value.trim().toLowerCase(), mine = $("mine").checked, now = Date.now();
    const list = ads.filter(a => (!a.expires_at || new Date(a.expires_at) > now) && (!mine || a.discord_id === me) &&
      (!v || (a.content + " " + (a.discord_name || "") + " " + (a.roblox_name || "")).toLowerCase().includes(v)));
    const sort = $("adsort").value;
    if (sort === "old") list.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    else if (sort === "ending") list.sort((a, b) => new Date(a.expires_at || 8e15) - new Date(b.expires_at || 8e15));
    else list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    $("ads").replaceChildren(...list.slice(0, shown).map(card));
    $("more").hidden = list.length <= shown;
    $("adsnone").hidden = list.length > 0;
    $("adsnone").textContent = mine ? "You have no live trade ads. Post one above!" : ads.length ? "No trade ad matches that." : "No trade ads right now.";
    $("count").textContent = list.length + " live trade ad" + (list.length === 1 ? "" : "s");
  }

  async function load() {
    const { data, error } = await BB.sb.from("trade_ads").select("*").order("created_at", { ascending: false }).limit(1000);
    if (error) {
      $("adsnone").hidden = false;
      $("adsnone").textContent = "Couldn't load trade ads. Try again in a minute.";
      return;
    }
    ads = data || [];
    render();
  }

  /* ── posting ─────────────────────────────────────────────── */
  const MIN = 7, MAX = 200;
  function counter() {
    const n = $("adtext").value.trim().length;
    $("adcount").textContent = `${n}/${MAX}`;
    $("adcount").classList.toggle("bad", n > MAX || (n > 0 && n < MIN));
    $("postbtn").disabled = n < MIN || n > MAX;
  }
  function status(kind, text) {
    const s = $("poststatus");
    s.hidden = !text;
    s.className = "post-status " + kind;
    s.textContent = text || "";
  }
  async function post(e) {
    e.preventDefault();
    const content = $("adtext").value.trim();
    if (content.length < MIN || content.length > MAX) return;
    $("postbtn").disabled = true;
    status("wait", "Sending your trade ad to Bloombot…");
    const { data, error } = await BB.sb.from("ad_submissions").insert({ content }).select("id").single();
    if (error) {
      status("bad", /row-level security/i.test(error.message)
        ? "You already have a trade ad waiting. Give it a few seconds."
        : "Couldn't send it: " + error.message);
      counter();
      return;
    }
    const started = Date.now();
    const poll = async () => {
      const { data: row } = await BB.sb.from("ad_submissions").select("status,reason,servers").eq("id", data.id).single();
      if (row && row.status === "posted") {
        status("ok", row.reason || `Posted to ${row.servers} server${row.servers === 1 ? "" : "s"}! It's on the board below.`);
        $("adtext").value = "";
        counter();
        load();
        return;
      }
      if (row && row.status === "rejected") {
        status("bad", row.reason || "Bloombot couldn't post that trade ad.");
        counter();
        return;
      }
      if (Date.now() - started > 90000) {
        status("wait", "Bloombot is busy. Your ad will post soon; check back in a minute.");
        counter();
        return;
      }
      status("wait", row && row.status === "processing" ? "Posting to every server…" : "Waiting for Bloombot…");
      setTimeout(poll, 2500);
    };
    setTimeout(poll, 1500);
  }

  function show(session) {
    $("loading").hidden = true;
    if (BB.loginError) { $("loginerr").hidden = false; $("loginerr").textContent = "Login failed: " + BB.loginError; }
    if (!session) {
      $("login").hidden = false; $("board").hidden = true;
      clearInterval(timer);
      return;
    }
    const u = BB.user(session);
    me = u.id;
    $("meav").src = u.avatar;
    $("mename").textContent = u.name;
    $("login").hidden = true; $("board").hidden = false;
    if (new URLSearchParams(location.search).get("mine")) $("mine").checked = true;
    if (location.hash === "#post") setTimeout(() => { $("post").scrollIntoView({ block: "center" }); $("adtext").focus(); }, 50);
    BB.loadValues().then(v => { prepUnits(v); render(); }).catch(() => {});
    load();
    clearInterval(timer);
    timer = setInterval(load, 60000);
  }

  const reset = () => { shown = PAGE; render(); };
  $("adq").oninput = reset;
  $("mine").onchange = reset;
  $("adsort").onchange = reset;
  $("more").onclick = () => { shown += PAGE; render(); };
  document.querySelectorAll("[data-q]").forEach(b => b.onclick = () => { $("adq").value = b.dataset.q; reset(); });
  $("adtext").oninput = counter;
  $("postform").onsubmit = post;
  counter();
  BB.onAuth(show);
})();
