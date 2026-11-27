/* Weekly quests on the levels page: this week's 3 quests, your progress, a reset
   countdown and Claim. Checked by wq_status / claim_weekly_quest (sql/quests.sql);
   the bot pays the XP within a few seconds, like the one-time XP tasks. */
(() => {
  const $ = id => document.getElementById(id);
  const { el } = BB;
  const box = $("wqlist");
  if (!box) return;
  let data = null, me = null, poll = null;
  const left = ends => {
    const s = Math.max(0, (new Date(ends) - Date.now()) / 1000);
    const d = Math.floor(s / 86400), h = Math.floor(s % 86400 / 3600), m = Math.floor(s % 3600 / 60);
    return d ? d + "d " + h + "h" : h ? h + "h " + m + "m" : m + "m";
  };
  function draw() {
    if (!data || !data.quests) { $("wqsec").hidden = true; return; }
    $("wqsec").hidden = false;
    $("wqreset").textContent = "New quests in " + left(data.ends_at);
    box.replaceChildren(...data.quests.map(q => {
      const done = q.progress >= q.goal;
      const st = q.status === "given" ? "given" : q.status === "pending" || q.status === "processing" ? "wait" : q.status === "failed" ? "failed" : done ? "ready" : "open";
      const c = el("article", "wq st-" + st);
      const top = el("div", "wq-top");
      top.append(el("strong", null, q.title), el("span", "tk-xp", "+" + q.xp + " XP"));
      const bar = el("div", "wq-bar");
      bar.setAttribute("role", "progressbar");
      bar.setAttribute("aria-valuemin", "0");
      bar.setAttribute("aria-valuemax", String(q.goal));
      bar.setAttribute("aria-valuenow", String(q.progress));
      bar.setAttribute("aria-label", q.title);
      const fill = el("i");
      fill.style.width = Math.round(100 * Math.min(1, q.progress / q.goal)) + "%";
      bar.append(fill);
      const foot = el("div", "wq-foot");
      foot.append(el("span", "wq-n", st === "failed" && q.reason ? q.reason : q.progress + " / " + q.goal + " · " + q.about));
      if (st === "given") foot.append(el("span", "tk-done", "Claimed"));
      else if (st === "wait") foot.append(el("span", "tk-wait", "Adding XP…"));
      else if (!me) { const b = el("button", "brick dark sm", "Log in"); b.type = "button"; b.dataset.login = ""; foot.append(b); }
      else if (st === "ready") {
        const b = el("button", "brick green sm", "Claim");
        b.type = "button";
        b.onclick = () => claim(q, b);
        foot.append(b);
      } else { const a = el("a", "tk-go", "Go"); a.href = q.go; foot.append(a); }
      c.append(top, bar, foot);
      return c;
    }));
  }
  async function load() {
    try {
      const { data: d, error } = await BB.sb.rpc("wq_status");
      data = error ? null : d;
    } catch (e) { data = null; }
    draw();
    /* a claim is being paid: check again shortly */
    clearTimeout(poll);
    if (data && data.quests && data.quests.some(q => q.status === "pending" || q.status === "processing")) poll = setTimeout(load, 3000);
  }
  async function claim(q, b) {
    b.disabled = true;
    const { error } = await BB.sb.rpc("claim_weekly_quest", { p_key: q.key });
    if (error) {
      b.disabled = false;
      const m = error.message || "";
      BB.toast(/wq:not_done/.test(m) ? "Not done yet. " + q.about : /wq:profile/.test(m) ? "Create your Bloombot account first." : /wq:not_this_week/.test(m) ? "That quest has ended. New ones are up." : "Couldn't claim. Try again.", "bad", { title: "Not claimed" });
      load();
      return;
    }
    BB.toast("+" + q.xp + " XP is on its way to your level.", "ok", { title: q.title + " done" });
    q.status = "pending";
    draw();
    setTimeout(load, 2500);
  }
  BB.onAuth(s => { me = s && BB.user(s).id; load(); });
  setInterval(() => { if (data) $("wqreset").textContent = "New quests in " + left(data.ends_at); }, 60000);
})();
