"""Builds the site pages from src/*.html. Run: python3 build.py"""
import hashlib
import re

VER = hashlib.md5(open("style.css", "rb").read()).hexdigest()[:8]
SUPPORT = "https://discord.gg/tGuXfcJxwf"
BASE = "https://bloombot-gtd.vercel.app/"
UPDATED = "7 November 2026"
CLIENT_ID = "1510660385517211820"
# Bot permissions: view/send/history, embeds, files, reactions, external emojis, manage messages,
# manage webhooks (trade ads), manage server (invite tracking), threads, timeout members.
INVITE = f"https://discord.com/oauth2/authorize?client_id={CLIENT_ID}&permissions=1374926793824&integration_type=0&scope=bot+applications.commands"
SUPABASE_URL = "https://rkzgsndfzzgezoltddvx.supabase.co"
SUPABASE_KEY = "sb_publishable_CfTjHiYYCGqLZMlgpiKN-Q_m7JNITb5"  # public key, reads are limited by row level security
import json as _json
HOME_LD = '<script type="application/ld+json">' + _json.dumps([
    {"@context": "https://schema.org", "@type": "WebSite", "name": "Bloombot", "url": BASE,
     "description": "Garden Tower Defense trading bot: trade ads, live values, trade calculator and strategies."},
    {"@context": "https://schema.org", "@type": "SoftwareApplication", "name": "Bloombot",
     "applicationCategory": "GameApplication", "operatingSystem": "Discord", "url": BASE,
     "image": BASE + "img/logo.png", "offers": {"@type": "Offer", "price": "0", "priceCurrency": "USD"},
     "description": "Discord bot for Roblox Garden Tower Defense traders: global trade ads, live unit values, trade checks and wishlists."},
]).replace("<", "\\u003c") + "</script>\n"
KEYWORDS = ("Garden Tower Defense, GTD, Roblox, Discord bot, GTD Discord, Garden Tower Defense Discord, "
            "GTD values, Garden Tower Defense values, GTD trading, GTD trade ads, value list, Bloombot")
PAGE_KW = {
    "values.html": "GTD value list, Garden Tower Defense value list, unit values, gamepass values, demand, value trends",
    "calculator.html": "GTD trade calculator, Garden Tower Defense trade calculator, win or loss, WFL, fair trade",
    "levels.html": "Bloombot levels, GTD Discord bot XP, rank perks, XP tasks, Garden Tower Defense trading rank",
    "farm.html": "GTD seeds per hour, Garden Tower Defense fertilizer per hour, farm calculator, best farming, seeds calculator, fertilizer calculator, grind time",
    "crates.html": "GTD crate calculator, Garden Tower Defense summon calculator, drop chance, summon odds, pity, luck, how many summons, Skull Summon, Classic Summon",
    "trades.html": "GTD trade ads, Garden Tower Defense trading server, trade ads, LF NLF",
    "strategies.html": "GTD strategies, Garden Tower Defense strategy, best units, meta units, loadouts, map guides",
    "features.html": "Discord trading bot, Roblox trading bot, slash commands, wishlist, trade check",
}
# Pages Google should list (profile, dashboard and 404 are noindex).
SITEMAP = ["", "features.html", "trades.html", "values.html", "calculator.html", "crates.html", "farm.html", "levels.html", "strategies.html", "privacy.html", "terms.html", "intents.html"]
DISCORD_SVG = '<img class="dc" src="img/discord_stud_white.png" alt="">'

HEAD = """<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{title}</title>
<meta name="description" content="{desc}">
<meta property="og:title" content="{title}">
<meta property="og:description" content="{desc}">
<meta property="og:image" content="{base}img/og-v2.jpg">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:image" content="{base}img/og-v2.jpg">
<meta property="og:url" content="{base}{path}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Bloombot">
<meta name="twitter:card" content="summary_large_image">
<link rel="canonical" href="{base}{path}">
<meta name="robots" content="{robots}">
<meta name="keywords" content="{keywords}">
<meta name="google-site-verification" content="wgEfTTw4ymFeGxytFVhbK6OwL639P6QfcPRBa0BeqMo">
<meta name="theme-color" content="#13151b">
<meta name="color-scheme" content="dark">
<meta name="darkreader-lock">
<link rel="icon" href="img/favicon.png">
<link rel="stylesheet" href="style.css?v={ver}">
<script src="js/theme.js?v={themever}"></script>
<script defer src="js/supabase.js?v=2.45.4"></script>
<script defer src="js/app.js?v={appver}"></script>
<script defer src="js/site.js?v={sitever}"></script>
<script defer src="js/giveaway.js?v={gwver}"></script>
<script defer src="js/consent.js?v={ckver}"></script>
<script defer src="js/track.js?v={trver}"></script>
{ld}</head>
<body>
<a class="skip" href="#main">Skip to content</a>
<div class="progress" aria-hidden="true"></div>
<header class="topbar">
<div class="wrap bar">
<a class="mini" href="./"><img class="flower" src="img/flower.png" alt=""><img src="img/logo.png" alt="Bloombot home"></a>
<nav class="links" id="links">{nav}</nav>
<div class="right">
<button class="qs-btn" id="qs" type="button" aria-label="Search the site (Ctrl+K)"><svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" d="M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15Zm5.4-2.1L21 21"/></svg><span>Search</span><kbd>Ctrl K</kbd></button>
<button class="theme-btn" id="themebtn" type="button" aria-label="Switch to light mode" aria-pressed="false"><img class="i-sun" src="img/sun.png" alt=""><img class="i-moon" src="img/moon.png" alt=""></button>
<a class="brick nb discord add" href="{invite}">{dsvg}<span>Add<span class="wide"> to Discord</span></span></a>
<div class="acct" id="acct"><button class="brick nb dark login-btn" type="button" data-login><img class="dc" src="img/login.png" alt=""><span>Log in</span></button></div>
<button class="burger" id="burger" type="button" aria-label="Menu" aria-expanded="false"><span></span><span></span><span></span></button>
</div>
</div>
</header>
"""

FOOT = """<footer>
<div class="wrap foot">
<div class="foot-top">
<div class="foot-brand">
<a class="foot-mark" href="./"><img class="flower" src="img/flower.png" alt=""><img src="img/logo.png" alt="Bloombot home"></a>
<p>The trading bot for Roblox Garden Tower Defense. Trade ads, live values, calculators and strategies, free in every server.</p>
<div class="foot-cta"><a class="brick discord sm" href="{invite}">{dsvg}Add to Discord</a><a class="brick dark sm" href="{support}"><img src="img/envelope.png" alt="">Support</a></div>
</div>
<nav class="foot-cols" aria-label="Footer">
<div><h2>Tools</h2><a href="values.html">Values</a><a href="calculator.html">Trade calculator</a><a href="crates.html">Crate calculator</a><a href="farm.html">Farm calculator</a><a href="trades.html">Trade ads</a><a href="strategies.html">Strategies</a><a href="levels.html">Levels &amp; perks</a></div>
<div><h2>Bot</h2><a href="./">Home</a><a href="features.html">Features &amp; commands</a><a href="dashboard.html">Server dashboard</a><a href="{invite}">Add to Discord</a><a href="{support}">Support server</a></div>
<div><h2>Legal</h2><a href="privacy.html">Privacy Policy</a><a href="terms.html">Terms of Service</a><a href="privacy.html#cookies" data-cookies>Cookie settings</a></div>
</nav>
</div>
<div class="foot-bottom">
<p>Unit values come from the <a href="https://sites.google.com/view/garden-td-values/main-page" target="_blank" rel="noopener">official Garden TD value list</a>. Thanks to its team!</p>
<p>&copy; 2026 Bloombot. A fan-made bot, not affiliated with Discord, Roblox, or the developers of Garden Tower Defense.</p>
</div>
</div>
</footer>
<a class="totop brick dark" href="#" aria-label="Back to top"><img src="img/up.png" alt=""></a>
</body>
</html>
"""


NAV = [
    ("v", "values.html", "dollar", "Values", "blue"),
    ("c", "calculator.html", "calculator", "Calculator", "green"),
    ("a", "trades.html", "trading", "Trade ads", "purple"),
    ("s", "strategies.html", "bullseye", "Strategies", "orange"),
    ("f", "features.html", "gem", "Features", "yellow"),
]
APPVER = hashlib.md5(open("js/app.js", "rb").read()).hexdigest()[:8]
SITEVER = hashlib.md5(open("js/site.js", "rb").read()).hexdigest()[:8]
THEMEVER = hashlib.md5(open("js/theme.js", "rb").read()).hexdigest()[:8]
GWVER = hashlib.md5(open("js/giveaway.js", "rb").read()).hexdigest()[:8]
CKVER = hashlib.md5(open("js/consent.js", "rb").read()).hexdigest()[:8]
TRVER = hashlib.md5(open("js/track.js", "rb").read()).hexdigest()[:8]


def page(title, desc, body, cur="", path="", index=True, ld="", kw=""):
    nav = "".join(
        f'<a class="nl{" on g-" + color if key == cur else ""}" data-g="{color}" href="{href}"><img src="img/{icon}.png" alt=""><span>{label}</span></a>'
        for key, href, icon, label, color in NAV)
    kw = kw or PAGE_KW.get(path, "")
    return (HEAD.format(title=title, desc=desc, support=SUPPORT, ver=VER, base=BASE, path=path,
                        invite=INVITE, dsvg=DISCORD_SVG, nav=nav, sburl=SUPABASE_URL, sbkey=SUPABASE_KEY,
                        appver=APPVER, themever=THEMEVER, sitever=SITEVER, gwver=GWVER, ckver=CKVER, trver=TRVER,
                        robots="index, follow, max-image-preview:large" if index else "noindex, follow",
                        ld=ld, keywords=(kw + ", " if kw else "") + KEYWORDS)
            + body + FOOT.replace("{support}", SUPPORT).replace("{invite}", INVITE).replace("{dsvg}", DISCORD_SVG))


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
    ("trading", "Global trade ads", "Post once and your ad reaches every server running Bloombot.", "trades.html", "green"),
    ("dollar", "Live values", "Every unit's value, demand and 30-day trend, with price charts.", "values.html", "blue"),
    ("calculator", "Trade calculator", "See right away if a trade is a win, fair, or a loss.", "calculator.html", "yellow"),
    ("crate", "Crate calculator", "Your real chance per crate, and how much to save first.", "crates.html", "orange"),
    ("bullseye", "Strategies", "Loadouts and map guides from the community. Share your own.", "strategies.html", "purple"),
    ("medal_gold", "Levels & perks", "Earn XP for trading and helping out. Unlock ranks and banners.", "levels.html", "red"),
]
tiles = "".join(f'<a class="tile tlink" href="{u}"><div class="weld g-{c}"><img src="img/{i}.png" alt=""><h3>{h.replace("&", "&amp;")}</h3></div><p>{p}</p><span class="more">Open &rarr;</span></a>' for i, h, p, u, c in FEATURES)


def dc_msg(body, time="Today at 17:13"):
    return (f'<div class="dmsg"><img class="dav" src="img/flower.png" alt=""><div class="dbody">'
            f'<div class="dname"><strong>Bloombot</strong><span class="dapp">APP</span><span class="dtime">{time}</span></div>{body}</div></div>')


def unit(n, label):
    return f'<span class="dunit"><img src="img/units/{n}.webp" alt="">{label}</span>'


DEMOS = [
    ("post", "Post once", "img/trading.png",
     dc_msg('<div class="demb g-bar-purple"><p class="dtitle"><img src="img/trading.png" alt="">Trade Ad</p>'
            f'<p>{unit("grim_gardener", "Grim Gardener")} for {unit("coffinroot", "Coffinroot")} + add</p>'
            '<p class="dmeta"><b>Trader:</b> <span class="dping">@you</span><br><b>Roblox:</b> <span class="dlink">your_name</span></p></div>'
            '<p class="dok"><img src="img/win.png" alt=""><span>Your trade ad was posted to <b>26 servers</b>.</span></p>', "Today at 16:58")),
    ("wish", "Wishlist DMs", "img/wish_star.png",
     dc_msg('<div class="demb g-bar-yellow"><p class="dtitle"><img src="img/wish_star.png" alt="">Wishlist match</p>'
            f'<p>{unit("grim_gardener", "Grim Gardener")} is offered in a new trade ad.</p>'
            f'<p class="dquote">{unit("witchleaf", "Witchleaf")} and {unit("ghost_pepper", "Ghost Pepper")} for offers</p>'
            '<p class="dmeta"><b>Trader:</b> <span class="dping">@gardenpro</span></p>'
            '<span class="dbtn"><img src="img/wish_star.png" alt="">Remove Grim Gardener</span></div>')),
    ("check", "Trade checks", "img/scale.png",
     dc_msg('<div class="demb g-bar-green"><p class="dtitle"><img src="img/scale.png" alt="">Trade check</p>'
            f'<div class="dsides"><div><em>You give</em>{unit("witchleaf", "Witchleaf")}{unit("ghost_pepper", "Ghost Pepper")}</div>'
            f'<div><em>You get</em>{unit("grim_gardener", "Grim Gardener")}</div></div>'
            '<p class="dverdict"><img src="img/win.png" alt=""><b>Win</b> &middot; you get about 18% more value</p></div>', "Today at 17:20")),
]
demo_tabs = "".join(f'<button type="button" role="tab" class="dtab{" on" if i == 0 else ""}" data-d="{k}" aria-selected="{"true" if i == 0 else "false"}"><img src="{ic}" alt="">{t}</button>' for i, (k, t, ic, _) in enumerate(DEMOS))
demo_panes = "".join(f'<div class="dpane" data-d="{k}" role="tabpanel"{"" if i == 0 else " hidden"}>{m}</div>' for i, (k, t, ic, m) in enumerate(DEMOS))

home = f"""<section class="hero big">
<div class="wrap hero-in">
<h1 class="hero-mark"><img class="hero-flower" src="img/flower.png" alt=""><img class="hero-logo" src="img/logo.png" alt="Bloombot, the Garden Tower Defense trading bot"></h1>
<p class="sub">The free trading bot for Roblox Garden Tower Defense.<br class="br-wide"> Trade ads, live values and trade checks in every server.</p>
<div class="ctas">
<a class="brick discord big-cta" href="{INVITE}">{DISCORD_SVG}Add to Discord</a>
<a class="brick purple big-cta" href="trades.html"><img src="img/trading.png" alt="">Browse trade ads</a>
</div>
<div class="hstats" id="stats">
<span hidden><img src="img/shield.png" alt=""><strong id="st-servers">–</strong> servers</span>
<span hidden><img src="img/medal_gold.png" alt=""><strong id="st-users">–</strong> users</span>
<span><i class="live" aria-hidden="true"></i><strong id="st-ads">–</strong> live trade ads</span>
<span><img src="img/dollar.png" alt=""><strong id="st-values">–</strong> units tracked</span>
<span><img src="img/bullseye.png" alt=""><strong id="st-strats">–</strong> strategies</span>
</div>
</div>
</section>
<main class="wrap home" id="main">
<section class="tiles six">{tiles}</section>
<section class="watch" id="watch" hidden>
<div class="sec-head"><h2>Your watchlist</h2><a href="values.html#watchlist">Edit &rarr;</a></div>
<div class="panel wl" id="wl"></div>
</section>
<section class="now" id="now" hidden>
<div class="sec-head"><h2><i class="live" aria-hidden="true"></i>Happening now</h2><a href="trades.html">All trade ads &rarr;</a></div>
<div class="now-grid">
<div class="panel now-ads" id="hads-box" hidden><h3><img src="img/trading.png" alt="">Newest trade ads</h3><div id="hads"></div></div>
<div class="panel mv-col" id="mv-box" hidden><div class="mv-head"><h3><img src="img/chart_up.png" alt="">Biggest moves</h3><div class="mv-tabs" role="tablist"><button type="button" class="on" data-m="up" aria-selected="true">Up</button><button type="button" data-m="down" aria-selected="false">Down</button></div></div><div id="mv-up"></div><div id="mv-down" hidden></div><a class="mv-all" href="values.html">All values &rarr;</a></div>
</div>
</section>
<section class="hstrats" id="hstrats" hidden>
<div class="sec-head"><h2>New strategies</h2><a href="strategies.html">All strategies &rarr;</a></div>
<div class="hs-list" id="hs-list"></div>
</section>
<section class="demo">
<div class="demo-text">
<h2>Right inside your Discord</h2>
<p>Bloombot does the busy work, so you can focus on the trade.</p>
<div class="dtabs" role="tablist">{demo_tabs}</div>
<p class="demo-hint" id="demo-hint">Your ad goes to every server running Bloombot, not just one.</p>
</div>
<div class="demo-shot" aria-label="Example Bloombot messages in Discord">{demo_panes}</div>
</section>
<section class="how">
<div class="sec-head"><h2>How it works</h2><a href="features.html">All features &rarr;</a></div>
<div class="steps">
<div class="step"><img src="img/num_1.png" alt="1"><div><h3>Make your account</h3><p>Log in here with Discord or Google, or run <code>/link</code>, and add your Roblox username.</p></div></div>
<div class="step"><img src="img/num_2.png" alt="2"><div><h3>Post a trade ad</h3><p>Post it on this site or in a Global Trade Ad Channel. It reaches every server running Bloombot.</p></div></div>
<div class="step"><img src="img/num_3.png" alt="3"><div><h3>Get offers</h3><p>Traders DM you, and Bloombot DMs you when a unit on your wishlist is offered.</p></div></div>
</div>
</section>
<section class="hband">
<img class="hband-flower" src="img/flower.png" alt="">
<div class="hband-text"><h2>Bring Bloombot to your server</h2><p>Free, set up in a minute. Pick your channels and pings from the dashboard.</p></div>
<div class="hband-btns">
<a class="brick discord" href="{INVITE}">{DISCORD_SVG}Add to Discord</a>
<a class="brick dark" href="dashboard.html"><img src="img/gear.png" alt="">Dashboard</a>
<a class="brick dark" href="{SUPPORT}"><img src="img/envelope.png" alt="">Support</a>
</div>
</section>
</main>
<script defer src="js/home.js?v={hashlib.md5(open('js/home.js', 'rb').read()).hexdigest()[:8]}"></script>
"""
open("index.html", "w").write(page("Bloombot · Garden Tower Defense Trading Bot, Values and Trade Ads", "Bloombot is the trading bot for Roblox Garden Tower Defense: global trade ads, live values, trade checks and wishlists. Add it to your Discord server.", home, ld=HOME_LD))

# ── Features & commands ──────────────────────────────────────────────────
ALL_FEATURES = [
    # (icon, title, text, commands, (site link, label) or None)
    ("trading", "Global trade ads", "Post one ad in your server's trade channel and it shows up in every server running Bloombot. Unit names turn into icons.", ["/trade ad", "/trade bump"], ("trades.html", "Trade ads")),
    ("dollar", "Live values", "Every unit and gamepass with its value, demand and a price chart, updated from the community value list.", ["/value"], ("values.html", "Value list")),
    ("chart_up", "Value hub", "What's going up, what's going down, our guess for the next 30 days and the best cheap units for your budget.", ["/value-hub"], None),
    ("calculator", "Trade checker", "Type what you give and what you get and see if it's a win, fair or a loss, with a picture you can share.", ["/value-calculator"], ("calculator.html", "Calculator")),
    ("wish_star", "Wishlist", "Add the units you want. Bloombot DMs you the moment a new trade ad offers one.", ["/wishlist"], None),
    ("bell", "Value alerts", "Follow a unit and get a DM when its price moves 20% or more.", ["/value"], None),
    ("lightning", "DPS ranking", "Every unit ranked by damage, refreshed each week, plus full unit and enemy stats.", ["/dps", "/search"], None),
    ("medal_gold", "Levels and ranks", "Earn XP for using Bloombot. Higher ranks keep their trade ads up longer and auto-bump them.", ["/level", "/ranks"], ("levels.html", "Perks")),
    ("gift", "Giveaways", "Run giveaways with entry rules like a role, a linked Roblox account, invites or a level.", ["/giveaway create"], None),
    ("bullseye", "Team finder and strategies", "Find teammates across servers, plus meta loadouts and community guides.", ["/home"], ("strategies.html", "Strategies")),
    ("clock", "Weekly recap", "Every Sunday: the biggest value moves, new units and balance changes.", ["/config"], None),
    ("shield", "Safe trading", "Ads are screened for scams, bad words and NSFW images, and anyone can report a user.", ["Report user"], ("terms.html", "Rules")),
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


def _ftile(n, i, h, p, cmds, link):
    chips = "".join(f'<a class="fcmd" href="#cmd={_esc(c)}">{_esc(c)}</a>' for c in cmds)
    more = f'<a class="fgo" href="{link[0]}">{link[1]} &rarr;</a>' if link else ""
    return (f'<div class="tile ftile"><div class="weld g-{F_COLORS[n % len(F_COLORS)]}"><img src="img/{i}.png" alt=""><h3>{h}</h3></div>'
            f'<p>{p}</p><div class="ffoot">{chips}{more}</div></div>')


ftiles = "".join(_ftile(n, *f) for n, f in enumerate(ALL_FEATURES))
groups = ""
gchips = '<button class="chip on" type="button" data-cg="all">All<i>%d</i></button>' % sum(len(c) for _, _, c in COMMANDS)
for name, color, cmds in COMMANDS:
    gid = name.lower().replace(" ", "-")
    rows = "".join(
        f'<li class="cmd" data-q="{_esc((c + " " + d).lower())}"><button type="button" class="cmd-copy"{"" if c.startswith("/") else " disabled"} title="{"Copy" if c.startswith("/") else "Right-click menu in Discord"}"><code>{_esc(c)}</code></button><span>{_esc(d)}</span></li>'
        for c, d in cmds)
    groups += f'<div class="cmd-group" data-cg="{gid}"><h3 class="weld g-{color}">{name}</h3><ul>{rows}</ul></div>'
    gchips += f'<button class="chip" type="button" data-cg="{gid}">{name}<i>{len(cmds)}</i></button>'
features_body = hero("gem", "Features", "Everything Bloombot can do, and every command.", "t_features") + f"""<main class="wrap" id="main">
<section class="tiles ftiles">{ftiles}</section>
<section class="panel cmds" id="commands">
<div class="cmds-head"><h2 class="sec weld g-yellow"><img src="img/bell.png" alt="">Commands</h2>
<input class="search" id="cmdq" type="search" placeholder="Search commands…" aria-label="Search commands"></div>
<div class="chips cmd-chips" role="group" aria-label="Command groups">{gchips}</div>
<p class="hint cmd-hint">Click a command to copy it, then paste it in Discord.</p>
<div class="cmd-grid">{groups}</div>
<div class="empty" id="cmdnone" hidden><p>No command matches that.</p><button class="brick sm" type="button" id="cmdclear">Clear search</button></div>
</section>
<section class="cta-panel">
<img src="img/gem.png" alt="">
<div><h2>Want Bloombot in your server?</h2><p>Add it, then run <code>/setup</code>. It takes about a minute.</p></div>
<a class="brick discord" href="{INVITE}">{DISCORD_SVG}Add to Discord</a>
</section>
</main>
"""
open("features.html", "w").write(page("Bloombot Features and Commands · Garden Tower Defense Discord Bot", "Everything the Bloombot Discord bot can do for Garden Tower Defense traders, and every slash command.", features_body, "f", "features.html"))

# ── Trade ads (Discord login through Supabase) ───────────────────────────
JSVER = {n: hashlib.md5(open(f"js/{n}.js", "rb").read()).hexdigest()[:8] for n in ("trades", "values", "calc", "strategies", "home", "profile")}
trades_body = hero("trading", "Trade ads", "Every live Bloombot trade ad, from every server. Post your own right here.", "t_trades") + f"""<main class="wrap trades" id="main">
<section class="panel login" id="login" hidden>
<img class="login-icon" src="img/trading.png" alt="">
<h2>Log in to see trade ads</h2>
<p>Trade ads are only shown to Discord users. We use your Discord account only to log you in.</p>
<button class="brick green" type="button" data-login>Log in</button>
<p class="err" id="loginerr" hidden></p>
</section>
<section id="board" hidden>
<form class="panel post cz" id="postform">
<div class="cz-head"><img id="meav" alt=""><div class="cz-who"><strong>New trade ad</strong><span>as <b id="mename"></b> · shows in every Bloombot server</span></div><span class="cz-slots" id="slots" title="You can have 3 live trade ads at once"><i></i><i></i><i></i><b>0/3 live</b></span></div>
<div class="cz-grid" id="post">
<section class="cz-side give" aria-label="You give">
<div class="cz-band"><span class="cz-dot"></span><strong>You give</strong><em id="hworth"></em></div>
<div class="cz-units" id="hchips"></div>
<div class="picker cz-find"><svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" d="M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15ZM16 16l5 5"/></svg><input id="hq" type="search" autocomplete="off" placeholder="Add a unit…" aria-label="Add a unit you give"><div class="sugs" id="hsug" hidden></div></div>
<div class="cz-extras"><button class="tagb" type="button" data-tag="have-small" data-group="have-add"><img src="img/tiny_add.png" alt="">Small add</button><button class="tagb" type="button" data-tag="have-add" data-group="have-add"><img src="img/add.png" alt="">Add</button><button class="tagb" type="button" data-tag="have-big" data-group="have-add"><img src="img/big_add.png" alt="">Big add</button></div>
</section>
<div class="cz-swap" aria-hidden="true"><img src="img/trading.png" alt=""></div>
<section class="cz-side get" aria-label="You want">
<div class="cz-band"><span class="cz-dot"></span><strong>You want</strong><em id="wworth"></em></div>
<div class="cz-units" id="wchips"></div>
<div class="picker cz-find"><svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" d="M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15ZM16 16l5 5"/></svg><input id="wq" type="search" autocomplete="off" placeholder="Add a unit…" aria-label="Add a unit you want"><div class="sugs" id="wsug" hidden></div></div>
<div class="cz-extras"><button class="tagb" type="button" data-tag="want-offers" data-group="want-kind"><img src="img/offer.png" alt="">Offers</button><button class="tagb" type="button" data-tag="want-any" data-group="want-kind"><img src="img/any.png" alt="">Any</button><button class="tagb" type="button" data-tag="want-add"><img src="img/add.png" alt="">Add</button><button class="tagb" type="button" data-tag="want-overpay"><img src="img/win.png" alt="">Overpay</button></div>
</section>
</div>
<div class="cz-out">
<div class="cz-out-top"><strong>Your ad</strong><button class="cz-edit" id="adedit" type="button" aria-expanded="false">Edit text</button><span id="adcount" class="count">0/200</span></div>
<div class="cz-prev" id="adprev"><div id="adprevbody"></div><p class="cz-empty" id="adempty">Add units above, or <button type="button" id="adwrite">write it yourself</button>.</p></div>
<textarea id="adtext" rows="2" maxlength="220" placeholder="e.g. tesla + 2x peashooter for beehive" aria-label="Your trade ad" hidden></textarea>
</div>
<div class="cz-foot">
<p class="cz-rules">7 to 200 characters · no links · 1 ad per 5 min · needs <code>/link</code></p>
<div class="post-actions"><button class="brick dark sm" id="adclear" type="button">Clear</button><button class="brick green" id="postbtn" type="submit"><img src="img/plus.png" alt="">Post trade ad</button></div>
</div>
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
open("trades.html", "w").write(page("Bloombot Trade Ads · Garden Tower Defense", "Browse and post Garden Tower Defense trade ads from every Bloombot server. Log in with Discord or Google.", trades_body, "a", "trades.html"))

# ── Values ───────────────────────────────────────────────────────────────
values_body = hero("dollar", "Values", "Every Garden Tower Defense unit and gamepass, with demand and 30-day trends.", "t_values") + f"""<main class="wrap vals" id="main">
<section class="panel filters">
<input class="search" id="vq" type="search" placeholder="Search a unit…" aria-label="Search units">
<div class="chips"><button class="chip on" type="button" data-cat="all">All</button><button class="chip" type="button" data-cat="units">Units</button><button class="chip" type="button" data-cat="gamepasses">Gamepasses</button><button class="chip star-chip" type="button" data-cat="fav">★ Watchlist</button></div>
<select id="vrar" aria-label="Rarity" data-pills="1"><option value="">All rarities</option></select>
<select id="vsort" aria-label="Sort"><option value="value">Highest value</option><option value="low">Lowest value</option><option value="demand">Most demand</option><option value="up">Rising most</option><option value="down">Falling most</option><option value="name">A to Z</option></select>
<div class="chips vview" role="group" aria-label="Layout"><button class="chip on" type="button" data-view="grid" aria-label="Cards" title="Cards"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z"/></svg><span class="vv-t">Cards</span></button><button class="chip" type="button" data-view="list" aria-label="List" title="List"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16v3H4zM4 10.5h16v3H4zM4 16h16v3H4z"/></svg><span class="vv-t">List</span></button></div>
</section>
<div class="vinfo"><span id="vcount"></span><span id="vupdated"></span></div>
<div class="skel-grid sk-vals" id="vloading" aria-busy="true" aria-label="Loading"><div class="skel"><i></i><i></i><i></i></div><div class="skel"><i></i><i></i><i></i></div><div class="skel"><i></i><i></i><i></i></div><div class="skel"><i></i><i></i><i></i></div><div class="skel"><i></i><i></i><i></i></div><div class="skel"><i></i><i></i><i></i></div><div class="skel"><i></i><i></i><i></i></div><div class="skel"><i></i><i></i><i></i></div></div>
<p class="credit"><img src="img/dollar.png" alt="">Values come from the <a href="https://sites.google.com/view/garden-td-values/main-page" target="_blank" rel="noopener">official Garden TD value list</a>. Bloombot copies them every few minutes and adds trend charts.</p>
<div class="vgrid" id="vgrid"></div>
<button class="brick dark more-btn" type="button" id="vmore" hidden>Show more</button>
<p class="empty" id="vnone" hidden>No unit matches that.</p>
<p class="note">Values come from the community value list and update about every 2 days. They are estimates, not guarantees.</p>
</main>
<div class="modal" id="vmodal" hidden><div class="modal-box panel" role="dialog" aria-modal="true"><button class="modal-x" id="vmclose" type="button" aria-label="Close">×</button><div id="vmbody"></div></div></div>
<script defer src="js/values.js?v={JSVER['values']}"></script>
"""
open("values.html", "w").write(page("Bloombot Values · Garden Tower Defense", "GTD value list: live Garden Tower Defense unit and gamepass values with demand, status and 30-day trends.", values_body, "v", "values.html"))

# ── Trade calculator ─────────────────────────────────────────────────────
def side(key, title, color):
    return f"""<section class="panel cside">
<h2 class="weld g-{color} cs-title">{title}<span class="cs-count" id="{key}count"></span><span class="cs-total" id="{key}total">0</span></h2>
<div class="picker"><input class="search" id="{key}q" type="search" autocomplete="off" placeholder="Add a unit or a value like 4k" aria-label="Add to {title}"><div class="sugs" id="{key}sug" hidden></div></div>
<div class="clist" id="{key}list"></div>
<p class="cempty" id="{key}empty">Nothing here yet.</p>
</section>"""


def calc_tabs(cur):
    tabs = [("trade", "calculator.html", "calculator", "Trade", "Win, fair or loss"), ("crate", "crates.html", "crate", "Crate", "Summon odds"), ("farm", "farm.html", "seeds", "Farm", "Seeds per hour")]
    i = [k for k, *_ in tabs].index(cur)
    return f'<nav class="ctabs" aria-label="Calculators" data-tab="{i}"><span class="ctab-ind weld" aria-hidden="true"></span>' + "".join(
        f'<a class="ctab{" on" if k == cur else ""}" href="{h}" data-i="{n}"{" aria-current=\"page\"" if k == cur else ""}><img src="img/{ic}.png" alt=""><span class="ct-t"><b>{t}<span class="ct-l"> calculator</span></b><small>{sub}</small></span></a>'
        for n, (k, h, ic, t, sub) in enumerate(tabs)) + "</nav>\n"


calc_body = hero("calculator", "Trade calculator", "Is it a win, fair or a loss? Add both sides and find out.", "t_calc") + f"""<main class="wrap calc" id="main">
{calc_tabs("trade")}<p class="loading" id="cloading">Loading values…</p>
<div class="cgrid">
{side("give", "You give", "red")}
<div class="cmid">
<div class="verdict" id="verdict"><img id="vicon" class="vicon" alt="" hidden><strong>Add units to both sides</strong><span>Search a unit or type a value like 4k.</span></div>
<div class="meter" id="meter"><i></i></div>
<div class="cbtns"><button class="brick dark sm" id="swap" type="button">⇄ Swap sides</button><button class="brick dark sm" id="clear" type="button">Clear</button></div>
<div class="cbtns share-btns"><button class="brick blue sm" id="copylink" type="button">Copy link</button><button class="brick discord sm" id="copytext" type="button">Copy for Discord</button></div>
<button class="brick green sm post-from-calc" id="postad" type="button"><img src="img/plus.png" alt="">Post as trade ad</button>
<div class="fairadds" id="fairadds"></div>
</div>
{side("get", "You get", "green")}
</div>
<p class="note">Fair means both sides are within 5%, the same rule as Bloombot's <code>/value-calculator</code>. Use Copy link to share this exact trade. Values from the <a href="https://sites.google.com/view/garden-td-values/main-page" target="_blank" rel="noopener">official Garden TD value list</a>.</p>
</main>
<script defer src="js/calc.js?v={JSVER['calc']}"></script>
"""
open("calculator.html", "w").write(page("Bloombot Trade Calculator · Garden Tower Defense", "GTD trade calculator: check if a Garden Tower Defense trade is a win, fair or a loss with live values.", calc_body, "c", "calculator.html"))



# ── Crate calculator ─────────────────────────────────────────────────────
JSVER["crates"] = hashlib.md5(open("js/crates.js", "rb").read()).hexdigest()[:8]
CRATESVER = hashlib.md5(open("data/crates.json", "rb").read()).hexdigest()[:8]
crates_body = hero("crate", "Crate calculator", "Your real chance to pull a unit, and how much to save before you spend.", "t_crates") + f"""
<main class="wrap calc crates" id="main" data-crates="data/crates.json?v={CRATESVER}">
{calc_tabs("crate")}
<section class="panel kpick">
<h2 class="weld g-orange kh"><img src="img/num_1.png" alt="1">Pick a crate, then the unit you want</h2>
<div class="kcrates" id="kcrates"></div>
<section class="smw" id="sw" aria-label="Summon window">
<div class="sw-top"><h3 class="sw-title" id="swtitle">Skull Summon</h3><span class="sw-sub" id="swsub" hidden></span></div>
<button class="sw-x" id="swx" type="button" aria-label="Reset pretend pulls" title="Reset pretend pulls">X</button>
<div class="sw-grid" id="kunits"></div>
<div class="sw-buy"><kbd class="sw-key">E</kbd><button class="sw-btn" id="buy1" type="button"><span id="buy1n">Buy 1 -</span><img src="img/candy.png" alt=""><span id="buy1p">666</span></button><button class="sw-btn" id="buyn" type="button"><span id="buynn">Buy 13 -</span><img src="img/candy.png" alt=""><span id="buynp">6666</span></button><kbd class="sw-key">T</kbd></div>
</section>
<div class="sw-under">
<p class="khint"><b>Tap a unit</b> to calculate it. <b>Buy</b> (or E and T) opens pretend crates for fun, nothing is spent.</p>
<p class="sw-stat" id="swstat" hidden>Opened <b id="swopened">0</b> · Spent <b id="swspent">0</b> · <b id="swmine"></b> <button class="linkbtn" id="swreset" type="button">Reset</button></p>
</div>
<div class="sw-pull" id="swpull" hidden></div>
<p class="khint knote" id="knote" hidden></p>
</section>
<div class="kgrid">
<section class="panel kform">
<h2 class="weld g-blue kh"><img src="img/num_2.png" alt="2">How much do you have?</h2>
<label class="kf kmain">
<span class="kin"><img data-curimg alt=""><input class="search" id="kb" inputmode="decimal" autocomplete="off" placeholder="Like 250k or 1.5m"><b data-cur>Candy</b></span>
<span>Or what you plan to spend. 1.5m and 20k work too.</span></label>
<div class="kf"><span class="kluck-h"><img src="img/luck.webp" alt="">Luck boost</span><span>Only if you have one.</span>
<div class="kluck"><button class="chip" type="button" data-luck="1">None</button><button class="chip" type="button" data-luck="1.5"><img src="img/luck.webp" alt="">1.5x</button><button class="chip" type="button" data-luck="2"><img src="img/luck.webp" alt="">2x</button><button class="chip" type="button" data-luck="3"><img src="img/luck.webp" alt="">3x</button></div></div>
<details class="kmore" id="kmore"><summary>Change the crate's numbers</summary>
<div class="kmore-in">
<p class="khint">Already filled in from the crate. Only change them if the game shows something else.</p>
<label class="kf">Drop chance <span>The unit's chance per crate, like 0.005% or 1/20000</span>
<span class="kin"><input class="search" id="kd" inputmode="decimal" autocomplete="off" value="0.005"><b>%</b></span></label>
<label class="kf">Exact luck <span>If your boost isn't 1.5x, 2x or 3x</span>
<span class="kin"><input class="search" id="kl" inputmode="decimal" autocomplete="off" value="1" aria-label="Luck multiplier"><b>x</b></span></label>
<label class="kf">Price per crate
<span class="kin"><img data-curimg alt=""><input class="search" id="kp" inputmode="decimal" autocomplete="off" value="666"><b data-cur>Candy</b></span></label>
<div class="kf">Pack deal <span>Like "Buy 13 for 6666".</span>
<div class="kpack"><label class="ktog"><input type="checkbox" id="kpk" checked><i></i></label><input class="search" id="kpn" inputmode="numeric" autocomplete="off" value="13" aria-label="Crates in a pack"><span>for</span><input class="search" id="kpp" inputmode="decimal" autocomplete="off" value="6666" aria-label="Pack price"></div></div>
<div class="kf kpyf"><label class="ktog-line"><span class="ktog"><input type="checkbox" id="kpy"><i></i></span><span><strong>This crate has pity</strong><span>A guaranteed drop after a set number of crates.</span></span></label>
<div class="kpity" id="kpity" hidden>
<label class="kf">Pity at <span>Crates until the guarantee, like the 50 in "Pity 10/50"</span><input class="search" id="kyn" inputmode="numeric" autocomplete="off" value="50000"></label>
<label class="kf">Your pity now <span>Like the 10 in "Pity 10/50"</span><input class="search" id="kyk" inputmode="numeric" autocomplete="off" value="0"></label>
<label class="kf">Pity gives <select id="kyt"><option value="exact">This exact unit</option><option value="tier">A random unit of this rarity</option></select></label>
<label class="kf" id="kyr-wrap">Chance of the whole rarity <span>All units with the same stars added up</span><span class="kin"><input class="search" id="kyr" inputmode="decimal" autocomplete="off"><b>%</b></span></label>
</div></div>
</div>
</details>
</section>
<section class="kout" id="kout">
<h2 class="weld g-green kh kout-h"><img src="img/num_3.png" alt="3">Your answer</h2>
<p class="kerr" id="kerr" hidden></p>
<div class="kres">
<div class="kr-head"><img class="kr-img" id="krimg" src="img/crate.png" alt=""><div><strong id="kunitname">Grim Gardener</strong><span id="krsub"></span></div></div>
<div class="kr-you" id="kryou"><span>Your chance to get it</span><strong id="kt3">?</strong></div>
<div class="kr-meter" id="krmeter"><i id="krbar"></i></div>
<p class="kr-line" id="krline"></p>
</div>
<section class="panel kneed">
<h3>How much do you need?</h3>
<div class="kn-cards" id="kneed"></div>
<p class="kr-note" id="krnote"></p>
<button class="kshow" id="kshow" type="button" aria-expanded="false" aria-controls="kextra"><span>Show more</span><i></i></button>
<div class="kextra" id="kextra" hidden>
<div class="kx-stats"><div><span>Chance per crate</span><strong id="kx1"></strong></div><div><span>Crates on average</span><strong id="kx2"></strong></div><div><span>Cost on average</span><strong id="kx3"></strong></div></div>
<h4>Every chance, step by step</h4>
<div class="kx-table" id="kxtable"></div>
</div>
</section>
</section>
</div>
<section class="panel khow">
<h2 class="weld g-green kh"><img src="img/bell.png" alt="">How it works</h2>
<div class="khow-grid">
<div><h3>Every crate is a fresh roll</h3><p>Opening crates doesn't make the next one luckier. At 1% you don't get the unit after 100 crates for sure: your chance is <b>1 - 0.99<sup>100</sup> = 63%</b>. That's why we never just multiply the chance by the crates.</p></div>
<div><h3>Average is not guaranteed</h3><p>The average is what it takes across many players. About 63% get the unit by then, and 37% don't. Without pity there is no number of crates that guarantees it.</p></div>
<div><h3>Luck</h3><p>We multiply the drop chance by your luck, up to 100%. 2x luck halves the average crates. Check in game which units your luck boost works on.</p></div>
<div><h3>Pity</h3><p>With pity, the crate at the pity count always drops that rarity. If the rarity has more than one unit, it can still be a different one. Pity counts are per rarity and reset when you pull one.</p></div>
</div>
</section>
<div class="cbtns kbtns"><button class="brick blue sm" id="kcopy" type="button">Copy link</button><button class="brick dark sm" id="kreset" type="button">Reset</button></div>
<p class="note">Drop chances and prices are from the in-game shop and can change with updates. Got different numbers? Just type them in. More crates on the <a href="https://gtd.fandom.com/wiki/Crates" target="_blank" rel="noopener">Garden Tower Defense wiki</a>.</p>
</main>
<script defer src="js/crates.js?v={JSVER['crates']}"></script>
"""
open("crates.html", "w").write(page("Bloombot Crate Calculator · Garden Tower Defense Summon Odds", "GTD crate calculator: your real chance to pull a Garden Tower Defense unit, average summons, currency needed, luck and pity.", crates_body, "c", "crates.html"))


# ── Farm calculator ──────────────────────────────────────────────────────
JSVER["farm"] = hashlib.md5(open("js/farm.js", "rb").read()).hexdigest()[:8]
farm_body = hero("seeds", "Farm calculator", "How many Seeds and Fertilizer you really earn per hour, and how long until your goal.", "t_farm") + f"""
<main class="wrap calc crates farm" id="main">
{calc_tabs("farm")}
<div class="kgrid">
<section class="panel kform">
<h2 class="weld g-orange kh"><img src="img/num_1.png" alt="1">Your run</h2>
<label class="kf kmain">Run time <span>From the start to the win screen. 12:30, 12m 30s and 12 all work.</span>
<span class="kin"><img src="img/clock.png" alt=""><input class="search" id="ft" inputmode="text" autocomplete="off" placeholder="12:00"><b>min:sec</b></span></label>
<label class="kf">Seeds per run <span>What the win screen shows. 70.9k works too.</span>
<span class="kin"><img src="img/cur/seeds.webp" alt=""><input class="search" id="fs" inputmode="decimal" autocomplete="off" placeholder="70950"><b>Seeds</b></span></label>
<label class="kf">Fertilizer per run
<span class="kin"><img src="img/cur/fertilizer.webp" alt=""><input class="search" id="ff" inputmode="decimal" autocomplete="off" placeholder="38"><b>Fertilizer</b></span></label>
<div class="kf">Time between runs <span>Loading, voting and the lobby. Most calculators forget this.</span>
<div class="kluck fgap"><button class="chip" type="button" data-gap="0">None</button><button class="chip" type="button" data-gap="10">10s</button><button class="chip" type="button" data-gap="30">30s</button><button class="chip" type="button" data-gap="60">1 min</button><span class="kin sm"><input class="search" id="fg" inputmode="text" autocomplete="off" aria-label="Seconds between runs"><b>s</b></span></div></div>
<details class="kmore"><summary>Try a x2 gamepass</summary>
<div class="kmore-in">
<p class="khint">Only turn these on if the numbers above are <b>without</b> the gamepass. It shows what you'd earn with it.</p>
<label class="ktog-line"><span class="ktog"><input type="checkbox" id="fx2s"><i></i></span><span><strong>x2 Seeds</strong><span>Doubles the Seeds you typed.</span></span></label>
<label class="ktog-line"><span class="ktog"><input type="checkbox" id="fx2f"><i></i></span><span><strong>x2 Fertilizer</strong><span>Doubles the Fertilizer you typed.</span></span></label>
</div>
</details>
</section>
<section class="kout" id="fout">
<h2 class="weld g-green kh kout-h"><img src="img/num_2.png" alt="2">Your farming rate</h2>
<p class="kerr" id="ferr" hidden></p>
<div class="kres">
<p class="fex" id="fex" hidden>Example numbers. Type your own run on the left.</p>
<div class="fstats" id="fstats"></div>
<div class="fcycle" id="fline"></div>
</div>
<section class="panel kneed">
<h3>How long do you play?</h3>
<div class="kluck fplay"><button class="chip" type="button" data-play="1800">30 min</button><button class="chip" type="button" data-play="3600">1h</button><button class="chip" type="button" data-play="7200">2h</button><button class="chip" type="button" data-play="18000">5h</button><span class="kin sm"><input class="search" id="fp" inputmode="text" autocomplete="off" placeholder="1h" aria-label="Play time"></span></div>
<div class="kn-cards" id="fplay"></div>
<p class="kr-note">Rewards come at the end of a run, so we only count runs you finish.</p>
</section>
<section class="panel kneed">
<h3>Saving up for something?</h3>
<div class="kf fgoal"><span class="kin"><input class="search" id="fgoal" inputmode="decimal" autocomplete="off" placeholder="Like 500k" aria-label="Goal amount"><select id="fgc" aria-label="Currency"><option value="s">Seeds</option><option value="f">Fertilizer</option></select></span></div>
<div class="kn-cards" id="fgoalout"></div>
<button class="kshow" id="fshow" type="button" aria-expanded="false" aria-controls="fextra"><span>Show more</span><i></i></button>
<div class="kextra" id="fextra" hidden>
<div class="kx-stats"><div><span>One run gives</span><strong id="fx1"></strong></div><div><span>Farming 24 hours</span><strong id="fx2"></strong></div><div><span>Time spent waiting</span><strong id="fx3"></strong></div></div>
<h4>If your runs were faster</h4>
<div class="fx-table" id="fxfast"></div>
</div>
</section>
</section>
</div>
<section class="panel khow">
<h2 class="weld g-green kh"><img src="img/bell.png" alt="">How it works</h2>
<div class="khow-grid">
<div><h3>Waiting counts too</h3><p>A 12 minute run with 10 seconds of loading is really 12:10. We add the time between runs, so <b>3600 ÷ 730 = 4.9 runs</b> an hour, not 5.</p></div>
<div><h3>No rounding</h3><p>Per hour is the real average, so 12:30 runs give 4.8 runs an hour instead of being rounded down to 4.</p></div>
<div><h3>Only finished runs pay</h3><p>For your play time and goals we count whole runs, because you get nothing for a run you stop halfway.</p></div>
<div><h3>Find your best farm</h3><p>Try your different maps and modes. A shorter run with fewer Seeds can still win per hour. Copy link saves your numbers.</p></div>
</div>
</section>
<div class="cbtns kbtns"><button class="brick blue sm" id="fcopy" type="button">Copy link</button><button class="brick dark sm" id="freset" type="button">Reset</button></div>
<p class="note">Rewards change with the map, mode and difficulty, so time a few of your own runs for the best answer.</p>
</main>
<script defer src="js/farm.js?v={JSVER['farm']}"></script>
"""
open("farm.html", "w").write(page("Bloombot Farm Calculator · Garden Tower Defense Seeds per Hour", "GTD farm calculator: Garden Tower Defense Seeds and Fertilizer per hour, play time totals and how long until your goal.", farm_body, "c", "farm.html"))


# ── Strategies ───────────────────────────────────────────────────────────
strat_body = hero("bullseye", "Strategies", "Community strategies for Garden Tower Defense. Share yours and it shows up in /home in Discord too.", "t_strategies") + f"""<main class="wrap strats" id="main">
<section class="panel share" id="share">
<div class="share-login"><img class="share-ico" src="img/bullseye.png" alt=""><div><strong>Got a good strategy?</strong><span id="shint">Log in to share it with every Bloombot server.</span></div>
<button class="brick green" type="button" data-login id="slogbtn">Log in to share</button>
<button class="brick green" type="button" id="sopen" aria-expanded="false" aria-controls="sform" hidden>Share a strategy</button></div>
<form id="sform" hidden novalidate><span id="sname" hidden></span>
<ol class="ssteps" id="ssteps"><li data-step="0"><button type="button"><b>1</b><span>Basics</span></button></li><li data-step="1"><button type="button"><b>2</b><span>Units</span></button></li><li data-step="2"><button type="button"><b>3</b><span>How to play</span></button></li><li data-step="3"><button type="button"><b>4</b><span>Share</span></button></li></ol>

<div class="spane" data-step="0">
<label class="sfl"><span>Title</span><input class="search" id="st" maxlength="80" placeholder="e.g. Solo Volcano level 5"><small class="serr" id="st-err" hidden>Give it a title (5 to 80 characters).</small></label>
<div class="sfl"><span>Type</span><input type="hidden" id="sc" value="general"><div class="seg" data-for="sc" role="radiogroup"><button type="button" data-v="general">General</button><button type="button" data-v="meta-units">Meta units</button><button type="button" data-v="map-specific">Map-specific</button></div></div>
<div class="sf-grid">
<label class="sfl"><span>Gamemode <em>optional</em></span><select id="f-mode"><option value="">Any</option><option>Story</option><option>Hard Mode</option><option>Endless</option><option>Survival</option><option>PvP</option><option>Event</option><option>Raid</option><option>Challenge</option></select></label>
<label class="sfl"><span>Map or level <em>optional</em></span><input class="search" id="f-map" maxlength="40" placeholder="e.g. Volcano 5"></label>
</div>
<div class="sfl"><span>Players <em>optional</em></span><input type="hidden" id="f-team" value=""><div class="seg" data-for="f-team" role="radiogroup"><button type="button" data-v="1 player">Solo</button><button type="button" data-v="2 players">2</button><button type="button" data-v="3 players">3</button><button type="button" data-v="4 players">4</button></div></div>
<div class="sfl"><span>Difficulty <em>optional</em></span><input type="hidden" id="f-diff" value=""><div class="seg" data-for="f-diff" role="radiogroup"><button type="button" data-v="Easy">Easy</button><button type="button" data-v="Medium">Medium</button><button type="button" data-v="Hard">Hard</button><button type="button" data-v="Extreme">Extreme</button></div></div>
</div>

<div class="spane" data-step="1" hidden>
<div class="sfl"><span>Units you need <em id="f-ucount">0/10</em></span>
<div class="picker"><input class="search" id="f-uq" type="search" autocomplete="off" placeholder="Type a unit name…" aria-label="Add a unit"><div class="sugs" id="f-usug" hidden></div></div>
<div class="f-units" id="f-units"><p class="hint f-empty">No units yet. Search above and press Enter.</p></div></div>
<div class="sfl"><span>Swaps <em>optional · for players who don't have a unit</em></span>
<div class="f-swap"><div class="picker"><input class="search" id="f-aq1" type="search" autocomplete="off" placeholder="Instead of…" aria-label="Unit to replace"><div class="sugs" id="f-asug1" hidden></div></div><span class="f-arrow">→</span><div class="picker"><input class="search" id="f-aq2" type="search" autocomplete="off" placeholder="use…" aria-label="Replacement unit"><div class="sugs" id="f-asug2" hidden></div></div><button class="brick dark" type="button" id="f-aadd">Add</button></div>
<div class="f-alts" id="f-alts"></div></div>
</div>

<div class="spane" data-step="2" hidden>
<label class="sfl"><span>How does it work?</span><textarea id="sd" rows="3" maxlength="1000" placeholder="e.g. Stall the first waves, then burst the boss with Glowthorn."></textarea><small class="serr" id="sd-err" hidden>Write at least a sentence here.</small></label>
<div class="sfl"><span>Steps <em>optional · one step per line</em></span>
<div class="sf-phases">
<label><i>Start</i><textarea id="f-early" rows="3" maxlength="500" placeholder="Place Glowthorn at the back"></textarea></label>
<label><i>Middle</i><textarea id="f-mid" rows="3" maxlength="500" placeholder="Max 2 Shockolateflora"></textarea></label>
<label><i>End</i><textarea id="f-late" rows="3" maxlength="500" placeholder="Use Reverse Time on the boss"></textarea></label>
</div></div>
<label class="sfl"><span>Tips <em>optional</em></span><textarea id="f-tips" rows="2" maxlength="500" placeholder="One tip per line"></textarea></label>
</div>

<div class="spane" data-step="3" hidden>
<label class="sfl"><span>One-line summary <em>optional</em></span><input class="search" id="f-tag" maxlength="100" placeholder="e.g. Cheap stall loadout for PvP"></label>
<div class="sf-grid">
<div class="sfl"><span>Cost <em>optional</em></span><input type="hidden" id="f-cost" value=""><div class="seg" data-for="f-cost" role="radiogroup"><button type="button" data-v="Cheap">Cheap</button><button type="button" data-v="Medium">Medium</button><button type="button" data-v="Expensive">Expensive</button></div></div>
<div class="sfl"><span>Speed <em>optional</em></span><input type="hidden" id="f-speed" value=""><div class="seg" data-for="f-speed" role="radiogroup"><button type="button" data-v="Slow">Slow</button><button type="button" data-v="Medium">Medium</button><button type="button" data-v="Fast">Fast</button></div></div>
</div>
<p class="sfl-h">This is how it will look</p>
<div class="sd-prev" id="sdprev"></div>
</div>

<div class="snav"><button class="brick dark" type="button" id="sback">Back</button><span class="hint" id="sinfo"><span id="stc" hidden></span><span id="sdc">0/1500</span></span><button class="brick green" type="button" id="snext">Next</button><button class="brick green" id="sbtn" type="submit" hidden>Share strategy</button></div>
<p class="hint snote">No links. One strategy every 10 minutes (<a href="levels.html">faster at higher levels</a>). Needs a linked account (<code>/link</code>).</p>
<p class="post-status" id="sstatus" hidden></p>
</form>
</section>
<div class="board-bar">
<input class="search" id="sq" type="search" placeholder="Search strategies…" aria-label="Search strategies">
<div class="chips"><button class="chip on" type="button" data-scat="all">All<i></i></button><button class="chip" type="button" data-scat="meta-units">Meta units<i></i></button><button class="chip" type="button" data-scat="map-specific">Map-specific<i></i></button><button class="chip" type="button" data-scat="general">General<i></i></button><button class="chip" type="button" data-scat="mine" hidden>Mine<i></i></button></div>
<select id="ssort" aria-label="Sort strategies"><option value="new">Newest</option><option value="old">Oldest</option><option value="az">A to Z</option><option value="long">Most detailed</option></select>
<span class="count-pill" id="scount"></span>
</div>
<div class="skel-grid sk-strats" id="sloading" aria-busy="true" aria-label="Loading"><div class="skel"><i></i><i></i><i></i></div><div class="skel"><i></i><i></i><i></i></div><div class="skel"><i></i><i></i><i></i></div></div>
<div class="slist" id="slist"></div>
<div class="empty" id="snone" hidden><p id="snonet">No strategies match that.</p><button class="brick sm" type="button" id="sclear">Show all strategies</button></div>
</main>
<script defer src="js/strategies.js?v={JSVER['strategies']}"></script>
"""
open("strategies.html", "w").write(page("Bloombot Strategies · Garden Tower Defense", "Community Garden Tower Defense strategies: meta units, map-specific guides and general tips.", strat_body, "s", "strategies.html"))

# ── Levels & perks ───────────────────────────────────────────────────────
JSVER["levels"] = hashlib.md5(open("js/levels.js", "rb").read()).hexdigest()[:8]
levels_body = hero("medal_gold", "Levels", "Earn XP in Discord and on the website, climb the ranks and unlock perks.", "t_levels") + f"""<main class="wrap lv" id="main">
<div class="skel-grid sk-prof" id="lvloading" aria-busy="true" aria-label="Loading"><div class="skel"><i></i><i></i><i></i></div></div>
<section class="panel lv-card" id="lvcard" hidden aria-live="polite"></section>
<nav class="lv-road" id="lvroad" aria-label="Ranks"></nav>
<section class="lv-sec" id="tasks">
<div class="lv-sh"><h2><img src="img/lightning.png" alt="">XP tasks</h2><span class="count-pill" id="lvtsum"></span></div>
<p class="hint lv-sub">One-time bonuses. Do the task, then press <b>Claim</b>. Bloombot checks it and adds the XP to your level in Discord too.</p>
<div class="lv-tasks" id="lvtasks"></div>
</section>
<section class="lv-sec" id="earn">
<div class="lv-sh"><h2><img src="img/chart_up.png" alt="">How to earn XP</h2></div>
<div class="lv-earn">
<div class="weld g-blue"><img src="img/gem.png" alt=""><strong>+15 XP</strong><span>for a command in any Bloombot server, once every 30 seconds</span></div>
<div class="weld g-purple"><img src="img/swap.png" alt=""><strong>+50 XP</strong><span>for a trade ad, your first 3 each day</span></div>
<div class="weld g-green"><img src="img/lightning.png" alt=""><strong>Bonus XP</strong><span>from the tasks above, and from XP boosts during events</span></div>
</div>
</section>
<section class="lv-sec" id="perks">
<div class="lv-sh"><h2><img src="img/medal_gold.png" alt="">Every perk</h2></div>
<p class="hint lv-sub">Perks stack: you keep everything from the ranks below yours. <span class="pk-where pk-k">Discord</span> perks work in every server, <span class="pk-where pk-k web">Website</span> perks work here.</p>
<div class="lv-perks" id="lvperks"></div>
</section>
</main>
<script defer src="js/levels.js?v={JSVER['levels']}"></script>
"""
open("levels.html", "w").write(page("Bloombot Levels & Perks · Garden Tower Defense", "Your Bloombot level, every rank perk in Discord and on the website, and one-time tasks for bonus XP.", levels_body, "", "levels.html"))

# ── Profiles ─────────────────────────────────────────────────────────────
JSVER["profile"] = hashlib.md5(open("js/profile.js", "rb").read()).hexdigest()[:8]
profile_body = f"""<main class="wrap prof" id="main">
<section class="panel login" id="plogin" hidden>
<img class="login-icon" src="img/medal_gold.png" alt="">
<h2>Log in to see profiles</h2>
<p>Profiles are only shown to Discord users. We use your Discord account only to log you in.</p>
<button class="brick green" type="button" data-login>Log in</button>
</section>
<div class="skel-grid sk-prof" id="ploading" aria-busy="true" aria-label="Loading"><div class="skel"><i></i><i></i><i></i></div></div>
<section class="panel pcard" id="pcard" hidden></section>
<form class="panel pedit" id="pedit" hidden novalidate>
<div class="pe-head"><span class="pe-ico"><img src="img/gear.png" alt=""></span><div><h2 id="pedit-h">Profile settings</h2><p class="hint" id="pedit-sub">Changes are saved to your Bloombot account, the same as /home → Settings in Discord.</p></div><button class="pe-x" type="button" id="pclose" aria-label="Close settings"><svg viewBox="0 0 24 24" aria-hidden="true"><path stroke="currentColor" stroke-width="2.6" stroke-linecap="round" d="M7 7l10 10M17 7 7 17"/></svg></button></div>
<section class="pe-sec" aria-labelledby="ps-rbx"><h3 class="pe-st" id="ps-rbx">Roblox</h3>
<div class="pfields">
<div class="pe-field" id="fu-f"><label for="fu">Username</label><div class="pe-in"><span class="pe-pre" aria-hidden="true">@</span><input id="fu" maxlength="20" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="CoolGardener123" aria-describedby="fu-m"><span class="pe-ok" aria-hidden="true"></span></div><p class="pe-msg" id="fu-m">Your exact Roblox name, not your display name.</p></div>
<div class="pe-field" id="fl-f"><label for="fl">Private server link <em>optional</em></label><div class="pe-in"><input id="fl" maxlength="300" autocomplete="off" autocapitalize="off" spellcheck="false" inputmode="url" placeholder="https://www.roblox.com/share?code=…&amp;type=Server" aria-describedby="fl-m"><button class="pe-paste" type="button" id="fpaste" hidden>Paste</button><span class="pe-ok" aria-hidden="true"></span></div><p class="pe-msg" id="fl-m">Garden Tower Defense → ··· → Share → Copy Private Server Link. Only you can see it.</p></div>
</div>
</section>
<section class="pe-sec" id="pacc-sec" aria-labelledby="ps-acc"><h3 class="pe-st" id="ps-acc">Connected accounts</h3>
<div class="pacc" id="pacc">
<div class="pacc-row" id="pa-dc"><span class="pacc-ic st-ic"><img src="img/discord_stud.png" alt=""></span><div class="pacc-t"><strong>Discord</strong><span id="pa-dc-s">Connected</span></div><span class="pacc-ok">Connected</span></div>
<div class="pacc-row" id="pa-go" hidden><span class="pacc-ic st-ic"><img src="img/google_stud.png" alt=""></span><div class="pacc-t"><strong>Google</strong><span id="pa-go-s">Log in with Google too</span></div><button class="brick dark sm" type="button" id="pa-go-b">Connect</button></div>
<div class="pacc-row rv-row" id="fv-row"><span class="pacc-ic st-ic"><img src="img/rbx_stud.png" alt=""></span><div class="pacc-t"><strong>Roblox</strong><span id="fv-s"></span></div><button class="brick blue sm" type="button" id="fverify">Verify</button></div>
</div>
</section>
<section class="pe-sec" aria-labelledby="ps-look"><h3 class="pe-st" id="ps-look">Your profile</h3>
<div class="pe-field pe-ban" id="fb-f"><div class="pe-lrow"><label id="fb-l">Profile banner</label><span class="pe-bs" id="fb-s" role="status"></span></div><div class="ban-grid" id="fban" role="radiogroup" aria-labelledby="fb-l"></div><p class="pe-msg">Shown at the top of your profile. Saves by itself as soon as you pick one, no need to press Save changes.</p></div>
<div class="pe-field" id="fd-f"><div class="pe-lrow"><label for="fd">About me <em>optional</em></label><div class="pe-tabs" role="tablist"><button type="button" role="tab" class="on" id="fdw" aria-selected="true">Write</button><button type="button" role="tab" id="fdp" aria-selected="false">Preview</button></div></div>
<div class="pe-ta"><textarea id="fd" rows="4" maxlength="300" placeholder="How you play, what you collect, when you're online…"></textarea><div class="pe-prev" id="fdprev" hidden></div></div>
<div class="pe-foot"><span><b>**bold**</b> <i>*italic*</i> and emojis work</span><span class="count" id="fdc">0/300</span></div></div>
</section>
<section class="pe-sec" id="fab-sec" aria-labelledby="ps-ads" hidden><h3 class="pe-st" id="ps-ads">Trade ads</h3>
<label class="ktog-line pe-tog"><span class="ktog"><input type="checkbox" id="fab" aria-describedby="fab-m"><i></i></span><span><strong>Auto-bump my trade ads</strong><span id="fab-m"></span></span></label>
</section>
<div class="pe-bar"><span class="pe-dirty" id="pdirty" hidden>Unsaved changes</span><span class="pe-sp"></span><button class="brick dark sm" type="button" id="pcancel">Cancel</button><button class="brick green" id="psave" type="submit">Save changes</button></div>
<p class="post-status" id="pstatus" hidden role="status"></p>
<details class="pe-danger" id="pdanger" hidden><summary>Delete account</summary><div class="pdanger"><div><p class="hint">Removes your Bloombot account, trade ads, strategies, wishlist and website login. This can't be undone.</p></div><button class="brick red sm" type="button" id="pdel">Delete account</button></div></details>
</form>
<div class="pcols">
<section class="panel psec" id="pads-sec" hidden><div class="upop-sh"><h3 class="upop-h">Live trade ads</h3><a href="trades.html" id="pads-all">All trade ads &rarr;</a></div><div class="plist" id="pads"></div></section>
<section class="panel psec" id="pstr-sec" hidden><div class="upop-sh"><h3 class="upop-h">Strategies</h3><a href="strategies.html">All strategies &rarr;</a></div><div class="plist" id="pstrs"></div></section>
</div>
<p class="panel pempty hint" id="pempty" hidden>No live trade ads or strategies yet.</p>
</main>
<script defer src="js/profile.js?v={JSVER['profile']}"></script>
"""
open("profile.html", "w").write(page("Bloombot Profile", "A Bloombot trader's profile: Roblox account, live trade ads and strategies.", profile_body, "", "profile.html", index=False))

# ── Server dashboard ─────────────────────────────────────────────────────
JSVER["dashboard"] = hashlib.md5(open("js/dashboard.js", "rb").read()).hexdigest()[:8]
dash_body = hero("gear", "Server dashboard", "Change Bloombot's settings for your server without typing a command. For server owners and administrators.", "t_dash") + f"""<main class="wrap dash" id="main">
<section class="panel login" id="dlogin" hidden>
<img class="login-icon" src="img/shield.png" alt="">
<h2>Log in to manage your servers</h2>
<p>We check you're the owner or an administrator of a server before showing its settings.</p>
<button class="brick green" type="button" data-login>Log in</button>
</section>
<div class="skel-grid sk-prof" id="dloading" aria-busy="true" aria-label="Loading"><div class="skel"><i></i><i></i><i></i></div></div>
<section class="panel login" id="dempty" hidden>
<img class="login-icon" src="img/envelope.png" alt="">
<h2 id="dempty-t">No servers to manage yet</h2>
<p>You'll see every server where you're the owner or an administrator and Bloombot is a member. New servers show up within a few minutes.</p>
<a class="brick discord" href="{INVITE}">{DISCORD_SVG}Add Bloombot to a server</a>
</section>
<div class="dgrid" id="dmain" hidden>
<section class="dbar" aria-label="Your servers"><div class="dbar-row">
<button type="button" class="dcur" id="dcur" aria-haspopup="listbox" aria-expanded="false" aria-controls="dpop"><span class="dcur-ic" id="dcur-ic"></span><span class="dg-t"><small>Managing</small><strong id="dcur-n">Pick a server</strong><em id="dcur-s"></em></span><span class="dcur-r"><i id="dcount"></i><svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round" d="m6 9 6 6 6-6"/></svg></span></button>
<a class="brick dark sm dadd" href="{INVITE}" aria-label="Add Bloombot to another server"><b>+</b><span>Add server</span></a></div>
<div class="dpop" id="dpop" hidden><div class="dpop-q"><svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" d="M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15Zm5.4-2.1L21 21"/></svg><input class="dgq" id="dgq" placeholder="Find a server…" autocomplete="off" spellcheck="false" aria-label="Find a server" aria-controls="dglist"></div><div id="dglist" role="listbox" aria-label="Your servers"></div><p class="dnone" id="dnone" hidden>No server matches that.</p></div></section>
<p class="panel dpick" id="dpick" hidden>Pick a server above to change its settings.</p><section class="panel dpanel" id="dpanel" hidden></section>
</div>
</main>
<script defer src="js/dashboard.js?v={JSVER['dashboard']}"></script>
"""
open("dashboard.html", "w").write(page("Bloombot Server Dashboard", "Change Bloombot's channels, pings and features for your Discord server from the website.", dash_body, "", "dashboard.html", index=False))

# ── Giveaway page: a link to share. Not in the menu, footer, search or sitemap on purpose ──
giveaway_body = hero("gift", "Giveaway", "Join in one click. Tasks give you extra entries.", "t_giveaway") + """<main class="wrap gwp" id="main">
<div id="gwpage" aria-busy="true" aria-label="Loading"><div class="skel-grid sk-prof"><div class="skel"><i></i><i></i><i></i></div></div></div>
<div class="gwp-share"><button class="brick blue sm" type="button" id="gwshare">Copy link</button></div>
</main>
"""
open("giveaway.html", "w").write(page("Bloombot Giveaway · Garden Tower Defense", "Join the live Bloombot giveaway for Garden Tower Defense. Do tasks for extra entries.", giveaway_body, "", "giveaway.html", index=False))

# ── Giveaway manager moved into the admin panel (admin.html#giveaways); old links still work ──
open("giveaway-admin.html", "w").write("""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Giveaways · Bloombot Admin</title>
<meta name="robots" content="noindex, nofollow">
<meta http-equiv="refresh" content="0; url=admin.html#giveaways">
<link rel="icon" href="img/favicon.png">
</head>
<body>
<p><a href="admin.html#giveaways">The giveaway manager is in the admin panel now.</a></p>
</body>
</html>
""")

notfound = hero("warning", "Page not found", "That page doesn't exist. It may have moved.", "t_404") + """<main class="wrap" id="main"><section class="cta-panel nf">
<img src="img/trading.png" alt="">
<div><h2>Let's get you back</h2><p>Head home, or open the Privacy Policy or Terms of Service.</p></div>
<a class="brick green" href="./">Go home</a>
</section></main>
"""
open("404.html", "w").write(re.sub(r'href="([a-z]+\.html)"', r'href="/\1"', page("Page not found · Bloombot", "This page does not exist.", index=False, body=notfound.replace('href="./"', 'href="/"')).replace('src="img/', 'src="/img/').replace('src="js/', 'src="/js/').replace('href="style.css', 'href="/style.css').replace('href="img/', 'href="/img/').replace('<a class="mini" href="./">', '<a class="mini" href="/">').replace('<a href="./">Home</a>', '<a href="/">Home</a>').replace('<a class="foot-mark" href="./">', '<a class="foot-mark" href="/">')))

# Admin dashboard. Owner only: the data comes from owner-checked Supabase functions (sql/site-admin.sql).
# Own layout, linked only from the owner menu, noindex.
ADMVER = {n: hashlib.md5(open(f, "rb").read()).hexdigest()[:8] for n, f in (("css", "admin.css"), ("charts", "js/admin-charts.js"), ("app", "js/admin.js"))}
ADMIN_HTML = f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Bloombot Admin</title>
<meta name="robots" content="noindex, nofollow">
<meta name="theme-color" content="#14171d">
<meta name="color-scheme" content="dark">
<meta name="darkreader-lock">
<link rel="icon" href="img/favicon.png">
<script src="js/theme.js?v={THEMEVER}"></script>
<link rel="stylesheet" href="fonts/fonts.css?v=1">
<link rel="stylesheet" href="admin.css?v={ADMVER['css']}">
<script defer src="js/supabase.js?v=2.45.4"></script>
<script defer src="js/admin-charts.js?v={ADMVER['charts']}"></script>
<script defer src="js/admin.js?v={ADMVER['app']}"></script>
</head>
<body class="booting">
<div class="gate" id="gate"><div class="gbox"><img class="gflower" src="img/flower.png" alt=""><h1 id="gtitle">Bloombot Admin</h1><p id="gtext">Checking your login…</p><div class="gload" id="gloading"><i></i><i></i><i></i></div><button class="brick" id="glogin" type="button" hidden>Log in with Discord</button><a class="gback" href="./">Back to the website</a></div></div>
<div class="app">
<aside class="side" aria-label="Admin menu">
<a class="brand" href="#overview"><img class="flower" src="img/flower.png" alt=""><img class="word" src="img/logo.png" alt="Bloombot"><span class="tag weld g-red">Admin</span></a>
<nav class="snav" id="snav"></nav>
<div class="side-foot"><a class="si back" href="./" title="Back to the website"><img src="img/flower.png" alt=""><span>Back to the website</span></a><div class="botcard"><img src="img/favicon.png" alt=""><div><b>Bloombot</b><small><span class="st" id="bstat"><i></i>Loading…</span></small></div></div></div>
</aside>
<div class="sideshade"></div>
<div class="main">
<header class="top">
<button class="ibtn burger" id="burger" type="button" aria-label="Open menu"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg></button>
<button class="ibtn collapse-btn" id="collapse" type="button" aria-label="Collapse menu"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16v14H4zM9 5v14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"/></svg></button>
<div class="crumb" id="crumb"></div>
<div class="gsearch"><svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" d="M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15Zm5.4-2.1L21 21"/></svg><label class="sr" for="gs">Search users, units, commands and pages</label><input id="gs" type="search" placeholder="Search users, units, pages…" autocomplete="off" role="combobox" aria-controls="gres" aria-expanded="false"><kbd>Ctrl K</kbd><div class="pop sres" id="gres" role="listbox"></div></div>
<button class="ibtn" id="tref" type="button" aria-label="Refresh data" title="Refresh data"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 12a8 8 0 1 1-2.34-5.66M20 4v5h-5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
<button class="ibtn theme-b" id="themebtn" type="button" aria-label="Switch to light mode" aria-pressed="false"><img class="i-sun" src="img/sun.png" alt=""><img class="i-moon" src="img/moon.png" alt=""></button>
<div class="wrapr"><button class="ibtn" id="nbtn" type="button" aria-label="Notifications" aria-expanded="false"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15zM10 20a2 2 0 0 0 4 0" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linejoin="round"/></svg><span class="dot" id="ndot" hidden></span></button><div class="pop notes" id="npop"></div></div>
<div class="wrapr"><button class="me" id="mebtn" type="button" aria-label="Account menu" aria-expanded="false"><img id="meav" src="img/task_user.png" alt="" referrerpolicy="no-referrer"><div><b id="mename">Owner</b><small>Owner</small></div></button>
<div class="pop" id="mepop"><div class="ph"><b>Owner</b> <span class="pill purple">Owner</span></div><a class="pi" href="./"><img src="img/flower.png" alt="">Back to website</a><a class="pi" href="profile.html"><img src="img/task_user.png" alt="">My profile</a><a class="pi" href="#giveaways"><img src="img/gift.png" alt="">Giveaway manager</a><button class="pi" type="button" id="mref"><img src="img/clock.png" alt="">Refresh data</button><div class="lastload" id="lastload"></div><hr><button class="pi" type="button" id="mout"><img src="img/login.png" alt="">Log out</button></div></div>
</header>
<div class="loadbar" id="loadbar" aria-hidden="true"></div>
<main class="content" id="main"><div id="view" class="view"><div class="phead"><div><i class="skel sk-h"></i><i class="skel sk-p"></i></div></div><div class="kpis"><div class="kpi"><i class="skel"></i><i class="skel sk-big"></i><i class="skel"></i></div><div class="kpi"><i class="skel"></i><i class="skel sk-big"></i><i class="skel"></i></div><div class="kpi"><i class="skel"></i><i class="skel sk-big"></i><i class="skel"></i></div><div class="kpi"><i class="skel"></i><i class="skel sk-big"></i><i class="skel"></i></div><div class="kpi"><i class="skel"></i><i class="skel sk-big"></i><i class="skel"></i></div><div class="kpi"><i class="skel"></i><i class="skel sk-big"></i><i class="skel"></i></div><div class="kpi"><i class="skel"></i><i class="skel sk-big"></i><i class="skel"></i></div><div class="kpi"><i class="skel"></i><i class="skel sk-big"></i><i class="skel"></i></div></div><div class="grid g-21 mt"><div class="card"><i class="skel sk-chart"></i></div><div class="card"><i class="skel sk-chart"></i></div></div></div></main>
</div>
</div>
<div class="scrim" id="scrim"></div>
<aside class="drawer" id="drawer" aria-label="User details"></aside>
<div class="modal" id="modal" role="dialog" aria-modal="true"></div>
<div class="toasts" id="toasts" aria-live="polite"></div>
</body>
</html>
"""
open("admin.html", "w").write(ADMIN_HTML)

open("robots.txt", "w").write(f"User-agent: *\nAllow: /\nDisallow: /admin.html\n\nSitemap: {BASE}sitemap.xml\n")
# Sitemap: every page whose robots meta says "index" (noindex pages such as the
# dashboard, profile and admin pages stay out on their own). A page's lastmod only
# moves when its HTML changed since the last commit, so Google sees real updates.
def _sitemap():
    import datetime, glob, subprocess
    today = datetime.date.today().isoformat()
    old = dict(re.findall(r"<loc>([^<]+)</loc><lastmod>([^<]+)</lastmod>", open("sitemap.xml").read())) if os.path.exists("sitemap.xml") else {}
    pages = [f for f in glob.glob("*.html") if re.search(r'<meta name="robots" content="index', open(f).read())]
    order = {u or "index.html": i for i, u in enumerate(SITEMAP)}
    pages.sort(key=lambda f: (order.get(f, len(order)), f))
    rows = []
    for f in pages:
        loc = BASE + ("" if f == "index.html" else f)
        try:
            changed = subprocess.run(["git", "status", "--porcelain", "--", f], capture_output=True, text=True, check=True).stdout.strip()
        except Exception:
            changed = "?"
        mod = today if changed or loc not in old else old[loc]
        pri = "1.0" if f == "index.html" else "0.8"
        rows.append(f"<url><loc>{loc}</loc><lastmod>{mod}</lastmod><priority>{pri}</priority></url>\n")
    open("sitemap.xml", "w").write('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + "".join(rows) + "</urlset>\n")
_sitemap()
