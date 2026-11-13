/* Messages: private chats between traders.
   Every read and write goes through the dm_* functions in Supabase, which check
   who you are from your login and enforce the chat rules (no bad words, no links
   except Bloombot's). Pictures are re-drawn in the browser (strips location data
   and anything hidden in the file) and go to a private bucket. */
(() => {
  const $ = id => document.getElementById(id);
  const { el } = BB;
  const BUCKET = "dm-images";
  const MAX_LEN = 2000;
  const RULES_MSG = "That message breaks the chat rules. Rewrite it and try again.";
  const ERR = {
    "dm:login": "Log in to send messages.",
    "dm:banned": "You can't send messages right now.",
    "dm:profile": "Finish setting up your account first.",
    "dm:bad_user": "That user doesn't exist.",
    "dm:no_user": "This trader isn't on Bloombot yet.",
    "dm:self": "You can't message yourself.",
    "dm:too_long": "Keep it under 2,000 characters.",
    "dm:empty": "Type a message first.",
    "dm:bad_image": "That picture didn't upload. Try again.",
    "dm:image_wait": "Pictures unlock once they reply.",
    "dm:you_blocked": "You blocked this trader. Unblock them to send a message.",
    "dm:closed": "This trader isn't taking new messages.",
    "dm:slow": "Slow down a little.",
    "dm:wait_reply": "Wait for a reply before sending more.",
    "dm:new_limit": "You started a lot of new chats today. Try again tomorrow.",
    "dm:duplicate": "You just sent that.",
    "dm:not_found": "That message is gone.",
    "dm:bad_word": RULES_MSG,
    "dm:link": "Only Bloombot links can be sent.",
  };
  const NOTE = {
    you_blocked: "You blocked this trader.",
    closed: "This trader isn't taking new messages.",
    wait_reply: "You can send more once they reply.",
    no_user: "This trader isn't on Bloombot yet.",
    self: "This is you.",
    bad_user: "That user doesn't exist.",
  };
  const codeOf = e => (String((e && e.message) || e || "").match(/dm:[a-z_]+/) || [])[0];
  const errText = e => ERR[codeOf(e)] || "Something went wrong. Try again.";
  const rpc = async (fn, args) => {
    const { data, error } = await BB.sb.rpc(fn, args || {});
    if (error) throw error;
    return data;
  };
  const store = {
    get(k, d) { try { return JSON.parse(localStorage.getItem(k)) || d; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage blocked */ } },
  };

  let me = null, started = false, wired = false;
  let inbox = [], inboxLoaded = false, cur = null, curInfo = null, canSend = "ok";
  let msgs = [], oldest = null, newest = 0, noMore = false, loadingOld = false;
  let firstUnread = null, missed = 0;
  let pending = null;           // { blob, ext, url }
  let busy = false;
  const signed = new Map();     // path -> { url, exp }

  /* ── emojis ──────────────────────────────────────────────── */
  const BB_EMOJI = ["bloombot", "win", "lose", "fair", "offer", "lf", "nlf", "any", "gem", "candy", "dollar", "cookie",
    "chart_up", "chart_down", "rise", "fall", "steady", "maybe_up", "maybe_down", "lightning", "bell", "thanks", "shield",
    "warning", "alert", "swap", "wish_star", "medal_gold", "medal_silver", "medal_bronze", "clock", "verified", "scale",
    "bullseye", "calculator", "envelope", "typing", "sleep", "drop", "swirl", "floating_island", "gear", "door", "health_plus"];
  const BB_SET = new Set(BB_EMOJI);
  const bbSrc = n => "img/e/" + n + ".webp";
  const UNICODE = [
    ["Smileys", "😀", "😀 😃 😄 😁 😆 😅 🤣 😂 🙂 😉 😊 😇 🥰 😍 🤩 😘 😋 😛 😜 🤪 😎 🤓 🧐 🤔 🤨 😐 😑 😶 🙄 😏 😬 😌 😔 😴 😷 🤒 🥵 🥶 😵 🤯 🥳 😕 😟 🙁 😮 😲 🥺 😢 😭 😱 😤 😡 💀 👻 🤖 😺 🙈"],
    ["Hands", "👍", "👍 👎 👌 🤌 ✌️ 🤞 🤝 🙏 👏 🙌 👐 🤲 👋 🤙 💪 👀 🫡 🫶 ✋ 👉 👈 👆 👇 ☝️ ✊ 👊"],
    ["Things", "🎁", "🔥 ✨ ⭐ 🌟 💫 💥 💯 💎 💰 💸 🪙 🎁 🎉 🎊 🏆 🥇 🥈 🥉 🎮 🕹️ ⚔️ 🛡️ 🏹 🔮 🧪 🌸 🌻 🌱 🍀 🍄 🌵 🌳 🐝 🦋 🐉 🍎 🍕 🍩 🍪 🍭 🎃 ❄️ ⚡ 🌈 ☀️ 🌙 ⏰ 📈 📉 📦 🔔 🔒 🔑 ✅ ❌ ⚠️ ❓ ❗ ➕ ➖ 🔁 💬 💤"],
    ["Hearts", "❤️", "❤️ 🧡 💛 💚 💙 💜 🖤 🤍 🤎 💔 ❣️ 💕 💞 💓 💗 💖 💘 💝"],
  ];
  /* Unit icons come from the value list. Only ids we know are ever shown. */
  const units = new Map();      // id -> { name, url }
  let unitsReady = null;
  const tokenName = n => String(n).replace(/[^A-Za-z0-9_]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 32) || "unit";
  function loadUnits() {
    if (!unitsReady) unitsReady = BB.loadUnits().then(list => {
      list.forEach(u => {
        const url = BB.safeUrl(u.icon_url) || BB.safeUrl(u.image_url) || (typeof u.image_url === "string" && u.image_url) || "";
        const id = (String(url).match(/(\d{15,22})/) || [])[1];
        if (id && !units.has(id)) units.set(id, { name: u.name, url });
      });
    }).catch(() => {});
    return unitsReady;
  }
  function emojiImg(src, name, cls = "dm-e") {
    const i = el("img", cls);
    i.src = src;
    i.alt = ":" + name + ":";
    i.title = name.replace(/_/g, " ");
    i.draggable = false;
    i.loading = "lazy";
    return i;
  }

  /* ── links: only Bloombot's own, shown as a named chip ───── */
  const SITE = /^(?:https?:\/\/)?(?:www\.)?bloombot-gtd\.vercel\.app(\/[^\s]*)?$/i;
  const INVITE = /^(?:https?:\/\/)?(?:www\.)?discord(?:app)?\.(?:gg|com\/invite)\/tGuXfcJxwf$/i;
  const PAGES = { "": "Bloombot", "index.html": "Bloombot", "values.html": "Values", "calculator.html": "Trade calculator",
    "trades.html": "Trade ads", "crates.html": "Crate calculator", "farm.html": "Farm calculator", "strategies.html": "Strategies",
    "levels.html": "Levels & perks", "features.html": "Features", "profile.html": "Profile", "messages.html": "Messages",
    "giveaway.html": "Giveaway", "dashboard.html": "Dashboard", "privacy.html": "Privacy", "terms.html": "Rules" };
  function chip(raw) {
    let href, label;
    if (INVITE.test(raw)) { href = "https://discord.gg/tGuXfcJxwf"; label = "Support server"; }
    else {
      const path = (raw.match(SITE) || [])[1] || "/";
      href = "https://bloombot-gtd.vercel.app" + path;
      let u;
      try { u = new URL(href); } catch (e) { return null; }
      const page = u.pathname.replace(/^\/+/, "").replace(/\/$/, "");
      label = PAGES[page] || PAGES[page + ".html"] || "Bloombot";
      if (/^profile/.test(page) && u.searchParams.get("id")) label = "Trader profile";
      href = u.href;
    }
    const a = el("a", "dm-chip");
    a.href = href;
    a.title = href;
    if (!href.startsWith(location.origin)) { a.target = "_blank"; a.rel = "noopener noreferrer"; }
    a.append(emojiImg(bbSrc("bloombot"), "bloombot", "dm-chip-i"), el("span", null, label));
    return a;
  }
  /* Same rule the server uses, so the warning shows before sending. */
  const TLD = "com|net|org|gg|io|xyz|ru|ly|tk|ml|ga|cf|gq|info|biz|cc|gl|eu|ws|su|vip|tv|uk|de|fr|ca|au|nl|pl|online|shop|store|site|app|dev|link|gift|gifts|click|top|club|live|codes|sh|gd|nu";
  const LINK_RES = [
    /[a-z][a-z0-9+.-]*:\/\//, /\bwww\s*\.\s*[a-z0-9]/, new RegExp("[a-z0-9-]\\.(?:" + TLD + ")\\b"),
    /[a-z0-9-]\s*(?:\(dot\)|\[dot\]|\sdot\s)\s*(?:com|net|org|gg|xyz|ru|io)\b/, /[a-z0-9-]\s+\.\s*(?:com|net|org|gg|xyz|ru)\b/,
    /\b(?:discord|dsc)\s*\.\s*gg\b/,
  ];
  function hasLink(t) {
    const s = String(t).toLowerCase()
      .replace(/(?:https?:\/\/)?(?:www\.)?bloombot-gtd\.vercel\.app(?:\/\S*)?/g, " ")
      .replace(/(?:https?:\/\/)?(?:www\.)?discord(?:app)?\.(?:gg|com\/invite)\/tguxfcjxwf\b/g, " ");
    return LINK_RES.some(r => r.test(s));
  }

  /* ── text with chips and emojis (never innerHTML) ────────── */
  const TOKENS = /((?:https?:\/\/)?(?:www\.)?bloombot-gtd\.vercel\.app(?:\/[^\s<>"']*[^\s<>"'.,:;!?)\]])?|(?:https?:\/\/)?(?:www\.)?discord(?:app)?\.(?:gg|com\/invite)\/tGuXfcJxwf\b|<a?:\w{2,32}:\d{15,22}>|:[a-z0-9_]{2,32}:)/gi;
  const ONLY_EMOJI = /^(?:\p{Extended_Pictographic}|\p{Emoji_Component}|‍|️|\s)*$/u;
  function inlineText(parent, text, { chips = true } = {}) {
    let count = 0, plain = "";
    String(text || "").split(TOKENS).forEach((part, i) => {
      if (!part) return;
      if (i % 2) {
        const unit = part.match(/^<a?:(\w{2,32}):(\d{15,22})>$/);
        const own = part.match(/^:([a-z0-9_]{2,32}):$/i);
        if (unit && units.has(unit[2])) { parent.append(emojiImg(units.get(unit[2]).url, unit[1])); count++; return; }
        if (unit) { parent.append(document.createTextNode(":" + unit[1] + ":")); plain += "x"; return; }
        if (own && BB_SET.has(own[1].toLowerCase())) { parent.append(emojiImg(bbSrc(own[1].toLowerCase()), own[1].toLowerCase())); count++; return; }
        if (!own && chips) { const c = chip(part); if (c) { parent.append(c); plain += "x"; return; } }
      }
      parent.append(document.createTextNode(part));
      plain += part;
    });
    return { count, plainOnlyEmoji: ONLY_EMOJI.test(plain) };
  }
  function richText(text) {
    const box = el("div", "dm-t");
    const r = inlineText(box, text);
    const uni = (String(text).match(/\p{Extended_Pictographic}/gu) || []).length;
    if (r.plainOnlyEmoji && r.count + uni > 0 && r.count + uni <= 4) box.classList.add("big");
    return box;
  }

  /* ── helpers ─────────────────────────────────────────────── */
  function avatar(src, cls) {
    const i = el("img", cls);
    i.alt = "";
    i.src = BB.safeUrl(src) || "img/flower.png";
    i.onerror = () => { if (i.src.indexOf("img/flower.png") < 0) i.src = "img/flower.png"; };
    return i;
  }
  const nameOf = p => BB.plain((p && (p.name || p.discord_name)) || "") || "Trader";
  const clock = t => new Date(t).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  const dayOf = t => {
    const d = new Date(t), now = new Date();
    const y = new Date(now); y.setDate(now.getDate() - 1);
    if (d.toDateString() === now.toDateString()) return "Today";
    if (d.toDateString() === y.toDateString()) return "Yesterday";
    return d.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric", year: d.getFullYear() === now.getFullYear() ? undefined : "numeric" });
  };
  const short = t => {
    const s = (Date.now() - new Date(t)) / 1000;
    if (s < 60) return "now";
    if (s < 3600) return Math.floor(s / 60) + "m";
    if (s < 86400) return Math.floor(s / 3600) + "h";
    if (s < 604800) return Math.floor(s / 86400) + "d";
    return new Date(t).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  };
  async function signedUrls(paths) {
    const now = Date.now();
    const need = [...new Set(paths)].filter(p => p && !(signed.has(p) && signed.get(p).exp > now + 60000));
    if (need.length) {
      const { data, error } = await BB.sb.storage.from(BUCKET).createSignedUrls(need, 3600);
      if (!error && data) data.forEach(r => { if (r.signedUrl) signed.set(r.path, { url: r.signedUrl, exp: now + 3500000 }); });
    }
  }
  const urlFor = p => (signed.get(p) || {}).url || null;
  const setUnread = n => { if (BB.setDmUnread) BB.setDmUnread(n); };
  const totalUnread = () => inbox.reduce((n, c) => n + (c.blocked ? 0 : c.unread), 0);

  /* ── inbox ───────────────────────────────────────────────── */
  function skeleton() {
    $("dlist").replaceChildren(...[0, 1, 2, 3, 4].map(() => {
      const r = el("div", "dm-c dm-sk");
      r.append(el("i", "dm-sk-av"), el("span", "dm-ct"));
      r.lastChild.append(el("i", "dm-sk-l1"), el("i", "dm-sk-l2"));
      return r;
    }));
  }
  async function loadInbox() {
    try { inbox = (await rpc("dm_inbox")) || []; }
    catch (e) { if (!inboxLoaded) { $("dlist").replaceChildren(); BB.toast(errText(e), "bad", { title: "Couldn't load chats" }); } return; }
    inboxLoaded = true;
    renderInbox();
    setUnread(totalUnread());
  }
  function preview(c, box) {
    if (c.last_from_me && !c.last_unsent) box.append(el("span", "dm-you", "You: "));
    if (c.last_unsent) { box.append(el("em", null, c.last_from_me ? "You unsent a message" : "Message unsent")); return; }
    if (c.last_body) inlineText(box, c.last_body.replace(/\s+/g, " "), { chips: false });
    else if (c.last_image) box.append(el("em", null, "Sent a picture"));
  }
  function renderInbox() {
    const q = $("dq").value.trim().toLowerCase();
    const list = inbox.filter(c => !q || (nameOf(c) + " " + (c.roblox_name || "")).toLowerCase().includes(q));
    $("dlist").replaceChildren(...list.map(c => {
      const b = el("button", "dm-c" + (c.other === cur ? " on" : "") + (c.unread && !c.blocked ? " new" : ""));
      b.type = "button";
      b.setAttribute("role", "listitem");
      b.dataset.id = c.other;
      const txt = el("span", "dm-ct");
      const top = el("span", "dm-ctop");
      top.append(el("strong", null, nameOf(c)), el("time", null, short(c.last_at)));
      const bot = el("span", "dm-cbot");
      const line = el("span", "dm-cl");
      preview(c, line);
      bot.append(line);
      if (c.blocked) bot.append(el("span", "dm-cblk", "Blocked"));
      else if (c.unread) bot.append(el("span", "dm-badge", c.unread > 99 ? "99+" : String(c.unread)));
      txt.append(top, bot);
      const avw = el("span", "dm-cavw");
      avw.append(avatar(c.avatar, "dm-cav"));
      if (c.roblox_verified) avw.append(el("i", "dm-cver"));
      b.append(avw, txt);
      b.onclick = () => open(c.other);
      return b;
    }));
    $("dnone").hidden = inbox.length > 0;
    if (inbox.length && !list.length) $("dlist").append(el("p", "hint dm-nores", "No chat matches that."));
  }

  /* ── one chat ────────────────────────────────────────────── */
  async function open(id, opts = {}) {
    if (!BB.isId(id) || id === me) return;
    const same = cur === id;
    cur = id;
    if (!opts.keepUrl) history.replaceState(null, "", "messages.html?to=" + id);
    $("dm").classList.add("chat-open");
    $("dempty").hidden = true;
    $("dchat").hidden = false;
    document.querySelectorAll(".dm-c").forEach(b => b.classList.toggle("on", b.dataset.id === id));
    if (!same) {
      msgs = []; oldest = null; newest = 0; noMore = false; firstUnread = null; missed = 0;
      $("djump").hidden = true;
      $("dmsgs").replaceChildren(el("div", "dm-load", "Loading…"));
      clearPending();
      closePicker();
    }
    curInfo = inbox.find(c => c.other === id) || null;
    if (!curInfo) {
      const { data } = await BB.sb.from("profiles").select("discord_id,discord_name,discord_avatar,roblox_name,roblox_verified,level").eq("discord_id", id).maybeSingle();
      if (cur !== id) return;
      curInfo = data ? { other: id, name: data.discord_name, avatar: data.discord_avatar, roblox_name: data.roblox_name, roblox_verified: data.roblox_verified, level: data.level, blocked: false } : { other: id, name: null };
    }
    head();
    const [rows, can] = await Promise.all([
      rpc("dm_thread", { p_other: id, p_before: null, p_limit: 50 }).catch(e => { BB.toast(errText(e), "bad"); return []; }),
      rpc("dm_can_message", { p_other: id }).catch(() => "ok"),
    ]);
    if (cur !== id) return;
    rows.reverse();
    msgs = rows;
    oldest = rows.length ? rows[0].id : null;
    newest = rows.length ? rows[rows.length - 1].id : 0;
    noMore = rows.length < 50;
    const fu = rows.find(m => !m.from_me && !m.read_at && !m.unsent);
    firstUnread = fu && rows.indexOf(fu) > 0 ? fu.id : null;
    await signedUrls(rows.map(r => r.image_path));
    if (cur !== id) return;
    renderMsgs(true);
    setCan(can);
    markRead();
    if (!opts.noFocus && matchMedia("(pointer:fine)").matches && !$("dtext").disabled) $("dtext").focus({ preventScroll: true });
  }

  function head() {
    const c = curInfo || {};
    $("dhav").src = BB.safeUrl(c.avatar) || "img/flower.png";
    $("dhav").onerror = () => { $("dhav").src = "img/flower.png"; };
    $("dname").textContent = c.name ? nameOf(c) : "Trader";
    const sub = $("dsub");
    sub.replaceChildren();
    if (c.roblox_name) {
      const r = el("span", "dm-rbx");
      const i = el("img"); i.src = "img/rbx_stud.png"; i.alt = "";
      r.append(i, document.createTextNode(c.roblox_name));
      if (c.roblox_verified) { r.classList.add("ok"); r.title = "Verified Roblox account"; }
      sub.append(r);
    } else sub.append(el("span", null, "No Roblox linked"));
    if (c.level) sub.append(el("span", "dm-lv", "Lv " + c.level));
    $("dwho").href = "profile.html?id=" + encodeURIComponent(c.other || cur);
    $("dwho").title = "See " + nameOf(c) + "'s profile";
  }

  function setCan(state) {
    canSend = state || "ok";
    const typeOff = !["ok", "new"].includes(canSend);
    const note = $("dnote");
    note.className = "dm-note" + (canSend === "new" ? " info" : "");
    note.hidden = canSend === "ok";
    note.replaceChildren();
    if (canSend === "new") {
      note.append(emojiImg(bbSrc("shield"), "shield", "dm-note-i"), document.createTextNode("New chat · pictures unlock once they reply"));
    } else note.append(document.createTextNode(NOTE[canSend] || ""));
    if (canSend === "you_blocked") {
      const b = el("button", "dm-link", "Unblock");
      b.type = "button";
      b.onclick = () => block(false);
      note.append(" ", b);
    }
    $("dtext").disabled = typeOff;
    $("dfile").disabled = typeOff || canSend === "new";
    $("dclip").title = canSend === "new" ? "Pictures unlock once they reply" : "Add a picture";
    $("demo").disabled = typeOff;
    $("dform").classList.toggle("off", typeOff);
    $("dtext").placeholder = typeOff ? "You can't send messages here" : "Message " + ($("dname").textContent || "");
    ready();
  }

  async function markRead() {
    if (!cur || document.hidden) return;
    const c = inbox.find(x => x.other === cur);
    if (!msgs.some(m => !m.from_me && !m.read_at) && !(c && c.unread)) return;
    try { await rpc("dm_read", { p_other: cur }); } catch (e) { return; }
    msgs.forEach(m => { if (!m.from_me && !m.read_at) m.read_at = new Date().toISOString(); });
    if (c) { c.unread = 0; renderInbox(); }
    setUnread(totalUnread());
  }

  /* ── messages ────────────────────────────────────────────── */
  const DOTS = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="12" r="2" fill="currentColor"/><circle cx="12" cy="12" r="2" fill="currentColor"/><circle cx="19" cy="12" r="2" fill="currentColor"/></svg>';
  function bubble(m) {
    const row = el("div", "dm-m " + (m.from_me ? "mine" : "theirs") + (m.unsent ? " gone" : "") + (m.failed ? " fail" : "") + (m.sending ? " wait" : ""));
    row.dataset.id = m.id;
    const b = el("div", "dm-b");
    b.title = new Date(m.created_at).toLocaleString();
    if (m.unsent) b.append(el("div", "dm-t dm-gone", m.from_me ? "You unsent this message" : "Message unsent"));
    else {
      if (m.image_path || m.local_url) {
        const u = m.local_url || urlFor(m.image_path);
        const fig = el("button", "dm-img");
        fig.type = "button";
        fig.setAttribute("aria-label", "Open picture");
        const i = el("img");
        i.alt = "Picture";
        i.loading = "lazy";
        i.decoding = "async";
        if (u) i.src = u;
        i.onerror = () => { fig.classList.add("broken"); i.remove(); fig.append(el("span", null, "Picture unavailable")); };
        fig.append(i);
        fig.onclick = () => u && lightbox(u);
        b.append(fig);
      }
      if (m.body) {
        const t = richText(m.body);
        b.append(t);
        if (t.classList.contains("big") && !m.image_path && !m.local_url) row.classList.add("emo");
      }
    }
    row.append(b);
    if (!m.unsent && !m.sending && !m.failed && m.id > 0) {
      const more = el("button", "dm-mm");
      more.type = "button";
      more.setAttribute("aria-label", "Message options");
      more.setAttribute("aria-haspopup", "menu");
      more.innerHTML = DOTS;
      more.onclick = e => { e.stopPropagation(); msgMenu(m, more); };
      row.append(more);
    }
    if (m.failed) {
      const r = el("button", "dm-retry", "Not sent · Retry");
      r.type = "button";
      r.onclick = () => retry(m);
      row.append(r);
    }
    return row;
  }
  function hello() {
    const w = el("div", "dm-hello");
    const avs = el("div", "dm-hello-avs");
    avs.append(avatar(curInfo && curInfo.avatar, "dm-hav-lg"));
    w.append(avs, el("strong", null, nameOf(curInfo)), el("span", null, "This is the start of your chat."));
    return w;
  }
  function safety() {
    const s = el("div", "dm-safe");
    s.append(emojiImg(bbSrc("shield"), "shield", "dm-safe-i"));
    const t = el("div");
    t.append(el("strong", null, "Trade safe"), el("span", null, "Bloombot never asks for your password. Only trade inside the game, and report anything off."));
    s.append(t);
    return s;
  }
  function renderMsgs(toBottom) {
    const box = $("dmsgs");
    const keep = box.scrollHeight - box.scrollTop;
    const out = [];
    if (noMore || !msgs.length) out.push(hello(), safety());
    else out.push(el("div", "dm-load sm", "Scroll up for older messages"));
    let lastDay = "", lastFrom = null, lastT = 0;
    msgs.forEach(m => {
      const d = dayOf(m.created_at);
      if (d !== lastDay) { out.push(el("div", "dm-day", d)); lastDay = d; lastFrom = null; }
      if (m.id === firstUnread) { out.push(el("div", "dm-newline", "New messages")); lastFrom = null; }
      const t = new Date(m.created_at).getTime();
      const node = bubble(m);
      if (lastFrom === m.from_me && t - lastT < 5 * 60000) node.classList.add("cont");
      else node.prepend(el("time", "dm-time", clock(m.created_at)));
      lastFrom = m.from_me; lastT = t;
      out.push(node);
    });
    const lastMine = [...msgs].reverse().find(m => m.from_me && !m.unsent && !m.sending && !m.failed);
    if (lastMine && msgs[msgs.length - 1] === lastMine) {
      const s = el("div", "dm-seen" + (lastMine.read_at ? " read" : ""), lastMine.read_at ? "Seen " + BB.ago(lastMine.read_at) : "Sent");
      out.push(s);
    }
    box.replaceChildren(...out);
    if (toBottom) box.scrollTop = box.scrollHeight;
    else box.scrollTop = box.scrollHeight - keep;
  }
  const nearBottom = () => { const b = $("dmsgs"); return b.scrollHeight - b.scrollTop - b.clientHeight < 120; };
  function toBottom(smooth) {
    const b = $("dmsgs");
    b.scrollTo({ top: b.scrollHeight, behavior: smooth && !matchMedia("(prefers-reduced-motion:reduce)").matches ? "smooth" : "auto" });
    missed = 0;
    $("djump").hidden = true;
  }

  async function loadOlder() {
    if (!cur || noMore || loadingOld || !oldest) return;
    loadingOld = true;
    const id = cur;
    try {
      const rows = await rpc("dm_thread", { p_other: id, p_before: oldest, p_limit: 50 });
      if (cur !== id) return;
      rows.reverse();
      await signedUrls(rows.map(r => r.image_path));
      msgs = rows.concat(msgs);
      if (rows.length) oldest = rows[0].id;
      noMore = rows.length < 50;
      renderMsgs(false);
    } catch (e) { /* try again on next scroll */ }
    finally { loadingOld = false; }
  }

  async function poll() {
    if (!cur || document.hidden || busy) return;
    const id = cur;
    let r;
    try { r = await rpc("dm_poll", { p_other: id, p_after: newest }); } catch (e) { return; }
    if (cur !== id || !r) return;
    let changed = false;
    const fresh = (r.msgs || []).filter(m => !msgs.some(x => x.id === m.id));
    if (fresh.length) {
      await signedUrls(fresh.map(m => m.image_path));
      if (cur !== id) return;
      msgs = msgs.concat(fresh);
      newest = Math.max(newest, ...fresh.map(m => m.id));
      changed = true;
    }
    (r.unsent || []).forEach(gone => {
      const m = msgs.find(x => x.id === gone);
      if (m && !m.unsent) { m.unsent = true; m.body = ""; m.image_path = null; changed = true; }
    });
    if (r.read_upto) msgs.forEach(m => { if (m.from_me && !m.read_at && m.id <= r.read_upto) { m.read_at = new Date().toISOString(); changed = true; } });
    if (changed) {
      const atEnd = nearBottom();
      renderMsgs(atEnd);
      const theirs = fresh.filter(m => !m.from_me).length;
      if (theirs) {
        if (!atEnd) { missed += theirs; $("djump").hidden = false; $("djumpn").textContent = missed === 1 ? "1 new message" : missed + " new messages"; }
        markRead();
        if (canSend === "wait_reply" || canSend === "new") setCan("ok");
        const c = inbox.find(x => x.other === id), last = fresh[fresh.length - 1];
        if (c && last) { Object.assign(c, { last_id: last.id, last_body: last.body, last_image: !!last.image_path, last_from_me: last.from_me, last_unsent: false, last_at: last.created_at }); inbox = [c].concat(inbox.filter(x => x !== c)); renderInbox(); }
      }
    }
  }

  /* ── sending ─────────────────────────────────────────────── */
  function ready() {
    const t = $("dtext").value;
    const n = t.length;
    const link = !!t.trim() && hasLink(t);
    const w = $("dwarn");
    w.hidden = !link;
    $("dsend").disabled = busy || $("dtext").disabled || (!t.trim() && !pending) || n > MAX_LEN || link;
    const c = $("dcount");
    c.hidden = n < MAX_LEN - 300;
    c.textContent = n + "/" + MAX_LEN;
    c.classList.toggle("bad", n > MAX_LEN);
  }
  function grow() {
    const t = $("dtext");
    t.style.height = "auto";
    t.style.height = Math.min(t.scrollHeight, 180) + "px";
  }
  function insertText(s) {
    const t = $("dtext");
    if (t.disabled) return;
    const a = t.selectionStart ?? t.value.length, b = t.selectionEnd ?? t.value.length;
    const before = t.value.slice(0, a), pad = before && !/\s$/.test(before) && s.startsWith(":") ? " " : "";
    t.value = before + pad + s + t.value.slice(b);
    const pos = a + pad.length + s.length;
    t.setSelectionRange(pos, pos);
    grow();
    ready();
  }

  async function send(e) {
    if (e) e.preventDefault();
    if ($("dsend").disabled || !cur) return;
    const body = $("dtext").value.replace(/\s+$/, "");
    const att = pending;
    busy = true;
    closePicker();
    const temp = { id: -Date.now(), from_me: true, body: body.trim(), created_at: new Date().toISOString(), sending: true, local_url: att && att.url, _att: att, _body: body };
    msgs.push(temp);
    $("dtext").value = "";
    grow();
    pending = null;
    $("datt").hidden = true;
    ready();
    renderMsgs(true);
    await deliver(temp);
  }
  async function deliver(temp) {
    const id = cur, att = temp._att;
    let path = null;
    try {
      if (att) {
        path = me + "/" + crypto.randomUUID() + "." + att.ext;
        const { error } = await BB.sb.storage.from(BUCKET).upload(path, att.blob, { contentType: att.type, upsert: false, cacheControl: "3600" });
        if (error) throw new Error(/row-level|policy|403/i.test(error.message || "") ? "dm:slow" : "dm:bad_image");
      }
      const row = await rpc("dm_send", { p_to: id, p_body: temp._body, p_image: path });
      if (row && row.error) throw new Error("dm:" + row.error);
      if (att) signed.set(row.image_path, { url: att.url, exp: Date.now() + 3500000 });
      const i = msgs.indexOf(temp);
      if (i >= 0) msgs[i] = row;
      newest = Math.max(newest, row.id);
      bumpInbox(id, row);
    } catch (err) {
      if (path) BB.sb.storage.from(BUCKET).remove([path]).catch(() => {});
      const k = codeOf(err);
      if (k === "dm:bad_word" || k === "dm:link") {
        /* Put the text back so it can be fixed, and drop the failed bubble. */
        msgs = msgs.filter(m => m !== temp);
        if (!$("dtext").value) { $("dtext").value = temp._body; grow(); }
        if (att && !pending) restorePending(att);
      } else {
        temp.sending = false;
        temp.failed = true;
      }
      if (k === "dm:wait_reply" || k === "dm:closed" || k === "dm:you_blocked") setCan(k.slice(3));
      if (k === "dm:image_wait") setCan("new");
      BB.toast(errText(err), "bad", { title: "Message not sent" });
    } finally {
      busy = false;
      ready();
      if (cur === id) renderMsgs(true);
    }
  }
  function retry(m) {
    if (busy) return;
    m.failed = false;
    m.sending = true;
    busy = true;
    renderMsgs(true);
    deliver(m);
  }
  function bumpInbox(id, row) {
    let c = inbox.find(x => x.other === id);
    if (!c) {
      c = Object.assign({ other: id, unread: 0, blocked: false }, curInfo || {});
      inbox.unshift(c);
    } else { inbox = [c].concat(inbox.filter(x => x !== c)); }
    Object.assign(c, { last_id: row.id, last_body: row.body, last_image: !!row.image_path, last_from_me: true, last_unsent: false, last_at: row.created_at });
    renderInbox();
  }

  /* ── pictures ────────────────────────────────────────────── */
  const toBlob = (cv, type, q) => new Promise(res => cv.toBlob(res, type, q));
  async function prepImage(file) {
    if (!/^image\/(png|jpeg|webp|gif)$/.test(file.type)) throw new Error("Only PNG, JPG, WEBP or GIF pictures.");
    if (file.size > 15 * 1024 * 1024) throw new Error("That picture is over 15 MB.");
    let bmp;
    try { bmp = await createImageBitmap(file); } catch (e) { throw new Error("That file isn't a picture we can open."); }
    let max = 1600;
    for (let tries = 0; tries < 4; tries++) {
      const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
      const w = Math.max(1, Math.round(bmp.width * k)), h = Math.max(1, Math.round(bmp.height * k));
      const cv = document.createElement("canvas");
      cv.width = w; cv.height = h;
      const ctx = cv.getContext("2d");
      ctx.drawImage(bmp, 0, 0, w, h);
      let blob = await toBlob(cv, "image/webp", 0.86), ext = "webp";
      if (!blob || blob.type !== "image/webp") {
        /* JPG has no transparency: put the picture on white first. */
        ctx.globalCompositeOperation = "destination-over";
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, w, h);
        blob = await toBlob(cv, "image/jpeg", 0.86);
        ext = "jpg";
      }
      if (blob && blob.size <= 3 * 1024 * 1024) { if (bmp.close) bmp.close(); return { blob, ext, type: blob.type, w, h }; }
      max = Math.round(max * 0.75);
    }
    throw new Error("That picture is too big.");
  }
  function restorePending(p) {
    pending = p;
    $("dattimg").src = p.url;
    $("dattp").textContent = Math.max(1, Math.round(p.blob.size / 1024)) + " KB";
    $("datt").hidden = false;
    ready();
  }
  async function pick(file) {
    if (!file || $("dfile").disabled) {
      if (file && canSend === "new") BB.toast(ERR["dm:image_wait"], "info");
      return;
    }
    try {
      const p = await prepImage(file);
      clearPending();
      p.url = URL.createObjectURL(p.blob);
      restorePending(p);
      $("dtext").focus();
    } catch (e) { BB.toast(e.message, "bad", { title: "Can't add that picture" }); }
  }
  function clearPending() {
    pending = null;
    $("datt").hidden = true;
    $("dfile").value = "";
    ready();
  }

  function lightbox(url) {
    const back = el("div", "wm-back dm-lb");
    back.setAttribute("role", "dialog");
    back.setAttribute("aria-modal", "true");
    back.setAttribute("aria-label", "Picture");
    const i = el("img"); i.src = url; i.alt = "Picture";
    const x = el("button", "upop-x"); x.type = "button"; x.setAttribute("aria-label", "Close");
    x.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path stroke="currentColor" stroke-width="2.6" stroke-linecap="round" d="M7 7l10 10M17 7 7 17"/></svg>';
    back.append(i, x);
    const close = () => { back.remove(); document.removeEventListener("keydown", key); };
    const key = e => { if (e.key === "Escape") close(); };
    document.addEventListener("keydown", key);
    back.onclick = e => { if (e.target !== i) close(); };
    document.body.append(back);
    x.focus();
  }

  /* ── emoji picker ────────────────────────────────────────── */
  let picker = null, pickTab = "bloombot";
  const recent = () => store.get("bb_dm_recent", []).slice(0, 24);
  function addRecent(token) { store.set("bb_dm_recent", [token].concat(recent().filter(x => x !== token)).slice(0, 24)); }
  function tokenTile(token, label, img) {
    const b = el("button", "dm-et");
    b.type = "button";
    b.title = label;
    b.setAttribute("aria-label", label);
    if (img) b.append(img); else b.textContent = token;
    b.onclick = () => { insertText(token); addRecent(token); if (pickTab === "recent") fillPicker(); $("dtext").focus(); };
    return b;
  }
  function tileFor(token) {
    const own = token.match(/^:([a-z0-9_]+):$/);
    if (own && BB_SET.has(own[1])) return tokenTile(token, own[1].replace(/_/g, " "), emojiImg(bbSrc(own[1]), own[1]));
    const unit = token.match(/^<:(\w+):(\d+)>$/);
    if (unit) return units.has(unit[2]) ? tokenTile(token, units.get(unit[2]).name, emojiImg(units.get(unit[2]).url, unit[1])) : null;
    return tokenTile(token, token, null);
  }
  function fillPicker() {
    if (!picker) return;
    const grid = picker.querySelector(".dm-eg");
    const q = picker.querySelector("input").value.trim().toLowerCase().replace(/\s+/g, "_");
    picker.querySelectorAll(".dm-etab").forEach(t => t.setAttribute("aria-selected", String(t.dataset.k === pickTab && !q)));
    const tiles = [];
    const head = t => tiles.push(el("div", "dm-eh", t));
    if (q) {
      const own = BB_EMOJI.filter(n => n.includes(q)).map(n => ":" + n + ":");
      const us = [...units].filter(([, u]) => tokenName(u.name).toLowerCase().includes(q)).slice(0, 80).map(([id, u]) => "<:" + tokenName(u.name) + ":" + id + ">");
      if (own.length) { head("Bloombot"); own.forEach(t => tiles.push(tileFor(t))); }
      if (us.length) { head("Units"); us.forEach(t => tiles.push(tileFor(t))); }
      if (!own.length && !us.length) tiles.push(el("p", "dm-enone", "No emoji found"));
    } else if (pickTab === "recent") {
      const r = recent().map(tileFor).filter(Boolean);
      head("Recently used");
      if (r.length) tiles.push(...r); else tiles.push(el("p", "dm-enone", "Emojis you use show up here"));
    } else if (pickTab === "bloombot") {
      head("Bloombot");
      BB_EMOJI.forEach(n => tiles.push(tileFor(":" + n + ":")));
    } else if (pickTab === "units") {
      head("Units");
      if (!units.size) {
        tiles.push(el("p", "dm-enone", "Loading units…"));
        loadUnits().then(() => { if (pickTab === "units") fillPicker(); });
      } else [...units].sort((a, b) => a[1].name.localeCompare(b[1].name))
        .forEach(([id, u]) => tiles.push(tileFor("<:" + tokenName(u.name) + ":" + id + ">")));
    } else {
      const set = UNICODE.find(x => x[0] === pickTab);
      head(set[0]);
      set[2].split(" ").forEach(ch => tiles.push(tokenTile(ch, ch, null)));
    }
    grid.replaceChildren(...tiles.filter(Boolean));
    grid.scrollTop = 0;
  }
  function openPicker() {
    if (picker) { closePicker(); return; }
    picker = el("div", "dm-ep");
    picker.setAttribute("role", "dialog");
    picker.setAttribute("aria-label", "Emojis");
    const s = el("input", "dm-es");
    s.type = "search";
    s.placeholder = "Search Bloombot and unit emojis";
    s.setAttribute("aria-label", "Search emojis");
    s.maxLength = 30;
    s.oninput = fillPicker;
    const tabs = el("div", "dm-etabs");
    tabs.setAttribute("role", "tablist");
    const tab = (k, label, content) => {
      const b = el("button", "dm-etab");
      b.type = "button";
      b.dataset.k = k;
      b.title = label;
      b.setAttribute("role", "tab");
      b.setAttribute("aria-label", label);
      if (typeof content === "string") b.textContent = content; else b.append(content);
      b.onclick = () => { pickTab = k; s.value = ""; fillPicker(); };
      tabs.append(b);
    };
    tab("recent", "Recently used", emojiImg(bbSrc("clock"), "clock"));
    tab("bloombot", "Bloombot", emojiImg(bbSrc("bloombot"), "bloombot"));
    tab("units", "Units", emojiImg("img/flower.png", "units"));
    UNICODE.forEach(([k, icon]) => tab(k, k, icon));
    const grid = el("div", "dm-eg");
    picker.append(s, tabs, grid);
    $("dform").append(picker);
    $("demo").setAttribute("aria-expanded", "true");
    loadUnits().then(() => {
      const first = units.values().next().value;
      const ti = picker && picker.querySelector('[data-k="units"] img');
      if (first && ti) ti.src = first.url;
    });
    fillPicker();
    if (matchMedia("(pointer:fine)").matches) s.focus();
  }
  function closePicker() {
    if (!picker) return;
    picker.remove();
    picker = null;
    $("demo").setAttribute("aria-expanded", "false");
  }

  /* ── menus ───────────────────────────────────────────────── */
  let openMenu = null;
  function popMenu(anchor, items) {
    closeMenu();
    const m = el("div", "dm-pop");
    m.setAttribute("role", "menu");
    items.forEach(([label, run, danger]) => {
      const b = el("button", "dm-pi" + (danger ? " bad" : ""), label);
      b.type = "button";
      b.setAttribute("role", "menuitem");
      b.onclick = () => { closeMenu(); run(); };
      m.append(b);
    });
    m.onkeydown = e => {
      const list = [...m.children], i = list.indexOf(document.activeElement);
      if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); list[(i + (e.key === "ArrowDown" ? 1 : list.length - 1)) % list.length].focus(); }
    };
    document.body.append(m);
    const r = anchor.getBoundingClientRect();
    const w = m.offsetWidth, h = m.offsetHeight;
    m.style.left = Math.max(8, Math.min(innerWidth - w - 8, r.right - w)) + "px";
    m.style.top = (r.bottom + h + 8 > innerHeight ? r.top - h - 6 : r.bottom + 6) + "px";
    openMenu = m;
    anchor.setAttribute("aria-expanded", "true");
    m._anchor = anchor;
    setTimeout(() => m.firstChild && m.firstChild.focus(), 20);
  }
  function closeMenu() {
    if (!openMenu) return;
    if (openMenu._anchor) openMenu._anchor.setAttribute("aria-expanded", "false");
    openMenu.remove();
    openMenu = null;
  }
  document.addEventListener("click", e => {
    if (openMenu && !openMenu.contains(e.target)) closeMenu();
    if (picker && !picker.contains(e.target) && !e.target.closest("#demo")) closePicker();
  });
  document.addEventListener("keydown", e => {
    if (e.key !== "Escape") return;
    if (openMenu) { const a = openMenu._anchor; closeMenu(); if (a) a.focus(); }
    else if (picker) { closePicker(); $("demo").focus(); }
  });
  addEventListener("resize", closeMenu);

  function msgMenu(m, anchor) {
    const items = [];
    if (m.body) items.push(["Copy text", () => BB.copy(m.body)]);
    if (m.from_me) items.push(["Unsend", () => unsend(m), true]);
    else items.push(["Report", () => report(m), true]);
    items.push(["Delete for me", () => hideMsg(m)]);
    popMenu(anchor, items);
  }
  async function unsend(m) {
    if (!(await BB.confirm({ title: "Unsend message?", text: "It's removed for both of you.", ok: "Unsend" }))) return;
    try {
      const img = await rpc("dm_unsend", { p_id: m.id });
      if (img) BB.sb.storage.from(BUCKET).remove([img]).catch(() => {});
      Object.assign(m, { unsent: true, body: "", image_path: null, local_url: null });
      renderMsgs(false);
      loadInbox();
    } catch (e) { BB.toast(errText(e), "bad"); }
  }
  async function hideMsg(m) {
    try {
      await rpc("dm_hide", { p_id: m.id, p_other: null });
      msgs = msgs.filter(x => x !== m);
      renderMsgs(false);
      loadInbox();
    } catch (e) { BB.toast(errText(e), "bad"); }
  }
  function dialog(cls, labelId) {
    const back = el("div", "wm-back");
    const box = el("form", "wm panel " + cls);
    box.setAttribute("role", "dialog");
    box.setAttribute("aria-modal", "true");
    box.setAttribute("aria-labelledby", labelId);
    back.append(box);
    document.body.append(back);
    const opener = document.activeElement;
    const close = () => { back.remove(); document.removeEventListener("keydown", esc); if (opener && opener.focus) opener.focus({ preventScroll: true }); };
    const esc = e => { if (e.key === "Escape") close(); };
    document.addEventListener("keydown", esc);
    back.onclick = e => { if (e.target === back) close(); };
    return { box, close };
  }
  function report(m) {
    const { box, close } = dialog("cf dm-rep", "rp-h");
    const h = el("h2", null, "Report message"); h.id = "rp-h";
    const opts = el("div", "dm-reasons");
    ["Scam or fake trade", "Harassment", "Spam", "Inappropriate picture", "Something else"].forEach((r, i) => {
      const l = el("label", "dm-reason");
      const inp = el("input"); inp.type = "radio"; inp.name = "why"; inp.value = r; if (!i) inp.checked = true;
      l.append(inp, el("span", null, r));
      opts.append(l);
    });
    const blk = el("label", "dm-reason dm-also");
    const bi = el("input"); bi.type = "checkbox"; bi.checked = true;
    blk.append(bi, el("span", null, "Also block " + nameOf(curInfo)));
    const no = el("button", "brick dark sm", "Cancel"); no.type = "button";
    const yes = el("button", "brick red", "Report"); yes.type = "submit";
    const acts = el("div", "post-actions"); acts.append(no, yes);
    box.append(h, el("p", "hint", "The Bloombot team sees this message and who sent it."), opts, blk, acts);
    no.onclick = close;
    box.onsubmit = async e => {
      e.preventDefault();
      yes.disabled = true;
      try {
        await rpc("dm_report", { p_id: m.id, p_reason: box.querySelector("input[name=why]:checked").value });
        close();
        if (bi.checked) await block(true, true);
        BB.toast("Thanks, we'll take a look.", "ok", { title: "Reported" });
      } catch (err) { yes.disabled = false; BB.toast(errText(err), "bad"); }
    };
    setTimeout(() => opts.querySelector("input").focus(), 50);
  }

  function chatMenu() {
    const c = inbox.find(x => x.other === cur) || curInfo || {};
    const blocked = c.blocked || canSend === "you_blocked";
    popMenu($("dmore"), [
      ["View profile", () => BB.openProfile(cur, { name: c.name, avatar: c.avatar })],
      [blocked ? "Unblock" : "Block", () => block(!blocked), !blocked],
      ["Delete chat", deleteChat, true],
    ]);
  }
  async function block(on, quiet) {
    if (on && !quiet && !(await BB.confirm({ title: "Block " + nameOf(curInfo) + "?", text: "They can't message you, and you won't see new messages from them.", ok: "Block" }))) return;
    try {
      await rpc("dm_block", { p_other: cur, p_on: on });
      const c = inbox.find(x => x.other === cur);
      if (c) c.blocked = on;
      if (curInfo) curInfo.blocked = on;
      setCan(on ? "you_blocked" : await rpc("dm_can_message", { p_other: cur }).catch(() => "ok"));
      renderInbox();
      if (!quiet) BB.toast(on ? "They can't message you anymore." : "You can message each other again.", "ok", { title: on ? "Blocked" : "Unblocked" });
    } catch (e) { BB.toast(errText(e), "bad"); }
  }
  async function deleteChat() {
    if (!(await BB.confirm({ title: "Delete this chat?", text: "It's removed for you only. They still see it.", ok: "Delete" }))) return;
    try {
      await rpc("dm_hide", { p_id: null, p_other: cur });
      inbox = inbox.filter(x => x.other !== cur);
      closeChat();
      renderInbox();
    } catch (e) { BB.toast(errText(e), "bad"); }
  }
  function closeChat() {
    cur = null;
    curInfo = null;
    clearPending();
    closePicker();
    history.replaceState(null, "", "messages.html");
    $("dm").classList.remove("chat-open");
    $("dchat").hidden = true;
    $("dempty").hidden = false;
    document.querySelectorAll(".dm-c.on").forEach(b => b.classList.remove("on"));
  }

  async function settings() {
    let s;
    try { s = await rpc("dm_get_settings"); } catch (e) { BB.toast(errText(e), "bad"); return; }
    const { box, close } = dialog("dm-set", "ds-h");
    const h = el("h2", null, "Message settings"); h.id = "ds-h";
    const tog = el("label", "ktog-line pe-tog");
    const sw = el("span", "ktog");
    const inp = el("input"); inp.type = "checkbox"; inp.checked = !!s.allow_new;
    sw.append(inp, el("i"));
    const t = el("span");
    t.append(el("strong", null, "Let new people message me"), el("span", null, "When off, only people you already talk to can message you."));
    tog.append(sw, t);
    inp.onchange = async () => {
      inp.disabled = true;
      try { await rpc("dm_set_allow", { p_allow: inp.checked }); BB.toast("Saved", "ok"); }
      catch (e) { inp.checked = !inp.checked; BB.toast(errText(e), "bad"); }
      inp.disabled = false;
    };
    const rules = el("div", "dm-rules");
    rules.append(el("h3", "upop-h", "Chat rules"));
    const ul = el("ul");
    ["No bad words or slurs", "No links except Bloombot's", "Pictures unlock once someone replies", "Never share your password"].forEach(r => ul.append(el("li", null, r)));
    rules.append(ul);
    const bl = el("div", "dm-bl");
    bl.append(el("h3", "upop-h", "Blocked"));
    const list = s.blocked || [];
    if (!list.length) bl.append(el("p", "hint", "You haven't blocked anyone."));
    list.forEach(u => {
      const r = el("div", "dm-blr");
      const b = el("button", "brick dark sm", "Unblock"); b.type = "button";
      b.onclick = async () => {
        b.disabled = true;
        try {
          await rpc("dm_block", { p_other: u.id, p_on: false });
          r.remove();
          const c = inbox.find(x => x.other === u.id); if (c) c.blocked = false;
          if (cur === u.id) setCan(await rpc("dm_can_message", { p_other: cur }).catch(() => "ok"));
          renderInbox();
        } catch (e) { b.disabled = false; BB.toast(errText(e), "bad"); }
      };
      r.append(avatar(u.avatar, "dm-cav sm"), el("strong", null, BB.plain(u.name || "") || "Trader"), b);
      bl.append(r);
    });
    const done = el("button", "brick green sm", "Done"); done.type = "button";
    const acts = el("div", "post-actions"); acts.append(done);
    box.append(h, tog, rules, bl, acts);
    box.onsubmit = e => e.preventDefault();
    done.onclick = close;
    setTimeout(() => inp.focus(), 50);
  }

  /* ── start ───────────────────────────────────────────────── */
  function wire() {
    $("dform").onsubmit = send;
    $("dtext").addEventListener("input", () => { grow(); ready(); });
    $("dtext").addEventListener("keydown", e => {
      if (e.key === "Enter" && !e.shiftKey && !e.isComposing && matchMedia("(pointer:fine)").matches) { e.preventDefault(); send(); }
    });
    $("dtext").addEventListener("paste", e => {
      const f = [...(e.clipboardData && e.clipboardData.files || [])].find(x => /^image\//.test(x.type));
      if (f) { e.preventDefault(); pick(f); }
    });
    $("dfile").onchange = () => pick($("dfile").files[0]);
    $("dattx").onclick = () => { clearPending(); $("dtext").focus(); };
    $("demo").onclick = e => { e.stopPropagation(); openPicker(); };
    $("djump").onclick = () => toBottom(true);
    const main = $("dmain");
    main.addEventListener("dragover", e => { if (cur && !$("dfile").disabled && [...e.dataTransfer.types].includes("Files")) { e.preventDefault(); main.classList.add("drop"); } });
    main.addEventListener("dragleave", e => { if (e.target === main || !main.contains(e.relatedTarget)) main.classList.remove("drop"); });
    main.addEventListener("drop", e => { main.classList.remove("drop"); const f = e.dataTransfer.files[0]; if (f) { e.preventDefault(); pick(f); } });
    $("dq").addEventListener("input", renderInbox);
    $("dback").onclick = closeChat;
    $("dmore").onclick = e => { e.stopPropagation(); if (openMenu) closeMenu(); else chatMenu(); };
    $("dset").onclick = settings;
    $("dwho").addEventListener("click", e => {
      if (e.ctrlKey || e.metaKey || e.button) return;
      e.preventDefault();
      e.stopPropagation();
      BB.openProfile(cur, { name: curInfo && curInfo.name, avatar: curInfo && curInfo.avatar });
    });
    $("dmsgs").addEventListener("scroll", () => {
      if ($("dmsgs").scrollTop < 80) loadOlder();
      if (!$("djump").hidden && nearBottom()) { missed = 0; $("djump").hidden = true; }
    }, { passive: true });
    document.addEventListener("visibilitychange", () => { if (!document.hidden) { poll(); markRead(); loadInbox(); } });
    setInterval(poll, 4000);
    setInterval(() => { if (!document.hidden) loadInbox(); }, 20000);
  }

  BB.onAuth(async s => {
    const u = s ? BB.user(s) : null;
    $("dlogin").hidden = !!(u && u.id);
    $("dm").hidden = !(u && u.id);
    if (!s) return;
    if (!u.id) { BB.requireDiscord(); return; }
    if (started && me === u.id) return;
    me = u.id;
    started = true;
    if (!wired) { wire(); wired = true; }
    skeleton();
    /* Unit emojis show as icons once the value list is in. */
    loadUnits().then(() => { if (units.size && inboxLoaded) { renderInbox(); if (cur && msgs.some(m => /<a?:\w+:\d+>/.test(m.body || ""))) renderMsgs(nearBottom()); } });
    await loadInbox();
    const to = new URLSearchParams(location.search).get("to");
    if (BB.isId(to) && to !== me) open(to, { keepUrl: true });
  });
})();
