"""Builds the site pages from src/*.html. Run: python3 build.py"""
import hashlib
import re

VER = hashlib.md5(open("style.css", "rb").read()).hexdigest()[:8]
SUPPORT = "https://discord.gg/tGuXfcJxwf"
BASE = "https://marcel899.github.io/bloombot-legal/"
UPDATED = "2 November 2026"

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
<a class="brick nb {pc}" href="privacy.html"><img src="img/shield.png" alt=""><span>Privacy</span></a>
<a class="brick nb {tc}" href="terms.html"><img src="img/scale.png" alt=""><span>Terms</span></a>
<a class="brick nb red" href="{support}"><img src="img/envelope.png" alt=""><span>Support</span></a>
</nav>
</div>
</header>
"""

FOOT = """<footer>
<div class="grass"></div>
<div class="wrap foot">
<div class="foot-mark"><img class="flower" src="img/flower.png" alt=""><img src="img/logo.png" alt="Bloombot"></div>
<nav><a href="./">Home</a><a href="privacy.html">Privacy Policy</a><a href="terms.html">Terms of Service</a><a href="intents.html">How we use intents</a><a href="{support}">Support server</a></nav>
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
                        pc="green" if cur == "p" else "dark", tc="blue" if cur == "t" else "dark")
            + body + FOOT.replace("{support}", SUPPORT))


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
<a class="brick green" href="privacy.html"><img src="img/shield.png" alt="">Privacy Policy</a>
<a class="brick blue" href="terms.html"><img src="img/scale.png" alt="">Terms of Service</a>
</div>
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
open("index.html", "w").write(page("Bloombot", "Bloombot is the trading bot for Roblox Garden Tower Defense. Read its Privacy Policy and Terms of Service.", home))

notfound = hero("warning", "Page not found", "That page doesn't exist. It may have moved.", "t_404") + """<main class="wrap" id="main"><section class="cta-panel nf">
<img src="img/swap.png" alt="">
<div><h2>Let's get you back</h2><p>Head home, or open the Privacy Policy or Terms of Service.</p></div>
<a class="brick green" href="./">Go home</a>
</section></main>
"""
open("404.html", "w").write(page("Page not found · Bloombot", "This page does not exist.", notfound.replace('href="./"', 'href="/bloombot-legal/"')).replace('href="privacy.html"', 'href="/bloombot-legal/privacy.html"').replace('href="terms.html"', 'href="/bloombot-legal/terms.html"').replace('href="intents.html"', 'href="/bloombot-legal/intents.html"').replace('src="img/', 'src="/bloombot-legal/img/').replace('href="style.css', 'href="/bloombot-legal/style.css').replace('href="img/', 'href="/bloombot-legal/img/').replace('<a class="mini" href="./">', '<a class="mini" href="/bloombot-legal/">').replace('<a href="./">Home</a>', '<a href="/bloombot-legal/">Home</a>'))
