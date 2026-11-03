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
  /* Plain text pieces of an ad: unit names get their picture. */
  function chips(parent, text) {
    if (!unitRe) { parent.append(text); return; }
    let last = 0;
    text.replace(unitRe, (m, _g, i) => {
      if (i > last) parent.append(text.slice(last, i));
      const it = unitMap.get(m.toLowerCase());
      const chip = el("span", "uchip");
      chip.title = it.value > 0 ? `${it.name} · ${BB.fmt(it.value)}` : it.name;
      chip.append(BB.itemImg(it, "uimg"), document.createTextNode(m));
      parent.append(chip);
      last = i + m.length;
      return m;
    });
    if (last < text.length) parent.append(text.slice(last));
  }
  const adText = text => BB.md(text, { cls: "tc-text", onText: chips });
  const left = t => {
    const h = (new Date(t) - Date.now()) / 36e5;
    if (!(h > 0)) return "";
    return h < 1 ? Math.max(1, Math.round(h * 60)) + "m left" : Math.round(h) + "h left";
  };

  const NS = "http://www.w3.org/2000/svg";
  function icon(kind) {
    const svg = document.createElementNS(NS, "svg");
    svg.setAttribute("viewBox", kind === "discord" ? "0 0 24 24" : "0 0 24 24");
    svg.setAttribute("class", "tc-ico");
    svg.setAttribute("aria-hidden", "true");
    const path = document.createElementNS(NS, "path");
    path.setAttribute("fill", "currentColor");
    path.setAttribute("d", kind === "discord"
      ? "M20.3 4.4A19.8 19.8 0 0 0 15.4 3l-.6 1.3a18.4 18.4 0 0 0-5.6 0L8.6 3a19.7 19.7 0 0 0-4.9 1.4C.6 9 0 13.6.3 18.1a19.9 19.9 0 0 0 6 3l1.3-2a13 13 0 0 1-2-1l.5-.4a14.2 14.2 0 0 0 12.2 0l.5.4-2 1 1.3 2a19.8 19.8 0 0 0 6-3c.5-5.2-.8-9.7-3.8-13.7ZM8.5 15.3c-1.2 0-2.2-1.1-2.2-2.4s1-2.4 2.2-2.4 2.2 1.1 2.2 2.4-1 2.4-2.2 2.4Zm7 0c-1.2 0-2.2-1.1-2.2-2.4s1-2.4 2.2-2.4 2.2 1.1 2.2 2.4-1 2.4-2.2 2.4Z"
      : "M6.3 1 1 18.7 17.7 23 23 5.3 6.3 1Zm7.9 14.2-4.1-1.1 1.1-4.1 4.1 1.1-1.1 4.1Z");
    svg.append(path);
    return svg;
  }
  /* A labelled account pill: icon, which app, and the name. Links when we have a safe link. */
  function account(kind, name, href) {
    const a = el(href ? "a" : "span", "acc " + kind);
    if (href) { a.href = href; a.target = "_blank"; a.rel = "noopener nofollow"; }
    const t = el("span", "acc-t");
    t.append(el("em", null, kind === "discord" ? "Discord" : "Roblox"), el("strong", null, name));
    a.append(icon(kind), t);
    return a;
  }

  function card(a) {
    const own = a.discord_id === me;
    const c = el("article", "tcard" + (own ? " own" : ""));
    const head = el("div", "tc-head");
    const av = el("img", "tc-av");
    av.alt = "";
    av.src = BB.safeUrl(a.discord_avatar) || "img/flower.png";
    av.onerror = () => { av.src = "img/flower.png"; };
    const who = el("div", "tc-who");
    who.append(el("strong", null, BB.plain(a.discord_name || "") || "Trader"),
      el("span", null, BB.ago(a.created_at) + (a.expires_at && left(a.expires_at) ? " · " + left(a.expires_at) : "")));
    head.append(av, who);
    if (own) head.append(el("span", "tag", "Yours"));
    c.append(head, adText(a.content));
    const img = BB.safeUrl(a.image_url);
    if (img) {
      const i = el("img", "tc-img");
      i.alt = "Trade ad picture";
      i.loading = "lazy";
      i.src = img;
      i.onerror = () => i.remove();
      c.append(i);
    }
    const users = el("div", "tc-users");
    const did = /^\d{5,25}$/.test(String(a.discord_id || "")) ? String(a.discord_id) : null;
    users.append(account("discord", a.discord_name || (did ? "User " + did.slice(-4) : "Unknown"), did ? "https://discord.com/users/" + did : null));
    const r = BB.safeUrl(a.roblox_url);
    if (a.roblox_name || r) users.append(account("roblox", a.roblox_name || "Profile", r));
    else users.append(account("roblox", "Not linked", null));
    c.append(users);
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
    $("tlist").replaceChildren(...list.slice(0, shown).map(card));
    $("more").hidden = list.length <= shown;
    $("tnone").hidden = list.length > 0;
    $("tnone").textContent = mine ? "You have no live trade ads. Post one above!" : ads.length ? "No trade ad matches that." : "No trade ads right now.";
    $("count").textContent = list.length + " live trade ad" + (list.length === 1 ? "" : "s");
  }

  async function load() {
    const { data, error } = await BB.sb.from("trade_ads").select("*").order("created_at", { ascending: false }).limit(1000);
    if (error) {
      $("tnone").hidden = false;
      $("tnone").textContent = "Couldn't load trade ads. Try again in a minute.";
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
