// Sample data for the admin dashboard preview. Nothing here is real: it is generated
// from a fixed seed so the numbers stay the same on every visit.
(function () {
  "use strict";
  let seed = 20261107;
  const rnd = () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const ri = (a, b) => Math.floor(a + rnd() * (b - a + 1));
  const pick = (a) => a[Math.floor(rnd() * a.length)];

  const DAY = 864e5;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const NDAYS = 730; // two years so "previous period" comparisons work for 12 months
  const days = [];
  for (let i = NDAYS - 1; i >= 0; i--) days.push(new Date(today.getTime() - i * DAY));

  // update days give traffic spikes
  const spikes = new Set();
  for (let i = 0; i < 26; i++) spikes.add(ri(10, NDAYS - 1));
  spikes.add(NDAYS - 4);

  const visits = [], uniques = [], regs = [], verified = [], active = [], cmds = [], ads = [], lookups = [], trades = [];
  days.forEach((d, i) => {
    const t = i / (NDAYS - 1);
    const growth = 380 + 2900 * Math.pow(t, 1.6);
    const wk = [1.18, 0.93, 0.9, 0.92, 0.97, 1.08, 1.22][d.getDay()];
    const spike = spikes.has(i) ? 1.7 + rnd() * 0.8 : spikes.has(i - 1) ? 1.25 : 1;
    const v = Math.round(growth * wk * spike * (0.9 + rnd() * 0.2));
    visits.push(v);
    uniques.push(Math.round(v * (0.58 + rnd() * 0.08)));
    const r = Math.round((8 + 70 * Math.pow(t, 1.4)) * wk * (spike > 1 ? 1.5 : 1) * (0.75 + rnd() * 0.5));
    regs.push(r);
    verified.push(Math.round(r * (0.55 + rnd() * 0.2)));
    active.push(Math.round((120 + 1500 * Math.pow(t, 1.3)) * wk * (0.92 + rnd() * 0.16)));
    const c = Math.round((900 + 11500 * Math.pow(t, 1.25)) * wk * (spike > 1 ? 1.35 : 1) * (0.9 + rnd() * 0.2));
    cmds.push(c);
    ads.push(Math.round(c * (0.085 + rnd() * 0.02)));
    lookups.push(Math.round(c * (0.31 + rnd() * 0.05)));
    trades.push(Math.round(c * (0.05 + rnd() * 0.015)));
  });

  // ---------- users ----------
  const first = ["Bloom", "Leaf", "Seed", "Sprout", "Petal", "Thorn", "Root", "Moss", "Fern", "Clover", "Cactus", "Tulip", "Daisy", "Sunny", "Vine", "Berry", "Mango", "Pine", "Lotus", "Basil", "Pepper", "Shroom", "Ivy", "Olive", "Maple", "Cherry", "Kiwi", "Gnome", "Tomato", "Radish"];
  const last = ["King", "Master", "Pro", "Lord", "Gamer", "Hero", "Slayer", "Kid", "TD", "Trader", "Boss", "Ninja", "Wizard", "Queen", "Farmer", "Legend", "Dude", "Star", "XD", "YT"];
  const ROLES = ["Member", "Member", "Member", "Member", "Member", "Trusted trader", "Trusted trader", "Value team", "Moderator", "Admin"];
  const units = ["Sunflower", "Venus Flytrap", "Laser Plant", "Rainbow Dragon Fruit", "Grim Gardener", "Thornzilla", "Overlord Stem", "Sea Dragon", "Skeleton Dragon", "Celestial Stem", "Galaxiflora", "Quantum Stalk", "Tridenthra", "Cyborg Farmer", "Mermaid", "Draculaflora", "Ghost Pepper", "Lucky Clover", "Gold RNG Flytrap", "Rooted Excalibur", "Plasma Petal", "Umbra", "Vine Sheriff", "Subzero Stem", "Pyrocopter Root", "Molten Pumpkin", "Rainbow Laser Plant", "Bloodvine", "Dreamshroom", "Echofern"];
  const slug = (n) => n.toLowerCase().replace(/[^a-z0-9]+/g, "_");
  const AV = ["img/units/" + slug("Sunflower") + ".webp"];
  const users = [];
  const used = new Set();
  for (let i = 0; i < 248; i++) {
    let name;
    do { name = pick(first) + pick(last) + (rnd() < 0.55 ? ri(1, 999) : ""); } while (used.has(name));
    used.add(name);
    const regAgo = Math.floor(Math.pow(rnd(), 1.7) * 600);
    const lastAgo = Math.min(regAgo, Math.floor(Math.pow(rnd(), 3) * 90));
    const ver = rnd() < 0.66;
    const role = pick(ROLES);
    const warns = rnd() < 0.82 ? 0 : ri(1, 4);
    const status = warns >= 3 && rnd() < 0.6 ? "Banned" : warns >= 2 && rnd() < 0.5 ? "Muted" : "Active";
    const u = {
      id: "1" + String(ri(100000000, 499999999)) + String(ri(100000000, 999999999)),
      discord: name.toLowerCase().replace(/(\d+)$/, "_$1"),
      roblox: ver ? name : "",
      robloxId: ver ? ri(100000000, 7999999999) : null,
      verified: ver,
      method: ver ? pick(["Bio code", "Bio code", "OAuth", "Google + Roblox"]) : "",
      registered: new Date(today.getTime() - regAgo * DAY - ri(0, 86000) * 1000),
      lastActive: new Date(Math.min(Date.now() - ri(60, 3000) * 1000, today.getTime() + DAY - lastAgo * DAY - ri(0, 86000) * 1000)),
      ads: Math.floor(Math.pow(rnd(), 1.5) * 140),
      trades: Math.floor(Math.pow(rnd(), 1.6) * 90),
      cmds: Math.floor(Math.pow(rnd(), 1.3) * 2400),
      level: Math.max(1, Math.floor(Math.pow(rnd(), 1.4) * 60)),
      warns, status, role,
      servers: ri(1, 9),
      avatar: "img/units/" + slug(pick(units)) + ".webp",
    };
    users.push(u);
  }
  users.sort((a, b) => b.registered - a.registered);
  users[3].roblox = "Marcel"; // keep a familiar name near the top
  void AV;

  // ---------- commands ----------
  const COMMANDS = [
    ["/value", "Values", 0.21], ["/trade ad", "Trading", 0.14], ["/value-calculator", "Values", 0.11], ["/search", "Stats", 0.09],
    ["/home", "Getting started", 0.07], ["/trade bump", "Trading", 0.065], ["/value-hub", "Values", 0.055], ["/level", "Levels", 0.05],
    ["Check trade", "Trading", 0.045], ["/wishlist", "Trading", 0.04], ["/dps", "Stats", 0.035], ["/leaderboard", "Levels", 0.03],
    ["/trade banner", "Trading", 0.02], ["/link", "Getting started", 0.018], ["/help", "Getting started", 0.015], ["/ranks", "Levels", 0.01],
    ["/giveaway create", "Server admins", 0.006], ["/config", "Server admins", 0.005], ["/setup", "Server admins", 0.004], ["/ping", "Getting started", 0.004], ["Report user", "Moderation", 0.003],
  ].map(([name, cat, share]) => ({
    name, cat, share,
    enabled: !(name === "/trade banner" && false),
    cooldown: name.startsWith("/trade") ? 300 : name === "/value" ? 3 : ri(0, 10),
    avgMs: ri(90, 620),
    errors: +(rnd() * 1.6).toFixed(2),
    perm: name === "/config" || name === "/setup" || name === "/giveaway create" ? "Manage Server" : "Everyone",
  }));

  // ---------- trade ads ----------
  const ads_list = [];
  for (let i = 0; i < 120; i++) {
    const u = pick(users);
    const give = [pick(units), rnd() < 0.5 ? pick(units) : null].filter(Boolean);
    const want = [pick(units)];
    const ago = Math.floor(Math.pow(rnd(), 1.8) * 72 * 60);
    const r = rnd();
    ads_list.push({
      id: 48210 - i,
      user: u, give, want,
      tags: [rnd() < 0.3 ? "Overpay" : null, rnd() < 0.25 ? "Offers" : null, rnd() < 0.15 ? "Bulk" : null].filter(Boolean),
      text: give.join(" and ") + (rnd() < 0.3 ? " + add" : "") + " for " + want.join(" "),
      posted: new Date(Date.now() - ago * 60000),
      status: r < 0.07 ? "Flagged" : r < 0.12 ? "Removed" : r < 0.2 ? "Expired" : "Live",
      servers: ri(8, 140),
      bumps: ri(0, 14),
      source: rnd() < 0.27 ? "Website" : "Discord",
    });
  }

  // ---------- values ----------
  const RAR = ["Godly", "Legendary", "Epic", "Rare", "Exclusive", "Limited"];
  const values = units.map((n, i) => {
    const base = Math.round(Math.pow(1.23, 30 - i) * 40 + ri(10, 400));
    const ch = +(rnd() * 34 - 13).toFixed(1);
    return {
      name: n, img: "img/units/" + slug(n) + ".webp", rarity: pick(RAR), value: base, change: ch,
      demand: ri(2, 10), trend: ch > 6 ? "Rising" : ch < -5 ? "Falling" : "Stable",
      lookups: ri(400, 28000), updated: new Date(Date.now() - ri(1, 300) * 3600e3),
      history: Array.from({ length: 30 }, (_, k) => Math.round(base * (1 - ch / 100 * (1 - k / 29)) * (0.97 + rnd() * 0.06))),
    };
  }).sort((a, b) => b.value - a.value);

  const enemies = ["Sproutling", "Weed Walker", "Beetle Brute", "Moth Swarm", "Fungus Tank", "Thorn Golem", "Crow King", "Locust Lord", "Rot Giant", "Frost Snail", "Mole Digger", "Spore Queen"].map((n, i) => ({
    name: n, hp: Math.round(Math.pow(1.7, i) * 120), speed: +(0.6 + rnd() * 1.6).toFixed(1),
    type: pick(["Ground", "Ground", "Flying", "Hidden", "Boss"]), first: ri(1, 40), lookups: ri(60, 3400),
  }));

  // ---------- servers ----------
  const servers = ["GTD Trading Hub", "Garden TD Official Fans", "Bloom Traders", "Seed Market", "Tower Defense Plaza", "The Greenhouse", "GTD Values & Trades", "Leafy Lounge", "Sprout Society", "Rainbow Garden", "Petal Palace", "Garden Guild", "Thorn Trading Co.", "Moss Hangout", "Plant Gang", "Roblox TD Central"].map((n) => ({
    name: n, id: "9" + String(ri(10000000, 99999999)) + String(ri(100000000, 999999999)), members: Math.round(Math.pow(rnd(), 2) * 48000 + 120),
    setup: rnd() < 0.86, adsCh: rnd() < 0.9, feats: ri(3, 9), cmds: ri(200, 42000), joined: new Date(Date.now() - ri(2, 400) * DAY),
  })).sort((a, b) => b.members - a.members);

  // ---------- geography / pages / referrers ----------
  const countries = [
    ["United States", "us", 31.2], ["Philippines", "ph", 11.4], ["United Kingdom", "gb", 7.9], ["Brazil", "br", 6.8], ["Germany", "de", 5.6],
    ["Canada", "ca", 4.9], ["Indonesia", "id", 4.1], ["Australia", "au", 3.6], ["Poland", "pl", 2.9], ["Netherlands", "nl", 2.4], ["Other", "", 19.2],
  ];
  const pages = [
    ["/values.html", "Values", 28.4, 94, 0.31], ["/", "Home", 19.8, 41, 0.52], ["/calculator.html", "Trade calculator", 14.6, 132, 0.24],
    ["/trades.html", "Trade ads", 13.1, 156, 0.27], ["/crates.html", "Crate calculator", 7.2, 101, 0.36], ["/levels.html", "Levels", 4.9, 73, 0.4],
    ["/strategies.html", "Strategies", 4.4, 168, 0.33], ["/features.html", "Features", 3.6, 58, 0.47], ["/dashboard.html", "Server dashboard", 2.3, 188, 0.21],
    ["/profile.html", "Profile", 1.1, 64, 0.29], ["/privacy.html", "Privacy Policy", 0.4, 49, 0.71], ["/terms.html", "Terms of Service", 0.2, 38, 0.74],
  ].map(([path, title, share, time, bounce]) => ({ path, title, share, time, bounce }));
  const referrers = [["Discord", 46.3], ["Direct", 21.5], ["Google", 17.8], ["YouTube", 6.4], ["TikTok", 3.9], ["Roblox", 2.2], ["Other", 1.9]];

  // peak hours heat (7 days x 24 hours), UTC
  const heat = [];
  for (let d = 0; d < 7; d++) {
    const row = [];
    for (let hr = 0; hr < 24; hr++) {
      const curve = Math.exp(-Math.pow((hr - 19) / 4.2, 2)) * 1 + Math.exp(-Math.pow((hr - 1) / 3, 2)) * 0.55 + 0.08;
      const wk = d === 0 || d === 6 ? 1.3 : 1;
      row.push(Math.round(curve * wk * 900 * (0.85 + rnd() * 0.3)));
    }
    heat.push(row);
  }

  // ---------- logs ----------
  const LOGT = [
    ["registration", "New account", (u) => `${u.discord} created an account`],
    ["verification", "Roblox verified", (u) => `${u.discord} verified as ${u.roblox || pick(first) + ri(1, 99)}`],
    ["command", "Command used", (u) => `${u.discord} ran ${pick(COMMANDS).name}`],
    ["trade", "Trade ad posted", (u) => `${u.discord} posted ad #${ri(40000, 48210)}`],
    ["trade", "Trade checked", (u) => `${u.discord} checked a trade (${pick(["Fair", "Win", "Lose", "Big win"])})`],
    ["admin", "Admin action", () => pick(["Marcel updated Sea Dragon value", "Marcel removed ad #47991", "Moderator warned " + pick(users).discord, "Marcel edited the loading messages", "Marcel added a banned word", "Moderator muted " + pick(users).discord + " for 1h", "Marcel started a giveaway"])],
  ];
  const logs = [];
  let tcur = Date.now();
  for (let i = 0; i < 400; i++) {
    tcur -= ri(8, 520) * 1000;
    const tp = rnd() < 0.08 ? LOGT[5] : pick(LOGT.slice(0, 5));
    const u = pick(users);
    logs.push({ time: new Date(tcur), type: tp[0], title: tp[1], text: tp[2](u), user: u, ip: "" });
  }

  // ---------- errors / services ----------
  const ERR = [
    ["Error", "HTTPException 429 Too Many Requests", "trade_ads.post_global", "Discord rate limit while posting to 3 channels"],
    ["Warning", "Value sheet fetch slow (4.8s)", "value_updater.refresh", "Google sheet took longer than 4s"],
    ["Error", "Missing Permissions (50013)", "trade_ads.post_global", "Bot can't send in #trade-ads of a server"],
    ["Warning", "Image moderation timeout", "home.check_image", "Sightengine answered after 6s"],
    ["Error", "KeyError: 'demand'", "value_hub.render", "A unit row had no demand field"],
    ["Info", "Shard 1 reconnected", "gateway", "Resumed session after 2.1s"],
    ["Warning", "Supabase sync lag 42s", "web_sync.push", "Website sync behind by one cycle"],
    ["Error", "Unknown interaction (10062)", "views.TradeCheck", "Button pressed after the 15 min timeout"],
  ];
  const errors = [];
  let ecur = Date.now();
  for (let i = 0; i < 60; i++) {
    ecur -= ri(1200, 36000) * 1000;
    const e = pick(ERR);
    errors.push({ time: new Date(ecur), level: e[0], title: e[1], where: e[2], detail: e[3], count: ri(1, 40), resolved: rnd() < 0.55 });
  }
  const services = [
    ["Discord gateway", "Bot connection, 2 shards", 41, "good"], ["Bot command handler", "Slash commands + buttons", 118, "good"],
    ["Website (Vercel)", "bloombot-gtd.vercel.app", 63, "good"], ["Supabase database", "Website accounts, ads, giveaways", 88, "good"],
    ["Supabase sync", "Bot ↔ website, every 120s", 412, "warn"], ["Value sheet", "Official Garden TD value list", 1830, "warn"],
    ["Image moderation", "Sightengine API", 640, "good"], ["Roblox API", "Profile + verification lookups", 236, "good"],
    ["Discord webhooks", "Dev log + error reports", 97, "good"],
  ].map(([name, desc, ms, st]) => ({ name, desc, ms, st }));
  const uptimeDays = Array.from({ length: 90 }, (_, i) => (i === 61 ? "c" : i === 23 || i === 77 || i === 84 ? "w" : ""));
  const latency = Array.from({ length: 48 }, (_, i) => ({ api: Math.round(40 + rnd() * 30 + (i > 30 && i < 34 ? 70 : 0)), db: Math.round(70 + rnd() * 40), web: Math.round(50 + rnd() * 25) }));

  // ---------- notifications ----------
  const notifs = [
    { t: "5 ads flagged by the word filter", s: "Trade advertisements", ago: "4m", go: "ads", icon: "warning", unread: true },
    { t: "Value sheet sync is slow", s: "System monitoring", ago: "18m", go: "system", icon: "clock", unread: true },
    { t: "42 new accounts today", s: "Users", ago: "1h", go: "users", icon: "verified_stud", unread: true },
    { t: "Giveaway 'Sea Dragon' ends in 3h", s: "Giveaways", ago: "2h", go: "giveaways", icon: "gift", unread: false },
    { t: "Website deploy finished", s: "Website", ago: "5h", go: "website", icon: "chart_up", unread: false },
  ];

  // ---------- misc admin content ----------
  const banned = ["scam", "free robux", "rbx gen", "discord.gg/", "nitro free", "dm me first", "cheap robux", "beam", "hack"];
  const loadingMsgs = ["Watering the garden…", "Counting seeds…", "Checking the value list…", "Asking the gnomes…", "Polishing studs…", "Planting your trade ad…"];
  const giveaways = [
    { title: "Sea Dragon", img: "img/units/sea_dragon.webp", ends: new Date(Date.now() + 3 * 3600e3), entries: 1842, status: "Live", winners: 1 },
    { title: "Rainbow Dragon Fruit", img: "img/units/rainbow_dragon_fruit.webp", ends: new Date(Date.now() + 4 * DAY), entries: 611, status: "Live", winners: 2 },
    { title: "Grim Gardener", img: "img/units/grim_gardener.webp", ends: new Date(Date.now() - 2 * DAY), entries: 2290, status: "Ended", winners: 1 },
    { title: "Laser Plant x5", img: "img/units/laser_plant.webp", ends: new Date(Date.now() + 9 * DAY), entries: 0, status: "Scheduled", winners: 5 },
  ];
  const events = [
    { title: "Double XP weekend", when: "Sat–Sun, all day", status: "Scheduled" },
    { title: "Halloween trade event", when: "Ended 1 Nov", status: "Ended" },
  ];
  const announcements = [
    { title: "Website update: dark mode, quick search", where: "Discord + website", by: "Marcel", when: new Date(Date.now() - 2 * DAY), status: "Sent", reach: 18240 },
    { title: "New units added to the value list", where: "Discord", by: "Value team", when: new Date(Date.now() - 6 * DAY), status: "Sent", reach: 15102 },
    { title: "Double XP weekend", where: "Discord + website banner", by: "Marcel", when: new Date(Date.now() + 1 * DAY), status: "Scheduled", reach: 0 },
    { title: "Trade ad rules reminder", where: "Discord", by: "Moderator", when: null, status: "Draft", reach: 0 },
  ];

  window.AD = {
    today, DAY, days, visits, uniques, regs, verified, active, cmds, ads, lookups, trades,
    users, COMMANDS, ads_list, values, enemies, servers, countries, pages, referrers, heat,
    logs, errors, services, uptimeDays, latency, notifs, banned, loadingMsgs, giveaways, events, announcements, units, slug,
  };
})();
