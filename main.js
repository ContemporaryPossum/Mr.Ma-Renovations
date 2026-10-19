/* ==========================================================================
   main.js
   Lenis smooth scroll driven by GSAP's ticker (one requestAnimationFrame
   loop for scroll, ScrollTrigger and the WebGL scene), plus every scroll
   and pointer interaction on the page.
   ========================================================================== */

import { createRingChart, createBarChart, rollNumber } from "./charts.js";

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const html = document.documentElement;
const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
const isMobile = () => window.innerWidth <= 900;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const WA_NUMBER = "601160619060";

/* Review data from the Google Maps listing (October 2026) */
const RATINGS = [
  { label: "5 stars", value: 29, maxValue: 32, color: "var(--chart-1)", centerLabel: "five-star reviews" },
  { label: "4 stars", value: 3, maxValue: 32, color: "var(--chart-2)", centerLabel: "four-star reviews" },
  { label: "3 stars or lower", value: 0, maxValue: 32, color: "var(--chart-3)", centerLabel: "at 3 stars or lower" },
];
const TOPICS = [
  { label: "Workmanship", value: 9 },
  { label: "Attention to detail", value: 6 },
  { label: "Reliable contractor", value: 4 },
  { label: "Tiles", value: 3 },
  { label: "Punctuality", value: 3 },
  { label: "Professional team", value: 3 },
  { label: "Home repair work", value: 2 },
  { label: "Roof", value: 2 },
  { label: "Clean work", value: 2 },
  { label: "Fast work", value: 2 },
];

/* Where the vector scene sits for each section */
const SCENE_KEYS = [
  ["#top",      { morph: 0,   theta: 0.75, phi: 1.12, radius: 37, tx: 0, ty: 4.2, tz: 0.6, shift: 0.24,  dim: 1,    points: 0,    wave: 0,   spin: 1 }],
  ["#services", { morph: 0.35, theta: -0.45, phi: 1.04, radius: 54, tx: 0, ty: 9.5, tz: 0,  shift: -0.3,  dim: 1,    points: 0.25, wave: 0,   spin: 0.3 }],
  ["#work",     { morph: 1,   theta: -2.1, phi: 1.18, radius: 36, tx: 0, ty: 4.5, tz: 0,   shift: 0,     dim: 0.4,  points: 0.4,  wave: 0,   spin: 0.4 }],
  ["#process",  { morph: 2,   theta: -3.0, phi: 0.22, radius: 30, tx: 0, ty: 0.5, tz: 0,   shift: 0,     dim: 0.75, points: 0.35, wave: 0,   spin: 0.15 }],
  ["#reviews",  { morph: 3,   theta: -3.7, phi: 1.36, radius: 26, tx: 0, ty: 2.0, tz: 0,   shift: 0,     dim: 0.6,  points: 0.55, wave: 1,   spin: 0.3 }],
  [".quote",    { morph: 3,   theta: -4.2, phi: 1.22, radius: 20, tx: 0, ty: 1.2, tz: 0,   shift: 0,     dim: 0.9,  points: 0.6,  wave: 1.5, spin: 0.4 }],
  ["#contact",  { morph: 0,   theta: -5.6, phi: 1.1,  radius: 33, tx: 0, ty: 4.0, tz: 0.6, shift: 0.24,  dim: 0.6,  points: 0.1,  wave: 0,   spin: 0.6 }],
];

/* ---------- Works with or without the animation libraries ---------- */
initYear();
initOpenStatus();
initQuoteForm();
initRolls();

const { gsap, ScrollTrigger, SplitText, Lenis } = window;
let menuOpen = false;

if (!gsap || !ScrollTrigger || !Lenis) {
  fallback();
} else {
  boot().catch((err) => {
    console.error(err);
    fallback();
  });
}

/* ========================================================================== */

function fallback() {
  html.classList.remove("is-loading");
  $(".loader")?.remove();
  initMenu(null);
  const charts = initCharts();
  charts.ring.reveal();
  charts.bars.reveal();
  loadMap();
}

async function boot() {
  // The intro is choreographed from the top of the page
  if ("scrollRestoration" in history) history.scrollRestoration = "manual";
  if (!location.hash) window.scrollTo(0, 0);

  gsap.registerPlugin(ScrollTrigger, ...(SplitText ? [SplitText] : []));
  ScrollTrigger.config({ ignoreMobileResize: true });
  ScrollTrigger.clearScrollMemory("manual");

  const lenis = new Lenis({ lerp: 0.09, smoothWheel: true, autoRaf: false });
  lenis.stop();
  lenis.on("scroll", ScrollTrigger.update);

  let scene = null;
  const sceneState = {};
  const keyPositions = [];

  gsap.ticker.add((time) => {
    lenis.raf(time * 1000);
    if (scene && !reduced) {
      scene.setTarget(sceneTargetAt(lenis.scroll));
      scene.update(time);
    }
  });
  gsap.ticker.lagSmoothing(0);

  /* ---- Loader ---- */
  const countEl = $("[data-loader-count]");
  const counter = { v: 0 };
  const paint = () => { countEl.textContent = String(Math.round(counter.v)).padStart(3, "0"); };
  const countTween = gsap.to(counter, { v: 90, duration: 1.8, ease: "power2.out", onUpdate: paint });
  const barTween = gsap.to(".loader-bar", { scaleX: 0.88, duration: 1.8, ease: "power2.out" });

  const scenePromise = import("./scene.js")
    .then(({ createScene }) => {
      scene = createScene($("#scene"), { reduced, mobile: isMobile() });
      if (!scene) html.classList.add("no-webgl");
    })
    .catch(() => html.classList.add("no-webgl"));

  await Promise.race([
    Promise.all([document.fonts ? document.fonts.ready : Promise.resolve(), scenePromise, wait(reduced ? 0 : 1100)]),
    wait(4500),
  ]);

  if (scene) {
    window.addEventListener("pointermove", (e) => {
      if (!finePointer) return;
      scene.setPointer((e.clientX / window.innerWidth) * 2 - 1, (e.clientY / window.innerHeight) * 2 - 1);
    });
  }

  /* ---- Build the page motion (page order, pinned section gets refreshPriority) ---- */
  const splits = setupSplits();
  initNav(lenis);
  const closeMenu = initMenu(lenis);
  initAnchors(lenis, closeMenu);
  initProgress(lenis);
  initMagnetic();
  const intro = buildIntro(splits, () => scene);
  initHero();
  initMarquee();
  initHeadings(splits);
  initServices(() => scene);
  initWork();
  initProcess();
  const charts = initCharts();
  initRecord(charts);
  initQuote(splits);
  initContact();
  initFooter();
  initActionBar();
  initNavActive();

  /* ---- Scene keyframes follow the real layout (pins included) ---- */
  function computeKeys() {
    keyPositions.length = 0;
    const vh = window.innerHeight;
    SCENE_KEYS.forEach(([sel, state], i) => {
      const el = $(sel);
      if (!el) return;
      const top = el.getBoundingClientRect().top + window.scrollY;
      keyPositions.push({ at: i === 0 ? 0 : Math.max(0, top - vh * 0.55), state });
    });
  }
  function sceneTargetAt(y) {
    if (!keyPositions.length) return SCENE_KEYS[0][1];
    let i = 0;
    while (i < keyPositions.length - 1 && y >= keyPositions[i + 1].at) i++;
    const a = keyPositions[i];
    const b = keyPositions[Math.min(i + 1, keyPositions.length - 1)];
    let t = b === a ? 0 : (y - a.at) / Math.max(1, b.at - a.at);
    t = Math.min(1, Math.max(0, t));
    t = t * t * (3 - 2 * t);
    for (const k in a.state) sceneState[k] = a.state[k] + (b.state[k] - a.state[k]) * t;
    if (isMobile()) sceneState.dim *= 0.62;
    return sceneState;
  }
  ScrollTrigger.addEventListener("refresh", computeKeys);

  if (scene && reduced) {
    scene.setTarget({ ...SCENE_KEYS[0][1], dim: 0.55, spin: 0 });
    scene.snap();
    scene.setDraw(1);
    scene.renderOnce();
  }

  /* ---- Exit loader, play the intro ---- */
  countTween.kill();
  barTween.kill();
  await new Promise((resolve) => {
    if (reduced) { resolve(); return; }
    gsap.timeline({ onComplete: resolve })
      .to(counter, { v: 100, duration: 0.35, ease: "power1.out", onUpdate: paint })
      .to(".loader-bar", { scaleX: 1, duration: 0.35, ease: "power1.out" }, "<")
      .to(".loader-inner", { yPercent: -60, autoAlpha: 0, duration: 0.55, ease: "power3.in" })
      .to(".loader", { clipPath: "inset(0% 0% 100% 0%)", duration: 0.95, ease: "expo.inOut" }, "-=0.2")
      .add(() => intro.play(), "-=0.55");
  });
  $(".loader")?.remove();
  html.classList.remove("is-loading");
  if (reduced) intro.progress(1);
  lenis.start();
  if (location.hash && $(location.hash)) lenis.scrollTo(location.hash, { immediate: true, force: true });
  else lenis.scrollTo(0, { immediate: true, force: true });

  ScrollTrigger.refresh();
  window.addEventListener("load", () => ScrollTrigger.refresh());
}

/* ==========================================================================
   Pieces
   ========================================================================== */

function setupSplits() {
  const out = { beats: [], headings: [], quote: null };
  const h1 = $("[data-hero-title]");
  if (h1) h1.setAttribute("aria-label", h1.textContent.replace(/\s+/g, " ").trim());
  if (!SplitText || reduced) return out;
  $$(".hero-title .beat").forEach((beat) => {
    out.beats.push(SplitText.create(beat, { type: "chars", charsClass: "char", mask: "chars", aria: "none" }));
  });
  $$("[data-split]").forEach((el) => {
    out.headings.push({ el, split: SplitText.create(el, { type: "lines", linesClass: "split-line", mask: "lines" }) });
  });
  const q = $("[data-quote-text]");
  if (q) out.quote = SplitText.create(q, { type: "words", wordsClass: "word", aria: "none" });
  return out;
}

function buildIntro(splits, getScene) {
  const tl = gsap.timeline({ paused: true, defaults: { ease: "expo.out" } });
  const beats = $$(".hero-title .beat");
  if (reduced) return tl;

  gsap.set("[data-hero-fade]", { autoAlpha: 0, y: 26 });
  gsap.set(".nav > *", { autoAlpha: 0, y: -14 });
  splits.beats.forEach((s) => gsap.set(s.chars, { yPercent: 118 }));

  const draw = { v: 0 };
  tl.to(draw, { v: 1, duration: 3, ease: "power2.inOut", onUpdate: () => getScene()?.setDraw(draw.v) }, 0);
  splits.beats.forEach((s, i) => {
    tl.to(s.chars, { yPercent: 0, duration: 1.15, stagger: 0.026 }, 0.1 + i * 0.38);
    tl.call(() => {
      getScene()?.pulse(beats[i].dataset.beat);
      beats[i].classList.add("is-lit");
    }, null, 0.4 + i * 0.38);
  });
  tl.to(".nav > *", { autoAlpha: 1, y: 0, duration: 0.9, stagger: 0.07 }, 0.45);
  tl.to("[data-hero-fade]", { autoAlpha: 1, y: 0, duration: 1.1, stagger: 0.12 }, 0.95);
  return tl;
}

function initHero() {
  if (reduced) return;
  const beats = $$(".hero-title .beat");
  gsap.to(beats, {
    yPercent: (i) => -35 - i * 28,
    ease: "none",
    scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom top", scrub: true },
  });
  gsap.to(".hero-inner", {
    opacity: 0,
    ease: "power1.in",
    scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom 10%", scrub: true },
  });
}

function initNav(lenis) {
  const nav = $("[data-nav]");
  lenis.on("scroll", ({ scroll, direction }) => {
    nav.classList.toggle("is-scrolled", scroll > 24);
    if (menuOpen) return;
    if (scroll > 180 && direction === 1) nav.classList.add("is-hidden");
    else if (direction === -1 || scroll <= 180) nav.classList.remove("is-hidden");
  });
}

function initNavActive() {
  $$(".nav-links a").forEach((a) => {
    const sec = $(a.getAttribute("href"));
    if (!sec) return;
    ScrollTrigger.create({
      trigger: sec, start: "top 50%", end: "bottom 50%",
      onToggle: (self) => a.classList.toggle("is-active", self.isActive),
    });
  });
}

function initMenu(lenis) {
  const btn = $("[data-menu-toggle]");
  const menu = $("[data-mobile-menu]");
  if (!btn || !menu) return () => {};
  const label = btn.querySelector(".menu-toggle-label");
  const open = () => {
    menuOpen = true;
    menu.hidden = false;
    btn.setAttribute("aria-expanded", "true");
    if (label) label.textContent = "Close";
    $("[data-nav]")?.classList.remove("is-hidden");
    lenis?.stop();
    if (window.gsap && !reduced) {
      gsap.fromTo(menu.querySelectorAll("nav a, .mobile-menu-foot"),
        { yPercent: 40, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 0.7, stagger: 0.05, ease: "expo.out" });
    }
    menu.querySelector("a")?.focus({ preventScroll: true });
  };
  const close = () => {
    if (!menuOpen) return;
    menuOpen = false;
    menu.hidden = true;
    btn.setAttribute("aria-expanded", "false");
    if (label) label.textContent = "Menu";
    lenis?.start();
  };
  btn.addEventListener("click", () => (menuOpen ? close() : open()));
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && menuOpen) { close(); btn.focus(); }
  });
  if (!lenis) menu.querySelectorAll("a").forEach((a) => a.addEventListener("click", close));
  return close;
}

function initAnchors(lenis, closeMenu) {
  $$('a[href^="#"]:not(.skip-link)').forEach((a) => {
    a.addEventListener("click", (e) => {
      const id = a.getAttribute("href");
      if (id.length < 2) return;
      const target = $(id);
      if (!target) return;
      e.preventDefault();
      closeMenu();
      lenis.scrollTo(id === "#top" ? 0 : target, {
        duration: 1.5,
        easing: (t) => 1 - Math.pow(1 - t, 4),
      });
    });
  });
}

function initProgress(lenis) {
  const fill = $(".progress-fill");
  lenis.on("scroll", ({ progress }) => gsap.set(fill, { scaleX: progress || 0 }));
}

function initMagnetic() {
  if (!finePointer || reduced) return;
  $$(".magnetic").forEach((el) => {
    const xTo = gsap.quickTo(el, "x", { duration: 0.5, ease: "power3.out" });
    const yTo = gsap.quickTo(el, "y", { duration: 0.5, ease: "power3.out" });
    el.addEventListener("pointermove", (e) => {
      const r = el.getBoundingClientRect();
      xTo((e.clientX - (r.left + r.width / 2)) * 0.22);
      yTo((e.clientY - (r.top + r.height / 2)) * 0.3);
    });
    el.addEventListener("pointerleave", () => { xTo(0); yTo(0); });
  });
}

function initMarquee() {
  const track = $("[data-marquee-track]");
  const group = track?.querySelector(".marquee-group");
  if (!group) return;
  track.appendChild(group.cloneNode(true));
  if (reduced) return;
  const loop = gsap.to(track, { xPercent: -50, ease: "none", duration: 42, repeat: -1 });
  let dir = 1;
  ScrollTrigger.create({
    trigger: ".proof", start: "top bottom", end: "bottom top",
    onToggle: (self) => (self.isActive ? loop.play() : loop.pause()),
    onUpdate: (self) => {
      dir = self.direction;
      const v = Math.abs(self.getVelocity());
      gsap.to(loop, { timeScale: dir * (1 + Math.min(v / 260, 6)), duration: 0.2, overwrite: true });
      gsap.to(loop, { timeScale: dir, duration: 1.4, delay: 0.25, ease: "power2.out" });
    },
  });
}

function initHeadings(splits) {
  if (reduced) return;
  splits.headings.forEach(({ el, split }) => {
    gsap.from(split.lines, {
      yPercent: 108,
      duration: 1.2,
      ease: "expo.out",
      stagger: 0.09,
      scrollTrigger: { trigger: el, start: "top 87%", once: true },
      onComplete: () => split.revert(),
    });
  });
  $$("[data-reveal]").forEach((el) => {
    gsap.from(el, {
      y: 26, autoAlpha: 0, duration: 1.1, ease: "expo.out",
      scrollTrigger: { trigger: el, start: "top 90%", once: true },
    });
  });
}

function initServices(getScene) {
  const rows = $$(".svc");
  const list = $("[data-svc-list]");
  if (!rows.length) return;
  let current = -1;
  const setActive = (i) => {
    if (i === current) return;
    current = i;
    rows.forEach((r, j) => r.classList.toggle("is-active", j === i));
    getScene()?.setHighlight(i >= 0 ? rows[i].dataset.group : null);
  };

  rows.forEach((row, i) => {
    ScrollTrigger.create({
      trigger: row, start: "top 62%", end: "bottom 62%",
      onToggle: (self) => { if (self.isActive) setActive(i); },
    });
  });
  ScrollTrigger.create({
    trigger: list, start: "top 62%", end: "bottom 62%",
    onLeave: () => setActive(-1),
    onLeaveBack: () => setActive(-1),
  });

  if (!reduced) {
    gsap.from(rows, {
      y: 44, autoAlpha: 0, duration: 1.1, ease: "expo.out", stagger: 0.07,
      scrollTrigger: { trigger: list, start: "top 82%", once: true },
    });
  }

  ScrollTrigger.create({
    trigger: ".services", start: "top bottom+=500", once: true,
    onEnter: () => rows.forEach((r) => { const im = new Image(); im.src = r.dataset.img; }),
  });

  if (!finePointer) return;
  const preview = $("[data-svc-preview]");
  const inner = $("[data-svc-preview-inner]");
  gsap.set(preview, { autoAlpha: 0, scale: 0.88, xPercent: -112, yPercent: -50 });
  const xTo = gsap.quickTo(preview, "x", { duration: 0.55, ease: "power3" });
  const yTo = gsap.quickTo(preview, "y", { duration: 0.55, ease: "power3" });
  let shown = false;
  let lastSrc = null;

  const swap = (src) => {
    if (!src || src === lastSrc) return;
    lastSrc = src;
    const img = new Image();
    img.src = src;
    img.alt = "";
    inner.appendChild(img);
    gsap.fromTo(img,
      { clipPath: "inset(100% 0% 0% 0%)", scale: 1.25 },
      {
        clipPath: "inset(0% 0% 0% 0%)", scale: 1, duration: reduced ? 0 : 0.75, ease: "expo.out",
        onComplete: () => { while (inner.children.length > 1) inner.firstElementChild.remove(); },
      });
  };
  rows.forEach((row, i) => {
    row.addEventListener("pointerenter", (e) => {
      setActive(i);
      swap(row.dataset.img);
      if (!shown) {
        shown = true;
        gsap.set(preview, { x: e.clientX, y: e.clientY });
        gsap.to(preview, { autoAlpha: 1, scale: 1, duration: 0.45, ease: "power3.out" });
      }
    });
  });
  list.addEventListener("pointermove", (e) => { xTo(e.clientX); yTo(e.clientY); });
  list.addEventListener("pointerleave", () => {
    shown = false;
    gsap.to(preview, { autoAlpha: 0, scale: 0.88, duration: 0.3, ease: "power2.out" });
  });
}

function initWork() {
  const mm = gsap.matchMedia();
  mm.add("(min-width: 901px) and (prefers-reduced-motion: no-preference)", () => {
    const pin = $("[data-work-pin]");
    const track = $("[data-work-track]");
    const fill = $("[data-work-progress]");
    const dist = () => Math.max(0, track.scrollWidth - document.documentElement.clientWidth);

    const pan = gsap.to(track, {
      x: () => -dist(),
      ease: "none",
      scrollTrigger: {
        trigger: pin,
        start: "top top",
        end: () => "+=" + dist(),
        pin: true,
        scrub: 1,
        anticipatePin: 1,
        invalidateOnRefresh: true,
        refreshPriority: 1,
        onUpdate: (self) => gsap.set(fill, { scaleX: self.progress }),
      },
    });

    $$(".work-media img").forEach((img) => {
      gsap.fromTo(img, { xPercent: 7 }, {
        xPercent: -7, ease: "none",
        scrollTrigger: { trigger: img.parentElement, containerAnimation: pan, start: "left right", end: "right left", scrub: true },
      });
    });

    const medias = $$(".work-media");
    const proxy = { skew: 0 };
    const setSkew = gsap.quickSetter(medias, "skewX", "deg");
    const clamp = gsap.utils.clamp(-5, 5);
    ScrollTrigger.create({
      trigger: pin, start: "top top", end: () => "+=" + dist(),
      onUpdate: (self) => {
        const s = clamp(self.getVelocity() / -450);
        if (Math.abs(s) > Math.abs(proxy.skew)) {
          proxy.skew = s;
          gsap.to(proxy, { skew: 0, duration: 0.9, ease: "power3", overwrite: true, onUpdate: () => setSkew(proxy.skew) });
        }
      },
    });
  });

  if (!reduced) {
    gsap.from(".work-card", {
      y: 70, autoAlpha: 0, duration: 1.2, ease: "expo.out", stagger: 0.07,
      scrollTrigger: { trigger: ".work", start: "top 72%", once: true },
    });
  }
}

function initProcess() {
  const body = $("[data-process]");
  const fill = $("[data-tape-fill]");
  const steps = $$("[data-step]");
  if (!body) return;
  if (reduced) {
    gsap.set(fill, { scaleY: 1 });
    steps.forEach((s) => s.classList.add("is-active"));
    return;
  }
  const mm = gsap.matchMedia();
  mm.add({ desk: "(min-width: 901px)", mob: "(max-width: 900px)" }, (ctx) => {
    gsap.set(fill, { transformOrigin: ctx.conditions.desk ? "50% 100%" : "50% 0%" });
  });
  gsap.fromTo(fill, { scaleY: 0 }, {
    scaleY: 1, ease: "none",
    scrollTrigger: {
      trigger: body, start: "top 72%", end: "bottom 55%", scrub: 0.6,
      onUpdate: (self) => steps.forEach((s, i) => s.classList.toggle("is-active", self.progress >= (i + 0.5) / steps.length)),
    },
  });
  gsap.from(steps, {
    y: 90, autoAlpha: 0, duration: 1.2, ease: "expo.out", stagger: 0.12,
    scrollTrigger: { trigger: body, start: "top 82%", once: true },
  });
}

function initCharts() {
  const ring = createRingChart($("[data-ring-chart]"), $("[data-ring-legend]"), {
    data: RATINGS,
    defaultValue: "4.9",
    defaultLabel: "Google rating",
  });
  const bars = createBarChart($("[data-bar-chart]"), {
    data: TOPICS,
    total: 32,
    unit: "mentions",
    tableBody: $("[data-bar-table]"),
  });
  return { ring, bars };
}

function initRecord(charts) {
  ScrollTrigger.create({
    trigger: ".bento", start: "top 72%", once: true,
    onEnter: () => { charts.ring.reveal(); charts.bars.reveal(); },
  });
  if (reduced) return;
  gsap.from(".cell", {
    y: 56, autoAlpha: 0, duration: 1.15, ease: "expo.out", stagger: 0.08,
    scrollTrigger: { trigger: ".bento", start: "top 82%", once: true },
  });
}

function initQuote(splits) {
  if (reduced) return;
  if (splits.quote) {
    gsap.fromTo(splits.quote.words, { opacity: 0.14 }, {
      opacity: 1, ease: "none", stagger: 0.1,
      scrollTrigger: { trigger: ".quote", start: "top 72%", end: "center 42%", scrub: true },
    });
  }
  gsap.from([".quote-cite", ".quote .link-arrow"], {
    y: 22, autoAlpha: 0, duration: 1, ease: "expo.out", stagger: 0.1,
    scrollTrigger: { trigger: ".quote-cite", start: "top 92%", once: true },
  });
}

function initContact() {
  ScrollTrigger.create({ trigger: "#contact", start: "top bottom+=600", once: true, onEnter: loadMap });
  if (reduced) return;
  gsap.from([".quote-form", ".contact-info"], {
    y: 60, autoAlpha: 0, duration: 1.2, ease: "expo.out", stagger: 0.12,
    scrollTrigger: { trigger: ".contact-grid", start: "top 85%", once: true },
  });
}

function initFooter() {
  if (reduced) return;
  gsap.fromTo("[data-footer-word]", { yPercent: 62, "--wdth": 62 }, {
    yPercent: 0, "--wdth": 112, ease: "none",
    scrollTrigger: { trigger: ".footer", start: "top bottom", end: "bottom bottom", scrub: true },
  });
}

function initActionBar() {
  const bar = $("[data-action-bar]");
  if (!bar) return;
  ScrollTrigger.create({
    trigger: ".hero", start: "bottom 75%", endTrigger: "#contact", end: "top 80%",
    onToggle: (self) => bar.classList.toggle("is-visible", self.isActive),
  });
}

function loadMap() {
  const frame = $("[data-map] iframe");
  if (frame && !frame.src && frame.dataset.src) frame.src = frame.dataset.src;
}

/* ---------- No-library features ---------- */

function initYear() {
  $$("[data-year]").forEach((el) => { el.textContent = new Date().getFullYear(); });
}

function initRolls() {
  const els = $$("[data-roll]");
  if (!els.length || !("IntersectionObserver" in window)) return;
  const io = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (!en.isIntersecting) return;
      io.unobserve(en.target);
      rollNumber(en.target, parseFloat(en.target.dataset.roll), en.target.dataset.format, { delay: 200 });
    });
  }, { threshold: 0.6 });
  els.forEach((el) => io.observe(el));
}

function initOpenStatus() {
  const wrap = $("[data-open-status]");
  const text = $("[data-open-text]");
  if (!wrap || !text) return;
  const update = () => {
    const parts = Object.fromEntries(
      new Intl.DateTimeFormat("en-GB", {
        timeZone: "Asia/Kuala_Lumpur", weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false,
      }).formatToParts(new Date()).map((p) => [p.type, p.value])
    );
    const day = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(parts.weekday);
    const mins = (Number(parts.hour) % 24) * 60 + Number(parts.minute);
    const workday = day >= 1 && day <= 6;
    let msg;
    let open = false;
    if (workday && mins >= 540 && mins < 1020) { open = true; msg = "Open now, closes at 5pm"; }
    else if (workday && mins < 540) msg = "Closed now, opens at 9am today";
    else if (day >= 1 && day <= 5) msg = "Closed now, opens at 9am tomorrow";
    else msg = "Closed now, opens at 9am Monday";
    text.textContent = msg;
    wrap.classList.toggle("is-open", open);
    wrap.hidden = false;
  };
  update();
  setInterval(update, 60000);
}

function initQuoteForm() {
  const form = $("[data-quote-form]");
  if (!form) return;
  const { name, area, message } = form.elements;

  const setError = (input, msg) => {
    const field = input.closest(".field");
    const err = field.querySelector(".field-error");
    field.classList.toggle("has-error", Boolean(msg));
    if (err) err.textContent = msg || "";
    input.setAttribute("aria-invalid", msg ? "true" : "false");
  };
  [name, message].forEach((input) => input.addEventListener("input", () => setError(input, "")));

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    let first = null;
    if (!name.value.trim()) {
      setError(name, "Add your name so we know who we are talking to.");
      first = first || name;
    }
    if (message.value.trim().length < 8) {
      setError(message, "Tell us a little about the job. One sentence is enough.");
      first = first || message;
    }
    if (first) { first.focus(); return; }

    const services = $$('input[name="service"]:checked', form).map((c) => c.value);
    const lines = [`Hi Mr.MA Renovation, my name is ${name.value.trim()}${area.value.trim() ? ` (${area.value.trim()})` : ""}.`];
    if (services.length) lines.push(`I need help with: ${services.join(", ")}.`);
    lines.push("", message.value.trim());
    const url = `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(lines.join("\n"))}`;

    const link = document.createElement("a");
    link.href = url;
    link.target = "_blank";
    link.rel = "noopener";
    document.body.appendChild(link);
    link.click();
    link.remove();

    let note = form.querySelector(".form-note");
    if (!note) {
      note = document.createElement("p");
      note.className = "field-help form-note";
      note.setAttribute("role", "status");
      form.querySelector(".form-foot").appendChild(note);
    }
    note.textContent = "WhatsApp opened in a new tab with your message. Press send there and we will reply during working hours.";
  });
}
