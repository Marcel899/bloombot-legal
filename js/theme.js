/* Light / dark theme. Loaded in <head> without defer so the page never flashes the wrong theme. Dark is the default. */
(function () {
  var KEY = "bb_theme";
  var root = document.documentElement;
  function saved() { try { return localStorage.getItem(KEY); } catch (e) { return null; } }
  function apply(t) {
    root.setAttribute("data-theme", t);
    var m = document.querySelector('meta[name="theme-color"]');
    if (m) m.setAttribute("content", t === "light" ? "#eef3f8" : "#13151b");
    var c = document.querySelector('meta[name="color-scheme"]');
    if (c) c.setAttribute("content", t);
    var b = document.getElementById("themebtn");
    if (b) {
      var next = t === "light" ? "dark" : "light";
      b.setAttribute("aria-label", "Switch to " + next + " mode");
      b.title = "Switch to " + next + " mode";
      b.setAttribute("aria-pressed", t === "light" ? "true" : "false");
    }
  }
  /* load the web font without blocking the first paint */
  var f = document.createElement("link");
  f.rel = "stylesheet";
  f.href = "https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&display=swap";
  document.head.appendChild(f);
  apply(saved() === "light" ? "light" : "dark");
  document.addEventListener("DOMContentLoaded", function () {
    apply(root.getAttribute("data-theme"));
    var b = document.getElementById("themebtn");
    if (!b) return;
    b.addEventListener("click", function () {
      var t = root.getAttribute("data-theme") === "light" ? "dark" : "light";
      root.classList.add("theme-anim");
      apply(t);
      try { localStorage.setItem(KEY, t); } catch (e) {}
      setTimeout(function () { root.classList.remove("theme-anim"); }, 400);
    });
  });
})();
