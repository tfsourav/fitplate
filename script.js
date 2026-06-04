// Mobile nav toggle
const navToggle = document.getElementById("navToggle");
const navLinks = document.getElementById("navLinks");

navToggle.addEventListener("click", () => {
  const open = navLinks.classList.toggle("open");
  navToggle.setAttribute("aria-expanded", String(open));
});

// Close mobile menu when a link is clicked
navLinks.querySelectorAll("a").forEach((link) => {
  link.addEventListener("click", () => {
    navLinks.classList.remove("open");
    navToggle.setAttribute("aria-expanded", "false");
  });
});

// Hydration tracker
const TOTAL_GLASSES = 8;
const glassesEl = document.getElementById("glasses");
const glassCountEl = document.getElementById("glassCount");
const trackerMsg = document.getElementById("trackerMsg");
const addGlassBtn = document.getElementById("addGlass");
const resetGlassBtn = document.getElementById("resetGlass");

let filled = 0;

function renderGlasses() {
  glassesEl.innerHTML = "";
  for (let i = 0; i < TOTAL_GLASSES; i++) {
    const g = document.createElement("div");
    g.className = "glass" + (i < filled ? " filled" : "");
    g.setAttribute("role", "img");
    g.setAttribute("aria-label", i < filled ? "Full glass" : "Empty glass");
    glassesEl.appendChild(g);
  }
  glassCountEl.textContent = String(filled);
}

function updateMessage() {
  if (filled === 0) {
    trackerMsg.textContent = "Tap \u201CAdd a glass\u201D each time you drink water.";
  } else if (filled >= TOTAL_GLASSES) {
    trackerMsg.textContent = "🎉 Goal reached! Great hydration today.";
  } else {
    const left = TOTAL_GLASSES - filled;
    trackerMsg.textContent = `Nice! ${left} glass${left === 1 ? "" : "es"} to go.`;
  }
}

addGlassBtn.addEventListener("click", () => {
  if (filled < TOTAL_GLASSES) filled++;
  renderGlasses();
  updateMessage();
});

resetGlassBtn.addEventListener("click", () => {
  filled = 0;
  renderGlasses();
  updateMessage();
});

renderGlasses();
updateMessage();

// CTA form (front-end only validation)
const ctaForm = document.getElementById("ctaForm");
const emailInput = document.getElementById("email");
const ctaNote = document.getElementById("ctaNote");

ctaForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const email = emailInput.value.trim();
  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  if (!valid) {
    ctaNote.textContent = "Please enter a valid email address.";
    ctaNote.style.color = "#fde68a";
    emailInput.focus();
    return;
  }
  ctaNote.textContent = `Thanks! Your free guide is on its way to ${email}.`;
  ctaNote.style.color = "#dcfce7";
  ctaForm.reset();
});

// Footer year
document.getElementById("year").textContent = String(new Date().getFullYear());

/* ---------------------------------------------------------------------------
   Motion layer: scroll progress, nav state, scroll-reveal, count-up
   (All reveal classes are added via JS so content stays visible if JS fails.)
--------------------------------------------------------------------------- */
const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// Scroll progress bar + sticky nav shadow
const progressBar = document.createElement("div");
progressBar.className = "progress";
document.body.appendChild(progressBar);

const navEl = document.querySelector(".nav");

function onScroll() {
  const scrollTop = window.scrollY || document.documentElement.scrollTop;
  const docHeight = document.documentElement.scrollHeight - window.innerHeight;
  const pct = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
  progressBar.style.width = pct + "%";
  navEl.classList.toggle("scrolled", scrollTop > 8);
}
window.addEventListener("scroll", onScroll, { passive: true });
onScroll();

// Scroll-reveal with staggering inside groups
if (!prefersReduced && "IntersectionObserver" in window) {
  const groups = [
    { sel: ".section__head", stagger: 0 },
    { sel: ".grid--habits .card", stagger: 80 },
    { sel: ".timeline .meal", stagger: 70 },
    { sel: ".hydration__text", variant: "reveal--left", stagger: 0 },
    { sel: ".hydration__tracker", variant: "reveal--right", stagger: 0 },
    { sel: ".grid--tips .tip", stagger: 60 },
    { sel: ".cta__inner", variant: "reveal--scale", stagger: 0 },
  ];

  const observer = new IntersectionObserver(
    (entries, obs) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const delay = Number(entry.target.dataset.revealDelay || 0);
          setTimeout(() => entry.target.classList.add("is-visible"), delay);
          obs.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.15, rootMargin: "0px 0px -40px 0px" }
  );

  groups.forEach(({ sel, variant, stagger }) => {
    document.querySelectorAll(sel).forEach((el, i) => {
      el.classList.add("reveal");
      if (variant) el.classList.add(variant);
      if (stagger) el.dataset.revealDelay = String(i * stagger);
      observer.observe(el);
    });
  });
}

// Count-up animation for hero stat (Core habits)
const statHabits = document.getElementById("statHabits");
if (statHabits && !prefersReduced) {
  const target = parseInt(statHabits.textContent, 10) || 0;
  const duration = 900;
  const start = performance.now();
  const easeOut = (t) => 1 - Math.pow(1 - t, 3);
  function tick(now) {
    const p = Math.min((now - start) / duration, 1);
    statHabits.textContent = String(Math.round(easeOut(p) * target));
    if (p < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}
