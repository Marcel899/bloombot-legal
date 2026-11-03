/* Small page behaviours: scroll progress, back to top, command search, "On this page" highlight. */
(() => {
  const p = document.querySelector(".progress"), t = document.querySelector(".totop");
  if (p && t) {
    const f = () => {
      const h = document.documentElement, max = h.scrollHeight - h.clientHeight;
      p.style.transform = `scaleX(${max > 0 ? h.scrollTop / max : 0})`;
      t.classList.toggle("show", h.scrollTop > 600);
    };
    addEventListener("scroll", f, { passive: true });
    f();
  }

  const q = document.getElementById("cmdq"), none = document.getElementById("cmdnone");
  if (q) q.addEventListener("input", () => {
    const v = q.value.trim().toLowerCase();
    let any = 0;
    document.querySelectorAll(".cmd-group").forEach(g => {
      let n = 0;
      g.querySelectorAll(".cmd").forEach(li => { const ok = !v || li.dataset.q.includes(v); li.hidden = !ok; n += ok; });
      g.hidden = !n;
      any += n;
    });
    none.hidden = !!any;
  });

  const links = [...document.querySelectorAll(".toc-box a")];
  if (links.length && "IntersectionObserver" in window) {
    const map = new Map(links.map(a => [a.getAttribute("href").slice(1), a]));
    const io = new IntersectionObserver(es => es.forEach(e => {
      if (!e.isIntersecting) return;
      links.forEach(a => a.classList.remove("on"));
      const a = map.get(e.target.id);
      if (a) a.classList.add("on");
    }), { rootMargin: "-90px 0px -70% 0px" });
    map.forEach((a, id) => { const el = document.getElementById(id); if (el) io.observe(el); });
  }
  const d = document.querySelector(".mtoc");
  if (d) d.querySelectorAll("a").forEach(a => a.addEventListener("click", () => { d.open = false; }));
})();
