/* Profiles: anyone's linked account, live trade ads and strategies; your own settings. */
(() => {
  const $ = id => document.getElementById(id);
  const { el } = BB;
  const want = new URLSearchParams(location.search).get("id");
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
    const top = el("div", "p-top");
    const avs = el("div", "p-avs");
    avs.append(img(p && p.discord_avatar, "p-av"));
    if (p && p.roblox_avatar) avs.append(img(p.roblox_avatar, "p-rav"));
    const who = el("div", "p-who");
    who.append(el("h1", null, (p && p.discord_name) || fallbackName || "Bloombot player"));
    const tags = el("div", "p-tags");
    if (p && p.level) tags.append(el("span", "p-tag lvl", "Level " + p.level));
    if (p && p.registered_at) tags.append(el("span", "p-tag", "Joined " + since(p.registered_at)));
    if (isMe) tags.append(el("span", "p-tag you", "You"));
    who.append(tags);
    top.append(avs, who);
    c.append(top);
    if (p && p.description) {
      const d = BB.md(p.description, { cls: "p-desc" });
      c.append(d);
    }
    const acc = el("div", "p-accs");
    const pill = (kind, label, name, href) => {
      const a = el(href ? "a" : "span", "acc " + kind);
      if (href) { a.href = href; a.target = "_blank"; a.rel = "noopener nofollow"; }
      const t = el("span", "acc-t");
      t.append(el("em", null, label), el("strong", null, name));
      a.append(t);
      return a;
    };
    const did = p ? p.discord_id : want;
    if (did && !isMe) acc.append(pill("discord", "Discord", "Message", "https://discord.com/users/" + did));
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
    }
    const share = el("button", "brick dark sm", "Copy link");
    share.type = "button";
    share.onclick = () => BB.share(location.origin + location.pathname.replace(/[^/]*$/, "profile.html") + "?id=" + did, "Bloombot profile");
    acts.append(share);
    c.append(acts);
    c.hidden = false;
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
    const c = el("article", "tcard");
    const foot = el("div", "tc-foot");
    const head = el("div", "tc-who");
    head.append(el("span", null, BB.ago(a.created_at)));
    foot.append(head);
    if (own) foot.append(delBtn("trade_ad", a.id, "Delete this trade ad", a.discord_id));
    c.append(BB.md(a.content, { cls: "tc-text" }), foot);
    return c;
  }
  function stratCard(s, own, did) {
    const c = el("a", "hs");
    c.href = "strategies.html#s-" + s.id;
    const t = el("strong");
    BB.mdInline(t, s.title);
    c.append(t, el("span", null, (s.category || "").replace("-", " ")));
    if (!own) return c;
    const row = el("div", "hs-row");
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
  let orig = { u: "", l: "", d: "" }, touched = {};
  const vals = () => ({ u: $("fu").value.trim(), l: $("fl").value.trim(), d: $("fd").value.trim() });
  const dirty = () => { const v = vals(); return v.u !== orig.u || v.l !== orig.l || v.d !== orig.d; };
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
    orig = { u: (mine && mine.roblox_name) || "", l: (priv && priv.server_link) || "", d: (mine && mine.description) || "" };
    $("fu").value = orig.u;
    $("fl").value = orig.l;
    $("fd").value = orig.d;
    touched = {};
    preview(false);
    $("pdanger").hidden = !mine;
    $("pclose").hidden = !mine;
    $("pcancel").hidden = !mine;
    status("", "");
    check();
    $("pedit").scrollIntoView({ block: "start", behavior: "smooth" });
    setTimeout(() => $("fu").focus({ preventScroll: true }), 250);
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
      isMe ? BB.sb.from("profile_private").select("server_link").eq("discord_id", did).maybeSingle() : Promise.resolve({ data: null }),
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
    lists(did);
  }

  BB.onAuth(session => {
    if (!session) { $("ploading").hidden = true; $("plogin").hidden = false; $("pcard").hidden = true; $("pedit").hidden = true; return; }
    $("plogin").hidden = true;
    const id = BB.user(session).id;
    if (started && id === me) return;
    me = id; started = true;
    load();
  });
  addEventListener("hashchange", () => { if (location.hash === "#edit" && me && (!want || want === me)) openEdit(); });
})();
