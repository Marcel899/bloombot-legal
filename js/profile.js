/* Profiles: anyone's linked account, live trade ads and strategies; your own settings. */
(() => {
  const $ = id => document.getElementById(id);
  const { el } = BB;
  const asked = new URLSearchParams(location.search).get("id");
  const want = BB.isId(asked) ? asked : null;
  let me = null, mine = null, priv = null, started = false;

  function img(src, cls, fallback = "img/flower.png") {
    const i = el("img", cls);
    i.alt = "";
    i.src = BB.safeUrl(src) || fallback;
    i.onerror = () => { if (i.src.indexOf(fallback) < 0) i.src = fallback; };
    return i;
  }
  const since = t => t ? new Date(t).toLocaleDateString(undefined, { month: "long", year: "numeric" }) : "";

  function card(p, isMe, fallbackName) {
    const c = $("pcard");
    c.replaceChildren();
    const did0 = p ? p.discord_id : want;
    const ban = el("div", "p-ban pban");
    BB.paintBanner(ban, "auto", did0);
    BB.getBanner(did0).then(k => BB.paintBanner(ban, k, did0));
    c.append(ban);
    const top = el("div", "p-top");
    const avs = el("div", "p-avs");
    avs.append(img(p && p.discord_avatar, "p-av"));
    if (p && p.roblox_avatar) avs.append(img(p.roblox_avatar, "p-rav"));
    const who = el("div", "p-who");
    who.append(el("h1", null, (p && p.discord_name) || fallbackName || "Bloombot player"));
    if (p && p.roblox_name && p.roblox_verified) who.firstChild.append(BB.verifiedBadge());
    const tags = el("div", "p-tags");
    if (p && p.registered_at) tags.append(el("span", "p-tag", "Joined " + since(p.registered_at)));
    if (p && p.level) tags.append(BB.rankTag(p.level));
    if (p && p.roblox_name) tags.append(BB.robloxTag(p));
    if (isMe) tags.append(el("span", "p-tag you", "You"));
    who.append(tags);
    top.append(avs, who);
    c.append(top);
    c.classList.toggle("rk-ring", !!(p && p.level >= 20));
    if (p && p.level) c.style.setProperty("--rk", BB.rankFor(p.level).color);
    who.firstChild.classList.toggle("ancient-name", !!(p && p.level >= 50));
    if (p && p.xp != null) {
      /* small level bar; the full one is on levels.html */
      const L = BB.levelFromXp(p.xp);
      const bar = el("a", "p-xp");
      bar.href = "levels.html";
      bar.style.setProperty("--rk", BB.rankFor(L.level).color);
      const tr = el("span", "p-xp-tr"), fill = el("i");
      fill.append(el("span", "p-xp-sh"));
      tr.append(fill);
      const lvl = el("span", "p-xp-l");
      lvl.append(el("em", null, "Lv"), el("b", null, String(L.level)));
      const nums = el("span", "p-xp-n");
      nums.append(el("strong", null, L.into.toLocaleString()), " / " + L.need.toLocaleString() + " XP");
      bar.append(lvl, tr, nums);
      if (L.into / L.need >= 0.9) bar.classList.add("close");
      c.append(bar);
      requestAnimationFrame(() => setTimeout(() => { fill.style.width = (100 * L.into / L.need).toFixed(1) + "%"; }, 60));
    }
    const stats = el("div", "upop-stats pstats");
    const stat = (v, l, g, ic, id) => {
      const s = el("div", "weld " + g);
      const i = el("img"); i.alt = ""; i.src = "img/" + ic + ".png";
      const n = el("strong", null, String(v));
      if (id) n.id = id;
      const lb = el("span", null, l);
      if (id) lb.id = id + "-l";
      s.append(i, n, lb);
      return s;
    };
    stats.append(stat(p && p.level ? p.level : "–", "Level", "g-yellow", "medal_gold"), stat("…", "Trade ads", "g-blue", "swap", "pst-ads"), stat("…", "Strategies", "g-purple", "bullseye", "pst-strs"));
    c.append(stats);
    if (p && p.description) {
      const d = el("div", "upop-sec p-about");
      d.append(el("h3", "upop-h", "About me"), BB.md(p.description, { cls: "p-desc" }));
      c.append(d);
    } else if (isMe && p) {
      const d = el("a", "upop-sec p-about empty");
      d.href = "#edit";
      d.append(el("h3", "upop-h", "About me"), el("p", "hint", "Tell other traders how you play, what you collect and when you're online. Add an About me →"));
      c.append(d);
    }
    /* Their collection (yours always; others' only if they made it public). */
    if (p && did0) {
      const slot = el("div", "pcol-slot");
      c.append(slot);
      collection(slot, did0, isMe);
    }
    /* What they're looking for: their wishlist, same as /wishlist in Discord. */
    if (p && did0) {
      const ws = el("div", "pwant-slot");
      c.append(ws);
      wants(ws, did0, isMe);
    }
    /* How to reach them: a Bloombot chat first, their accounts after. */
    if (p && !isMe && did0) c.append(BB.dmCard(did0, p.discord_name || fallbackName));
    const acc = el("div", "p-accs upop-accs");
    const pill = (kind, label, name, href) => {
      const a = el(href ? "a" : "span", "acc " + kind);
      const icons = { discord: "discord_stud_white", roblox: "rbx_stud", google: "google_stud" };
      if (icons[kind]) {
        const aic = el("img", "acc-ic");
        aic.alt = "";
        aic.src = "img/" + icons[kind] + ".png";
        a.append(aic);
      }
      if (href) { a.href = href; a.target = "_blank"; a.rel = "noopener nofollow"; }
      const t = el("span", "acc-t");
      t.append(el("em", null, label), el("strong", null, name));
      a.append(t);
      return a;
    };
    const did = p ? p.discord_id : want;
    if (did && !isMe) acc.append(pill("discord", "Discord", "Open profile", "https://discord.com/users/" + did));
    acc.append(p && p.roblox_name ? pill("roblox", "Roblox", p.roblox_name, BB.safeUrl(p.roblox_url)) : pill("roblox", "Roblox", "Not linked", null));
    if (isMe) {
      const has = priv && priv.server_link;
      acc.append(pill("server", "Private server", has ? "Set" : "Not set", has ? BB.safeUrl(priv.server_link) : null));
    }
    c.append(acc);
    const acts = el("div", "p-acts");
    if (isMe) {
      const e = el("button", "brick blue sm", "Edit profile");
      e.type = "button";
      e.onclick = () => openEdit();
      acts.append(e);
      if (p) {
        /* your inbox, with the unread count app.js keeps up to date */
        const mb = el("a", "brick green sm", "Messages");
        mb.href = "messages.html";
        const n = BB.dmUnread || 0;
        const badge = el("span", "me-badge", n > 99 ? "99+" : String(n));
        badge.setAttribute("data-dm-unread", "");
        badge.hidden = !n;
        mb.append(badge);
        acts.append(mb);
      }
    }
    if (acts.childElementCount) c.append(acts);
    c.append(BB.copyLinkBtn(location.origin + location.pathname.replace(/[^/]*$/, "profile.html") + "?id=" + did, "Bloombot profile"));
    c.hidden = false;
  }

  /* Collection summary: total value and the most valuable units, linking to the full list. */
  async function collection(slot, did, isMe) {
    let res, vals;
    try {
      [res, vals] = await Promise.all([BB.sb.rpc("col_get", { p_user: isMe ? null : did }), BB.loadValues()]);
    } catch (e) { return; }
    if (!res || res.error || !res.data) return;
    const items = res.data.items || [];
    if (!isMe && !items.length) return;
    const by = new Map(vals.map(v => [v.name, v]));
    const rows = items.map(r => ({ ...r, it: by.get(r.name) })).map(r => ({ ...r, worth: r.it && r.it.est > 0 ? r.it.est * r.qty : 0 }))
      .sort((a, b) => b.worth - a.worth);
    const total = rows.reduce((n, r) => n + r.worth, 0), count = rows.reduce((n, r) => n + r.qty, 0);
    const box = el("a", "pcol");
    box.href = isMe ? "collection.html" : "collection.html?id=" + encodeURIComponent(did);
    const head = el("div", "pcol-h");
    const t = el("span", "pcol-t");
    t.append(el("em", null, "Collection" + (isMe && !res.data.public ? " · private" : "")));
    if (rows.length) t.append(el("strong", null, BB.fmt(total) + " · " + count + (count === 1 ? " unit" : " units")));
    else t.append(el("strong", null, "Track the units you own"));
    head.append(t, el("span", "pcol-go", rows.length ? (isMe ? "Manage →" : "See all →") : "Start →"));
    box.append(head);
    if (rows.length) {
      const icons = el("div", "pcol-icons");
      rows.slice(0, 10).forEach(r => {
        const w = el("span", "pcol-i");
        w.title = r.name + (r.qty > 1 ? " ×" + r.qty : "");
        w.append(BB.itemImg(r.it || { name: r.name }, null));
        if (r.qty > 1) w.append(el("b", null, "×" + r.qty));
        icons.append(w);
      });
      if (rows.length > 10) icons.append(el("span", "pcol-more", "+" + (rows.length - 10)));
      box.append(icons);
    }
    slot.replaceChildren(box);
  }

  async function wants(slot, did, isMe) {
    let res, vals;
    try { [res, vals] = await Promise.all([BB.sb.rpc("wl_get", { p_user: isMe ? null : did }), BB.loadValues()]); } catch (e) { return; }
    if (!res || res.error || !res.data) return;
    const names = res.data.items || [];
    if (!names.length && !isMe) return;
    const by = new Map(vals.map(v => [v.name, v]));
    const box = el("div", "pwant");
    const h = el("div", "pwant-h");
    h.append(el("em", null, isMe ? "Your wishlist · " + names.length + "/" + (res.data.max || 20) : "Looking for"));
    if (isMe) { const ed = el("a", null, names.length ? "Edit →" : "Add units →"); ed.href = "values.html#watchlist"; h.append(ed); }
    box.append(h);
    const list = el("div", "pwant-list");
    names.forEach(n => {
      const it = by.get(n) || { name: n };
      const a = el("a", "pwant-c");
      a.href = BB.unitUrl(n);
      a.title = n + (it.est > 0 ? " · " + BB.fmt(it.est) : "");
      a.append(BB.itemImg(it, null), el("span", null, n));
      list.append(a);
    });
    if (!names.length) list.append(el("span", "hint", "Star units on the values page and traders see what you're after."));
    box.append(list);
    slot.replaceChildren(box);
  }

  function delBtn(kind, id, label, did) {
    const b = el("button", "del-btn", "Delete");
    b.type = "button";
    b.title = label;
    b.onclick = async e => {
      e.preventDefault();
      b.disabled = true;
      if (await BB.deleteMine(kind, id)) lists(did);
      else b.disabled = false;
    };
    return b;
  }
  function adCard(a, own) {
    const c = el("article", "upop-ad");
    const foot = el("div", "upop-adf");
    foot.append(el("span", "upop-ago", BB.ago(a.created_at)));
    if (own) foot.append(delBtn("trade_ad", a.id, "Delete this trade ad", a.discord_id));
    c.append(BB.md(a.content, { cls: "tc-text" }), foot);
    return c;
  }
  function stratCard(s, own, did) {
    const c = el("a", "upop-str");
    c.href = "strategies.html#s-" + s.id;
    const t = el("strong");
    BB.mdInline(t, s.title);
    c.append(t, el("span", null, (s.category || "").replace("-", " ")));
    if (!own) return c;
    const row = el("div", "hs-row pstr-row");
    row.append(c, delBtn("strategy", s.id, "Delete your strategy", did));
    return row;
  }

  async function lists(did) {
    const [{ data: ads }, { data: strs }] = await Promise.all([
      BB.sb.from("trade_ads").select("id,discord_id,content,created_at,expires_at").eq("discord_id", did).order("created_at", { ascending: false }).limit(20),
      BB.sb.from("strategies").select("id,title,category").eq("author_id", did).order("id", { ascending: false }).limit(20),
    ]);
    const live = (ads || []).filter(a => !a.expires_at || new Date(a.expires_at) > Date.now());
    const own = did === me;
    $("pads").replaceChildren(...live.map(a => adCard(a, own)));
    $("pads-sec").hidden = !live.length;
    $("pads-all").href = did === me ? "trades.html?mine=1" : "trades.html";
    $("pstrs").replaceChildren(...(strs || []).map(s => stratCard(s, own, did)));
    $("pstr-sec").hidden = !(strs || []).length;
    const n = (strs || []).length;
    if ($("pst-ads")) { $("pst-ads").textContent = live.length; $("pst-ads-l").textContent = live.length === 1 ? "Trade ad" : "Trade ads"; }
    if ($("pst-strs")) { $("pst-strs").textContent = n; $("pst-strs-l").textContent = n === 1 ? "Strategy" : "Strategies"; }
    $("pempty").hidden = !!(live.length || n);
  }

  /* ── settings ────────────────────────────────────────────── */
  function status(kind, text) {
    const s = $("pstatus");
    s.hidden = !text;
    s.className = "post-status " + kind;
    s.textContent = text || "";
  }
  const USER = /^[A-Za-z0-9_]{3,20}$/, LINK = /^https:\/\/www\.roblox\.com\/share\?code=[A-Za-z0-9]+&type=Server$/;
  const FU_HINT = "Your exact Roblox name, not your display name.";
  const FL_HINT = "Garden Tower Defense → ··· → Share → Copy Private Server Link. Only you can see it.";
  let orig = { u: "", l: "", d: "", a: true }, touched = {};
  const vals = () => ({ u: $("fu").value.trim(), l: $("fl").value.trim(), d: $("fd").value.trim(), a: $("fab").checked });
  const dirty = () => { const v = vals(); return v.u !== orig.u || v.l !== orig.l || v.d !== orig.d || v.a !== orig.a; };
  /* Rank auto-bump perk: level -> minutes (same as the bot's ranks). */
  const BUMP = [[50, 5], [35, 10], [20, 20], [10, 30]];
  const bumpHint = on => {
    const lv = (mine && mine.level) || 1;
    const m = (BUMP.find(([need]) => lv >= need) || [])[1];
    if (!m) return "Your ads get bumped automatically from level 10. Turn this off to keep them where they are.";
    return on ? "Your rank moves your ads back to the bottom every " + m + " minutes." : "Your ads stay where they are until you bump them.";
  };
  function field(id, state, msg) {
    const f = $(id + "-f");
    f.classList.toggle("ok", state === "ok");
    f.classList.toggle("bad", state === "bad");
    $(id).setAttribute("aria-invalid", String(state === "bad"));
    $(id + "-m").textContent = msg;
  }
  /* Pull a share link out of whatever was pasted (Roblox sometimes adds text around it). */
  const cleanLink = s => { const m = String(s).match(/https:\/\/www\.roblox\.com\/share\?code=[A-Za-z0-9]+&type=Server/); return m ? m[0] : String(s).trim(); };
  function check() {
    const v = vals();
    let ok = true;
    if (!v.u) { ok = false; field("fu", touched.fu ? "bad" : "", touched.fu ? "Enter your Roblox username." : FU_HINT); }
    else if (!USER.test(v.u)) { ok = false; field("fu", "bad", v.u.length < 3 ? "Usernames are at least 3 characters." : "Only letters, numbers and _ are allowed."); }
    else field("fu", "ok", FU_HINT);
    if (!v.l) field("fl", "", FL_HINT);
    else if (!LINK.test(v.l)) { ok = false; field("fl", touched.fl ? "bad" : "", touched.fl ? "That isn't a share link. It looks like https://www.roblox.com/share?code=…&type=Server" : FL_HINT); }
    else field("fl", "ok", "Looks good. Only you can see it.");
    const n = $("fd").value.length;
    $("fdc").textContent = n + "/300";
    $("fdc").classList.toggle("bad", n > 280);
    const d = dirty();
    $("pdirty").hidden = !d;
    /* With unsaved changes the Save bar floats at the bottom of the screen, so it's never a scroll away. */
    $("pedit").classList.toggle("dirty", d);
    $("psave").disabled = busy || !ok || (!d && !!mine);
    return ok;
  }
  function preview(on) {
    $("fdw").classList.toggle("on", !on); $("fdw").setAttribute("aria-selected", String(!on));
    $("fdp").classList.toggle("on", on); $("fdp").setAttribute("aria-selected", String(on));
    $("fd").hidden = on;
    const p = $("fdprev");
    p.hidden = !on;
    if (on) {
      const t = $("fd").value.trim();
      p.replaceChildren(t ? BB.md(t, { cls: "p-desc" }) : el("p", "hint", "Nothing to preview yet."));
    } else $("fd").focus();
  }
  function closeEdit() {
    if (busy) return;
    $("pedit").hidden = true;
    status("", "");
    $("pcard").classList.remove("editing");
    if (location.hash === "#edit") history.replaceState(null, "", location.pathname + location.search);
  }
  function openEdit() {
    $("pedit").hidden = false;
    $("pcard").classList.add("editing");
    $("pedit-h").textContent = mine ? "Profile settings" : "Create your Bloombot account";
    $("pedit-sub").textContent = mine
      ? "Saved to your Bloombot account, the same as /home → Settings in Discord."
      : "Link your Roblox account to post trade ads and share strategies. This is the same as /link in Discord.";
    $("psave").textContent = mine ? "Save changes" : "Create account";
    orig = { u: (mine && mine.roblox_name) || "", l: (priv && priv.server_link) || "", d: (mine && mine.description) || "", a: !(priv && priv.auto_bump === false) };
    $("fu").value = orig.u;
    $("fab").checked = orig.a;
    $("fab-m").textContent = bumpHint(orig.a);
    $("fab-sec").hidden = !(mine && priv && "auto_bump" in priv);
    $("fl").value = orig.l;
    $("fd").value = orig.d;
    touched = {};
    preview(false);
    $("fb-f").hidden = !mine;
    if (mine) banners();
    const vf = !!(mine && mine.roblox_name && mine.roblox_verified);
    $("fv-row").classList.toggle("ok", vf);
    $("fv-s").textContent = vf ? "Verified Roblox account" : mine && mine.roblox_name ? "Not verified yet. Prove it's yours to get the verified tag." : "Prefer to prove it's yours? Verify with a code instead.";
    $("fverify").textContent = vf ? "Verify again" : "Verify";
    $("fverify").className = "brick sm " + (vf ? "dark" : "blue");   // already verified: a quiet button, not a call to action
    accounts();
    $("pdanger").hidden = !mine;
    $("pclose").hidden = !mine;
    $("pcancel").hidden = !mine;
    status("", "");
    check();
    $("pedit").scrollIntoView({ block: "start", behavior: "smooth" });
    setTimeout(() => $("fu").focus({ preventScroll: true }), 250);
  }
  /* Connected accounts: Discord (always), Google (add/remove), Roblox (verify) */
  function accounts() {
    const u = BB.user(BB.session);
    $("pa-dc-s").textContent = u.hasDiscord ? "Logged in as " + u.name : "Not connected";
    const go = $("pa-go");
    go.hidden = !BB.googleReady;
    if (go.hidden) return;
    go.classList.toggle("ok", u.hasGoogle);
    $("pa-go-s").textContent = u.hasGoogle ? "You can log in with Google" : "Log in with Google too";
    const b = $("pa-go-b");
    b.textContent = u.hasGoogle ? "Remove" : "Connect";
    b.className = "brick sm " + (u.hasGoogle ? "dark" : "blue");
    b.onclick = async () => {
      if (!u.hasGoogle) { BB.addGoogle(); return; }
      const ok = await BB.confirm({ title: "Remove Google login?", text: "You'll log in with Discord only. You can add Google again any time.", ok: "Remove" });
      if (!ok) return;
      b.disabled = true;
      if (await BB.unlinkGoogle()) BB.toast("Log in with Discord from now on.", "ok", { title: "Google removed" });
      b.disabled = false;
    };
  }
  document.addEventListener("bb:accounts", () => { if (!$("pedit").hidden) accounts(); });

  /* banner picker: saves straight away, separate from the Save button */
  async function banners() {
    const g = $("fban");
    let cur = BB.bannerParts(await BB.getBanner(me));
    let pick = { ...cur };
    const texBtns = [["studs", "Studs"], ["weld", "Weld"]].map(([t, name]) => {
      const b = el("button", "ban-tex", name);
      b.type = "button";
      b.setAttribute("role", "radio");
      b.dataset.t = t;
      b.onclick = () => { if (pick.tex !== t) { pick.tex = t; paint(); commit(); } };
      return b;
    });
    const myLevel = (mine && mine.level) || 1;
    const btns = BB.BANNERS.map(([k, name, need]) => {
      const b = el("button", "ban-opt");
      b.type = "button";
      b.setAttribute("role", "radio");
      const sw = el("span", "ban-sw pban");
      if (k === "auto") sw.classList.add("auto");
      b.append(sw, el("span", "ban-n", name));
      b.dataset.k = k;
      const locked = need && myLevel < need;
      if (need) {
        const r = BB.rankFor(need);
        const lk = el("span", "ban-lv" + (locked ? " locked" : ""), (locked ? "\u{1F512} " : "") + "Lv " + need);
        lk.title = r.name + " rank perk";
        sw.append(lk);
      }
      if (locked) {
        b.classList.add("locked");
        b.setAttribute("aria-disabled", "true");
        b.title = "Unlocks at level " + need + " (" + BB.rankFor(need).name + ")";
        b.onclick = () => BB.toast("Reach level " + need + " to unlock the " + name + " banner. See how on the level page.", "info",
          { title: name + " is locked", action: { label: "Level page", run: () => { location.href = "levels.html"; } } });
        return b;
      }
      b.onclick = () => { if (pick.color !== k) { pick.color = k; paint(); commit(); } };
      return b;
    });
    function paint() {
      texBtns.forEach(x => x.setAttribute("aria-checked", String(x.dataset.t === pick.tex)));
      btns.forEach(x => {
        x.setAttribute("aria-checked", String(x.dataset.k === pick.color));
        BB.paintBanner(x.firstChild, BB.bannerKey(x.dataset.k, pick.tex), me);
      });
      const pb = document.querySelector(".p-ban");
      if (pb) BB.paintBanner(pb, BB.bannerKey(pick.color, pick.tex), me);
    }
    /* The server ignores a second change within 2s, so wait out the gap and send only the latest pick. */
    let lastSave = 0, timer = null;
    function commit() {
      $("fb-s").textContent = "Saving…";
      clearTimeout(timer);
      timer = setTimeout(send, Math.max(250, lastSave + 2200 - Date.now()));
    }
    async function send() {
      const want = { ...pick };
      lastSave = Date.now();
      const err = await BB.setBanner(BB.bannerKey(want.color, want.tex));
      if (err) {
        $("fb-s").textContent = "";
        BB.toast(/function|relation|schema/i.test(err.message) ? "Banners aren't switched on yet. Try again later." : "Couldn't save: " + err.message, "bad", { title: "Banner not saved" });
        pick = { ...cur };
        paint();
        return;
      }
      cur = want;
      if (pick.color !== want.color || pick.tex !== want.tex) return;
      $("fb-s").textContent = "Saved";
      BB.toast("Your new banner is live.", "ok", { title: "Banner saved" });
      setTimeout(() => { if ($("fb-s").textContent === "Saved") $("fb-s").textContent = ""; }, 2000);
    }
    const tex = el("div", "ban-texs");
    tex.setAttribute("role", "radiogroup");
    tex.setAttribute("aria-label", "Banner texture");
    tex.append(el("span", null, "Texture"), ...texBtns);
    g.replaceChildren(...btns);
    g.before(tex);
    document.querySelectorAll(".ban-texs").forEach(x => { if (x !== tex) x.remove(); });
    paint();
    /* Advent banners: shown once unlocked, or locked while the event is on */
    let doors = 0;
    try {
      const { data, error } = await BB.sb.rpc("adv_status");
      if (error || !data) return;
      doors = (data.opened || []).length;
    } catch (e) { return; }
    const showLocked = Date.now() < Date.UTC(2027, 0, 1);
    BB.EVENT_BANNERS.forEach(([k, name, need]) => {
      const locked = doors < need;
      if (locked && !showLocked && cur.color !== k) return;
      const b = el("button", "ban-opt");
      b.type = "button";
      b.setAttribute("role", "radio");
      b.dataset.k = k;
      const sw = el("span", "ban-sw pban");
      sw.append(el("span", "ban-lv" + (locked ? " locked" : ""), (locked ? "\u{1F512} " : "") + need + " doors"));
      b.append(sw, el("span", "ban-n", name));
      if (locked) {
        b.classList.add("locked");
        b.setAttribute("aria-disabled", "true");
        b.title = "Open " + need + " advent doors to unlock";
        b.onclick = () => BB.toast("Open " + need + " doors on the advent calendar to unlock the " + name + " banner. You've opened " + doors + ".", "info",
          { title: name + " is locked", action: { label: "Advent calendar", run: () => { location.href = "advent.html"; } } });
      } else b.onclick = () => { if (pick.color !== k) { pick.color = k; paint(); commit(); } };
      btns.push(b);
      g.append(b);
    });
    paint();
  }

  let busy = false;
  const done = () => { busy = false; $("psave").classList.remove("busy"); check(); };
  async function save(e) {
    e.preventDefault();
    if (busy) return;
    touched = { fu: true, fl: true };
    $("fl").value = cleanLink($("fl").value);
    if (!check()) { status("bad", "Fix the highlighted field first."); (USER.test(vals().u) ? $("fl") : $("fu")).focus(); return; }
    const { u, l, d } = vals();
    const row = {};
    if (!mine || u !== mine.roblox_name) row.roblox_username = u;
    if (l !== ((priv && priv.server_link) || "")) row.server_link = l;
    if (d !== ((mine && mine.description) || "")) row.description = d;
    if (!$("fab-sec").hidden && vals().a !== orig.a) row.auto_bump = vals().a;
    if (!Object.keys(row).length) { status("ok", "Nothing changed."); BB.toast("", "info", { title: "Nothing changed" }); return; }
    busy = true;
    $("psave").disabled = true;
    $("psave").classList.add("busy");
    status("wait", "Saving… Bloombot checks your Roblox name, this takes a few seconds.");
    const tt = BB.toast("Sending your changes to Bloombot…", "wait", { title: "Saving your profile" });
    let data, error;
    try { ({ data, error } = await BB.sb.from("profile_updates").insert(row).select("id").single()); }
    catch (err) { error = { message: (err && err.message) || "network error" }; }
    if (error) {
      done();
      const why = /row-level|violates/i.test(error.message) ? "Your last change is still being saved. Give it a few seconds." : "Couldn't save: " + error.message;
      status("bad", why);
      tt.update(why, "bad", { title: "Profile not saved" });
      return;
    }
    const t0 = Date.now();
    const poll = async () => {
      let r = null;
      try { ({ data: r } = await BB.sb.from("profile_updates").select("status,reason").eq("id", data.id).single()); } catch (err) { /* retry */ }
      if (r && r.status === "posted") {
        orig = vals();
        done();
        status("ok", "Saved!");
        tt.update("Your changes are live on the site and in Discord.", "ok", { title: "Profile saved" });
        setTimeout(() => { closeEdit(); load(); }, 900);
        return;
      }
      if (r && r.status === "rejected") { done(); status("bad", r.reason || "Bloombot couldn't save that."); tt.update(r.reason || "Bloombot couldn't save that.", "bad", { title: "Profile not saved" }); return; }
      if (Date.now() - t0 > 60000) { done(); status("wait", "Bloombot hasn't picked it up yet. If the bot is offline it will save when it's back."); tt.update("Bloombot seems busy or offline. It will save it when it's back.", "info", { title: "Still waiting" }); return; }
      setTimeout(poll, 2000);
    };
    setTimeout(poll, 1200);
  }
  $("pedit").onsubmit = save;
  if (/Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)) document.querySelector(".pe-kbd").textContent = "⌘ + Enter to save";
  $("fverify").onclick = () => BB.verifyRoblox({ name: $("fu").value.trim() || (mine && mine.roblox_name) || "" });
  document.addEventListener("bb:roblox-verified", () => { if (me) { orig = vals(); closeEdit(); setTimeout(load, 600); } });
  $("pdel").onclick = async () => {
    $("pdel").disabled = true;
    if (await BB.deleteAccount()) { setTimeout(() => { location.href = "./"; }, 1200); return; }
    $("pdel").disabled = false;
  };
  const cancel = async () => {
    if (dirty() && !(await BB.confirm({ title: "Discard changes?", text: "Your edits haven't been saved.", ok: "Discard" }))) return;
    orig = vals();
    closeEdit();
  };
  $("pcancel").onclick = cancel;
  $("pclose").onclick = cancel;
  $("fab").addEventListener("change", () => { $("fab-m").textContent = bumpHint($("fab").checked); check(); });
  ["fu", "fl", "fd"].forEach(id => {
    $(id).addEventListener("input", check);
    $(id).addEventListener("blur", () => { if ($(id).value.trim()) touched[id] = true; check(); });
  });
  $("fu").addEventListener("input", () => { const v = $("fu").value, c = v.replace(/[\s@]/g, ""); if (c !== v) { $("fu").value = c; check(); } });
  $("fl").addEventListener("paste", () => setTimeout(() => { $("fl").value = cleanLink($("fl").value); touched.fl = true; check(); }, 0));
  if (navigator.clipboard && navigator.clipboard.readText) {
    $("fpaste").hidden = false;
    $("fpaste").onclick = async () => {
      try { $("fl").value = cleanLink(await navigator.clipboard.readText()); touched.fl = true; check(); $("fl").focus(); }
      catch (err) { BB.toast("Couldn't read the clipboard. Paste with Ctrl+V."); $("fl").focus(); }
    };
  }
  $("fdw").onclick = () => preview(false);
  $("fdp").onclick = () => preview(true);
  $("pedit").addEventListener("keydown", e => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); $("pedit").requestSubmit(); }
    else if (e.key === "Escape" && mine && !e.defaultPrevented && !document.querySelector(".wm-back")) cancel();
  });
  addEventListener("beforeunload", e => { if (!$("pedit").hidden && dirty()) { e.preventDefault(); e.returnValue = ""; } });

  async function load() {
    const did = want || me;
    const isMe = did === me;
    const [{ data: p }, privRes] = await Promise.all([
      BB.sb.from("profiles").select("*").eq("discord_id", did).maybeSingle(),
      isMe ? BB.sb.from("profile_private").select("server_link,auto_bump").eq("discord_id", did).maybeSingle()
        .then(r => r.error ? BB.sb.from("profile_private").select("server_link").eq("discord_id", did).maybeSingle() : r)
        : Promise.resolve({ data: null }),
    ]);
    $("ploading").hidden = true;
    if (isMe) { mine = p; priv = privRes.data; }
    const fallback = isMe ? BB.user(BB.session).name : null;
    if (!p && !isMe) {
      card(null, false, "Unknown player");
      $("pcard").append(el("p", "hint", "This player hasn't linked a Roblox account to Bloombot yet."));
    } else card(p || { discord_id: did, discord_avatar: BB.user(BB.session).avatar }, isMe, fallback);
    if (isMe && !p) openEdit();
    else if (isMe && location.hash === "#edit") openEdit();
    document.title = ((p && p.discord_name) || fallback || "Player") + " · Bloombot";
    if (BB.dmUnread && BB.setDmUnread) BB.setDmUnread(BB.dmUnread);   // keep the "(3)" unread prefix
    lists(did);
  }

  BB.onAuth(session => {
    if (!session) { $("ploading").hidden = true; $("plogin").hidden = false; $("pcard").hidden = true; $("pedit").hidden = true; return; }
    $("plogin").hidden = true;
    const id = BB.user(session).id;
    if (!id && !want) { $("ploading").hidden = true; BB.requireDiscord(); return; }
    if (started && id === me) return;
    me = id; started = true;
    load();
  });
  addEventListener("hashchange", () => { if (location.hash === "#edit" && me && (!want || want === me)) openEdit(); });
})();
