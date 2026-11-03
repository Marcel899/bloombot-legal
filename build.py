"""Builds the site pages from src/*.html. Run: python3 build.py"""
import hashlib
import re

VER = hashlib.md5(open("style.css", "rb").read()).hexdigest()[:8]
SUPPORT = "https://discord.gg/tGuXfcJxwf"
BASE = "https://marcel899.github.io/bloombot-legal/"
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
</head>
<body>
<a class="skip" href="#main">Skip to content</a>
<div class="progress" aria-hidden="true"></div>
<header class="topbar">
<div class="wrap bar">
<a class="mini" href="./"><img class="flower" src="img/flower.png" alt=""><img src="img/logo.png" alt="Bloombot home"></a>
<nav>
<a class="brick nb {fc}" href="features.html"><img src="img/gem.png" alt=""><span>Features</span></a>
<a class="brick nb {ac}" href="trades.html"><img src="img/swap.png" alt=""><span>Trade ads</span></a>
<a class="brick nb dark hide-sm" href="{support}"><img src="img/envelope.png" alt=""><span>Support</span></a>
<a class="brick nb discord add" href="{invite}">{dsvg}<span>Add</span></a>
</nav>
</div>
</header>
"""

FOOT = """<footer>
<div class="grass"></div>
<div class="wrap foot">
<div class="foot-mark"><img class="flower" src="img/flower.png" alt=""><img src="img/logo.png" alt="Bloombot"></div>
<nav><a href="./">Home</a><a href="features.html">Features &amp; commands</a><a href="trades.html">Trade ads</a><a href="{invite}">Add to Discord</a><a href="privacy.html">Privacy Policy</a><a href="terms.html">Terms of Service</a><a href="intents.html">How we use intents</a><a href="{support}">Support server</a></nav>
<p>Bloombot is a fan-made bot. It is not affiliated with Discord, Roblox, or the developers of Garden Tower Defense.</p>
</div>
</footer>
<a class="totop brick dark" href="#" aria-label="Back to top">&#8593;</a>
<script>
(()=>{const p=document.querySelector(".progress"),t=document.querySelector(".totop");const f=()=>{const h=document.documentElement,max=h.scrollHeight-h.clientHeight;p.style.transform=`scaleX(${max>0?h.scrollTop/max:0})`;t.classList.toggle("show",h.scrollTop>600)};addEventListener("scroll",f,{passive:true});f();})();
</script>
</body>
</html>
"""


def page(title, desc, body, cur="", path=""):
    return (HEAD.format(title=title, desc=desc, support=SUPPORT, ver=VER, base=BASE, path=path,
                        invite=INVITE, dsvg=DISCORD_SVG,
                        fc="yellow" if cur == "f" else "dark", ac="purple" if cur == "a" else "dark")
            + body + FOOT.replace("{support}", SUPPORT).replace("{invite}", INVITE))


SPY = """<script>
(()=>{const links=[...document.querySelectorAll('.toc-box a')];const map=new Map(links.map(a=>[a.getAttribute('href').slice(1),a]));
const io=new IntersectionObserver(es=>{es.forEach(e=>{if(e.isIntersecting){links.forEach(a=>a.classList.remove('on'));const a=map.get(e.target.id);if(a)a.classList.add('on');}})},{rootMargin:'-90px 0px -70% 0px'});
map.forEach((a,id)=>{const el=document.getElementById(id);if(el)io.observe(el);});
const d=document.querySelector('.mtoc');if(d)d.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>d.open=false));})();
</script>
"""


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
    ("swap", "Global trade ads", "Post once and your ad reaches every server running Bloombot."),
    ("rise", "Live values", "Unit values, demand and trends, updated from the community lists."),
    ("scale", "Trade checks", "See right away if a trade is a win, fair, or a loss."),
    ("wish_star", "Wishlists", "Get a DM the moment someone offers a unit you want."),
]
TILE_COLORS = ["green", "blue", "yellow", "purple"]
tiles = "".join(f'<div class="tile"><div class="weld g-{c}"><img src="img/{i}.png" alt=""><h3>{h}</h3></div><p>{p}</p></div>' for (i, h, p), c in zip(FEATURES, TILE_COLORS))
home = f"""<section class="hero big">
<div class="wrap hero-in">
<div class="hero-mark"><img class="hero-flower" src="img/flower.png" alt=""><img class="hero-logo" src="img/logo.png" alt="Bloombot"></div>
<p class="sub">The trading bot for Roblox Garden Tower Defense.</p>
<div class="ctas">
<a class="brick discord big-cta" href="{INVITE}">{DISCORD_SVG}Add to Discord</a>
<a class="brick yellow" href="features.html"><img src="img/gem.png" alt="">Features &amp; commands</a>
<a class="brick purple" href="trades.html"><img src="img/swap.png" alt="">Browse trade ads</a>
</div>
<p class="legal-links"><a href="privacy.html">Privacy Policy</a> · <a href="terms.html">Terms of Service</a></p>
</div>
</section>
<main class="wrap" id="main">
<section class="tiles">{tiles}</section>
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
    ("floating_island", "Team finder and strategies", "Find teammates across servers, plus meta loadouts and community guides."),
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
<script>
(()=>{{const q=document.getElementById("cmdq"),none=document.getElementById("cmdnone");
q.addEventListener("input",()=>{{const v=q.value.trim().toLowerCase();let any=0;
document.querySelectorAll(".cmd-group").forEach(g=>{{let n=0;g.querySelectorAll(".cmd").forEach(li=>{{const ok=!v||li.dataset.q.includes(v);li.hidden=!ok;n+=ok}});g.hidden=!n;any+=n}});
none.hidden=!!any}});}})();
</script>
"""
open("features.html", "w").write(page("Bloombot Features and Commands", "Everything the Bloombot Discord bot can do for Garden Tower Defense traders, and every slash command.", features_body, "f", "features.html"))

# ── Trade ads (Discord login through Supabase) ───────────────────────────
trades_body = hero("swap", "Trade ads", "Every live Bloombot trade ad, from every server. Log in with Discord to see them.", "t_trades") + f"""<main class="wrap trades" id="main">
<section class="panel login" id="login" hidden>
<img class="login-icon" src="img/swap.png" alt="">
<h2>Log in to see trade ads</h2>
<p>Trade ads are only shown to Discord users. We only use your Discord account to log you in. We never post for you.</p>
<button class="brick discord" id="loginbtn" type="button">{DISCORD_SVG}Log in with Discord</button>
<p class="err" id="loginerr" hidden></p>
</section>
<section id="board" hidden>
<div class="board-bar panel">
<div class="me"><img id="meav" alt=""><div><strong id="mename"></strong><span id="count"></span></div></div>
<input class="search" id="adq" type="search" placeholder="Search units or traders…" aria-label="Search trade ads">
<label class="mine"><input type="checkbox" id="mine"> My ads</label>
<button class="brick dark sm" id="logout" type="button">Log out</button>
</div>
<div class="ads" id="ads"></div>
<p class="empty" id="adsnone" hidden>No trade ads right now.</p>
</section>
<p class="loading" id="loading">Loading…</p>
</main>
<script src="js/supabase.js?v=2.45.4"></script>
<script>
(()=>{{
const sb=supabase.createClient("{SUPABASE_URL}","{SUPABASE_KEY}");
const $=id=>document.getElementById(id);
let ads=[],me=null;
const safe=u=>typeof u==="string"&&/^https:\\/\\//.test(u)?u:null;
const ago=t=>{{const s=(Date.now()-new Date(t))/1000;if(!(s>=0))return"";if(s<60)return"just now";if(s<3600)return Math.floor(s/60)+"m ago";if(s<86400)return Math.floor(s/3600)+"h ago";return Math.floor(s/86400)+"d ago"}};
function el(tag,cls,text){{const e=document.createElement(tag);if(cls)e.className=cls;if(text!=null)e.textContent=text;return e}}
function card(a){{
  const c=el("article","ad");
  const head=el("div","ad-head");
  const av=el("img","ad-av");av.alt="";av.src=safe(a.discord_avatar)||"img/flower.png";av.onerror=()=>{{av.src="img/flower.png"}};
  const who=el("div","ad-who");who.append(el("strong",null,a.discord_name||"Trader"),el("span",null,ago(a.created_at)));
  head.append(av,who);c.append(head,el("p","ad-text",a.content));
  const img=safe(a.image_url);
  if(img){{const i=el("img","ad-img");i.alt="Trade ad picture";i.loading="lazy";i.src=img;i.onerror=()=>i.remove();c.append(i)}}
  const links=el("div","ad-links");
  if(/^\\d+$/.test(a.discord_id)){{const d=el("a","brick discord sm","Message");d.href="https://discord.com/users/"+a.discord_id;d.target="_blank";d.rel="noopener";links.append(d)}}
  const r=safe(a.roblox_url);
  if(r){{const b=el("a","brick dark sm","Roblox: "+(a.roblox_name||"profile"));b.href=r;b.target="_blank";b.rel="noopener";links.append(b)}}
  c.append(links);return c;
}}
function render(){{
  const v=$("adq").value.trim().toLowerCase(),mine=$("mine").checked,now=Date.now();
  const list=ads.filter(a=>(!a.expires_at||new Date(a.expires_at)>now)&&(!mine||a.discord_id===me)&&(!v||(a.content+" "+(a.discord_name||"")+" "+(a.roblox_name||"")).toLowerCase().includes(v)));
  $("ads").replaceChildren(...list.map(card));
  $("adsnone").hidden=list.length>0;
  $("adsnone").textContent=ads.length?"No trade ad matches that.":"No trade ads right now.";
  $("count").textContent=list.length+" live trade ad"+(list.length===1?"":"s");
}}
async function load(){{
  const {{data,error}}=await sb.from("trade_ads").select("*").order("created_at",{{ascending:false}}).limit(1000);
  if(error){{$("adsnone").hidden=false;$("adsnone").textContent="Couldn't load trade ads. Try again in a minute.";return}}
  ads=data||[];render();
}}
async function show(session){{
  $("loading").hidden=true;
  if(!session){{$("login").hidden=false;$("board").hidden=true;return}}
  const m=session.user.user_metadata||{{}};
  me=m.provider_id||m.sub||null;
  $("mename").textContent=m.full_name||m.custom_claims?.global_name||m.name||"Discord user";
  const av=safe(m.avatar_url);if(av)$("meav").src=av;else $("meav").src="img/flower.png";
  $("login").hidden=true;$("board").hidden=false;await load();
}}
$("loginbtn").onclick=()=>sb.auth.signInWithOAuth({{provider:"discord",options:{{redirectTo:location.origin+location.pathname,scopes:"identify"}}}});
$("logout").onclick=async()=>{{await sb.auth.signOut();show(null)}};
$("adq").oninput=render;$("mine").onchange=render;
const p=new URLSearchParams(location.hash.slice(1)+"&"+location.search.slice(1));
if(p.get("error_description")){{$("loginerr").hidden=false;$("loginerr").textContent="Login failed: "+p.get("error_description")}}
sb.auth.getSession().then(({{data}})=>show(data.session));
sb.auth.onAuthStateChange((ev,s)=>{{if(ev==="SIGNED_IN")show(s)}});
setInterval(()=>{{if(!$("board").hidden)load()}},60000);
}})();
</script>
"""
open("trades.html", "w").write(page("Bloombot Trade Ads", "Browse every live Bloombot trade ad for Garden Tower Defense. Log in with Discord.", trades_body, "a", "trades.html"))

notfound = hero("warning", "Page not found", "That page doesn't exist. It may have moved.", "t_404") + """<main class="wrap" id="main"><section class="cta-panel nf">
<img src="img/swap.png" alt="">
<div><h2>Let's get you back</h2><p>Head home, or open the Privacy Policy or Terms of Service.</p></div>
<a class="brick green" href="./">Go home</a>
</section></main>
"""
open("404.html", "w").write(re.sub(r'href="([a-z]+\.html)"', r'href="/bloombot-legal/\1"', page("Page not found · Bloombot", "This page does not exist.", notfound.replace('href="./"', 'href="/bloombot-legal/"')).replace('src="img/', 'src="/bloombot-legal/img/').replace('href="style.css', 'href="/bloombot-legal/style.css').replace('href="img/', 'href="/bloombot-legal/img/').replace('<a class="mini" href="./">', '<a class="mini" href="/bloombot-legal/">').replace('<a href="./">Home</a>', '<a href="/bloombot-legal/">Home</a>')))
