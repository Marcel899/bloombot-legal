// Small SVG chart kit for the admin dashboard (no libraries: CSP allows only our own scripts).
// Line/area (crosshair tooltip), bars (vertical/horizontal, stacked/grouped), donut, sparkline.
(function () {
  "use strict";
  const NS = "http://www.w3.org/2000/svg";
  const PAL = ["#3987e5", "#d95926", "#199e70", "#c98500", "#d55181", "#008300", "#9085e9", "#e66767"];
  // Same eight hues stepped for the light theme (validated light palette). Pages pass the dark hex; tc() swaps it.
  const LIGHT = { "#3987e5": "#2a78d6", "#d95926": "#eb6834", "#199e70": "#1baf7a", "#c98500": "#eda100", "#d55181": "#e87ba4", "#008300": "#008300", "#9085e9": "#6250d6", "#e66767": "#e34948", "#1b1e26": "#fffdf7" };
  const isLight = () => document.documentElement.getAttribute("data-theme") === "light";
  const tc = (c) => (c && isLight() ? LIGHT[String(c).toLowerCase()] || c : c);

  function s(tag, attrs, parent) {
    const el = document.createElementNS(NS, tag);
    for (const k in attrs) el.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(el);
    return el;
  }
  function h(tag, cls, text) {
    const el = document.createElement(tag);
    if (cls) el.className = cls;
    if (text != null) el.textContent = text;
    return el;
  }

  // number formatting
  function compact(v) {
    const a = Math.abs(v);
    if (a >= 1e6) return (v / 1e6).toFixed(a >= 1e7 ? 0 : 1).replace(/\.0$/, "") + "M";
    if (a >= 1e3) return (v / 1e3).toFixed(a >= 1e4 ? 0 : 1).replace(/\.0$/, "") + "k";
    return String(Math.round(v * 10) / 10);
  }
  const full = (v) => Math.round(v).toLocaleString("en-US");

  // 5 gridline steps when max starts with 2.5 or 5, so ticks stay round (10k, 20k…)
  function steps(max) { const p = Math.pow(10, Math.floor(Math.log10(max))); const m = Math.round(max / p * 10) / 10; return m === 2.5 || m === 5 ? 5 : 4; }
  function niceMax(v) {
    if (v <= 0) return 1;
    const p = Math.pow(10, Math.floor(Math.log10(v)));
    const n = v / p;
    const m = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10;
    return m * p;
  }

  // ---------- tooltip ----------
  let tip;
  function tipEl() {
    if (!tip) { tip = h("div", "tip"); tip.setAttribute("role", "status"); document.body.appendChild(tip); }
    return tip;
  }
  function showTip(x, y, head, rows) {
    const t = tipEl();
    t.replaceChildren();
    if (head) t.appendChild(h("div", "th", head));
    rows.forEach((r) => {
      const row = h("div", "tr");
      if (r.color) { const k = h("i", "ln"); k.style.background = r.color; row.appendChild(k); }
      row.appendChild(h("b", "", r.value));
      row.appendChild(h("span", "", r.name));
      t.appendChild(row);
    });
    t.classList.add("on");
    const w = t.offsetWidth, hh = t.offsetHeight;
    let left = x + 14, top = y - hh - 12;
    if (left + w > innerWidth - 8) left = x - w - 14;
    if (top < 8) top = y + 16;
    t.style.left = Math.max(8, left) + "px";
    t.style.top = top + "px";
  }
  function hideTip() { if (tip) tip.classList.remove("on"); }
  addEventListener("scroll", hideTip, { passive: true });

  // ---------- legend ----------
  function legend(host, series, kind, onToggle) {
    const ul = h("ul", "legend");
    series.forEach((sr, i) => {
      const li = h("li");
      const b = h("button");
      b.type = "button";
      const k = h("i", kind === "line" ? "ln" : "sw");
      k.style.background = sr.color;
      b.append(k, document.createTextNode(sr.name));
      if (onToggle) b.addEventListener("click", () => { b.classList.toggle("off"); onToggle(i, !b.classList.contains("off")); });
      else b.disabled = true;
      li.appendChild(b);
      ul.appendChild(li);
    });
    host.appendChild(ul);
  }

  // re-render on resize
  const RO = "ResizeObserver" in window ? new ResizeObserver((ents) => {
    ents.forEach((e) => { const f = e.target._draw; if (f && e.target._w !== Math.round(e.contentRect.width)) f(); });
  }) : null;
  function mount(el, draw) {
    el._draw = () => { el._w = Math.round(el.clientWidth); draw(); };
    el._draw();
    if (RO) RO.observe(el);
  }

  // ---------- line / area ----------
  // opts: labels[], series[{name,values,color}], area, stacked, height, fmt, tipLabel(i)
  function line(host, opts) {
    host.replaceChildren();
    const series = opts.series.map((sr, i) => ({ ...sr, color: tc(sr.color || PAL[i]), on: true }));
    if (series.length > 1 || opts.legend) legend(host, series, opts.area ? "area" : "line", (i, on) => { series[i].on = on; box._draw(); });
    const box = h("div", "chart");
    host.appendChild(box);
    const H = opts.height || 260, fmt = opts.fmt || full;
    const L = opts.labels;

    mount(box, () => {
      box.replaceChildren();
      const W = Math.max(260, box.clientWidth);
      const pad = { l: 44, r: 12, t: 10, b: 26 };
      const iw = W - pad.l - pad.r, ih = H - pad.t - pad.b;
      const vis = series.filter((x) => x.on);
      const n = L.length;
      let stack = null, max = 0;
      if (opts.stacked) {
        stack = [];
        const acc = new Array(n).fill(0);
        vis.forEach((sr) => {
          const lo = acc.slice();
          sr.values.forEach((v, i) => { acc[i] += v; });
          stack.push({ lo, hi: acc.slice() });
        });
        max = Math.max(...acc, 0);
      } else vis.forEach((sr) => { max = Math.max(max, ...sr.values); });
      max = niceMax(max * 1.05);
      const x = (i) => pad.l + (n === 1 ? iw / 2 : (i / (n - 1)) * iw);
      const y = (v) => pad.t + ih - (v / max) * ih;

      const svg = s("svg", { viewBox: `0 0 ${W} ${H}`, height: H, role: "img", "aria-label": opts.label || "Line chart" }, box);
      const g = s("g", { class: "grid" }, svg);
      const ax = s("g", { class: "axis" }, svg);
      const ns = steps(max);
      for (let k = 0; k <= ns; k++) {
        const v = (max / ns) * k, yy = y(v);
        if (k) s("line", { x1: pad.l, x2: W - pad.r, y1: yy, y2: yy }, g);
        const t = s("text", { x: pad.l - 8, y: yy + 4, "text-anchor": "end" }, ax);
        t.textContent = opts.yfmt ? opts.yfmt(v) : compact(v);
      }
      s("line", { class: "base", x1: pad.l, x2: W - pad.r, y1: y(0), y2: y(0) }, svg);
      // x ticks
      const want = Math.max(2, Math.floor(iw / 90));
      const step = Math.max(1, Math.ceil(n / want));
      for (let i = 0; i < n; i += step) {
        const t = s("text", { x: x(i), y: H - 6, "text-anchor": i === 0 ? "start" : "middle" }, ax);
        t.textContent = opts.xfmt ? opts.xfmt(L[i], i) : L[i];
      }

      vis.forEach((sr, si) => {
        const pts = sr.values.map((v, i) => [x(i), y(stack ? stack[si].hi[i] : v)]);
        const d = "M" + pts.map((p) => p[0].toFixed(1) + "," + p[1].toFixed(1)).join("L");
        if (opts.area) {
          let base;
          if (stack) base = stack[si].lo.map((v, i) => [x(i), y(v)]).reverse();
          else base = [[x(n - 1), y(0)], [x(0), y(0)]];
          const ad = d + "L" + base.map((p) => p[0].toFixed(1) + "," + p[1].toFixed(1)).join("L") + "Z";
          const id = "gr" + Math.random().toString(36).slice(2, 8);
          const defs = s("defs", {}, svg);
          const lg = s("linearGradient", { id, x1: 0, y1: 0, x2: 0, y2: 1 }, defs);
          s("stop", { offset: "0", "stop-color": sr.color, "stop-opacity": stack ? ".55" : ".32" }, lg);
          s("stop", { offset: "1", "stop-color": sr.color, "stop-opacity": stack ? ".35" : ".02" }, lg);
          s("path", { d: ad, fill: `url(#${id})`, class: "mk" }, svg);
        }
        s("path", { d, fill: "none", stroke: sr.color, "stroke-width": 2, "stroke-linejoin": "round", "stroke-linecap": "round", class: "mk", "stroke-dasharray": sr.dash ? "5 4" : "none" }, svg);
      });

      // crosshair
      const hair = s("line", { class: "hair", visibility: "hidden", y1: pad.t, y2: pad.t + ih, x1: -10, x2: -10 }, svg);
      const dots = vis.map((sr) => s("circle", { r: 4.5, class: "hdot", visibility: "hidden", fill: sr.color, stroke: tc("#1b1e26"), "stroke-width": 2, cx: -10, cy: -10 }, svg));
      const hit = s("rect", { x: pad.l, y: pad.t, width: iw, height: ih, fill: "transparent", tabindex: 0 }, svg);
      let cur = n - 1;
      const at = (i, cx, cy) => {
        cur = i;
        const xx = x(i);
        hair.setAttribute("visibility", "visible"); hair.setAttribute("x1", xx); hair.setAttribute("x2", xx);
        vis.forEach((sr, si) => { dots[si].setAttribute("visibility", "visible"); dots[si].setAttribute("cx", xx); dots[si].setAttribute("cy", y(stack ? stack[si].hi[i] : sr.values[i])); });
        const rows = vis.map((sr) => ({ name: sr.name, value: fmt(sr.values[i]), color: sr.color }));
        if (opts.stacked && vis.length > 1) rows.push({ name: "Total", value: fmt(vis.reduce((a, sr) => a + sr.values[i], 0)) });
        const r = svg.getBoundingClientRect();
        showTip(cx != null ? cx : r.left + (xx / W) * r.width, cy != null ? cy : r.top + 20, opts.tipLabel ? opts.tipLabel(i) : L[i], rows);
      };
      const idx = (ev) => {
        const r = svg.getBoundingClientRect();
        const px = ((ev.clientX - r.left) / r.width) * W;
        return Math.max(0, Math.min(n - 1, Math.round(((px - pad.l) / iw) * (n - 1))));
      };
      hit.addEventListener("pointermove", (ev) => at(idx(ev), ev.clientX, ev.clientY));
      hit.addEventListener("pointerdown", (ev) => at(idx(ev), ev.clientX, ev.clientY));
      const off = () => { hideTip(); hair.setAttribute("visibility", "hidden"); dots.forEach((d) => d.setAttribute("visibility", "hidden")); };
      hit.addEventListener("pointerleave", off);
      hit.addEventListener("blur", off);
      hit.addEventListener("focus", () => at(cur));
      hit.addEventListener("keydown", (ev) => {
        if (ev.key === "ArrowLeft") { at(Math.max(0, cur - 1)); ev.preventDefault(); }
        if (ev.key === "ArrowRight") { at(Math.min(n - 1, cur + 1)); ev.preventDefault(); }
      });
    });
  }

  // ---------- bars ----------
  // opts: labels[], series[{name,values,color}], stacked, horizontal, height, fmt, values (direct labels)
  function bars(host, opts) {
    host.replaceChildren();
    const series = opts.series.map((sr, i) => ({ ...sr, color: tc(sr.color || PAL[i]), on: true }));
    if (series.length > 1) legend(host, series, "bar", (i, on) => { series[i].on = on; box._draw(); });
    const box = h("div", "chart");
    host.appendChild(box);
    const fmt = opts.fmt || full;
    const L = opts.labels;
    const horiz = !!opts.horizontal;

    mount(box, () => {
      box.replaceChildren();
      const W = Math.max(240, box.clientWidth);
      const vis = series.filter((x) => x.on);
      const n = L.length;
      const H = horiz ? (opts.rowH || 30) * n + 26 : opts.height || 240;
      const pad = horiz ? { l: opts.labelW || 110, r: 46, t: 4, b: 22 } : { l: 44, r: 8, t: 14, b: 26 };
      const iw = W - pad.l - pad.r, ih = H - pad.t - pad.b;
      let max = 0;
      for (let i = 0; i < n; i++) {
        if (opts.stacked) max = Math.max(max, vis.reduce((a, sr) => a + sr.values[i], 0));
        else vis.forEach((sr) => { max = Math.max(max, sr.values[i]); });
      }
      max = niceMax(max * 1.04);
      const svg = s("svg", { viewBox: `0 0 ${W} ${H}`, height: H, role: "img", "aria-label": opts.label || "Bar chart" }, box);
      const g = s("g", { class: "grid" }, svg);
      const ax = s("g", { class: "axis" }, svg);
      const val = (v) => (horiz ? (v / max) * iw : (v / max) * ih);
      const ns = steps(max);
      for (let k = 0; k <= ns; k++) {
        const v = (max / ns) * k;
        if (horiz) {
          const xx = pad.l + val(v);
          if (k) s("line", { x1: xx, x2: xx, y1: pad.t, y2: pad.t + ih }, g);
          const t = s("text", { x: xx, y: H - 6, "text-anchor": "middle" }, ax); t.textContent = compact(v);
        } else {
          const yy = pad.t + ih - val(v);
          if (k) s("line", { x1: pad.l, x2: W - pad.r, y1: yy, y2: yy }, g);
          const t = s("text", { x: pad.l - 8, y: yy + 4, "text-anchor": "end" }, ax); t.textContent = compact(v);
        }
      }
      const band = (horiz ? ih : iw) / n;
      const inner = band * (horiz ? 0.66 : opts.stacked || vis.length === 1 ? 0.62 : 0.74);
      const want = horiz ? n : Math.max(2, Math.floor(iw / 56));
      const step = Math.max(1, Math.ceil(n / want));
      const marks = [];
      for (let i = 0; i < n; i++) {
        const c = (horiz ? pad.t : pad.l) + band * i + band / 2;
        if (i % step === 0) {
          const t = horiz ? s("text", { x: pad.l - 10, y: c + 4, "text-anchor": "end" }, ax) : s("text", { x: c, y: H - 6, "text-anchor": "middle" }, ax);
          let lab = String(L[i]);
          if (horiz && lab.length > 16) lab = lab.slice(0, 15) + "…";
          t.textContent = lab;
        }
        let acc = 0;
        const bw = opts.stacked ? inner : inner / vis.length;
        vis.forEach((sr, si) => {
          const v = sr.values[i];
          const len = Math.max(v > 0 ? 1 : 0, val(v));
          const gap = vis.length > 1 ? 1 : 0;
          let x0, y0, w, hh;
          if (horiz) {
            x0 = pad.l + val(acc); w = Math.max(0, len - (opts.stacked && si < vis.length - 1 ? 2 : 0));
            y0 = opts.stacked ? c - inner / 2 : c - inner / 2 + bw * si + gap; hh = (opts.stacked ? inner : bw) - gap * 2;
          } else {
            w = (opts.stacked ? inner : bw) - gap * 2;
            x0 = opts.stacked ? c - inner / 2 : c - inner / 2 + bw * si + gap;
            hh = Math.max(0, len - (opts.stacked && si < vis.length - 1 ? 2 : 0));
            y0 = pad.t + ih - val(acc) - len;
            if (opts.stacked && si > 0) { y0 += 0; }
          }
          const top = !opts.stacked || si === vis.length - 1;
          const r = Math.min(4, (horiz ? hh : w) / 2);
          const d = horiz ? barPathH(x0, y0, w, hh, top ? r : 0) : barPathV(x0, y0, w, hh, top ? r : 0);
          const p = s("path", { d, fill: sr.color, class: "mk" }, svg);
          marks.push({ p, i });
          if (opts.stacked) acc += v;
        });
        if (horiz && opts.directLabels !== false) {
          const tot = opts.stacked ? vis.reduce((a, sr) => a + sr.values[i], 0) : Math.max(...vis.map((sr) => sr.values[i]));
          const t = s("text", { class: "dl", x: pad.l + val(tot) + 6, y: c + 4 }, svg);
          t.textContent = opts.dlfmt ? opts.dlfmt(tot) : compact(tot);
        }
        // hit band per category
        const hit = horiz ? s("rect", { x: 0, y: c - band / 2, width: W, height: band, fill: "transparent", tabindex: 0 }, svg)
          : s("rect", { x: c - band / 2, y: pad.t, width: band, height: ih, fill: "transparent", tabindex: 0 }, svg);
        const show = (ev) => {
          marks.forEach((m) => { m.p.classList.toggle("hov", m.i === i); m.p.classList.toggle("dim", m.i !== i); });
          const rows = vis.map((sr) => ({ name: sr.name, value: fmt(sr.values[i]), color: sr.color }));
          if (opts.stacked && vis.length > 1) rows.push({ name: "Total", value: fmt(vis.reduce((a, sr) => a + sr.values[i], 0)) });
          let cx, cy;
          if (ev && ev.clientX != null) { cx = ev.clientX; cy = ev.clientY; }
          else { const r = hit.getBoundingClientRect(); cx = r.left + r.width / 2; cy = r.top; }
          showTip(cx, cy, opts.tipLabel ? opts.tipLabel(i) : String(L[i]), rows);
        };
        const hide = () => { marks.forEach((m) => m.p.classList.remove("hov", "dim")); hideTip(); };
        hit.addEventListener("pointermove", show);
        hit.addEventListener("pointerdown", show);
        hit.addEventListener("focus", () => show());
        hit.addEventListener("pointerleave", hide);
        hit.addEventListener("blur", hide);
      }
      s("line", horiz ? { class: "base", x1: pad.l, x2: pad.l, y1: pad.t, y2: pad.t + ih } : { class: "base", x1: pad.l, x2: W - pad.r, y1: pad.t + ih, y2: pad.t + ih }, svg);
    });
  }
  function barPathV(x, y, w, hh, r) {
    if (hh <= 0) return "";
    r = Math.min(r, hh);
    return `M${x},${y + hh}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + hh}Z`;
  }
  function barPathH(x, y, w, hh, r) {
    if (w <= 0) return "";
    r = Math.min(r, w);
    return `M${x},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + hh - r}Q${x + w},${y + hh} ${x + w - r},${y + hh}H${x}Z`;
  }

  // ---------- donut ----------
  // opts: items[{name,value,color}], center, sub, fmt
  function donut(host, opts) {
    host.replaceChildren();
    const wrap = h("div", "donut-wrap");
    const box = h("div", "chart");
    wrap.appendChild(box);
    const tot = opts.items.reduce((a, b) => a + b.value, 0);
    const fmt = opts.fmt || full;
    const items = opts.items.map((it, i) => ({ ...it, color: tc(it.color || PAL[i]) }));
    const S = 190, R = 88, r0 = 62, cx = S / 2;
    const svg = s("svg", { viewBox: `0 0 ${S} ${S}`, height: S, role: "img", "aria-label": opts.label || "Donut chart" }, box);
    let a0 = -Math.PI / 2;
    const gapA = items.length > 1 ? 0.025 : 0;
    const paths = [];
    items.forEach((it, i) => {
      const frac = it.value / tot;
      const a1 = a0 + frac * Math.PI * 2;
      const s0 = a0 + gapA / 2, s1 = Math.max(s0 + 0.001, a1 - gapA / 2);
      const big = s1 - s0 > Math.PI ? 1 : 0;
      const p = (rad, a) => [cx + rad * Math.cos(a), cx + rad * Math.sin(a)];
      const [x1, y1] = p(R, s0), [x2, y2] = p(R, s1), [x3, y3] = p(r0, s1), [x4, y4] = p(r0, s0);
      const d = `M${x1},${y1}A${R},${R} 0 ${big} 1 ${x2},${y2}L${x3},${y3}A${r0},${r0} 0 ${big} 0 ${x4},${y4}Z`;
      const path = s("path", { d, fill: it.color, class: "mk", tabindex: 0 }, svg);
      paths.push(path);
      const show = (ev) => {
        paths.forEach((q) => q.classList.toggle("dim", q !== path));
        let x0, y0;
        if (ev && ev.clientX != null) { x0 = ev.clientX; y0 = ev.clientY; } else { const rr = path.getBoundingClientRect(); x0 = rr.left + rr.width / 2; y0 = rr.top; }
        showTip(x0, y0, it.name, [{ name: "of " + (opts.unit || "total"), value: fmt(it.value) + " · " + ((it.value / tot) * 100).toFixed(1) + "%", color: it.color }]);
      };
      const hide = () => { paths.forEach((q) => q.classList.remove("dim")); hideTip(); };
      path.addEventListener("pointermove", show);
      path.addEventListener("pointerdown", show);
      path.addEventListener("focus", () => show());
      path.addEventListener("pointerleave", hide);
      path.addEventListener("blur", hide);
      a0 = a1;
    });
    const t1 = s("text", { x: cx, y: cx + 3, "text-anchor": "middle", class: "ctr-big" }, svg);
    t1.textContent = opts.center != null ? opts.center : compact(tot);
    const t2 = s("text", { x: cx, y: cx + 21, "text-anchor": "middle", class: "ctr-sm" }, svg);
    t2.textContent = opts.sub || "total";
    const ul = h("ul", "legend");
    items.forEach((it) => {
      const li = h("li");
      const l = h("span", "l");
      const k = h("i", "sw"); k.style.background = it.color;
      l.append(k, document.createTextNode(it.name));
      const v = h("span", "v", ((it.value / tot) * 100).toFixed(1) + "%");
      li.append(l, v);
      ul.appendChild(li);
    });
    wrap.appendChild(ul);
    host.appendChild(wrap);
  }

  // ---------- sparkline ----------
  function spark(values, color) {
    color = tc(color);
    const W = 200, H = 34;
    const max = Math.max(...values), min = Math.min(...values);
    const sp = max - min || 1;
    const pts = values.map((v, i) => [(i / (values.length - 1)) * W, H - 3 - ((v - min) / sp) * (H - 6)]);
    const svg = s("svg", { class: "spark", viewBox: `0 0 ${W} ${H}`, preserveAspectRatio: "none", "aria-hidden": "true" });
    const d = "M" + pts.map((p) => p[0].toFixed(1) + "," + p[1].toFixed(1)).join("L");
    const id = "sp" + Math.random().toString(36).slice(2, 8);
    const defs = s("defs", {}, svg);
    const lg = s("linearGradient", { id, x1: 0, y1: 0, x2: 0, y2: 1 }, defs);
    s("stop", { offset: "0", "stop-color": color, "stop-opacity": ".28" }, lg);
    s("stop", { offset: "1", "stop-color": color, "stop-opacity": "0" }, lg);
    s("path", { d: d + `L${W},${H}L0,${H}Z`, fill: `url(#${id})` }, svg);
    s("path", { d, fill: "none", stroke: color, "stroke-width": 2, "vector-effect": "non-scaling-stroke", "stroke-linejoin": "round" }, svg);
    return svg;
  }

  // ---------- ranked bar list (HTML) ----------
  function blist(host, items, opts) {
    opts = opts || {};
    const ul = h("ul", "blist");
    const max = Math.max(...items.map((i) => i.value));
    const tot = items.reduce((a, b) => a + b.value, 0);
    items.forEach((it) => {
      const li = h("li");
      li.tabIndex = 0;
      const l = h("span", "bl");
      if (it.img) { const im = h("img"); im.src = it.img; im.alt = ""; l.appendChild(im); }
      l.appendChild(document.createTextNode(it.name));
      const bt = h("span", "bt");
      const bf = h("i", "bf");
      bf.style.width = ((it.value / max) * 100).toFixed(1) + "%";
      bf.style.background = tc(it.color || opts.color || PAL[0]);
      bt.appendChild(bf);
      const bv = h("span", "bv", opts.pct ? ((it.value / tot) * 100).toFixed(1) + "%" : compact(it.value));
      li.append(l, bt, bv);
      const show = (ev) => {
        let x0, y0;
        if (ev && ev.clientX != null) { x0 = ev.clientX; y0 = ev.clientY; } else { const r = li.getBoundingClientRect(); x0 = r.left + r.width / 2; y0 = r.top; }
        showTip(x0, y0, it.name, [{ name: opts.unit || "", value: full(it.value) + " · " + ((it.value / tot) * 100).toFixed(1) + "%", color: tc(it.color || opts.color || PAL[0]) }]);
      };
      li.addEventListener("pointermove", show);
      li.addEventListener("focus", () => show());
      li.addEventListener("pointerleave", hideTip);
      li.addEventListener("blur", hideTip);
      ul.appendChild(li);
    });
    host.replaceChildren(ul);
  }

  window.AC = { line, bars, donut, spark, blist, showTip, hideTip, compact, full, PAL };
})();
