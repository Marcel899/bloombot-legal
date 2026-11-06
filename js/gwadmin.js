/* Giveaway manager: only the site owner (public.site_owners) can use it. Supabase checks every call. */
(() => {
  const $ = id => document.getElementById(id);
  const { el } = BB;
  let rows = [], editing = null, busy = false, started = false, blocks = [];
  const PTS = [
    ["join", "Join", "gift", 1], ["trade_ad", "Live trade ad", "trading", 4], ["strategy", "Share a strategy", "bullseye", 3],
    ["server_link", "Private server link", "gear", 1], ["in_server", "Join the Bloombot Discord", "envelope", 0], ["roblox", "Verify Roblox", "shield", 0],
  ];
  const REQ_BOX = [["in_server", "Be in the Bloombot Discord server"], ["roblox", "Have a verified Roblox account"], ["trade_ad", "Have a live trade ad"]];
  const REQ_NUM = [["min_level", "Bloombot level at least", 200], ["discord_days", "Discord account age (days)", 3650], ["bloombot_days", "Bloombot account age (days)", 3650]];
  const DEF = { entries: Object.fromEntries(PTS.map(p => [p[0], p[3]])), req: { in_server: false, roblox: false, trade_ad: false, min_level: 0, discord_days: 0, bloombot_days: 0 } };

  /* rule editor */
  (function buildRules() {
    $("gpts").replaceChildren(...PTS.map(([k, label, icon]) => {
      const row = el("label", "gwa-pt");
      const i = el("img"); i.src = `img/${icon}.png`; i.alt = ""; i.onerror = () => { i.style.visibility = "hidden"; };
      const n = el("input"); n.type = "number"; n.min = k === "join" ? 1 : 0; n.max = 25; n.step = 1; n.id = "gp_" + k; n.inputMode = "numeric";
      row.append(i, el("span", null, label), n);
      return row;
    }));
    const box = $("greq");
    REQ_BOX.forEach(([k, label]) => {
      const row = el("label", "gwa-chk");
      const c = el("input"); c.type = "checkbox"; c.id = "gr_" + k;
      row.append(c, el("span", null, label));
      box.append(row);
    });
    REQ_NUM.forEach(([k, label, max]) => {
      const row = el("label", "gwa-pt");
      const n = el("input"); n.type = "number"; n.min = 0; n.max = max; n.step = 1; n.id = "gr_" + k; n.inputMode = "numeric"; n.placeholder = "0";
      row.append(el("span", null, label), n);
      box.append(row);
    });
  })();
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, Math.round(Number(v) || 0)));
  function readRules() {
    const entries = {}, req = {};
    PTS.forEach(([k]) => { entries[k] = clamp($("gp_" + k).value, k === "join" ? 1 : 0, 25); });
    REQ_BOX.forEach(([k]) => { req[k] = $("gr_" + k).checked; });
    REQ_NUM.forEach(([k, , max]) => { req[k] = clamp($("gr_" + k).value, 0, max); });
    return { entries, req };
  }
  function setRules(r) {
    const e = { ...DEF.entries, ...((r && r.entries) || {}) }, q = { ...DEF.req, ...((r && r.req) || {}) };
    PTS.forEach(([k]) => { $("gp_" + k).value = e[k]; });
    REQ_BOX.forEach(([k]) => { $("gr_" + k).checked = !!q[k]; });
    REQ_NUM.forEach(([k]) => { $("gr_" + k).value = q[k] || ""; });
  }
  function ruleText(r) {
    const e = { ...DEF.entries, ...((r && r.entries) || {}) }, q = { ...DEF.req, ...((r && r.req) || {}) };
    const out = [];
    REQ_BOX.forEach(([k, label]) => { if (q[k]) out.push(label.replace(/^Be in the |^Have /, "")); });
    if (q.min_level) out.push("Level " + q.min_level + "+");
    if (q.discord_days) out.push("Discord " + q.discord_days + "d+");
    if (q.bloombot_days) out.push("Bloombot " + q.bloombot_days + "d+");
    const tasks = PTS.filter(([k]) => e[k] > 0).map(([k, label]) => `${label} +${e[k]}`);
    return { req: out, tasks };
  }

  function tab(name, focus) {
    document.querySelectorAll("#gtabs [role=tab]").forEach(b => { const on = b.dataset.tab === name; b.setAttribute("aria-selected", String(on)); b.tabIndex = on ? 0 : -1; b.classList.toggle("on", on); if (on && focus) b.focus(); });
    document.querySelectorAll("#gmain [data-pane]").forEach(p => { p.hidden = p.dataset.pane !== name; });
    try { history.replaceState(null, "", name === "list" ? location.pathname + location.search : "#" + name); } catch (e) { /* ignore */ }
  }
  $("gtabs").onclick = e => { const b = e.target.closest("[role=tab]"); if (b) tab(b.dataset.tab); };
  $("gtabs").onkeydown = e => {
    const all = [...document.querySelectorAll("#gtabs [role=tab]")], i = all.indexOf(document.activeElement);
    if (i < 0 || !/^(ArrowLeft|ArrowRight|Home|End)$/.test(e.key)) return;
    e.preventDefault();
    const n = e.key === "Home" ? 0 : e.key === "End" ? all.length - 1 : (i + (e.key === "ArrowRight" ? 1 : -1) + all.length) % all.length;
    tab(all[n].dataset.tab, true);
  };
  const show = id => ["glogin", "gnope", "gloading", "gmain"].forEach(k => { $(k).hidden = k !== id; });
  const pad = n => String(n).padStart(2, "0");
  const local = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const nice = t => new Date(t).toLocaleString(undefined, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  const errText = e => (e && e.message && !/not allowed/.test(e.message) ? e.message : "Couldn't save. Try again.");

  function left(t) {
    const s = Math.floor((new Date(t) - Date.now()) / 1000);
    if (s <= 0) return "Ended";
    const d = Math.floor(s / 86400), h = Math.floor(s % 86400 / 3600), m = Math.floor(s % 3600 / 60);
    return "Ends in " + (d ? `${d}d ${h}h` : h ? `${h}h ${m}m` : `${m}m`);
  }

  function preview() {
    $("gpt").textContent = $("gt").value.trim() || "Prize";
    $("gps").textContent = $("gs").value.trim();
    const u = BB.safeUrl($("gi").value.trim());
    $("gpi").src = u || "img/gift.png";
    $("gpe").textContent = $("ge").value ? left(new Date($("ge").value)) : "";
  }
  $("gpi").onerror = () => { $("gpi").src = "img/gift.png"; };

  function fill(g) {
    editing = g ? g.id : null;
    $("gt").value = g ? g.title : "";
    $("gs").value = g ? g.subtitle || "" : "";
    $("gi").value = g ? g.image_url || "" : "";
    $("ge").value = local(g ? new Date(g.ends_at) : new Date(Date.now() + 7 * 864e5));
    setRules(g ? g.rules : null);
    $("gform-h").textContent = g ? "Edit giveaway" : "New giveaway";
    $("gform-sub").textContent = g ? "Changes show up in the popup right away." : "It shows up in the popup on every page as soon as you save.";
    $("gsave").textContent = g ? "Save changes" : "Start giveaway";
    $("gcancel").hidden = !g;
    $("gtab-ft").textContent = g ? "Editing: " + (g.title.length > 18 ? g.title.slice(0, 17) + "…" : g.title) : "New giveaway";
    preview();
  }

  async function load() {
    const { data, error } = await BB.sb.rpc("gw_admin_list");
    if (error) throw error;
    rows = data || [];
    $("gcnt").textContent = rows.length || "";
    list();
  }

  function state(g) {
    if (g.winner_id) return ["won", "Winner picked"];
    if (new Date(g.ends_at) > Date.now()) return ["live", "Live"];
    return ["ended", "Ended, no winner yet"];
  }

  async function act(btn, ask, fn, okTitle) {
    if (busy) return;
    if (ask && !await BB.confirm(ask)) return;
    busy = true;
    const was = btn.textContent;
    btn.disabled = true;
    const t = BB.toast("Working…", "wait", { title: okTitle });
    try {
      const msg = await fn();
      t.update(msg, "ok", { title: okTitle });
      await load();
    } catch (e) {
      t.update(errText(e), "bad", { title: "Didn't work" });
      btn.disabled = false; btn.textContent = was;
    }
    busy = false;
  }

  async function entrants(g, box, btn) {
    if (!box.hidden) { box.hidden = true; btn.textContent = "Entrants"; return; }
    btn.disabled = true;
    const { data, error } = await BB.sb.rpc("gw_admin_entrants", { gid: g.id });
    btn.disabled = false;
    if (error) { BB.toast(errText(error), "bad", { title: "Entrants" }); return; }
    btn.textContent = "Hide entrants";
    box.hidden = false;
    const tot = (data || []).reduce((n, r) => n + Number(r.entries), 0) || 1;
    box.replaceChildren(...(data || []).map(r => {
      const row = el("div", "gwa-er" + (r.blocked ? " blocked" : ""));
      const who = el("a", "gwa-en", r.name || r.discord_id); who.href = "profile.html?id=" + encodeURIComponent(r.discord_id);
      const age = Math.floor((Date.now() - new Date(r.discord_created)) / 864e5);
      const info = el("span", "gwa-ei", `${r.entries} entries · ${(r.entries / tot * 100).toFixed(1)}% · Discord ${age < 30 ? age + "d" : Math.floor(age / 30) + "mo"} old`);
      if (age < 30) info.classList.add("young");
      row.append(who, info);
      if (r.blocked) row.append(el("span", "gwa-st", "Blocked"));
      else {
        const k = el("button", "gwa-copy", "Block"); k.type = "button";
        k.onclick = () => block(r.discord_id, r.name, "");
        row.append(k);
      }
      return row;
    }));
  }

  async function block(did, name, why) {
    if (!await BB.confirm({ title: "Block " + (name || did) + "?", text: "They can't join any giveaway and lose their entries in running ones.", ok: "Block" })) return;
    const t = BB.toast("Blocking…", "wait", { title: "Block" });
    const { error } = await BB.sb.rpc("gw_admin_block", { did, why: why || "" });
    if (error) { t.update(errText(error), "bad", { title: "Didn't block" }); return false; }
    t.update((name || did) + " is blocked.", "ok", { title: "Blocked" });
    await Promise.all([load(), loadBlocks()]).catch(() => {});
    return true;
  }

  async function loadBlocks() {
    const { data, error } = await BB.sb.rpc("gw_admin_blocks");
    if (error) throw error;
    blocks = data || [];
    $("gbcnt").textContent = blocks.length || "";
    const box = $("gblocks");
    if (!blocks.length) { box.replaceChildren(el("p", "hint gwa-bh", "Nobody is blocked.")); return; }
    box.replaceChildren(...blocks.map(r => {
      const row = el("div", "panel gwa-er");
      const who = el("a", "gwa-en", r.name || r.discord_id); who.href = "profile.html?id=" + encodeURIComponent(r.discord_id);
      row.append(who, el("span", "gwa-ei", r.reason || "No reason"));
      const u = el("button", "gwa-copy", "Unblock"); u.type = "button";
      u.onclick = async () => {
        u.disabled = true;
        const { error: e } = await BB.sb.rpc("gw_admin_unblock", { did: r.discord_id });
        if (e) { u.disabled = false; BB.toast(errText(e), "bad", { title: "Didn't unblock" }); return; }
        BB.toast((r.name || r.discord_id) + " can join giveaways again.", "ok", { title: "Unblocked" });
        loadBlocks().catch(() => {});
      };
      row.append(u);
      return row;
    }));
  }
  $("gbform").onsubmit = async e => {
    e.preventDefault();
    const did = $("gbid").value.trim();
    if (!/^\d{15,21}$/.test(did)) { BB.toast("Paste a Discord user ID (only numbers).", "bad", { title: "Check the ID" }); $("gbid").focus(); return; }
    if (await block(did, null, $("gbwhy").value.trim())) { $("gbid").value = ""; $("gbwhy").value = ""; }
  };

  function list() {
    const box = $("glist");
    if (!rows.length) { box.replaceChildren(el("p", "panel gwa-empty", "No giveaways yet. Start one in New giveaway.")); return; }
    box.replaceChildren(...rows.map(g => {
      const [cls, label] = state(g);
      const card = el("article", "panel gwa-card " + cls);
      const pic = el("img", "gwa-pic"); pic.alt = ""; pic.src = BB.safeUrl(g.image_url) || "img/gift.png";
      pic.onerror = () => { pic.src = "img/gift.png"; };
      const body = el("div", "gwa-body");
      const top = el("div", "gwa-row");
      top.append(el("strong", "gwa-t", g.title), el("span", "gwa-st " + cls, label));
      body.append(top);
      if (g.subtitle) body.append(el("p", "gwa-sub", g.subtitle));
      const meta = el("div", "gwa-meta");
      meta.append(el("span", null, cls === "live" ? left(g.ends_at) : "Ended " + nice(g.ends_at)),
        el("span", null, `${Number(g.entrants).toLocaleString()} joined`),
        el("span", null, `${Number(g.entries).toLocaleString()} entries`));
      body.append(meta);
      const rt = ruleText(g.rules);
      const chips = el("div", "gwa-rules");
      rt.req.forEach(t => chips.append(el("span", "gwa-rq", t)));
      rt.tasks.forEach(t => chips.append(el("span", "gwa-tk", t)));
      body.append(chips);
      if (g.winner_id) {
        const w = el("div", "gwa-win");
        const a = el("a", null, g.winner_name || g.winner_id);
        a.href = "profile.html?id=" + encodeURIComponent(g.winner_id);
        w.append(el("span", null, "Winner: "), a);
        const c = el("button", "gwa-copy", "Copy ID"); c.type = "button";
        c.onclick = () => BB.copy(g.winner_id, "Winner ID copied");
        w.append(c);
        body.append(w);
      }
      const btns = el("div", "gwa-btns");
      const b = (text, kind, fn) => { const x = el("button", "brick sm " + kind, text); x.type = "button"; x.onclick = () => fn(x); btns.append(x); return x; };
      const ent = el("div", "gwa-ent"); ent.hidden = true;
      if (Number(g.entrants)) b("Entrants", "dark", x => entrants(g, ent, x));
      b("Edit", "dark", () => { fill(g); tab("form"); $("gtabs").scrollIntoView({ behavior: "smooth", block: "nearest" }); $("gt").focus({ preventScroll: true }); });
      if (cls === "live") b("End now", "dark", x => act(x, { title: "End this giveaway?", text: `"${g.title}" stops taking entries now. You can pick a winner after.`, ok: "End now" }, async () => {
        const { error } = await BB.sb.rpc("gw_admin_end", { gid: g.id }); if (error) throw error; return "Giveaway ended.";
      }, "Giveaway ended"));
      if (Number(g.entrants)) b(g.winner_id ? "Reroll" : "Pick winner", g.winner_id ? "dark" : "green", x => act(x, { title: g.winner_id ? "Pick a new winner?" : "Pick a winner?", text: (cls === "live" ? "This ends the giveaway. " : "") + "More entries means a better chance.", ok: g.winner_id ? "Reroll" : "Pick winner" }, async () => {
        const { data, error } = await BB.sb.rpc("gw_admin_draw", { gid: g.id }); if (error) throw error;
        await load();
        const r = rows.find(o => o.id === g.id);
        return "Winner: " + ((r && r.winner_name) || data);
      }, "Winner picked"));
      b("Delete", "red", x => act(x, { title: "Delete giveaway?", text: `"${g.title}" and all its entries are removed. This can't be undone.` }, async () => {
        const { error } = await BB.sb.rpc("gw_admin_delete", { gid: g.id }); if (error) throw error;
        if (editing === g.id) fill(null);
        return "Giveaway deleted.";
      }, "Deleted"));
      body.append(btns, ent);
      card.append(pic, body);
      return card;
    }));
  }

  $("gform").onsubmit = async e => {
    e.preventDefault();
    if (busy) return;
    const title = $("gt").value.trim();
    const ends = $("ge").value ? new Date($("ge").value) : null;
    if (!title) { BB.toast("Give the prize a name.", "bad", { title: "Missing prize" }); $("gt").focus(); return; }
    if (!ends || isNaN(ends)) { BB.toast("Pick when it ends.", "bad", { title: "Missing end time" }); $("ge").focus(); return; }
    if (!editing && ends <= Date.now()) { BB.toast("The end time is in the past.", "bad", { title: "Check the end time" }); $("ge").focus(); return; }
    const img = $("gi").value.trim();
    if (img && !BB.safeUrl(img)) { BB.toast("The picture link must start with https://", "bad", { title: "Check the picture link" }); $("gi").focus(); return; }
    busy = true;
    const btn = $("gsave"); btn.disabled = true;
    const t = BB.toast("Saving…", "wait", { title: editing ? "Saving giveaway" : "Starting giveaway" });
    const { error } = await BB.sb.rpc("gw_admin_save", { gid: editing, p_title: title, p_subtitle: $("gs").value.trim(), p_image_url: img, p_ends_at: ends.toISOString(), p_rules: readRules() });
    busy = false; btn.disabled = false;
    if (error) { t.update(errText(error), "bad", { title: "Didn't save" }); return; }
    t.update(editing ? "Changes are live." : "It's live in the popup now.", "ok", { title: editing ? "Giveaway saved" : "Giveaway started" });
    fill(null);
    tab("list");
    load().catch(() => {});
  };
  $("gcancel").onclick = () => { fill(null); tab("list"); };
  ["gt", "gs", "gi", "ge"].forEach(id => $(id).addEventListener("input", preview));
  $("gquick").onclick = e => {
    const h = e.target.closest("button[data-h]");
    if (h) { $("ge").value = local(new Date(Date.now() + h.dataset.h * 36e5)); preview(); }
  };
  setInterval(() => { if (!$("gmain").hidden) preview(); }, 30000);

  BB.onAuth(async s => {
    if (!BB.sb) return;
    if (!s) { started = false; show("glogin"); return; }
    if (started) return;
    started = true;
    show("gloading");
    const { data: ok, error } = await BB.sb.rpc("is_site_owner");
    if (error || !ok) { show("gnope"); return; }
    fill(null);
    show("gmain");
    tab(/^#(form|blocks)$/.test(location.hash) ? location.hash.slice(1) : "list");
    loadBlocks().catch(() => {});
    try { await load(); } catch (e) { BB.toast("Couldn't load giveaways. Refresh to try again.", "bad", { title: "Giveaways" }); }
  });
})();
