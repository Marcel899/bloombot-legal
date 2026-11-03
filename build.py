"""Builds the site pages from src/*.html. Run: python3 build.py"""
import hashlib
import re

VER = hashlib.md5(open("style.css", "rb").read()).hexdigest()[:8]
SUPPORT = "https://discord.gg/tGuXfcJxwf"
BASE = "https://bloombot-gtd.vercel.app/"
UPDATED = "3 November 2026"
CLIENT_ID = "1510660385517211820"
# Bot permissions: view/send/history, embeds, files, reactions, external emojis, manage messages,
# manage webhooks (trade ads), manage server (invite tracking), threads, timeout members.
INVITE = f"https://discord.com/oauth2/authorize?client_id={CLIENT_ID}&permissions=1374926793824&integration_type=0&scope=bot+applications.commands"
SUPABASE_URL = "https://rkzgsndfzzgezoltddvx.supabase.co"
SUPABASE_KEY = "sb_publishable_CfTjHiYYCGqLZMlgpiKN-Q_m7JNITb5"  # public key, reads are limited by row level security
DISCORD_SVG = '<svg class="dc" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M20.317 4.37a19.79 19.79 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.865-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.74 19.74 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.058a.082.082 0 0 0 .031.056 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.1 14.1 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.1 13.1 0 0 1-1.872-.892.077.077 0 0 1-.008-.128c.126-.094.252-.192.372-.291a.074.074 0 0 1 .078-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.3 12.3 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.84 19.84 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/></svg>'

HEAD = """<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{title}</title>
<meta name="description" content="{desc}">
<meta property="og:title" content="{title}">
<meta property="og:description" content="{desc}">
<meta property="og:image" content="{base}img/garden.jpg">
<meta property="og:url" content="{base}{path}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Bloombot">
<meta name="twitter:card" content="summary_large_image">
<link rel="canonical" href="{base}{path}">
<meta name="theme-color" content="#13151b">
<meta name="color-scheme" content="dark">
<meta name="darkreader-lock">
<link rel="icon" href="img/favicon.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Comic+Neue:wght@700&family=Nunito:wght@400;600;700;800&display=swap" rel="stylesheet">
<link rel="stylesheet" href="style.css?v={ver}">
<script defer src="js/supabase.js?v=2.45.4"></script>
<script defer src="js/app.js?v={appver}"></script>
<script defer src="js/site.js?v={sitever}"></script>
</head>
<body>
<a class="skip" href="#main">Skip to content</a>
<div class="progress" aria-hidden="true"></div>
<header class="topbar">
<div class="wrap bar">
<a class="mini" href="./"><img class="flower" src="img/flower.png" alt=""><img src="img/logo.png" alt="Bloombot home"></a>
<nav class="links" id="links">{nav}</nav>
<div class="right">
<button class="qs-btn" id="qs" type="button" aria-label="Search the site (Ctrl+K)"><svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" d="M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15Zm5.4-2.1L21 21"/></svg><span>Search</span><kbd>Ctrl K</kbd></button>
<a class="brick nb discord add" href="{invite}">{dsvg}<span>Add<span class="wide"> to Discord</span></span></a>
<div class="acct" id="acct"><button class="brick nb dark login-btn" type="button" data-login>{dsvg}<span>Log in</span></button></div>
<button class="burger" id="burger" type="button" aria-label="Menu" aria-expanded="false"><span></span><span></span><span></span></button>
</div>
</div>
</header>
"""

FOOT = """<footer>
<div class="grass"></div>
<div class="wrap foot">
<div class="foot-mark"><img class="flower" src="img/flower.png" alt=""><img src="img/logo.png" alt="Bloombot"></div>
<nav><a href="./">Home</a><a href="values.html">Values</a><a href="calculator.html">Trade calculator</a><a href="trades.html">Trade ads</a><a href="strategies.html">Strategies</a><a href="features.html">Features &amp; commands</a><a href="{invite}">Add to Discord</a><a href="privacy.html">Privacy Policy</a><a href="terms.html">Terms of Service</a><a href="intents.html">How we use intents</a><a href="{support}">Support server</a></nav>
<p>Bloombot is a fan-made bot. It is not affiliated with Discord, Roblox, or the developers of Garden Tower Defense.</p>
</div>
</footer>
<a class="totop brick dark" href="#" aria-label="Back to top">&#8593;</a>
</body>
</html>
"""


NAV = [
    ("v", "values.html", "dollar", "Values", "blue"),
    ("c", "calculator.html", "calculator", "Calculator", "green"),
    ("a", "trades.html", "swap", "Trade ads", "purple"),
    ("s", "strategies.html", "bullseye", "Strategies", "orange"),
    ("f", "features.html", "gem", "Features", "yellow"),
]
APPVER = hashlib.md5(open("js/app.js", "rb").read()).hexdigest()[:8]
SITEVER = hashlib.md5(open("js/site.js", "rb").read()).hexdigest()[:8]


def page(title, desc, body, cur="", path=""):
    nav = "".join(
        f'<a class="nl{" on g-" + color if key == cur else ""}" href="{href}"><img src="img/{icon}.png" alt=""><span>{label}</span></a>'
        for key, href, icon, label, color in NAV)
    return (HEAD.format(title=title, desc=desc, support=SUPPORT, ver=VER, base=BASE, path=path,
                        invite=INVITE, dsvg=DISCORD_SVG, nav=nav, sburl=SUPABASE_URL, sbkey=SUPABASE_KEY,
                        appver=APPVER, sitever=SITEVER)
            + body + FOOT.replace("{support}", SUPPORT).replace("{invite}", INVITE))


SPY = ""


def hero(icon, h1, sub, art):
    return f"""<section class="hero">
<div class="wrap hero-in">
<h1 class="stud-title"><img class="hero-icon" src="img/{icon}.png" alt=""><img class="title-art" src="img/{art}.png" alt="{h1}"></h1>
<p class="sub">{sub}</p>
</div>
</section>
"""


COLORS = ["green", "blue", "yellow", "purple", "red", "orange"]


def doc(src, icon, h1, sub, title, desc, cur, art):
    body = open(f"src/{src}.html").read()
    if src == "intents":
        items = re.findall(r'<article class="panel" id="([^"]+)">\s*<h2 class="sec[^"]*"><img[^>]*>(.*?)</h2>', body)
        main = body
    else:
        items = []

        def rep(m):
            text = m.group(2)
            items.append((m.group(1), re.sub(r"^\d+\.\s*", "", text)))
            num, _, rest = text.partition(". ")
            return f'<h2 id="{m.group(1)}" class="weld g-{COLORS[(int(num) - 1) % len(COLORS)]}"><span class="num">{num}</span><span>{rest}</span><a class="anchor" href="#{m.group(1)}" aria-label="Link to this section">#</a></h2>'
        body = re.sub(r'<h2 id="([^"]+)">(.*?)</h2>', rep, body)
        main = f'<article class="panel">\n{body}</article>\n'
    toc = "".join(f'<li><a href="#{i}">{t}</a></li>' for i, t in items)
    out = (hero(icon, h1, sub, art)
           + f'<main class="wrap doc" id="main">\n<details class="mtoc"><summary class="weld g-yellow">On this page</summary><ul>{toc}</ul></details>\n<aside class="side"><div class="toc-box"><p class="weld g-yellow">On this page</p><ul>{toc}</ul></div></aside>\n'
           + f'<div class="content">\n{main}</div>\n</main>\n' + SPY)
    open(f"{src}.html", "w").write(page(title, desc, out, cur, f"{src}.html"))


doc("privacy", "shield", "Privacy Policy", f"Last updated {UPDATED}",
    "Bloombot Privacy Policy", "What data the Bloombot Discord bot collects and how it is used.", "p", "t_privacy")
doc("terms", "scale", "Terms of Service", f"Last updated {UPDATED}",
    "Bloombot Terms of Service", "The rules for using the Bloombot Discord bot.", "t", "t_terms")
doc("intents", "gear", "How Bloombot uses intents", "How Bloombot uses the Message Content and Server Members intents, with screenshots",
    "Bloombot Intent Use Cases", "Screenshots showing how Bloombot uses the Message Content and Server Members intents.", "", "t_intents")

FEATURES = [
    ("swap", "Global trade ads", "Post once and your ad reaches every server running Bloombot. Browse them all here.", "trades.html"),
    ("dollar", "Live values", "Every unit's value, demand and 30-day trend, with price charts.", "values.html"),
    ("calculator", "Trade calculator", "See right away if a trade is a win, fair, or a loss.", "calculator.html"),
    ("gem", "All features", "Wishlists, value alerts, DPS ranking, levels, giveaways and more.", "features.html"),
]
TILE_COLORS = ["green", "blue", "yellow", "purple"]
tiles = "".join(f'<a class="tile tlink" href="{u}"><div class="weld g-{c}"><img src="img/{i}.png" alt=""><h3>{h}</h3></div><p>{p}</p><span class="more">Open &rarr;</span></a>' for (i, h, p, u), c in zip(FEATURES, TILE_COLORS))
home = f"""<section class="hero big">
<div class="wrap hero-in">
<div class="hero-mark"><img class="hero-flower" src="img/flower.png" alt=""><img class="hero-logo" src="img/logo.png" alt="Bloombot"></div>
<p class="sub">The trading bot for Roblox Garden Tower Defense.</p>
<div class="ctas">
<a class="brick discord big-cta" href="{INVITE}">{DISCORD_SVG}Add to Discord</a>
<a class="brick blue" href="values.html"><img src="img/dollar.png" alt="">Values</a>
<a class="brick green" href="calculator.html"><img src="img/calculator.png" alt="">Trade calculator</a>
<a class="brick purple" href="trades.html"><img src="img/swap.png" alt="">Trade ads</a>
</div>
<p class="legal-links"><a href="privacy.html">Privacy Policy</a> · <a href="terms.html">Terms of Service</a></p>
</div>
</section>
<main class="wrap" id="main">
<section class="stats" id="stats">
<div class="stat"><img src="img/swap.png" alt=""><div><strong id="st-ads">–</strong><span>live trade ads</span></div></div>
<div class="stat"><img src="img/dollar.png" alt=""><div><strong id="st-values">–</strong><span>units and gamepasses tracked</span></div></div>
<div class="stat"><img src="img/bullseye.png" alt=""><div><strong id="st-strats">–</strong><span>community strategies</span></div></div>
</section>
<section class="tiles">{tiles}</section>
<section class="watch" id="watch" hidden>
<div class="sec-head"><h2>Your watchlist</h2><a href="values.html#watchlist">Edit &rarr;</a></div>
<div class="panel wl" id="wl"></div>
</section>
<section class="movers" id="movers" hidden>
<div class="sec-head"><h2>Biggest moves this month</h2><a href="values.html">All values &rarr;</a></div>
<div class="mv-cols"><div class="panel mv-col"><h3><img src="img/rise.png" alt="">Going up</h3><div id="mv-up"></div></div><div class="panel mv-col"><h3><img src="img/fall.png" alt="">Going down</h3><div id="mv-down"></div></div></div>
</section>
<section class="hstrats" id="hstrats" hidden>
<div class="sec-head"><h2>New strategies</h2><a href="strategies.html">All strategies &rarr;</a></div>
<div class="hs-list" id="hs-list"></div>
</section>
<section class="how">
<h2 class="weld g-green how-title">How it works</h2>
<div class="steps">
<div class="step"><img src="img/num_1.png" alt="1"><div><h3>Link your account</h3><p>Run <code>/link</code> and add your Roblox username and private server link.</p></div></div>
<div class="step"><img src="img/num_2.png" alt="2"><div><h3>Post a trade ad</h3><p>Write your ad in your server's Global Trade Ad Channel. Bloombot shares it with every server in the network.</p></div></div>
<div class="step"><img src="img/num_3.png" alt="3"><div><h3>Get offers</h3><p>Traders DM you, and Bloombot DMs you when a unit on your wishlist is offered.</p></div></div>
</div>
</section>
<section class="cta-panel">
<img src="img/envelope.png" alt="">
<div><h2>Need help or want your data removed?</h2><p>Ask the team in the support server. We answer data requests within 30 days.</p></div>
<a class="brick red" href="{SUPPORT}">Join the support server</a>
</section>
</main>
<script defer src="js/home.js?v={hashlib.md5(open('js/home.js', 'rb').read()).hexdigest()[:8]}"></script>
"""
open("index.html", "w").write(page("Bloombot", "Bloombot is the trading bot for Roblox Garden Tower Defense: global trade ads, live values, trade checks and wishlists. Add it to your Discord server.", home))

# ── Features & commands ──────────────────────────────────────────────────
ALL_FEATURES = [
    ("swap", "Global trade ads", "Post one ad in your server's trade channel and it shows up in every server running Bloombot. Unit names turn into icons."),
    ("dollar", "Live values", "Every unit and gamepass with its value, demand and a price chart, updated from the community value list."),
    ("chart_up", "Value hub", "What's going up, what's going down, our guess for the next 30 days and the best cheap units for your budget."),
    ("calculator", "Trade checker", "Type what you give and what you get and see if it's a win, fair or a loss, with a picture you can share."),
    ("wish_star", "Wishlist", "Add the units you want. Bloombot DMs you the moment a new trade ad offers one."),
    ("bell", "Value alerts", "Follow a unit and get a DM when its price moves 20% or more."),
    ("lightning", "DPS ranking", "Every unit ranked by damage, refreshed each week, plus full unit and enemy stats."),
    ("medal_gold", "Levels and ranks", "Earn XP for using Bloombot. Higher ranks keep their trade ads up longer and auto-bump them."),
    ("offer", "Giveaways", "Run giveaways with entry rules like a role, a linked Roblox account, invites or a level."),
    ("bullseye", "Team finder and strategies", "Find teammates across servers, plus meta loadouts and community guides."),
    ("clock", "Weekly recap", "Every Sunday: the biggest value moves, new units and balance changes."),
    ("shield", "Safe trading", "Ads are screened for scams, bad words and NSFW images, and anyone can report a user."),
]
F_COLORS = ["green", "blue", "yellow", "purple", "red", "orange"]

COMMANDS = [
    ("Getting started", "green", [
        ("/help", "See what Bloombot can do, by topic."),
        ("/link", "Connect your Roblox account and private server link."),
        ("/home", "Your hub: trade ads, team finder, strategies and settings."),
        ("/ping", "Check the bot is online."),
    ]),
    ("Trading", "blue", [
        ("/trade ad", "Post a global trade ad."),
        ("/trade banner", "Make a trading card picture, then post it as an ad."),
        ("/trade bump", "Move your ad back to the bottom (every 5 minutes)."),
        ("/wishlist", "Units you want. Get a DM when an ad offers one."),
        ("Apps → Check trade", "Right-click a trade ad to check if it's fair."),
    ]),
    ("Values", "yellow", [
        ("/value", "A unit's value, demand, price chart, stats and advanced value."),
        ("/value-hub", "Price moves, what to hold, 30-day guesses and cheap units."),
        ("/value-calculator", "What units are worth, or whether a trade is fair."),
    ]),
    ("Stats", "purple", [
        ("/search", "Unit or enemy stats. Partial names work."),
        ("/dps", "This week's DPS ranking of every unit."),
    ]),
    ("Levels", "orange", [
        ("/level", "Your level, XP and rank perks."),
        ("/leaderboard", "The top Bloombot levels."),
        ("/ranks", "Every rank and what it unlocks."),
    ]),
    ("Server admins", "red", [
        ("/setup", "First-time setup of Bloombot's channels. Run this first."),
        ("/config", "Change channels, turn features on or off, set the value-update ping role."),
        ("/giveaway create", "Create a giveaway with optional entry rules."),
        ("Apps → Report user", "Right-click a user to report them to the Bloombot team."),
    ]),
]


import json
import os
os.makedirs("data", exist_ok=True)
with open("data/commands.json", "w") as f:
    json.dump([[c, d, g] for g, _, cmds in COMMANDS for c, d in cmds], f, separators=(",", ":"))


def _esc(t):
    return t.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


ftiles = "".join(
    f'<div class="tile"><div class="weld g-{F_COLORS[n % len(F_COLORS)]}"><img src="img/{i}.png" alt=""><h3>{h}</h3></div><p>{p}</p></div>'
    for n, (i, h, p) in enumerate(ALL_FEATURES))
groups = ""
for name, color, cmds in COMMANDS:
    rows = "".join(
        f'<li class="cmd" data-q="{_esc((c + " " + d).lower())}"><code>{_esc(c)}</code><span>{_esc(d)}</span></li>'
        for c, d in cmds)
    groups += f'<div class="cmd-group"><h3 class="weld g-{color}">{name}</h3><ul>{rows}</ul></div>'
features_body = hero("gem", "Features", "Everything Bloombot can do, and every command.", "t_features") + f"""<main class="wrap" id="main">
<section class="tiles ftiles">{ftiles}</section>
<section class="panel cmds" id="commands">
<div class="cmds-head"><h2 class="sec weld g-yellow"><img src="img/bell.png" alt="">Commands</h2>
<input class="search" id="cmdq" type="search" placeholder="Search commands…" aria-label="Search commands"></div>
<div class="cmd-grid">{groups}</div>
<p class="empty" id="cmdnone" hidden>No command matches that.</p>
</section>
<section class="cta-panel">
<img src="img/gem.png" alt="">
<div><h2>Want Bloombot in your server?</h2><p>Add it, then run <code>/setup</code>. It takes about a minute.</p></div>
<a class="brick discord" href="{INVITE}">{DISCORD_SVG}Add to Discord</a>
</section>
</main>
"""
open("features.html", "w").write(page("Bloombot Features and Commands", "Everything the Bloombot Discord bot can do for Garden Tower Defense traders, and every slash command.", features_body, "f", "features.html"))

# ── Trade ads (Discord login through Supabase) ───────────────────────────
JSVER = {n: hashlib.md5(open(f"js/{n}.js", "rb").read()).hexdigest()[:8] for n in ("trades", "values", "calc", "strategies", "home")}
trades_body = hero("swap", "Trade ads", "Every live Bloombot trade ad, from every server. Post your own right here.", "t_trades") + f"""<main class="wrap trades" id="main">
<section class="panel login" id="login" hidden>
<img class="login-icon" src="img/swap.png" alt="">
<h2>Log in to see trade ads</h2>
<p>Trade ads are only shown to Discord users. We use your Discord account only to log you in.</p>
<button class="brick discord" type="button" data-login>{DISCORD_SVG}Log in with Discord</button>
<p class="err" id="loginerr" hidden></p>
</section>
<section id="board" hidden>
<form class="panel post" id="postform">
<div class="post-head"><img id="meav" alt=""><div><strong>Post a trade ad as <span id="mename"></span></strong><span>It goes to every server running Bloombot, just like posting in a trade ad channel.</span></div></div>
<div class="composer" id="post">
<div class="cmp-side have"><div class="cmp-top"><span class="cmp-label">I'm trading</span><span class="cmp-hint">pick units</span></div>
<div class="cmp-chips" id="hchips"></div>
<div class="picker"><input class="search" id="hq" type="search" autocomplete="off" placeholder="Search a unit…" aria-label="Add a unit you're trading"><div class="sugs" id="hsug" hidden></div></div>
<div class="cmp-tags"><button class="tagb" type="button" data-tag="have-add"><img src="img/add.png" alt="">+ add</button><button class="tagb" type="button" data-tag="have-bulk"><img src="img/bulk.png" alt="">Bulk</button></div>
</div>
<div class="cmp-mid"><img src="img/swap.png" alt=""><span>for</span></div>
<div class="cmp-side want"><div class="cmp-top"><span class="cmp-label">I want</span><span class="cmp-hint">or leave empty for offers</span></div>
<div class="cmp-chips" id="wchips"></div>
<div class="picker"><input class="search" id="wq" type="search" autocomplete="off" placeholder="Search a unit…" aria-label="Add a unit you want"><div class="sugs" id="wsug" hidden></div></div>
<div class="cmp-tags"><button class="tagb" type="button" data-tag="want-offers"><img src="img/offer.png" alt="">Offers</button><button class="tagb" type="button" data-tag="want-add"><img src="img/add.png" alt="">+ add</button><button class="tagb" type="button" data-tag="want-overpay"><img src="img/big_add.png" alt="">Overpay</button></div>
</div>
</div>
<label class="cmp-text-label" for="adtext">Your trade ad <span>Built from your picks. You can also type it yourself.</span></label>
<div class="post-row">
<textarea id="adtext" rows="2" maxlength="220" placeholder="e.g. tesla + 2x peashooter for beehive" aria-label="Your trade ad"></textarea>
</div>
<div class="cmp-preview" id="adprev" hidden><span class="pv-label">Preview</span><div id="adprevbody"></div></div>
<div class="post-foot"><span class="hint">7 to 200 characters, no links, one ad every 5 minutes. You need a linked account (<code>/link</code> in Discord). Press Enter to post.</span><span id="adcount" class="count">0/200</span></div>
<div class="post-actions"><button class="brick dark sm" id="adclear" type="button">Clear</button><button class="brick green" id="postbtn" type="submit"><img src="img/plus.png" alt="">Post trade ad</button></div>
<p class="post-status" id="poststatus" hidden></p>
</form>
<div class="board-bar">
<input class="search" id="adq" type="search" placeholder="Search units or traders…" aria-label="Search trade ads">
<select id="adsort" aria-label="Sort"><option value="new">Newest first</option><option value="old">Oldest first</option><option value="ending">Ending soon</option></select>
<label class="mine"><input type="checkbox" id="mine"> Only my ads</label>
<span class="count-pill" id="count"></span>
</div>
<div class="quick"><span>Quick search:</span><button class="chip" type="button" data-q="LF">LF</button><button class="chip" type="button" data-q="offers">Offers</button><button class="chip" type="button" data-q="gold">Gold</button><button class="chip" type="button" data-q="rainbow">Rainbow</button><button class="chip" type="button" data-q="">Clear</button></div>
<div class="tlist" id="tlist"></div>
<p class="empty" id="tnone" hidden>No trade ads right now.</p>
<div class="more-wrap"><button class="brick dark" id="more" type="button" hidden>Show more</button></div>
</section>
<div class="skel-grid sk-ads" id="loading" aria-busy="true" aria-label="Loading"><div class="skel"><i></i><i></i><i></i></div><div class="skel"><i></i><i></i><i></i></div><div class="skel"><i></i><i></i><i></i></div><div class="skel"><i></i><i></i><i></i></div><div class="skel"><i></i><i></i><i></i></div><div class="skel"><i></i><i></i><i></i></div></div>
</main>
<script defer src="js/trades.js?v={JSVER['trades']}"></script>
"""
open("trades.html", "w").write(page("Bloombot Trade Ads", "Browse and post Bloombot trade ads for Garden Tower Defense. Log in with Discord.", trades_body, "a", "trades.html"))

# ── Values ───────────────────────────────────────────────────────────────
values_body = hero("dollar", "Values", "Every Garden Tower Defense unit and gamepass, with demand and 30-day trends.", "t_values") + f"""<main class="wrap vals" id="main">
<section class="panel filters">
<input class="search" id="vq" type="search" placeholder="Search a unit…" aria-label="Search units">
<div class="chips"><button class="chip on" type="button" data-cat="all">All</button><button class="chip" type="button" data-cat="units">Units</button><button class="chip" type="button" data-cat="gamepasses">Gamepasses</button><button class="chip star-chip" type="button" data-cat="fav">★ Watchlist</button></div>
<select id="vrar" aria-label="Rarity"><option value="">All rarities</option></select>
<select id="vsort" aria-label="Sort"><option value="value">Highest value</option><option value="low">Lowest value</option><option value="demand">Most demand</option><option value="up">Rising most</option><option value="down">Falling most</option><option value="name">A to Z</option></select>
</section>
<div class="vinfo"><span id="vcount"></span><span id="vupdated"></span></div>
<div class="skel-grid sk-vals" id="vloading" aria-busy="true" aria-label="Loading"><div class="skel"><i></i><i></i><i></i></div><div class="skel"><i></i><i></i><i></i></div><div class="skel"><i></i><i></i><i></i></div><div class="skel"><i></i><i></i><i></i></div><div class="skel"><i></i><i></i><i></i></div><div class="skel"><i></i><i></i><i></i></div><div class="skel"><i></i><i></i><i></i></div><div class="skel"><i></i><i></i><i></i></div></div>
<div class="vgrid" id="vgrid"></div>
<p class="empty" id="vnone" hidden>No unit matches that.</p>
<p class="note">Values come from the community value list and update about every 2 days. They are estimates, not guarantees.</p>
</main>
<div class="modal" id="vmodal" hidden><div class="modal-box panel" role="dialog" aria-modal="true"><button class="modal-x" id="vmclose" type="button" aria-label="Close">×</button><div id="vmbody"></div></div></div>
<script defer src="js/values.js?v={JSVER['values']}"></script>
"""
open("values.html", "w").write(page("Bloombot Values · Garden Tower Defense", "Live Garden Tower Defense unit and gamepass values with demand, status and 30-day trends.", values_body, "v", "values.html"))

# ── Trade calculator ─────────────────────────────────────────────────────
def side(key, title, color):
    return f"""<section class="panel cside">
<h2 class="weld g-{color} cs-title">{title}<span class="cs-total" id="{key}total">0</span></h2>
<div class="picker"><input class="search" id="{key}q" type="search" autocomplete="off" placeholder="Add a unit or a value like 4k" aria-label="Add to {title}"><div class="sugs" id="{key}sug" hidden></div></div>
<div class="clist" id="{key}list"></div>
<p class="cempty" id="{key}empty">Nothing here yet.</p>
</section>"""


calc_body = hero("calculator", "Trade calculator", "Is it a win, fair or a loss? Add both sides and find out.", "t_calc") + f"""<main class="wrap calc" id="main">
<p class="loading" id="cloading">Loading values…</p>
<div class="cgrid">
{side("give", "You give", "red")}
<div class="cmid">
<div class="verdict" id="verdict"><strong>Add units to both sides</strong><span>Search a unit or type a value like 4k.</span></div>
<div class="meter" id="meter"><i></i></div>
<div class="cbtns"><button class="brick dark sm" id="swap" type="button">⇄ Swap sides</button><button class="brick dark sm" id="clear" type="button">Clear</button></div>
<div class="cbtns share-btns"><button class="brick blue sm" id="copylink" type="button">Copy link</button><button class="brick discord sm" id="copytext" type="button">Copy for Discord</button></div>
<div class="fairadds" id="fairadds"></div>
</div>
{side("get", "You get", "green")}
</div>
<p class="note">Fair means both sides are within 5%, the same rule as Bloombot's <code>/value-calculator</code>. Use Copy link to share this exact trade.</p>
</main>
<script defer src="js/calc.js?v={JSVER['calc']}"></script>
"""
open("calculator.html", "w").write(page("Bloombot Trade Calculator · Garden Tower Defense", "Check if a Garden Tower Defense trade is a win, fair or a loss with live values.", calc_body, "c", "calculator.html"))



# ── Strategies ───────────────────────────────────────────────────────────
strat_body = hero("bullseye", "Strategies", "Community strategies for Garden Tower Defense. Share yours and it shows up in /home in Discord too.", "t_strategies") + f"""<main class="wrap strats" id="main">
<section class="panel share" id="share">
<div id="slogin" class="share-login"><div><strong>Got a good strategy?</strong><span>Log in with Discord to share it with every Bloombot server.</span></div><button class="brick discord" type="button" data-login>{DISCORD_SVG}Log in to share</button></div>
<form id="sform" hidden>
<h2 class="share-title">Share a strategy as <span id="sname"></span></h2>
<div class="srow"><label>Title<input class="search" id="st" maxlength="80" placeholder="e.g. Solo Hard Mode with Cactus"></label><label>Category<select id="sc"><option value="general">General</option><option value="meta-units">Meta units</option><option value="map-specific">Map-specific</option></select></label></div>
<label>Details<textarea id="sd" rows="5" maxlength="1500" placeholder="Units you need, where to place them, upgrade order and tips…"></textarea></label>
<div class="post-foot"><span class="hint">Title <span id="stc" class="count">0/80</span> · Details <span id="sdc" class="count">0/1500</span> · No links. One strategy every 10 minutes. You need a linked account (<code>/link</code>).</span><button class="brick green" id="sbtn" type="submit">Share strategy</button></div>
<p class="post-status" id="sstatus" hidden></p>
</form>
</section>
<div class="board-bar">
<input class="search" id="sq" type="search" placeholder="Search strategies…" aria-label="Search strategies">
<div class="chips"><button class="chip on" type="button" data-scat="all">All</button><button class="chip" type="button" data-scat="meta-units">Meta units</button><button class="chip" type="button" data-scat="map-specific">Map-specific</button><button class="chip" type="button" data-scat="general">General</button></div>
<span class="count-pill" id="scount"></span>
</div>
<div class="skel-grid sk-strats" id="sloading" aria-busy="true" aria-label="Loading"><div class="skel"><i></i><i></i><i></i></div><div class="skel"><i></i><i></i><i></i></div><div class="skel"><i></i><i></i><i></i></div></div>
<div class="slist" id="slist"></div>
<p class="empty" id="snone" hidden>No strategies match that.</p>
</main>
<script defer src="js/strategies.js?v={JSVER['strategies']}"></script>
"""
open("strategies.html", "w").write(page("Bloombot Strategies · Garden Tower Defense", "Community Garden Tower Defense strategies: meta units, map-specific guides and general tips.", strat_body, "s", "strategies.html"))

notfound = hero("warning", "Page not found", "That page doesn't exist. It may have moved.", "t_404") + """<main class="wrap" id="main"><section class="cta-panel nf">
<img src="img/swap.png" alt="">
<div><h2>Let's get you back</h2><p>Head home, or open the Privacy Policy or Terms of Service.</p></div>
<a class="brick green" href="./">Go home</a>
</section></main>
"""
open("404.html", "w").write(re.sub(r'href="([a-z]+\.html)"', r'href="/\1"', page("Page not found · Bloombot", "This page does not exist.", notfound.replace('href="./"', 'href="/"')).replace('src="img/', 'src="/img/').replace('src="js/', 'src="/js/').replace('href="style.css', 'href="/style.css').replace('href="img/', 'href="/img/').replace('<a class="mini" href="./">', '<a class="mini" href="/">').replace('<a href="./">Home</a>', '<a href="/">Home</a>')))
