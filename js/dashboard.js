/* Server dashboard: owners and administrators change Bloombot's /config settings. */
(() => {
  const $ = id => document.getElementById(id);
  const { el } = BB;
  const SLOTS = [
    ["mod_log", "Moderation Log", "Reports, moderation actions and system alerts.", "shield", true, true],
    ["trade_ads", "Trade Ads", "Where global trade ads are posted.", "trading", false, true],
    ["trade_ad_submit", "Global Trade Ad Channel", "Messages here become trade ads and go out to every server.", "envelope", false, false],
    ["team_finds", "Team Finder", "Where global team listings are posted.", "bullseye", false, true],
    ["value_updates", "Value Updates", "Where item value changes are announced.", "chart_up", false, true],
  ];
  const FEATURES = [
    ["trade_ads", "Trade Ads", "Show global trade ads in this server."],
    ["team_finds", "Team Finder", "Show global team listings."],
    ["reports", "User Reports", "Let members report users with /report."],
    ["value_updates", "Value Updates", "Announce value changes."],
  ];
  let guilds = [], cur = null, busy = false, started = false, me = null;

  function icon(g, cls) {
    if (g.icon) { const i = el("img", cls); i.alt = ""; i.src = BB.safeUrl(g.icon) || "img/flower.png"; i.onerror = () => { i.src = "img/flower.png"; }; return i; }
    return el("span", cls + " letter", (g.name || "?").trim().charAt(0).toUpperCase());
  }

  let filter = "";
  function list() {
    const box = $("dglist");
    const q = $("dgq");
    if (q) { q.hidden = guilds.length < 6; q.oninput = () => { filter = q.value.trim().toLowerCase(); list(); }; }
    box.replaceChildren(...guilds.filter(g => !filter || g.name.toLowerCase().includes(filter)).map(g => {
      const b = el("button", "dg" + (cur && cur.guild_id === g.guild_id ? " on" : ""));
      b.type = "button";
      const t = el("span", "dg-t");
      t.append(el("strong", null, g.name), el("em", null, g.setup_complete ? (g.member_count || 0).toLocaleString() + " members" : "Needs /setup"));
      b.append(icon(g, "dg-ic"), t);
      b.onclick = () => { location.hash = "g=" + g.guild_id; };
      return b;
    }));
  }

  function status(text, kind) {
    const s = $("dstatus");
    s.hidden = !text;
    s.className = "post-status " + (kind || "wait");
    s.textContent = text || "";
  }

  async function send(action, slot, value, ctrl) {
    if (busy) { BB.toast("Wait for the last change to finish.", "info", { title: "One at a time" }); return; }
    busy = true;
    const row = ctrl && ctrl.closest(".drow");
    if (row) row.classList.add("saving");
    document.querySelectorAll("#dpanel select, #dpanel button.sw, #dpanel .dclear").forEach(x => { x.disabled = true; });
    status("Saving…", "wait");
    const tt = BB.toast("Bloombot is applying it to your server…", "wait", { title: "Saving change" });
    let data, error;
    try { ({ data, error } = await BB.sb.from("dash_updates").insert({ guild_id: cur.guild_id, action, slot, value }).select("id").single()); }
    catch (err) { error = { message: (err && err.message) || "network error" }; }
    const TT = { ok: "Saved", bad: "Change not saved", wait: "Still waiting" };
    const done = (msg, kind) => { busy = false; status(msg, kind); tt.update(msg, kind === "wait" ? "info" : kind, { title: TT[kind] }); reload(); };
    if (error) { done(/row-level|violates/i.test(error.message) ? "Not allowed. You may have lost admin in this server, or you made too many changes. Wait a few minutes." : "Couldn't save: " + error.message, "bad"); return; }
    const t0 = Date.now();
    const poll = async () => {
      let r = null;
      try { ({ data: r } = await BB.sb.from("dash_updates").select("status,reason").eq("id", data.id).single()); } catch (err) { /* retry */ }
      if (r && r.status === "posted") { done(r.reason || "Saved!", /failed/.test(r.reason || "") ? "bad" : "ok"); return; }
      if (r && r.status === "rejected") { done(r.reason || "Bloombot refused that change.", "bad"); return; }
      if (Date.now() - t0 > 60000) { done("Bloombot hasn't picked it up yet. If the bot is offline it will apply it when it's back.", "wait"); return; }
      setTimeout(poll, 1500);
    };
    setTimeout(poll, 1000);
  }

  function channelSelect(g, value, webhook) {
    const s = el("select", "search dsel");
    const none = el("option", null, "Not set");
    none.value = "";
    s.append(none);
    const groups = new Map();
    for (const c of g.channels || []) {
      const k = c.category || "No category";
      if (!groups.has(k)) groups.set(k, el("optgroup"));
      groups.get(k).label = k;
      const o = el("option", null, "#" + c.name + (!c.can_send ? "  (no access)" : webhook && !c.can_webhook ? "  (no webhooks)" : ""));
      o.value = c.id;
      groups.get(k).append(o);
    }
    s.append(...groups.values());
    s.value = value || "";
    return s;
  }

  function panel() {
    const p = $("dpanel");
    p.replaceChildren();
    if (!cur) { p.hidden = true; return; }
    p.hidden = false;
    const cfg = cur.config || {}, chans = cfg.channels || {}, feats = cfg.features || {};
    const head = el("div", "dhead");
    const ht = el("div");
    ht.append(el("h2", null, cur.name), el("p", "hint", "Synced " + BB.ago(cur.updated_at) + ". Changes apply in a few seconds."));
    head.append(icon(cur, "dh-ic"), ht);
    const open = el("a", "brick dark sm dopen", "Open in Discord");
    open.href = "https://discord.com/channels/" + cur.guild_id; open.target = "_blank"; open.rel = "noopener";
    head.append(open);
    p.append(head);
    const setCount = SLOTS.filter(([k]) => chans[k] && chans[k].id && !chans[k].missing).length;
    const onCount = FEATURES.filter(([k]) => feats[k] !== false).length;
    const ov = el("div", "dov");
    const chip = (ok, text) => el("span", "dchip " + (ok ? "good" : "warn"), (ok ? "✓ " : "! ") + text);
    ov.append(chip(cur.setup_complete, cur.setup_complete ? "Set up" : "Needs /setup"),
      chip(setCount > 0, `${setCount}/${SLOTS.length} channels set`),
      chip(true, `${onCount}/${FEATURES.length} features on`));
    p.append(ov);
    const bp = cfg.bot_perms;
    if (bp && !bp.administrator) {
      const miss = [["manage_webhooks", "Manage Webhooks"], ["send_messages", "Send Messages"], ["embed_links", "Embed Links"]].filter(([k]) => !bp[k]).map(x => x[1]);
      if (miss.length) {
        const w = el("div", "dwarn");
        w.append(el("strong", null, "Bloombot is missing permissions"), el("span", null, "Give its role: " + miss.join(", ") + ". Some features won't work without them."));
        p.append(w);
      }
    }
    if (!cur.setup_complete) {
      const w = el("div", "dwarn");
      w.append(el("strong", null, "Run /setup in Discord first"), el("span", null, "Bloombot needs its first setup before most settings work. You can still pick channels here."));
      p.append(w);
    }

    const cols = el("div", "dcols"), colA = el("div", "dcol"), colB = el("div", "dcol");
    cols.append(colA, colB);
    p.append(cols);
    const sec = (title, ic, box) => { const s = el("section", "dsec"); const h = el("h3"); const i = el("img"); i.src = "img/" + ic + ".png"; i.alt = ""; h.append(i, el("span", null, title)); s.append(h); box.append(s); return s; };

    const cs = sec("Channels", "envelope", colA);
    for (const [slot, label, desc, ic, required, webhook] of SLOTS) {
      const v = chans[slot] || {};
      const row = el("div", "drow");
      const t = el("div", "dlabel");
      const ii = el("img"); ii.src = "img/" + ic + ".png"; ii.alt = "";
      const tt = el("div");
      tt.append(el("strong", null, label + (required ? " *" : "")), el("span", null, desc));
      if (v.missing) tt.append(el("span", "dbad", "The saved channel was deleted. Pick a new one."));
      else if (v.id && !v.webhook_ok) tt.append(el("span", "dbad", "Webhook missing. Give Bloombot Manage Webhooks there and pick it again."));
      t.append(ii, tt);
      const ctl = el("div", "dctl");
      const s = channelSelect(cur, v.missing ? "" : v.id, webhook);
      s.setAttribute("aria-label", label + " channel");
      s.onchange = () => { if (s.value) send("channel", slot, s.value, s); else if (!required) send("clear_channel", slot, null, s); else { s.value = v.id || ""; BB.toast("Pick another channel instead of clearing it.", "info", { title: label + " is required" }); } };
      ctl.append(s);
      if (!required && v.id) {
        const x = el("button", "brick dark sm dclear", "Clear");
        x.type = "button";
        x.onclick = () => send("clear_channel", slot, null, x);
        ctl.append(x);
      }
      row.append(t, ctl);
      cs.append(row);
    }

    const rs = sec("Value update ping", "bell", colB);
    const row = el("div", "drow");
    const t = el("div", "dlabel");
    const tt = el("div");
    tt.append(el("strong", null, "Role to ping"), el("span", null, "Pinged when values change. Leave empty for no ping."));
    t.append(tt);
    const rsel = el("select", "search dsel");
    rsel.setAttribute("aria-label", "Value update role");
    const no = el("option", null, "No ping"); no.value = ""; rsel.append(no);
    for (const r of cur.roles || []) { const o = el("option", null, "@" + r.name); o.value = r.id; rsel.append(o); }
    rsel.value = (cfg.role && cfg.role.id) || "";
    rsel.onchange = () => send(rsel.value ? "role" : "clear_role", null, rsel.value || null, rsel);
    const rc = el("div", "dctl"); rc.append(rsel);
    row.append(t, rc);
    rs.append(row);

    const fs = sec("Features", "gem", colB);
    for (const [key, label, desc] of FEATURES) {
      const on = feats[key] !== false;
      const r = el("div", "drow");
      const ft = el("div", "dlabel");
      const fx = el("div");
      fx.append(el("strong", null, label), el("span", null, desc));
      ft.append(fx);
      const sw = el("button", "sw" + (on ? " on" : ""));
      sw.type = "button";
      sw.setAttribute("role", "switch");
      sw.setAttribute("aria-checked", String(on));
      sw.setAttribute("aria-label", label);
      sw.append(el("i"));
      sw.onclick = () => { sw.classList.toggle("on"); send("feature", key, on ? "off" : "on", sw); };
      const fc = el("div", "dctl"); fc.append(sw);
      r.append(ft, fc);
      fs.append(r);
    }
    const st = el("p", "post-status", "");
    st.id = "dstatus"; st.hidden = true;
    p.append(st);
    const hs = sec("Recent changes", "clock", p);
    const hl = el("div", "dhist"); hl.append(el("p", "hint", "Loading…"));
    hs.append(hl);
    history(cur.guild_id, hl);
  }

  async function history(gid, box) {
    let data = null;
    try { ({ data } = await BB.sb.from("dash_updates").select("*").eq("guild_id", gid).order("id", { ascending: false }).limit(8)); } catch (e) { /* offline */ }
    if (!cur || cur.guild_id !== gid) return;
    box.replaceChildren();
    if (!data || !data.length) { box.append(el("p", "hint", "No website changes yet. Changes made here show up in this list and in your Moderation Log.")); return; }
    for (const r of data) {
      const row = el("div", "dh " + (r.status || ""));
      const icon = r.status === "posted" ? "✓" : r.status === "rejected" ? "✕" : "…";
      row.append(el("span", "dh-i", icon));
      const t = el("div");
      t.append(el("strong", null, r.reason || (r.status === "pending" || r.status === "processing" ? "Waiting for Bloombot…" : r.action)),
        el("span", null, (r.actor_name || (r.discord_id === me ? "You" : "An admin")) + " · " + BB.ago(r.created_at)));
      row.append(t);
      box.append(row);
    }
  }

  function pick() {
    const m = /g=(\d+)/.exec(location.hash);
    cur = (m && guilds.find(g => g.guild_id === m[1])) || (guilds.length === 1 ? guilds[0] : null);
    list();
    const on = document.querySelector("#dglist .dg.on");
    if (on) { const b = $("dglist"), l = on.offsetLeft - b.offsetLeft; if (l < b.scrollLeft || l + on.offsetWidth > b.scrollLeft + b.clientWidth) b.scrollLeft = l - 12; }
    const keep = $("dstatus") && !$("dstatus").hidden ? [$("dstatus").textContent, $("dstatus").className.split(" ").pop()] : null;
    panel();
    if (keep) status(keep[0], keep[1]);
    $("dpick").hidden = !!cur || !guilds.length;
  }

  async function reload() {
    let data = null, error = null;
    try { ({ data, error } = await BB.sb.from("dash_guilds").select("*").order("name")); }
    catch (err) { error = err; }
    $("dloading").hidden = true;
    if (error) { $("dempty").hidden = false; $("dempty-t").textContent = "Couldn't load your servers. Refresh to try again."; return; }
    guilds = data || [];
    $("dempty").hidden = !!guilds.length;
    $("dmain").hidden = !guilds.length;
    pick();
  }

  BB.onAuth(session => {
    if (!session) { $("dloading").hidden = true; $("dlogin").hidden = false; $("dmain").hidden = true; $("dempty").hidden = true; return; }
    $("dlogin").hidden = true;
    me = BB.user(session).id;
    if (started) return;
    started = true;
    reload();
  });
  addEventListener("hashchange", pick);
})();
