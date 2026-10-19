/* ==========================================================================
   charts.js
   Bklit UI chart patterns (ui.bklit.com) ported to dependency-free SVG so the
   site stays a flat, build-free static bundle:
   - same --chart-* / --border theme tokens
   - Grid -> series -> axis -> tooltip composition
   - ~1100ms enter animation on cubic-bezier(0.85, 0, 0.15, 1)
   - hovered mark stays solid, siblings fade to 0.3, popover tooltip
   - prefers-reduced-motion renders final state
   ========================================================================== */

const NS = "http://www.w3.org/2000/svg";
const BKLIT_EASE = "cubic-bezier(0.85, 0, 0.15, 1)";
const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function svg(tag, attrs = {}, parent) {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  if (parent) parent.appendChild(el);
  return el;
}

const easeInOutBk = (t) => {
  // numeric approximation of cubic-bezier(0.85, 0, 0.15, 1)
  return t < 0.5 ? 16 * t ** 5 : 1 - Math.pow(-2 * t + 2, 5) / 2;
};

function tween(duration, onUpdate, { delay = 0, ease = easeInOutBk } = {}) {
  return new Promise((resolve) => {
    const start = performance.now() + delay;
    const step = (now) => {
      const t = Math.min(1, Math.max(0, (now - start) / duration));
      onUpdate(ease(t));
      if (t < 1) requestAnimationFrame(step);
      else resolve();
    };
    requestAnimationFrame(step);
  });
}

/* ---------- Shared popover tooltip ---------- */
const tooltipEl = () => document.querySelector("[data-chart-tooltip]");

function showTooltip(html, x, y) {
  const tt = tooltipEl();
  if (!tt) return;
  tt.innerHTML = html;
  tt.classList.add("is-visible");
  const pad = 14;
  const r = tt.getBoundingClientRect();
  let left = x + pad;
  let top = y + pad;
  if (left + r.width > window.innerWidth - 8) left = x - r.width - pad;
  if (top + r.height > window.innerHeight - 8) top = y - r.height - pad;
  tt.style.transform = `translate3d(${Math.round(left)}px, ${Math.round(top)}px, 0)`;
}
function hideTooltip() {
  tooltipEl()?.classList.remove("is-visible");
}

/* ---------- Rolling digits (NumberFlow-style) ---------- */
export function formatValue(value, format) {
  if (format === "comma") return Math.round(value).toLocaleString("en-US");
  if (format === "k") return `${value.toFixed(1)}K`;
  if (format === "decimal") return value.toFixed(1);
  return String(value);
}

export function rollNumber(el, value, format, { delay = 0, duration = 1400 } = {}) {
  const text = formatValue(value, format);
  el.setAttribute("aria-label", text);
  el.textContent = "";
  const wrap = document.createElement("span");
  wrap.className = "roll";
  wrap.setAttribute("aria-hidden", "true");
  const cols = [];
  [...text].forEach((ch) => {
    if (/\d/.test(ch)) {
      const col = document.createElement("span");
      col.className = "roll-col";
      for (let r = 0; r < 2; r++) for (let d = 0; d < 10; d++) {
        const s = document.createElement("span");
        s.textContent = d;
        col.appendChild(s);
      }
      wrap.appendChild(col);
      cols.push({ col, digit: Number(ch) });
    } else {
      const s = document.createElement("span");
      s.className = "roll-static";
      s.textContent = ch;
      wrap.appendChild(s);
    }
  });
  el.appendChild(wrap);

  if (reducedMotion()) {
    cols.forEach(({ col, digit }) => { col.style.transform = `translateY(-${10 + digit}em)`; });
    return;
  }
  cols.forEach(({ col, digit }, i) => {
    col.animate(
      [{ transform: "translateY(0)" }, { transform: `translateY(-${10 + digit}em)` }],
      { duration: duration + i * 90, delay: delay + i * 60, easing: "cubic-bezier(0.16, 1, 0.3, 1)", fill: "forwards" }
    );
  });
}

/* ==========================================================================
   Ring chart (Bklit RingChart + Ring + RingCenter + Legend)
   ========================================================================== */
export function createRingChart(container, legend, {
  data,
  defaultValue,
  defaultLabel,
  strokeWidth = 14,
  ringGap = 9,
  baseInnerRadius = 84,
}) {
  const n = data.length;
  const outer = baseInnerRadius + n * (strokeWidth + ringGap);
  const size = outer * 2 + 8;
  const c = size / 2;

  const root = svg("svg", { viewBox: `0 0 ${size} ${size}`, role: "img", "aria-label": `${defaultLabel}: ${defaultValue}. ` + data.map((d) => `${d.label}: ${d.value} of ${d.maxValue}`).join(", ") });
  container.appendChild(root);

  const center = document.createElement("div");
  center.className = "ring-center";
  center.innerHTML = `<span class="ring-center-value"></span><span class="ring-center-label"></span>`;
  container.appendChild(center);
  const cValue = center.querySelector(".ring-center-value");
  const cLabel = center.querySelector(".ring-center-label");

  const rings = data.map((d, i) => {
    // index 0 is the outermost ring
    const r = baseInnerRadius + (n - 1 - i) * (strokeWidth + ringGap) + strokeWidth / 2;
    const C = 2 * Math.PI * r;
    const g = svg("g", { class: "ring", style: "transform-origin: 50% 50%; transform-box: view-box;" }, root);
    svg("circle", { cx: c, cy: c, r, fill: "none", stroke: "var(--border)", "stroke-width": strokeWidth }, g);
    const arc = svg("circle", {
      cx: c, cy: c, r, fill: "none",
      stroke: d.color, "stroke-width": strokeWidth, "stroke-linecap": "round",
      "stroke-dasharray": C, "stroke-dashoffset": C,
      transform: `rotate(-90 ${c} ${c})`,
      style: "transition: opacity .2s ease, stroke-width .25s ease;",
    }, g);
    if (d.value <= 0) arc.style.display = "none";
    if (!reducedMotion()) g.style.opacity = "0";
    return { g, arc, C, r, d };
  });

  // Legend
  const items = data.map((d, i) => {
    const li = document.createElement("li");
    li.innerHTML = `<span class="swatch" style="background:${d.value > 0 ? d.color : "var(--border)"}"></span><span>${d.label}</span><span class="val">${d.value}</span>`;
    li.addEventListener("pointerenter", () => setHover(i));
    li.addEventListener("pointerleave", () => setHover(null));
    legend.appendChild(li);
    return li;
  });

  let hovered = null;
  function setCenter(value, label) {
    cValue.textContent = value;
    cLabel.textContent = label;
  }
  function setHover(i) {
    if (i === hovered) return;
    hovered = i;
    rings.forEach((ring, j) => {
      ring.arc.style.opacity = i === null || i === j ? "1" : "0.3";
      ring.arc.setAttribute("stroke-width", i === j ? strokeWidth + 3 : strokeWidth);
    });
    items.forEach((li, j) => li.classList.toggle("is-hovered", i === j));
    legend.classList.toggle("has-hover", i !== null);
    if (i === null) setCenter(defaultValue, defaultLabel);
    else setCenter(String(data[i].value), data[i].centerLabel || data[i].label);
  }

  root.addEventListener("pointermove", (e) => {
    const rect = root.getBoundingClientRect();
    const scale = size / rect.width;
    const x = (e.clientX - rect.left) * scale - c;
    const y = (e.clientY - rect.top) * scale - c;
    const dist = Math.hypot(x, y);
    const idx = rings.findIndex((ring) => Math.abs(dist - ring.r) <= strokeWidth / 2 + ringGap / 2);
    setHover(idx === -1 ? null : idx);
  });
  root.addEventListener("pointerleave", () => setHover(null));

  setCenter(defaultValue, defaultLabel);
  center.style.opacity = "0";

  function finalState() {
    rings.forEach(({ g, arc, C, d }) => {
      g.style.opacity = "1";
      arc.setAttribute("stroke-dashoffset", C * (1 - d.value / d.maxValue));
    });
    center.style.opacity = "1";
  }

  let revealed = false;
  function reveal() {
    if (revealed) return;
    revealed = true;
    if (reducedMotion()) { finalState(); return; }
    // 1. rings expand, 2. arcs sweep, 3. center fades, 4. legend slides in
    rings.forEach(({ g }, i) => {
      g.animate([{ transform: "scale(0.72)", opacity: 0 }, { transform: "scale(1)", opacity: 1 }],
        { duration: 700, delay: i * 90, easing: "cubic-bezier(0.16, 1, 0.3, 1)", fill: "both" })
        .finished.then(() => { g.style.opacity = "1"; });
    });
    rings.forEach(({ arc, C, d }, i) => {
      const to = C * (1 - d.value / d.maxValue);
      tween(1100, (t) => arc.setAttribute("stroke-dashoffset", C + (to - C) * t), { delay: 260 + i * 120 });
    });
    center.animate([{ opacity: 0, transform: "translateY(6px)" }, { opacity: 1, transform: "none" }],
      { duration: 600, delay: 700, easing: "cubic-bezier(0.16, 1, 0.3, 1)", fill: "forwards" })
      .finished.then(() => { center.style.opacity = "1"; });
    items.forEach((li, i) => li.animate([{ opacity: 0, transform: "translateX(16px)" }, { opacity: 1, transform: "none" }],
      { duration: 600, delay: 800 + i * 80, easing: "cubic-bezier(0.16, 1, 0.3, 1)", fill: "backwards" }));
  }

  return { reveal };
}

/* ==========================================================================
   Horizontal bar chart (Bklit BarChart orientation="horizontal" + Grid +
   BarYAxis + ChartTooltip)
   ========================================================================== */
export function createBarChart(container, {
  data,
  labelKey = "label",
  valueKey = "value",
  total,
  unit = "mentions",
  ticks = [0, 2, 4, 6, 8, 10],
  rowHeight = 30,
  barThickness = 10,
  tableBody,
}) {
  const domainMax = ticks[ticks.length - 1];
  const maxVal = Math.max(...data.map((d) => d[valueKey]));
  let revealed = false;
  let bars = [];
  let active = null;

  if (tableBody) {
    tableBody.innerHTML = data.map((d) => `<tr><td>${d[labelKey]}</td><td>${d[valueKey]}</td></tr>`).join("");
  }

  const measure = document.createElement("canvas").getContext("2d");
  function labelWidth() {
    measure.font = `400 13px ${getComputedStyle(document.body).fontFamily}`;
    return Math.ceil(Math.max(...data.map((d) => measure.measureText(d[labelKey]).width))) + 18;
  }

  function render() {
    const width = container.clientWidth;
    if (!width) return;
    container.innerHTML = "";
    const m = { top: 6, right: 34, bottom: 28, left: Math.min(labelWidth(), width * 0.42) };
    const innerW = Math.max(40, width - m.left - m.right);
    const height = m.top + data.length * rowHeight + m.bottom;
    const x = (v) => (v / domainMax) * innerW;

    const root = svg("svg", {
      viewBox: `0 0 ${width} ${height}`,
      height,
      role: "list",
      "aria-label": `Review topics by number of mentions, out of ${total} reviews`,
    }, container);

    // Grid: vertical lines that fade at top and bottom (fadeVertical)
    const defs = svg("defs", {}, root);
    const gradId = `bk-fade-${Math.random().toString(36).slice(2, 8)}`;
    const lg = svg("linearGradient", { id: gradId, x1: 0, y1: 0, x2: 0, y2: 1 }, defs);
    svg("stop", { offset: "0%", "stop-color": "var(--chart-grid)", "stop-opacity": 0 }, lg);
    svg("stop", { offset: "18%", "stop-color": "var(--chart-grid)", "stop-opacity": 1 }, lg);
    svg("stop", { offset: "82%", "stop-color": "var(--chart-grid)", "stop-opacity": 1 }, lg);
    svg("stop", { offset: "100%", "stop-color": "var(--chart-grid)", "stop-opacity": 0 }, lg);
    // The gradient is applied to thin rects, which (unlike 1px lines) carry a bounding box for objectBoundingBox units
    const grid = svg("g", { transform: `translate(${m.left},${m.top})` }, root);
    ticks.forEach((t) => {
      svg("rect", { x: x(t) - 0.5, y: -4, width: 1, height: data.length * rowHeight + 8, fill: `url(#${gradId})` }, grid);
      const lbl = svg("text", { x: x(t), y: data.length * rowHeight + 20, "text-anchor": "middle", class: "tick-label" }, grid);
      lbl.textContent = t;
    });

    const plot = svg("g", { transform: `translate(0,${m.top})` }, root);
    bars = data.map((d, i) => {
      const y = i * rowHeight;
      const row = svg("g", {
        class: "row", tabindex: 0, role: "listitem",
        "aria-label": `${d[labelKey]}: ${d[valueKey]} ${unit}`,
      }, plot);
      const band = svg("rect", { class: "row-band", x: 0, y, width, height: rowHeight, rx: 6, fill: "transparent" }, row);
      const label = svg("text", { x: m.left - 14, y: y + rowHeight / 2 + 4.5, "text-anchor": "end", class: "bar-label" }, row);
      label.textContent = d[labelKey];
      const w = x(d[valueKey]);
      const bar = svg("rect", {
        x: m.left, y: y + (rowHeight - barThickness) / 2,
        width: revealed ? w : 0, height: barThickness,
        rx: barThickness / 2, fill: "var(--chart-line-primary)",
        style: "transition: opacity .2s ease;",
      }, row);
      const value = svg("text", {
        x: m.left + w + 8, y: y + rowHeight / 2 + 4, class: "bar-value",
        style: `transition: opacity .2s ease; opacity:${revealed && d[valueKey] === maxVal ? 1 : 0}`,
      }, row);
      value.textContent = d[valueKey];

      const enter = (e) => {
        setActive(i);
        const pt = e && "clientX" in e ? { x: e.clientX, y: e.clientY } : (() => {
          const r = band.getBoundingClientRect();
          return { x: r.left + m.left + w, y: r.top };
        })();
        const share = total ? Math.round((d[valueKey] / total) * 100) : null;
        showTooltip(
          `<div class="tt-title">${d[labelKey]}</div>
           <div class="tt-row"><span class="tt-swatch"></span>${unit}<b>${d[valueKey]}</b></div>
           ${share !== null ? `<div class="tt-row"><span class="tt-swatch" style="background:transparent"></span>of reviews<b>${share}%</b></div>` : ""}`,
          pt.x, pt.y
        );
      };
      row.addEventListener("pointerenter", enter);
      row.addEventListener("pointermove", enter);
      row.addEventListener("focus", () => enter(null));
      row.addEventListener("pointerleave", clear);
      row.addEventListener("blur", clear);
      return { bar, value, band, w, d };
    });
  }

  function setActive(i) {
    if (active === i) return;
    active = i;
    bars.forEach((b, j) => {
      b.bar.style.opacity = i === null || i === j ? "1" : "0.3";
      b.band.setAttribute("fill", i === j ? "rgba(236,234,228,0.04)" : "transparent");
      b.value.style.opacity = (i === j || (i === null && b.d[valueKey] === maxVal)) && revealed ? "1" : "0";
    });
  }
  function clear() {
    setActive(null);
    hideTooltip();
  }

  function reveal() {
    if (revealed) return;
    revealed = true;
    if (reducedMotion()) {
      bars.forEach((b) => { b.bar.setAttribute("width", b.w); });
      setActiveValues();
      return;
    }
    // Stagger auto-sized so the whole set lands inside ~1.2s (Bklit default)
    const stagger = Math.min(80, 500 / bars.length);
    bars.forEach((b, i) => {
      tween(1100 - i * 20, (t) => {
        b.bar.setAttribute("width", Math.max(0, b.w * t));
        b.value.setAttribute("x", Number(b.bar.getAttribute("x")) + b.w * t + 8);
      }, { delay: i * stagger });
    });
    setTimeout(setActiveValues, 1100);
  }
  function setActiveValues() {
    bars.forEach((b) => { b.value.style.opacity = b.d[valueKey] === maxVal ? "1" : "0"; });
  }

  render();
  let lastW = container.clientWidth;
  const ro = new ResizeObserver(() => {
    const w = container.clientWidth;
    if (Math.abs(w - lastW) < 2) return;
    lastW = w;
    active = null;
    render();
    if (revealed) setActiveValues();
  });
  ro.observe(container);

  return { reveal };
}
