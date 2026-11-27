// Builds the public copy of the site into dist/ (run by Vercel on every deploy).
// The repo keeps the readable source; visitors only get minified + obfuscated files.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { minify as terser } from "terser";
import JavaScriptObfuscator from "javascript-obfuscator";
import CleanCSS from "clean-css";
import { minify as minifyHtml } from "html-minifier-terser";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."); // works on Windows too
const OUT = path.join(ROOT, "dist");

// Never shipped to visitors.
const SKIP = new Set([
  ".git", ".github", ".gitignore", ".vercel", ".vercelignore", ".nojekyll", "node_modules",
  "dist", "scripts", "src", "sql", "posts", "build.py", "package.json", "package-lock.json", "vercel.json",
]);
// Already-minified third-party bundles: copied as they are.
const VENDOR = new Set(["js/supabase.js", "js/591.supabase.js"]);

const OBF = {
  compact: true,
  target: "browser",
  identifierNamesGenerator: "hexadecimal",
  renameGlobals: false,          // pages share globals like BB across files
  stringArray: true,
  stringArrayEncoding: ["base64"],
  stringArrayThreshold: 0.75,
  stringArrayRotate: true,
  stringArrayShuffle: true,
  splitStrings: false,
  controlFlowFlattening: false,  // keeps the site fast
  deadCodeInjection: false,
  selfDefending: false,
  debugProtection: false,
  disableConsoleOutput: false,
  transformObjectKeys: false,
  unicodeEscapeSequence: false,
  sourceMap: false,
};

const css = new CleanCSS({ level: 1, inline: false, rebase: false });

async function js(code, rel) {
  const min = await terser(code, {
    compress: { passes: 2 },
    mangle: true,
    format: { comments: false },
    ecma: 2020,
  });
  if (min.error) throw min.error;
  return JavaScriptObfuscator.obfuscate(min.code, OBF).getObfuscatedCode();
}

async function html(code) {
  return minifyHtml(code, {
    collapseWhitespace: true,
    conservativeCollapse: true,
    removeComments: true,
    minifyCSS: false,
    minifyJS: false,
    keepClosingSlash: true,
    decodeEntities: false,
  });
}

async function build(file) {
  const rel = path.relative(ROOT, file).split(path.sep).join("/");
  const out = path.join(OUT, rel);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  const ext = path.extname(file);
  if (VENDOR.has(rel) || ![".js", ".css", ".html"].includes(ext)) {
    fs.copyFileSync(file, out);
    return;
  }
  const src = fs.readFileSync(file, "utf8");
  let res;
  if (ext === ".js") res = await js(src, rel);
  else if (ext === ".css") {
    const r = css.minify(src);
    if (r.errors.length) throw new Error(rel + ": " + r.errors.join("; "));
    res = r.styles;
  } else res = await html(src);
  fs.writeFileSync(out, res);
}

function walk(dir, top = true) {
  const files = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (top && SKIP.has(e.name)) continue;
    if (e.name.endsWith(".md")) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) files.push(...walk(p, false));
    else files.push(p);
  }
  return files;
}

/* ── one page per unit: /units/<slug> ─────────────────────────────────
   Copies unit.html once per unit on the public value list, with the unit's
   name, value and a short summary baked into the title, description and page,
   so search engines can list "Grim Gardener value" on its own. js/unit.js then
   draws the live version on top. If the value list can't be fetched, nothing
   breaks: vercel.json sends /units/* to unit.html, which works without them. */
const esc = t => String(t ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const slugOf = name => String(name || "").toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
  .replace(/['\u2019]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");   // same as BB.unitSlug in js/app.js
const fmt = n => { const t = x => (Math.round(x * 100) / 100).toString(); const a = Math.abs(n); return a >= 1e6 ? t(n / 1e6) + "m" : a >= 1e3 ? t(n / 1e3) + "k" : t(n); };
const estOf = it => {
  if (it.value > 0) return it.value;
  const m = String(it.value_text || "").toLowerCase().replace(/,/g, "").match(/(\d+(?:\.\d+)?)\s*([km]?)/);
  return m ? parseFloat(m[1]) * (m[2] === "k" ? 1e3 : m[2] === "m" ? 1e6 : 1) : 0;
};

async function unitPages() {
  /* Settings from files Vercel uploads (build.py and src/ are left out by .vercelignore):
     the public Supabase address and key in js/app.js, the site address from index.html. */
  const read = f => { try { return fs.readFileSync(path.join(ROOT, f), "utf8"); } catch (e) { return ""; } };
  const app = read("js/app.js"), home = read("index.html");
  const url = (app.match(/url:\s*"(https:\/\/[a-z0-9-]+\.supabase\.co)"/) || [])[1];
  const key = (app.match(/key:\s*"(sb_publishable_[A-Za-z0-9_-]+)"/) || [])[1];
  const base = (home.match(/<link rel="canonical" href="(https:\/\/[^"]+\/)"/) || [])[1];
  if (!url || !key || !base) { console.log("units: couldn't find the Supabase settings, skipped; /units/* uses unit.html"); return; }
  let list;
  try {
    const r = await fetch(url + "/rest/v1/item_values?select=name,category,value,value_text,demand,status,rarity&order=value.desc&limit=3000",
      { headers: { apikey: key, Authorization: "Bearer " + key }, signal: AbortSignal.timeout(20000) });
    if (!r.ok) throw new Error("HTTP " + r.status);
    list = await r.json();
  } catch (e) {
    console.log("units: couldn't fetch the value list (" + e.message + "), skipped; /units/* uses unit.html");
    return;
  }
  const tpl = fs.readFileSync(path.join(ROOT, "unit.html"), "utf8");
  const done = new Set(), urls = [];
  for (const it of list) {
    const slug = slugOf(it.name);
    if (!slug || done.has(slug)) continue;
    done.add(slug);
    const est = estOf(it);
    const value = est > 0 ? fmt(est) : it.value_text || "N/A";
    const kind = it.category === "gamepasses" ? "gamepass" : "unit";
    const title = `${it.name} value in Garden Tower Defense · Bloombot`;
    const desc = `${it.name} is worth ${value} in Garden Tower Defense trades.` + (it.demand ? ` Demand ${it.demand}.` : "") +
      (it.status ? ` Status: ${String(it.status).toLowerCase()}.` : "") + " Live value, 30-day trend and trade ads on Bloombot.";
    const loc = base + "units/" + slug;
    const line = `${it.name} is a ${it.rarity ? esc(String(it.rarity).toLowerCase()) + " " : ""}Garden Tower Defense ${kind} worth ${esc(value)} in trades` +
      (it.demand ? `, with demand ${esc(it.demand)}` : "") + (it.status ? ` (${esc(String(it.status).toLowerCase())})` : "") + ".";
    const ld = '<script type="application/ld+json">' + JSON.stringify({
      "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [
        { "@type": "ListItem", position: 1, name: "Values", item: base + "values.html" },
        { "@type": "ListItem", position: 2, name: it.name, item: loc }],
    }).replace(/</g, "\\u003c") + "</script>";
    let page = tpl
      .replace(/<title>[^<]*<\/title>/, `<title>${esc(title)}</title>`)
      .replace(/(<meta name="description" content=")[^"]*/, `$1${esc(desc)}`)
      .replace(/(<meta property="og:title" content=")[^"]*/, `$1${esc(title)}`)
      .replace(/(<meta property="og:description" content=")[^"]*/, `$1${esc(desc)}`)
      .replace(/(<meta property="og:url" content=")[^"]*/, `$1${loc}`)
      .replace(/(<link rel="canonical" href=")[^"]*/, `$1${loc}`)
      .replace(/(<meta name="robots" content=")[^"]*/, "$1index, follow, max-image-preview:large")
      .replace("</head>", ld + "\n</head>")
      .replace('<span id="ucrumb">Unit</span>', `<span id="ucrumb">${esc(it.name)}</span>`)
      .replace(/<div class="u-seed" id="useed">[\s\S]*?<\/div>/, `<div class="u-seed" id="useed"><h1 id="uname">${esc(it.name)} value</h1><p id="uline">${line}</p></div>`);
    const out = path.join(OUT, "units", slug, "index.html");
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, await html(page));
    urls.push(loc);
  }
  /* list them in the sitemap too */
  const sm = path.join(OUT, "sitemap.xml");
  if (fs.existsSync(sm) && urls.length) {
    const day = new Date().toISOString().slice(0, 10);
    const rows = urls.map(u => `<url><loc>${u}</loc><lastmod>${day}</lastmod><priority>0.6</priority></url>\n`).join("");
    fs.writeFileSync(sm, fs.readFileSync(sm, "utf8").replace("</urlset>", rows + "</urlset>"));
  }
  console.log(`units: ${urls.length} unit pages`);
}

fs.rmSync(OUT, { recursive: true, force: true });
const files = walk(ROOT);
for (const f of files) await build(f);
console.log(`dist/: ${files.length} files`);
/* Unit pages are extra: never let them fail the deploy. */
try { await unitPages(); } catch (e) { console.log("units: skipped (" + e.message + "); /units/* uses unit.html"); }
