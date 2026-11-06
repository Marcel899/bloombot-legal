/* Giveaway manager: only the site owner (public.site_owners) can use it. Supabase checks every call. */
(() => {
  const $ = id => document.getElementById(id);
  const { el } = BB;
  let rows = [], editing = null, busy = false, started = false;

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
    $("gform-h").textContent = g ? "Edit giveaway" : "New giveaway";
    $("gform-sub").textContent = g ? "Changes show up in the popup right away." : "It shows up in the popup on every page as soon as you save.";
    $("gsave").textContent = g ? "Save changes" : "Start giveaway";
    $("gcancel").hidden = !g;
    preview();
  }

  async function load() {
    const { data, error } = await BB.sb.rpc("gw_admin_list");
    if (error) throw error;
    rows = data || [];
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

  function list() {
    const box = $("glist");
    if (!rows.length) { box.replaceChildren(el("p", "panel gwa-empty", "No giveaways yet. Start one with the form.")); return; }
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
      b("Edit", "dark", () => { fill(g); $("gform").scrollIntoView({ behavior: "smooth", block: "start" }); $("gt").focus({ preventScroll: true }); });
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
      body.append(btns);
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
    const { error } = await BB.sb.rpc("gw_admin_save", { gid: editing, p_title: title, p_subtitle: $("gs").value.trim(), p_image_url: img, p_ends_at: ends.toISOString() });
    busy = false; btn.disabled = false;
    if (error) { t.update(errText(error), "bad", { title: "Didn't save" }); return; }
    t.update(editing ? "Changes are live." : "It's live in the popup now.", "ok", { title: editing ? "Giveaway saved" : "Giveaway started" });
    fill(null);
    load().catch(() => {});
  };
  $("gcancel").onclick = () => fill(null);
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
    try { await load(); } catch (e) { BB.toast("Couldn't load giveaways. Refresh to try again.", "bad", { title: "Giveaways" }); }
  });
})();
