/* FitPlate Tracker
   - Supabase auth + per-user daily logs when configured & signed in.
   - Falls back to localStorage (this device) otherwise.
*/
(function () {
  "use strict";

  const MEAL_EMOJI = { breakfast: "🌅", lunch: "🥗", dinner: "🐟", snack: "🍎" };
  const MEAL_LABEL = { breakfast: "Breakfast", lunch: "Lunch", dinner: "Dinner", snack: "Snack" };
  const WATER_GOAL = 8;
  const LS_KEY = "fitplate_logs";

  const $ = (id) => document.getElementById(id);
  const cfg = window.FITPLATE_CONFIG || {};
  const cloudConfigured =
    typeof cfg.SUPABASE_URL === "string" &&
    cfg.SUPABASE_URL.startsWith("http") &&
    !cfg.SUPABASE_URL.includes("__SUPABASE_URL__") &&
    typeof cfg.SUPABASE_ANON_KEY === "string" &&
    cfg.SUPABASE_ANON_KEY.length > 20 &&
    !cfg.SUPABASE_ANON_KEY.includes("__SUPABASE_ANON_KEY__");

  let supabase = null;
  if (cloudConfigured && window.supabase) {
    supabase = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
  }

  let session = null; // supabase session when signed in
  const state = {
    selected: toKey(new Date()), // date shown in Today panel
    viewYear: new Date().getFullYear(),
    viewMonth: new Date().getMonth(), // 0-11
    monthCache: {}, // key -> {water_glasses, foods}
  };

  /* ---------------- date helpers ---------------- */
  function toKey(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }
  function fromKey(k) {
    const [y, m, d] = k.split("-").map(Number);
    return new Date(y, m - 1, d);
  }
  function prettyDate(k) {
    return fromKey(k).toLocaleDateString(undefined, {
      weekday: "long", month: "long", day: "numeric", year: "numeric",
    });
  }

  /* ---------------- storage layer ---------------- */
  const Local = {
    all() {
      try { return JSON.parse(localStorage.getItem(LS_KEY)) || {}; }
      catch { return {}; }
    },
    get(date) {
      const d = this.all()[date];
      return d ? { water_glasses: d.water_glasses || 0, foods: d.foods || [] } : { water_glasses: 0, foods: [] };
    },
    save(date, data) {
      const all = this.all();
      all[date] = { water_glasses: data.water_glasses, foods: data.foods };
      localStorage.setItem(LS_KEY, JSON.stringify(all));
    },
    range(startKey, endKey) {
      const all = this.all();
      const out = {};
      Object.keys(all).forEach((k) => { if (k >= startKey && k <= endKey) out[k] = all[k]; });
      return out;
    },
  };

  function isCloud() { return !!(supabase && session); }

  async function getDay(date) {
    if (isCloud()) {
      const { data, error } = await supabase
        .from("daily_logs")
        .select("water_glasses, foods")
        .eq("log_date", date)
        .maybeSingle();
      if (error) { console.error(error); return { water_glasses: 0, foods: [] }; }
      return data ? { water_glasses: data.water_glasses || 0, foods: data.foods || [] } : { water_glasses: 0, foods: [] };
    }
    return Local.get(date);
  }

  async function saveDay(date, data) {
    if (isCloud()) {
      const { error } = await supabase
        .from("daily_logs")
        .upsert(
          { user_id: session.user.id, log_date: date, water_glasses: data.water_glasses, foods: data.foods },
          { onConflict: "user_id,log_date" }
        );
      if (error) console.error(error);
    } else {
      Local.save(date, data);
    }
  }

  async function getMonth(year, month) {
    const start = toKey(new Date(year, month, 1));
    const end = toKey(new Date(year, month + 1, 0));
    if (isCloud()) {
      const { data, error } = await supabase
        .from("daily_logs")
        .select("log_date, water_glasses, foods")
        .gte("log_date", start)
        .lte("log_date", end);
      if (error) { console.error(error); return {}; }
      const map = {};
      (data || []).forEach((r) => { map[r.log_date] = { water_glasses: r.water_glasses || 0, foods: r.foods || [] }; });
      return map;
    }
    return Local.range(start, end);
  }

  /* ---------------- Today panel ---------------- */
  let today = { water_glasses: 0, foods: [] };

  async function loadToday() {
    today = await getDay(state.selected);
    renderToday();
  }

  function renderToday() {
    const isActualToday = state.selected === toKey(new Date());
    $("todayTitle").textContent = isActualToday ? "Today" : "Selected day";
    $("todayDate").textContent = prettyDate(state.selected);

    $("waterCount").textContent = today.water_glasses;
    const pct = Math.min(today.water_glasses / WATER_GOAL, 1) * 100;
    $("waterFill").style.width = pct + "%";

    const list = $("foodList");
    list.innerHTML = "";
    if (!today.foods.length) {
      const li = document.createElement("li");
      li.className = "food__empty";
      li.textContent = "No foods logged yet.";
      list.appendChild(li);
    } else {
      today.foods.forEach((f, i) => {
        const li = document.createElement("li");
        li.className = "food__item";
        li.innerHTML =
          `<span class="food__meal">${MEAL_EMOJI[f.meal] || "🍴"}</span>` +
          `<span class="food__txt"><b>${MEAL_LABEL[f.meal] || ""}</b> ${escapeHtml(f.name)}</span>`;
        const del = document.createElement("button");
        del.className = "food__del";
        del.setAttribute("aria-label", "Remove");
        del.textContent = "×";
        del.addEventListener("click", () => removeFood(i));
        li.appendChild(del);
        list.appendChild(li);
      });
    }
  }

  async function changeWater(delta) {
    today.water_glasses = Math.max(0, today.water_glasses + delta);
    renderToday();
    await saveDay(state.selected, today);
    state.monthCache[state.selected] = { ...today };
    renderCalendar();
  }

  async function addFood(meal, name) {
    today.foods = today.foods.concat([{ meal, name }]);
    renderToday();
    await saveDay(state.selected, today);
    state.monthCache[state.selected] = { ...today };
    renderCalendar();
  }

  async function removeFood(index) {
    today.foods = today.foods.filter((_, i) => i !== index);
    renderToday();
    await saveDay(state.selected, today);
    state.monthCache[state.selected] = { ...today };
    renderCalendar();
  }

  /* ---------------- Calendar ---------------- */
  async function refreshMonth() {
    state.monthCache = await getMonth(state.viewYear, state.viewMonth);
    renderCalendar();
  }

  function renderCalendar() {
    const grid = $("calGrid");
    grid.innerHTML = "";
    $("calMonth").textContent = new Date(state.viewYear, state.viewMonth, 1)
      .toLocaleDateString(undefined, { month: "long", year: "numeric" });

    const firstDow = new Date(state.viewYear, state.viewMonth, 1).getDay();
    const daysInMonth = new Date(state.viewYear, state.viewMonth + 1, 0).getDate();
    const todayKey = toKey(new Date());

    for (let i = 0; i < firstDow; i++) {
      const empty = document.createElement("div");
      empty.className = "cal__cell cal__cell--empty";
      grid.appendChild(empty);
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const key = toKey(new Date(state.viewYear, state.viewMonth, d));
      const log = state.monthCache[key];
      const cell = document.createElement("button");
      cell.className = "cal__cell";
      if (key === todayKey) cell.classList.add("is-today");
      if (key === state.selected) cell.classList.add("is-selected");
      if (log && (log.water_glasses > 0 || (log.foods && log.foods.length))) cell.classList.add("has-log");

      const num = document.createElement("span");
      num.className = "cal__num";
      num.textContent = String(d);
      cell.appendChild(num);

      if (log && ((log.foods && log.foods.length) || log.water_glasses > 0)) {
        const meta = document.createElement("span");
        meta.className = "cal__meta";
        const foods = (log.foods && log.foods.length) || 0;
        meta.innerHTML =
          (foods ? `<i>🍽️${foods}</i>` : "") +
          (log.water_glasses ? `<i>💧${log.water_glasses}</i>` : "");
        cell.appendChild(meta);
      }

      cell.addEventListener("click", () => openDay(key));
      grid.appendChild(cell);
    }
  }

  /* ---------------- Day modal ---------------- */
  async function openDay(key) {
    const log = state.monthCache[key] || (await getDay(key));
    $("dayTitle").textContent = prettyDate(key);
    $("dayWater").textContent = log.water_glasses || 0;
    const list = $("dayFoods");
    list.innerHTML = "";
    const hasFoods = log.foods && log.foods.length;
    $("dayEmpty").hidden = !!(hasFoods || log.water_glasses);
    if (hasFoods) {
      log.foods.forEach((f) => {
        const li = document.createElement("li");
        li.className = "food__item food__item--ro";
        li.innerHTML =
          `<span class="food__meal">${MEAL_EMOJI[f.meal] || "🍴"}</span>` +
          `<span class="food__txt"><b>${MEAL_LABEL[f.meal] || ""}</b> ${escapeHtml(f.name)}</span>`;
        list.appendChild(li);
      });
    }
    $("dayEdit").onclick = () => {
      state.selected = key;
      closeModal("dayModal");
      loadToday();
      renderCalendar();
      $("todayPanel").scrollIntoView({ behavior: "smooth", block: "start" });
    };
    openModal("dayModal");
  }

  /* ---------------- Auth ---------------- */
  let authMode = "login"; // or "signup"

  function refreshAuthUI() {
    const badge = $("modeBadge");
    if (isCloud()) {
      const email = session.user.email || "Account";
      $("navUser").textContent = email;
      $("navUser").hidden = false;
      $("signOutBtn").hidden = false;
      $("openAuthBtn").hidden = true;
      badge.textContent = "☁️ Synced to your account";
      badge.className = "tracker__mode is-cloud";
      $("trackerSub").textContent = "Your foods and water are saved to your account and synced across devices.";
    } else {
      $("navUser").hidden = true;
      $("signOutBtn").hidden = true;
      $("openAuthBtn").hidden = !cloudConfigured; // only offer login if cloud is set up
      badge.textContent = cloudConfigured ? "💾 Saved on this device · log in to sync" : "💾 Saved on this device";
      badge.className = "tracker__mode";
      $("trackerSub").textContent = cloudConfigured
        ? "Log your foods and water. Log in to save them to your account and sync across devices."
        : "Log what you eat and drink each day, then review it on the calendar.";
    }
  }

  async function migrateLocalToCloud() {
    // Best-effort: push any local days not yet in the cloud.
    const local = Local.all();
    const keys = Object.keys(local);
    if (!keys.length) return;
    for (const key of keys) {
      const { data } = await supabase
        .from("daily_logs").select("id").eq("log_date", key).maybeSingle();
      if (!data) {
        await supabase.from("daily_logs").upsert(
          { user_id: session.user.id, log_date: key, water_glasses: local[key].water_glasses || 0, foods: local[key].foods || [] },
          { onConflict: "user_id,log_date" }
        );
      }
    }
  }

  function wireAuth() {
    if (!supabase) return;

    supabase.auth.getSession().then(({ data }) => {
      session = data.session;
      refreshAuthUI();
      reloadAll();
    });

    supabase.auth.onAuthStateChange((_event, newSession) => {
      const wasCloud = isCloud();
      session = newSession;
      refreshAuthUI();
      if (!wasCloud && isCloud()) {
        migrateLocalToCloud().finally(reloadAll);
      } else {
        reloadAll();
      }
    });

    $("authForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      const email = $("authEmail").value.trim();
      const password = $("authPassword").value;
      const errEl = $("authError");
      const msgEl = $("authMsg");
      errEl.hidden = true; msgEl.hidden = true;
      $("authSubmit").disabled = true;
      $("authSubmit").textContent = authMode === "signup" ? "Creating…" : "Logging in…";
      try {
        if (authMode === "signup") {
          const { data, error } = await supabase.auth.signUp({ email, password });
          if (error) throw error;
          if (data.session) {
            closeModal("authModal");
          } else {
            msgEl.textContent = "Check your email to confirm your account, then log in.";
            msgEl.hidden = false;
            setAuthMode("login");
          }
        } else {
          const { error } = await supabase.auth.signInWithPassword({ email, password });
          if (error) throw error;
          closeModal("authModal");
        }
      } catch (err) {
        errEl.textContent = err.message || "Something went wrong.";
        errEl.hidden = false;
      } finally {
        $("authSubmit").disabled = false;
        $("authSubmit").textContent = authMode === "signup" ? "Create account" : "Log in";
      }
    });

    $("signOutBtn").addEventListener("click", async () => {
      await supabase.auth.signOut();
    });
  }

  function setAuthMode(mode) {
    authMode = mode;
    const signup = mode === "signup";
    $("authTitle").textContent = signup ? "Create your account" : "Welcome back";
    $("authSubmit").textContent = signup ? "Create account" : "Log in";
    $("authSwitchText").textContent = signup ? "Already have an account?" : "New here?";
    $("authSwitch").textContent = signup ? "Log in" : "Create an account";
  }

  /* ---------------- modal helpers ---------------- */
  function openModal(id) { $(id).hidden = false; document.body.style.overflow = "hidden"; }
  function closeModal(id) { $(id).hidden = true; document.body.style.overflow = ""; }

  /* ---------------- misc ---------------- */
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  async function reloadAll() {
    await Promise.all([loadToday(), refreshMonth()]);
  }

  function wireUI() {
    $("year").textContent = String(new Date().getFullYear());

    // nav toggle (mobile)
    const navToggle = $("navToggle");
    const navLinks = $("navLinks");
    if (navToggle) navToggle.addEventListener("click", () => {
      const open = navLinks.classList.toggle("open");
      navToggle.setAttribute("aria-expanded", String(open));
    });

    $("waterPlus").addEventListener("click", () => changeWater(1));
    $("waterMinus").addEventListener("click", () => changeWater(-1));

    $("foodForm").addEventListener("submit", (e) => {
      e.preventDefault();
      const name = $("foodName").value.trim();
      if (!name) return;
      addFood($("foodMeal").value, name);
      $("foodName").value = "";
      $("foodName").focus();
    });

    $("calPrev").addEventListener("click", () => {
      state.viewMonth--;
      if (state.viewMonth < 0) { state.viewMonth = 11; state.viewYear--; }
      refreshMonth();
    });
    $("calNext").addEventListener("click", () => {
      state.viewMonth++;
      if (state.viewMonth > 11) { state.viewMonth = 0; state.viewYear++; }
      refreshMonth();
    });

    // auth modal open/close + switch
    $("openAuthBtn").addEventListener("click", (e) => { e.preventDefault(); setAuthMode("login"); openModal("authModal"); });
    $("authClose").addEventListener("click", () => closeModal("authModal"));
    $("dayClose").addEventListener("click", () => closeModal("dayModal"));
    document.querySelectorAll("[data-close]").forEach((el) =>
      el.addEventListener("click", () => { closeModal("authModal"); closeModal("dayModal"); }));
    $("authSwitch").addEventListener("click", (e) => { e.preventDefault(); setAuthMode(authMode === "login" ? "signup" : "login"); });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") { closeModal("authModal"); closeModal("dayModal"); }
    });
  }

  /* ---------------- boot ---------------- */
  document.addEventListener("DOMContentLoaded", () => {
    wireUI();
    refreshAuthUI();
    if (supabase) {
      wireAuth(); // will load data once session resolves
    } else {
      reloadAll();
    }
  });
})();
