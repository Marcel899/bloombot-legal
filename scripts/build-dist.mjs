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
  "dist", "scripts", "src", "sql", "build.py", "package.json", "package-lock.json", "vercel.json",
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

fs.rmSync(OUT, { recursive: true, force: true });
const files = walk(ROOT);
for (const f of files) await build(f);
console.log(`dist/: ${files.length} files`);
