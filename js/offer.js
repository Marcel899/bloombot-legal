/* Trade offers ("Make an offer"): a small calculator dialog that sends a structured
   offer as a Bloombot message, and the offer card shown in chats with Accept /
   Counter / Decline. Saved through dm_offer_send / dm_offer_respond (sql/offers.sql).
   Used on trades.html (button on each ad) and messages.html (cards, counters). */
(() => {
  const { el } = BB;
  const FAIR = 0.05;              // same as the trade calculator
  const MAX = 15;
  const ERR = {
    "dm:login": "Log in to make offers.",
    "dm:banned": "You can't send messages right now.",
    "dm:profile": "Create your Bloombot account first.",
    "dm:no_user": "This trader isn't on Bloombot yet.",
    "dm:you_blocked": "You blocked this trader. Unblock them first.",
    "dm:closed": "This trader isn't taking new messages.",
    "dm:verified_only": "This trader only takes new chats from verified Roblox accounts.",
    "dm:wait_reply": "Wait for a reply before sending more.",
    "dm:slow": "Slow down a little.",
    "dm:new_limit": "You started a lot of new chats today. Try again tomorrow.",
    "dm:duplicate": "You just sent that offer.",
    "dm:bad_offer": "One of those units isn't on the value list.",
    "dm:offer_gone": "That offer was already answered.",
    "dm:not_found": "That offer is gone.",
    "dm:bad_word": "That breaks the chat rules.",
  };
  const codeOf = e => (String((e && e.message) || e || "").match(/dm:[a-z_]+/) || [])[0];
  BB.offerError = e => ERR[codeOf(e)] || "Something went wrong. Try again.";

  let vals = null, byName = new Map(), byIcon = new Map(), nameRe = null;
  const esc = t => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  async function load() {
    if (vals) return vals;
    vals = (await BB.loadValues()).filter(v => v.name && v.category !== "gamepasses");
    vals.forEach(v => {
      byName.set(v.name.toLowerCase(), v);
      const id = (String(v.icon_url || "").match(/emojis\/(\d{15,22})/) || [])[1];
      if (id) byIcon.set(id, v);
    });
    const names = [...byName.keys()].sort((a, b) => b.length - a.length).map(esc);
    nameRe = new RegExp("(?<![a-z0-9])(?:(\\d{1,3})\\s*x\\s*)?(" + names.join("|") + ")s?(?:\\s*x\\s*(\\d{1,3}))?(?![a-z0-9])", "gi");
    return vals;
  }
  /* The units mentioned in a piece of text (unit emojis or names), with amounts. */
  function units(text) {
    const got = new Map();
    const add = (it, q) => { const r = got.get(it.name) || { item: it, qty: 0 }; r.qty = Math.min(999, r.qty + Math.max(1, parseInt(q) || 1)); got.set(it.name, r); };
    const rest = String(text || "").replace(/(?:(\d{1,3})\s*x\s*)?<a?:(\w{2,32}):(\d{15,22})>(?:\s*x\s*(\d{1,3}))?/gi, (m, q1, nm, id, q2) => {
      const it = byIcon.get(id) || byName.get(nm.replace(/_/g, " ").toLowerCase());
      if (it) add(it, q1 || q2);
      return " ";
    });
    if (nameRe) rest.replace(nameRe, (m, q1, nm, q2) => { const it = byName.get(nm.toLowerCase()); if (it) add(it, q1 || q2); return " "; });
    return [...got.values()];
  }
  /* A trade ad's two sides: what the poster has (you'd get) and what they want (you'd give).
     "Trading X for Y", "X for offers", "Trading X LF Y NLF Z" (NLF is ignored). */
  BB.adSides = async content => {
    await load();
    const t = String(content || "").replace(/\*\*|__/g, "");
    const lf = t.search(/\b(?:LF|looking for)\b/i);
    if (lf >= 0) {
      const after = t.slice(lf).replace(/^\S+(?:\s+for)?/i, "");
      const nlf = after.search(/\bNLF\b/i);
      return { have: units(t.slice(0, lf)), want: units(nlf >= 0 ? after.slice(0, nlf) : after) };
    }
    const m = t.match(/^(.*?)\s+for\s+(.*)$/is);
    if (m) return { have: units(m[1]), want: units(m[2]) };
    return { have: units(t), want: [] };
  };

  const total = side => side.reduce((n, r) => n + (r.item.est > 0 ? r.item.est * r.qty : 0), 0);
  /* Verdict for whoever is reading: giving g, getting r. */
  function verdict(g, r) {
    if (!(g > 0) || !(r > 0)) return null;
    const share = (r - g) / g, pct = Math.round(Math.abs(share) * 100);
    const kind = Math.abs(share) <= FAIR ? "fair" : share > 0 ? "win" : "lose";
    return { kind, pct, text: kind === "fair" ? "Fair trade" : kind === "win" ? "Win for you · +" + pct + "%" : "Loss for you · −" + pct + "%" };
  }
  const toRows = list => (list || []).map(x => ({ item: byName.get(String(x.name).toLowerCase()) || { name: x.name, est: 0 }, qty: x.qty || 1 }));

  /* ── the dialog ── */
  BB.offerDialog = async ({ to, name, give = [], get = [], replyTo = null, ad = null, onSent } = {}) => {
    if (!BB.session) { BB.login(); return; }
    if (!BB.user(BB.session).id) { BB.requireDiscord(); return; }
    try { await load(); } catch (e) { BB.toast("Couldn't load values. Try again in a minute.", "bad"); return; }
    const who = BB.plain(name || "") || "this trader";
    const sides = { give: give.map(r => ({ ...r })), get: get.map(r => ({ ...r })) };
    const back = el("div", "wm-back");
    const box = el("form", "wm panel of-dlg");
    box.setAttribute("role", "dialog");
    box.setAttribute("aria-modal", "true");
    box.setAttribute("aria-labelledby", "of-h");
    const opener = document.activeElement;
    const close = () => { back.remove(); document.removeEventListener("keydown", esc2); if (opener && opener.focus) opener.focus({ preventScroll: true }); };
    const esc2 = e => { if (e.key === "Escape" && !box.querySelector(".sugs:not([hidden])")) close(); };
    document.addEventListener("keydown", esc2);
    back.onclick = e => { if (e.target === back) close(); };

    const head = el("div", "of-head");
    const hi = el("span", "of-hi"); const hii = el("img"); hii.src = "img/swap.png"; hii.alt = ""; hi.append(hii);
    const ht = el("div");
    const h = el("h2", null, replyTo ? "Counter offer" : "Make an offer"); h.id = "of-h";
    ht.append(h, el("p", null, "To " + who + " · sent as a Bloombot message"));
    const x = el("button", "dms-x"); x.type = "button"; x.setAttribute("aria-label", "Close");
    x.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path stroke="currentColor" stroke-width="2.6" stroke-linecap="round" d="M7 7l10 10M17 7 7 17"/></svg>';
    x.onclick = close;
    head.append(hi, ht, x);

    const cols = el("div", "of-cols");
    const vbox = el("div", "of-verdict");
    const send = el("button", "brick green of-send", replyTo ? "Send counter offer" : "Send offer");
    send.type = "submit";
    const draw = {};
    const sideBox = (key, title) => {
      const col = el("section", "of-side " + key);
      const top = el("div", "of-st");
      const sum = el("span", "of-sum");
      top.append(el("h3", null, title), sum);
      const list = el("div", "of-list");
      const pick = el("div", "of-find");
      const inp = el("input", "of-q");
      inp.type = "search"; inp.placeholder = "Add a unit…"; inp.autocomplete = "off";
      inp.setAttribute("aria-label", title + ": add a unit");
      const sug = el("div", "sugs"); sug.hidden = true;
      pick.append(inp, sug);
      col.append(top, list, pick);
      let opts = [], idx = 0;
      const drawSug = () => {
        sug.replaceChildren(...opts.map((it, i) => {
          const o = el("button", "sug" + (i === idx ? " on" : "")); o.type = "button";
          o.append(BB.itemImg(it, "sug-img"), el("span", null, it.name), el("em", null, it.est > 0 ? BB.fmt(it.est) : (it.value_text || "N/A")));
          o.onmousedown = e => { e.preventDefault(); choose(it); };
          return o;
        }));
        sug.hidden = !opts.length;
      };
      const choose = it => {
        const have = sides[key].find(r => r.item.name === it.name);
        if (have) have.qty = Math.min(999, have.qty + 1);
        else if (sides[key].length >= MAX) { BB.toast("Up to " + MAX + " different units per side.", "info"); return; }
        else sides[key].push({ item: it, qty: 1 });
        inp.value = ""; opts = []; drawSug(); update(); inp.focus();
      };
      inp.oninput = () => {
        const s = inp.value.trim().toLowerCase();
        opts = s ? vals.filter(v => v.name.toLowerCase().includes(s)).sort((a, b) => (b.name.toLowerCase().startsWith(s) - a.name.toLowerCase().startsWith(s)) || b.est - a.est).slice(0, 7) : [];
        idx = 0; drawSug();
      };
      inp.onkeydown = e => {
        if (e.key === "ArrowDown") { idx = Math.min(idx + 1, opts.length - 1); drawSug(); e.preventDefault(); }
        else if (e.key === "ArrowUp") { idx = Math.max(idx - 1, 0); drawSug(); e.preventDefault(); }
        else if (e.key === "Enter") { if (opts[idx]) choose(opts[idx]); e.preventDefault(); }
        else if (e.key === "Escape" && opts.length) { opts = []; drawSug(); e.stopPropagation(); }
      };
      inp.onblur = () => setTimeout(() => { opts = []; drawSug(); }, 120);
      draw[key] = () => {
        list.replaceChildren(...sides[key].map((r, i) => {
          const row = el("div", "of-row");
          const q = el("div", "col-qty");
          const mi = el("button", "col-qb", "−"); mi.type = "button"; mi.setAttribute("aria-label", "One less " + r.item.name);
          const qn = el("span", "of-qn", String(r.qty));
          const pl = el("button", "col-qb", "+"); pl.type = "button"; pl.setAttribute("aria-label", "One more " + r.item.name);
          mi.onclick = () => { if (r.qty > 1) r.qty--; else sides[key].splice(i, 1); update(); };
          pl.onclick = () => { r.qty = Math.min(999, r.qty + 1); update(); };
          q.append(mi, qn, pl);
          const t = el("span", "of-rt");
          t.append(el("strong", null, r.item.name), el("span", null, r.item.est > 0 ? BB.fmt(r.item.est * r.qty) : "No value"));
          row.append(BB.itemImg(r.item, "of-img"), t, q);
          return row;
        }));
        if (!sides[key].length) list.append(el("p", "of-empty", key === "give" ? "What you'll give" : "What you want from " + who));
        sum.textContent = sides[key].length ? BB.fmt(total(sides[key])) : "";
      };
      return col;
    };
    cols.append(sideBox("give", "You give"), el("span", "of-arrow", "⇄"), sideBox("get", "You get"));
    const update = () => {
      draw.give(); draw.get();
      const v = verdict(total(sides.give), total(sides.get));
      vbox.className = "of-verdict" + (v ? " " + v.kind : "");
      vbox.replaceChildren();
      if (v) {
        const i = el("img"); i.src = "img/" + v.kind + ".png"; i.alt = "";
        vbox.append(i, el("strong", null, v.text), el("span", null, "You give " + BB.fmt(total(sides.give)) + " · you get " + BB.fmt(total(sides.get))));
      } else vbox.append(el("span", null, "Add units to both sides to see if it's fair."));
      send.disabled = !sides.give.length || !sides.get.length;
    };
    box.onsubmit = async e => {
      e.preventDefault();
      if (send.disabled) return;
      send.disabled = true;
      const pack = side => sides[side].map(r => ({ name: r.item.name, qty: r.qty }));
      const { data, error } = await BB.sb.rpc("dm_offer_send", { p_to: to, p_give: pack("give"), p_get: pack("get"), p_reply_to: replyTo, p_ad: ad });
      if (error || (data && data.error)) {
        send.disabled = false;
        BB.toast(error ? BB.offerError(error) : ERR["dm:" + data.error] || "That breaks the chat rules.", "bad", { title: "Offer not sent" });
        return;
      }
      close();
      if (onSent) onSent(data);
      else BB.toast("Sent to " + who + ".", "ok", { title: "Offer sent", action: { label: "Open chat", run: () => { location.href = "messages.html?to=" + encodeURIComponent(to); } } });
    };
    box.append(head, cols, vbox, send);
    back.append(box);
    document.body.append(back);
    update();
    setTimeout(() => box.querySelector(sides.give.length ? ".get .of-q" : ".give .of-q").focus(), 60);
  };

  /* ── the card in a chat ── */
  const STATUS = { open: "Waiting", accepted: "Accepted", declined: "Declined", countered: "Countered", withdrawn: "Withdrawn" };
  BB.offerCard = (m, { name, onChange, onCounter } = {}) => {
    const o = m.offer || {};
    const card = el("div", "of-card st-" + (o.status || "open"));
    const box = el("div");
    card.append(box);
    const render = () => {
      const mineGive = toRows(m.from_me ? o.give : o.get), mineGet = toRows(m.from_me ? o.get : o.give);
      const head = el("div", "of-ch");
      const ic = el("img"); ic.src = "img/swap.png"; ic.alt = "";
      head.append(ic, el("strong", null, o.reply_to ? "Counter offer" : "Trade offer"), el("span", "of-pill " + o.status, STATUS[o.status] || o.status));
      const side = (title, rows) => {
        const s = el("div", "of-cs");
        s.append(el("em", null, title));
        const l = el("div", "of-cl");
        rows.forEach(r => {
          const u = el("span", "of-cu");
          u.title = r.item.name + (r.qty > 1 ? " ×" + r.qty : "");
          u.append(BB.itemImg(r.item, null), el("span", null, (r.qty > 1 ? r.qty + "× " : "") + r.item.name));
          l.append(u);
        });
        s.append(l, el("b", null, BB.fmt(total(rows))));
        return s;
      };
      const body = el("div", "of-cb");
      body.append(side("You give", mineGive), side("You get", mineGet));
      const v = verdict(total(mineGive), total(mineGet));
      const parts = [head, body];
      if (v) { const vv = el("div", "of-cv " + v.kind); vv.textContent = v.text; parts.push(vv); }
      if (o.status === "open") {
        const acts = el("div", "of-ca");
        const act = async (action, label) => {
          acts.querySelectorAll("button").forEach(b => { b.disabled = true; });
          const { data, error } = await BB.sb.rpc("dm_offer_respond", { p_id: m.id, p_action: action });
          if (error) { BB.toast(BB.offerError(error), "bad"); acts.querySelectorAll("button").forEach(b => { b.disabled = false; }); return; }
          o.status = data.status;
          card.className = "of-card st-" + o.status;
          render();
          BB.toast(label, "ok");
          if (onChange) onChange(m);
        };
        if (!m.from_me) {
          const a = el("button", "brick green sm", "Accept"); a.type = "button"; a.onclick = () => act("accept", "Offer accepted. Meet in game to trade.");
          const c = el("button", "brick blue sm", "Counter"); c.type = "button";
          c.onclick = () => onCounter ? onCounter(m, mineGive, mineGet) : null;
          const d = el("button", "brick dark sm", "Decline"); d.type = "button"; d.onclick = () => act("decline", "Offer declined.");
          acts.append(a, c, d);
        } else {
          acts.append(el("span", "of-wait", "Waiting for " + (BB.plain(name || "") || "them") + " to answer"));
          const w = el("button", "of-link", "Withdraw"); w.type = "button"; w.onclick = () => act("withdraw", "Offer withdrawn.");
          acts.append(w);
        }
        parts.push(acts);
      } else if (o.status === "accepted") {
        parts.push(el("p", "of-note", "Trade it in game. Never go first with someone you don't trust."));
      }
      box.replaceChildren(...parts);
    };
    if (vals) render();
    else { box.append(el("p", "of-note", "Loading offer…")); load().then(render).catch(() => {}); }
    return card;
  };
  BB.offerLoad = load;
})();
