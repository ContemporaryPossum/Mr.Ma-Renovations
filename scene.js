/* ==========================================================================
   scene.js
   A scroll-driven vector "film": one set of line segments that morphs between
   four drawings as the page scrolls.
     0  terrace house (draws itself in on load)
     1  exploded view of the same house (roof lifted, walls pulled apart)
     2  office floor plate
     3  open wave grid
   Service rows on the page light up matching parts of the house.
   ========================================================================== */

import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.169.0/build/three.module.min.js";

const GROUP = { struct: 0, roof: 1, tiles: 2, open: 3, interior: 4, walls: 5, porch: 6, ground: 7 };

/* ---------- Segment builder ---------- */
class Builder {
  constructor() { this.s = []; }
  line(a, b, g) { this.s.push({ a: [a[0], a[1], a[2]], b: [b[0], b[1], b[2]], g }); }
  poly(pts, g, closed = false) {
    for (let i = 0; i < pts.length - 1; i++) this.line(pts[i], pts[i + 1], g);
    if (closed) this.line(pts[pts.length - 1], pts[0], g);
  }
  box(x0, y0, z0, x1, y1, z1, g) {
    const c = [
      [x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1],
      [x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1],
    ];
    [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]]
      .forEach(([i, j]) => this.line(c[i], c[j], g));
  }
  rectXY(x0, y0, x1, y1, z, g) { this.poly([[x0, y0, z], [x1, y0, z], [x1, y1, z], [x0, y1, z]], g, true); }
  rectZY(z0, y0, z1, y1, x, g) { this.poly([[x, y0, z0], [x, y0, z1], [x, y1, z1], [x, y1, z0]], g, true); }
  rectXZ(x0, z0, x1, z1, y, g) { this.poly([[x0, y, z0], [x1, y, z0], [x1, y, z1], [x0, y, z1]], g, true); }
  gridXZ(x0, z0, x1, z1, y, step, g) {
    for (let x = x0; x <= x1 + 1e-6; x += step) this.line([x, y, z0], [x, y, z1], g);
    for (let z = z0; z <= z1 + 1e-6; z += step) this.line([x0, y, z], [x1, y, z], g);
  }
  gridXY(x0, y0, x1, y1, z, step, g) {
    for (let x = x0; x <= x1 + 1e-6; x += step) this.line([x, y0, z], [x, y1, z], g);
    for (let y = y0; y <= y1 + 1e-6; y += step) this.line([x0, y, z], [x1, y, z], g);
  }
  gridZY(z0, y0, z1, y1, x, step, g) {
    for (let z = z0; z <= z1 + 1e-6; z += step) this.line([x, y0, z], [x, y1, z], g);
    for (let y = y0; y <= y1 + 1e-6; y += step) this.line([x, y, z0], [x, y, z1], g);
  }
}

/* ---------- Drawing 0: double-storey terrace house ---------- */
function buildHouse() {
  const b = new Builder();
  const G = GROUP;
  const X = 3.5, Z = 6, F1 = 3.2, F2 = 6.4;

  // Site grid
  for (let i = -12; i <= 12.001; i += 1.5) b.line([i, 0, -13.5], [i, 0, 15], G.ground);
  for (let i = -13.5; i <= 15.001; i += 1.5) b.line([-12, 0, i], [12, 0, i], G.ground);

  // Slabs, columns, beams
  [0, F1, F2].forEach((y) => b.rectXZ(-X, -Z, X, Z, y, G.struct));
  [F1, F2].forEach((y) => {
    b.rectXZ(-X, -Z, X, Z, y - 0.25, G.struct);
  });
  for (const x of [-X, X]) for (const z of [-Z, 0, Z]) b.line([x, 0, z], [x, F2, z], G.struct);
  b.line([-X, F1, 0], [X, F1, 0], G.struct);
  b.line([-X, F2, 0], [X, F2, 0], G.struct);

  // Wall courses (plaster and paint)
  for (let y = 0.4; y < F2 - 0.1; y += 0.4) b.line([X, y, -Z], [X, y, Z], G.walls);
  for (let y = 0.8; y < F2 - 0.1; y += 0.8) b.line([-X, y, -Z], [-X, y, Z], G.walls);

  // Front facade openings
  const zf = Z;
  b.rectXY(-2.9, 0, -1.9, 2.2, zf, G.open);
  b.line([-2.4, 0.05, zf], [-2.4, 2.15, zf], G.open);
  b.rectXY(-1.2, 0.9, 2.8, 2.4, zf, G.open);
  for (let x = -0.7; x < 2.79; x += 0.5) b.line([x, 0.9, zf], [x, 2.4, zf], G.open);
  b.line([-1.2, 1.65, zf], [2.8, 1.65, zf], G.open);
  b.rectXY(-2.9, 4.0, -0.6, 5.6, zf, G.open);
  b.line([-1.75, 4.0, zf], [-1.75, 5.6, zf], G.open);
  b.rectXY(0.6, 4.0, 2.9, 5.6, zf, G.open);
  b.line([1.75, 4.0, zf], [1.75, 5.6, zf], G.open);
  b.line([-3.3, 3.55, zf + 0.6], [3.3, 3.55, zf + 0.6], G.open); // balcony rail
  b.line([-3.3, 3.2, zf + 0.6], [-3.3, 3.55, zf + 0.6], G.open);
  b.line([3.3, 3.2, zf + 0.6], [3.3, 3.55, zf + 0.6], G.open);

  // Back facade
  b.rectXY(0.8, 1.0, 2.8, 2.4, -Z, G.open);
  b.line([1.8, 1.0, -Z], [1.8, 2.4, -Z], G.open);
  b.rectXY(-0.6, 0, 0.4, 2.2, -Z, G.open);
  b.rectXY(-2.6, 4.2, -0.8, 5.4, -Z, G.open);
  b.rectXY(0.8, 4.2, 2.6, 5.4, -Z, G.open);
  // Side vents (bathrooms)
  b.rectZY(-5.4, 1.7, -4.5, 2.3, -X, G.open);
  b.rectZY(-5.4, 4.9, -4.5, 5.5, X, G.open);

  // Roof
  const E = 4.1, RZ = 6.7, RH = 9.0;
  b.line([-E, F2, -RZ], [-E, F2, RZ], G.roof);
  b.line([E, F2, -RZ], [E, F2, RZ], G.roof);
  b.line([0, RH, -RZ], [0, RH, RZ], G.roof);
  for (const z of [-RZ, RZ]) {
    b.line([-E, F2, z], [0, RH, z], G.roof);
    b.line([0, RH, z], [E, F2, z], G.roof);
  }
  const courses = 10;
  for (let i = 1; i < courses; i++) {
    const t = i / courses;
    const y = F2 + (RH - F2) * t;
    const x = E * (1 - t);
    b.line([-x, y, -RZ], [-x, y, RZ], G.roof);
    b.line([x, y, -RZ], [x, y, RZ], G.roof);
  }
  for (let z = -RZ + 0.55; z < RZ - 0.05; z += 0.55) {
    b.line([-E, F2, z], [0, RH, z], G.roof);
    b.line([E, F2, z], [0, RH, z], G.roof);
  }
  b.line([-E - 0.08, F2 - 0.18, -RZ], [-E - 0.08, F2 - 0.18, RZ], G.roof);
  b.line([E + 0.08, F2 - 0.18, -RZ], [E + 0.08, F2 - 0.18, RZ], G.roof);
  for (const z of [-Z, Z]) b.poly([[-X, F2, z], [0, RH - 0.35, z], [X, F2, z]], G.walls);

  // Bathroom tiles, ground floor back-left
  const s = 0.3;
  b.gridXZ(-X, -Z, -1.1, -3.6, 0.02, s, G.tiles);
  b.gridXY(-X, 0, -1.1, 2.4, -Z + 0.02, s, G.tiles);
  b.gridZY(-Z, 0, -3.6, 2.4, -X + 0.02, s, G.tiles);
  // Upstairs bathroom floor
  b.gridXZ(1.1, -Z, X, -3.6, F1 + 0.02, s, G.tiles);

  // Interior
  b.rectZY(-Z, 0, -3.6, F1, -1.1, G.interior);
  b.rectXY(-X, 0, -1.1, F1, -3.6, G.interior);
  b.rectZY(-Z, F1, -3.6, F2, 1.1, G.interior);
  b.box(-3.2, 0, -5.7, -2.5, 0.85, -5.1, G.interior); // vanity
  b.box(-1.9, 0, -5.8, -1.4, 0.45, -5.2, G.interior); // wc
  // Staircase
  const steps = 14, run = 0.32, rise = F1 / steps;
  for (const sx of [1.5, 3.2]) {
    let y = 0, z = 2.8;
    for (let i = 0; i < steps; i++) {
      b.line([sx, y, z], [sx, y + rise, z], G.interior);
      b.line([sx, y + rise, z], [sx, y + rise, z - run], G.interior);
      y += rise; z -= run;
    }
    b.line([sx, 0, 2.8 + 0.02], [sx, F1 - rise, 2.8 - steps * run + 0.02], G.interior);
  }
  {
    let y = rise, z = 2.8;
    for (let i = 0; i < steps; i += 2) {
      b.line([1.5, y, z], [3.2, y, z], G.interior);
      y += rise * 2; z -= run * 2;
    }
  }
  b.box(2.7, 0, -5.8, 3.4, 0.9, -3.0, G.interior); // kitchen base
  b.box(2.95, 1.6, -5.8, 3.4, 2.3, -3.0, G.interior); // wall cabinets
  b.box(-3.2, 0, 1.4, -2.3, 0.8, 4.4, G.interior); // sofa
  b.box(-0.9, 0.72, -2.5, 0.9, 0.78, -1.1, G.interior); // dining table

  // Porch canopy and gate
  b.line([-3.3, 0, 10], [-3.3, 2.75, 10], G.porch);
  b.line([3.3, 0, 10], [3.3, 2.75, 10], G.porch);
  b.poly([[-3.7, 3.05, Z], [3.7, 3.05, Z], [3.7, 2.72, 10.4], [-3.7, 2.72, 10.4]], G.porch, true);
  for (let x = -3.1; x < 3.65; x += 0.62) b.line([x, 3.05, Z], [x, 2.72, 10.4], G.porch);
  b.rectXZ(-X, Z, X, 10.4, 0.0, G.porch);
  b.line([-X, 1.4, 11], [X, 1.4, 11], G.porch);
  b.line([-X, 0.15, 11], [X, 0.15, 11], G.porch);
  for (let x = -X; x <= X + 0.001; x += 0.35) b.line([x, 0.15, 11], [x, 1.4, 11], G.porch);

  return b.s;
}

/* ---------- Drawing 1: exploded house (derived per group) ---------- */
function explode(seg) {
  const mx = (seg.a[0] + seg.b[0]) / 2;
  const my = (seg.a[1] + seg.b[1]) / 2;
  const mz = (seg.a[2] + seg.b[2]) / 2;
  let o = [0, 0, 0];
  switch (seg.g) {
    case GROUP.roof: o = [Math.abs(mx) < 0.05 ? 0 : Math.sign(mx) * 1.1, 3.6, 0]; break;
    case GROUP.porch: o = [0, 0.6, 3.4]; break;
    case GROUP.walls: o = Math.abs(mx) > 3.4 ? [Math.sign(mx) * 2.6, 0, 0] : [0, 1.0, Math.sign(mz) * 1.6]; break;
    case GROUP.open:
      if (mz > 5.9) o = [0, 0, 2.6];
      else if (mz < -5.9) o = [0, 0, -2.6];
      else o = [Math.sign(mx) * 2.4, 0, 0];
      break;
    case GROUP.tiles: o = my < 3 ? [-3.0, 0.8, -1.2] : [3.0, 0.8, -1.2]; break;
    case GROUP.interior: o = [0, my > 3.2 ? 1.2 : 0.2, 0]; break;
    case GROUP.ground: o = [0, -1.4, 0]; break;
    default: break;
  }
  const f = (p) => [p[0] + o[0], p[1] * 1.3 + o[1], p[2] + o[2]];
  return { a: f(seg.a), b: f(seg.b), g: seg.g };
}

/* ---------- Drawing 2: office floor plate ---------- */
function buildOffice() {
  const b = new Builder();
  const G = GROUP;
  const X = 9, Z = 6.5, H = 3.2;
  b.rectXZ(-X, -Z, X, Z, 0, G.struct);
  b.rectXZ(-X, -Z, X, Z, -0.3, G.struct);
  for (const x of [-6, 0, 6]) for (const z of [-3.25, 3.25]) b.box(x - 0.2, 0, z - 0.2, x + 0.2, H, z + 0.2, G.struct);
  b.gridXZ(-X, -Z, X, Z, H, 1.2, G.tiles);
  // Glazed front
  for (let x = -X; x <= X + 0.001; x += 1.5) b.line([x, 0, Z], [x, H, Z], G.open);
  b.line([-X, H, Z], [X, H, Z], G.open);
  b.line([-X, 1.1, Z], [X, 1.1, Z], G.open);
  // Meeting room
  b.rectXY(3, 0, X, H, -2, G.open);
  for (let x = 4; x < X; x += 1) b.line([x, 0, -2], [x, H, -2], G.open);
  b.rectZY(-Z, 0, -2, H, 3, G.open);
  for (let z = -5.5; z < -2; z += 1) b.line([3, 0, z], [3, H, z], G.open);
  b.box(4.6, 0.72, -5.2, 7.6, 0.78, -3.3, G.interior);
  for (const cx of [5.0, 6.1, 7.2]) {
    b.box(cx - 0.25, 0, -5.9, cx + 0.25, 0.5, -5.45, G.interior);
    b.box(cx - 0.25, 0, -3.05, cx + 0.25, 0.5, -2.6, G.interior);
  }
  // Desk clusters
  const clusters = [[-6.6, 1.2], [-3.2, 1.2], [0.2, 1.2], [-6.6, -3.6], [-3.2, -3.6]];
  for (const [cx, cz] of clusters) {
    for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) {
      const x0 = cx + i * 1.5, z0 = cz + j * 0.8;
      b.box(x0, 0.72, z0, x0 + 1.4, 0.76, z0 + 0.72, G.interior);
      b.rectXY(x0 + 0.4, 0.8, x0 + 1.0, 1.15, z0 + (j ? 0.08 : 0.64), G.interior);
    }
  }
  // Reception
  b.box(-8.5, 0, 3.6, -5.6, 1.1, 5.1, G.interior);
  b.box(4.5, 0, 2.2, 8.3, 0.9, 3.0, G.interior);
  return b.s;
}

/* ---------- Drawing 3: open wave grid ---------- */
function buildGrid() {
  const b = new Builder();
  const R = 24, n = 32, seg = 26;
  for (let i = 0; i <= n; i++) {
    const x = -R + (2 * R * i) / n;
    for (let j = 0; j < seg; j++) {
      const z0 = -R + (2 * R * j) / seg, z1 = -R + (2 * R * (j + 1)) / seg;
      b.line([x, 0, z0], [x, 0, z1], GROUP.ground);
      b.line([z0, 0, x], [z1, 0, x], GROUP.ground);
    }
  }
  return b.s;
}

/* ---------- Helpers ---------- */
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const keyOf = (s) => Math.atan2((s.a[2] + s.b[2]) / 2, (s.a[0] + s.b[0]) / 2);

/** Pads a drawing with zero-length segments sitting on its own lines, then sorts by angle. */
function prepare(list, n, rand) {
  const out = list.map((s) => ({ ...s, deg: 0 }));
  while (out.length < n) {
    const host = list[Math.floor(rand() * list.length)];
    const t = rand();
    const p = [0, 1, 2].map((k) => host.a[k] + (host.b[k] - host.a[k]) * t);
    out.push({ a: p, b: p.slice(), g: host.g, deg: 1, host });
  }
  out.forEach((s) => { s.key = keyOf(s.host || s) + (rand() - 0.5) * 0.35; });
  out.sort((p, q) => p.key - q.key);
  return out;
}

const SHARED_GLSL = /* glsl */ `
  uniform float uMorph;
  uniform float uDraw;
  uniform float uTime;
  uniform float uWave;
  uniform float uDim;
  uniform vec4 uHiA;
  uniform vec4 uHiB;
  attribute vec3 p0;
  attribute vec3 p1;
  attribute vec3 p2;
  attribute vec3 p3;
  attribute vec3 pStart;
  attribute vec4 aInfo;   // x: draw delay, y: group, z: random, w: unused
  attribute vec4 aDeg;    // zero-length flag per drawing

  float easeIO(float t) { return t < 0.5 ? 4.0 * t * t * t : 1.0 - pow(-2.0 * t + 2.0, 3.0) / 2.0; }
  float stageT(float m, float idx, float r) {
    float t = clamp(m - idx, 0.0, 1.0);
    float d = r * 0.42;
    return easeIO(clamp((t - d) / 0.58, 0.0, 1.0));
  }
  float groupHi(float g) {
    if (g < 0.5) return uHiA.x;
    if (g < 1.5) return uHiA.y;
    if (g < 2.5) return uHiA.z;
    if (g < 3.5) return uHiA.w;
    if (g < 4.5) return uHiB.x;
    if (g < 5.5) return uHiB.y;
    if (g < 6.5) return uHiB.z;
    return uHiB.w;
  }

  vec3 t123;
  vec3 morphPos() {
    float r = aInfo.z;
    float dr = clamp((uDraw - aInfo.x * 0.6) / 0.4, 0.0, 1.0);
    dr = 1.0 - pow(1.0 - dr, 3.0);
    vec3 pos = mix(pStart, p0, dr);
    float t1 = stageT(uMorph, 0.0, r);
    float t2 = stageT(uMorph, 1.0, r);
    float t3 = stageT(uMorph, 2.0, r);
    t123 = vec3(t1, t2, t3);
    vec3 g = p3;
    float w = sin(g.x * 0.27 + uTime * 0.55) * 0.85
            + cos(g.z * 0.23 - uTime * 0.42) * 0.85
            + sin((g.x + g.z) * 0.11 + uTime * 0.3) * 0.6;
    g.y += w * uWave;
    vec3 c = mix(pos, p1, t1);
    c = mix(c, p2, t2);
    c = mix(c, g, t3);
    float f = 0.35 * sin(3.14159 * t1) + sin(3.14159 * t2) + sin(3.14159 * t3);
    c += vec3((fract(r * 13.7) - 0.5) * 3.2, fract(r * 7.3) * 3.6, (fract(r * 3.1) - 0.5) * 3.2) * f;
    return c;
  }
`;

const LINE_VERT = /* glsl */ `
  ${SHARED_GLSL}
  uniform vec3 uBase;
  uniform vec3 uAccent;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    vec3 c = morphPos();
    vec4 mv = modelViewMatrix * vec4(c, 1.0);
    gl_Position = projectionMatrix * mv;

    float grp = aInfo.y;
    float isGround = step(6.5, grp);
    float hi = groupHi(grp) * (1.0 - t123.y);
    float a = mix(0.46, 0.15, isGround);
    a *= mix(1.0, 1.0 - smoothstep(3.0, 17.0, length(c.xz)), isGround * (1.0 - t123.z));
    float gridA = 0.32 * (1.0 - smoothstep(5.0, 24.0, length(p3.xz)));
    a = mix(a, gridA, t123.z);
    float fog = 1.0 - smoothstep(16.0, 95.0, -mv.z);
    vColor = mix(uBase, uAccent, hi);
    vAlpha = (a + hi * 0.5) * fog * uDim;
  }
`;

const LINE_FRAG = /* glsl */ `
  precision mediump float;
  varying vec3 vColor;
  varying float vAlpha;
  void main() { gl_FragColor = vec4(vColor, vAlpha); }
`;

const POINT_VERT = /* glsl */ `
  ${SHARED_GLSL}
  uniform float uPoints;
  uniform float uPixelRatio;
  uniform vec3 uAccent;
  uniform vec3 uInk;
  varying float vAlpha;
  varying vec3 vColor;
  void main() {
    vec3 c = morphPos();
    vec4 mv = modelViewMatrix * vec4(c, 1.0);
    gl_Position = projectionMatrix * mv;
    float depth = -mv.z;
    gl_PointSize = clamp(48.0 / depth, 1.0, 3.2) * uPixelRatio;
    float deg = mix(mix(mix(aDeg.x, aDeg.y, t123.x), aDeg.z, t123.y), aDeg.w, t123.z);
    float flight = max(max(sin(3.14159 * t123.x), sin(3.14159 * t123.y)), sin(3.14159 * t123.z));
    float fog = 1.0 - smoothstep(16.0, 95.0, depth);
    float hi = groupHi(aInfo.y) * (1.0 - t123.y);
    vColor = mix(uInk, uAccent, max(hi, flight * 0.6));
    vAlpha = (uPoints * (1.0 - deg * 0.85) + flight * 0.55) * fog * uDim;
  }
`;

const POINT_FRAG = /* glsl */ `
  precision mediump float;
  varying float vAlpha;
  varying vec3 vColor;
  void main() {
    vec2 d = gl_PointCoord - 0.5;
    if (dot(d, d) > 0.25) discard;
    gl_FragColor = vec4(vColor, vAlpha);
  }
`;

const lerp = (a, b, t) => a + (b - a) * t;

/* ---------- Scene ---------- */
export function createScene(canvas, { reduced = false, mobile = false } = {}) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
  } catch (e) {
    return null;
  }
  if (!renderer.getContext()) return null;

  const dprCap = mobile ? 1.5 : 1.75;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, dprCap));
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 220);

  // Build and align the four drawings
  const rand = mulberry32(20261019);
  const house = buildHouse();
  const exploded = house.map(explode);
  const office = buildOffice();
  const grid = buildGrid();
  const N = Math.max(house.length, office.length, grid.length);

  const H = prepare(house, N, rand);
  // Exploded keeps the house order exactly
  const E = H.map((s) => {
    const src = s.deg ? { a: s.a, b: s.b, g: s.g } : s;
    return { ...explode(src), deg: s.deg };
  });
  const O = prepare(office, N, rand);
  const Gd = prepare(grid, N, rand);

  const V = N * 2;
  const p0 = new Float32Array(V * 3), p1 = new Float32Array(V * 3), p2 = new Float32Array(V * 3), p3 = new Float32Array(V * 3);
  const pStart = new Float32Array(V * 3);
  const info = new Float32Array(V * 4);
  const deg = new Float32Array(V * 4);
  const pos = new Float32Array(V * 3); // required by three; real positions come from the shader

  for (let i = 0; i < N; i++) {
    const h = H[i], e = E[i], o = O[i], g = Gd[i];
    const my = (h.a[1] + h.b[1]) / 2;
    const delay = Math.min(1, (my / 9.5) * 0.62 + rand() * 0.38);
    const r = rand();
    for (let v = 0; v < 2; v++) {
      const vi = i * 2 + v;
      const pick = (s) => (v === 0 ? s.a : s.b);
      p0.set(pick(h), vi * 3);
      p1.set(pick(e), vi * 3);
      p2.set(pick(o), vi * 3);
      p3.set(pick(g), vi * 3);
      pStart.set(h.a, vi * 3);
      pos.set(pick(h), vi * 3);
      info.set([delay, h.g, r, 0], vi * 4);
      deg.set([h.deg, h.deg, o.deg, g.deg], vi * 4);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setAttribute("p0", new THREE.BufferAttribute(p0, 3));
  geo.setAttribute("p1", new THREE.BufferAttribute(p1, 3));
  geo.setAttribute("p2", new THREE.BufferAttribute(p2, 3));
  geo.setAttribute("p3", new THREE.BufferAttribute(p3, 3));
  geo.setAttribute("pStart", new THREE.BufferAttribute(pStart, 3));
  geo.setAttribute("aInfo", new THREE.BufferAttribute(info, 4));
  geo.setAttribute("aDeg", new THREE.BufferAttribute(deg, 4));
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 3, 0), 60);

  const uniforms = {
    uMorph: { value: 0 },
    uDraw: { value: reduced ? 1 : 0 },
    uTime: { value: 0 },
    uWave: { value: 0 },
    uDim: { value: 1 },
    uPoints: { value: 0 },
    uPixelRatio: { value: renderer.getPixelRatio() },
    uHiA: { value: new THREE.Vector4() },
    uHiB: { value: new THREE.Vector4() },
    uBase: { value: new THREE.Color("#93a0b8") },
    uAccent: { value: new THREE.Color("#ff4d74") },
    uInk: { value: new THREE.Color("#eceae4") },
  };

  const lineMat = new THREE.ShaderMaterial({
    uniforms, vertexShader: LINE_VERT, fragmentShader: LINE_FRAG,
    transparent: true, depthWrite: false, depthTest: false,
  });
  const pointMat = new THREE.ShaderMaterial({
    uniforms, vertexShader: POINT_VERT, fragmentShader: POINT_FRAG,
    transparent: true, depthWrite: false, depthTest: false,
  });

  const lines = new THREE.LineSegments(geo, lineMat);
  const points = new THREE.Points(geo, pointMat);
  lines.frustumCulled = false;
  points.frustumCulled = false;
  scene.add(lines, points);

  // State (target is set by the page; current eases toward it)
  const KEYS = ["morph", "theta", "phi", "radius", "tx", "ty", "tz", "shift", "dim", "points", "wave", "spin"];
  const current = { morph: 0, theta: 0.7, phi: 1.13, radius: 31, tx: 0, ty: 3.4, tz: 0.8, shift: 0.2, dim: 1, points: 0, wave: 0, spin: 1 };
  const target = { ...current };
  const hiNames = Object.keys(GROUP);
  const hi = new Float32Array(8);
  const hiTarget = new Float32Array(8);
  const flash = new Float32Array(8);
  const pointer = { x: 0, y: 0, sx: 0, sy: 0 };
  let spinAcc = 0;
  let last = 0;
  let width = 0, height = 0;

  function resize() {
    width = window.innerWidth;
    height = window.innerHeight;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    uniforms.uPixelRatio.value = renderer.getPixelRatio();
    applyCamera();
    if (reduced) renderer.render(scene, camera);
  }

  function applyCamera() {
    const c = current;
    const theta = c.theta + spinAcc + pointer.sx * 0.1;
    const phi = Math.min(1.5, Math.max(0.12, c.phi + pointer.sy * 0.05));
    const tx = c.tx, ty = c.ty, tz = c.tz;
    camera.position.set(
      tx + c.radius * Math.sin(phi) * Math.cos(theta),
      ty + c.radius * Math.cos(phi),
      tz + c.radius * Math.sin(phi) * Math.sin(theta)
    );
    camera.lookAt(tx, ty, tz);
    const shiftPx = (width < 760 ? c.shift * 0.25 : c.shift) * width;
    camera.setViewOffset(width, height, -shiftPx, 0, width, height);
  }

  function update(timeSec) {
    const dt = Math.min(0.05, last ? timeSec - last : 0.016);
    last = timeSec;
    const k = 1 - Math.exp(-dt * 3.2);
    for (const key of KEYS) current[key] = lerp(current[key], target[key], k);
    if (!reduced) spinAcc += dt * 0.045 * current.spin;
    pointer.sx = lerp(pointer.sx, pointer.x, 1 - Math.exp(-dt * 2.5));
    pointer.sy = lerp(pointer.sy, pointer.y, 1 - Math.exp(-dt * 2.5));

    const kh = 1 - Math.exp(-dt * 6);
    for (let i = 0; i < 8; i++) {
      flash[i] = Math.max(0, flash[i] - dt * 0.9);
      hi[i] = lerp(hi[i], Math.max(hiTarget[i], flash[i]), kh);
    }

    uniforms.uTime.value = timeSec;
    uniforms.uMorph.value = current.morph;
    uniforms.uWave.value = current.wave;
    uniforms.uDim.value = current.dim;
    uniforms.uPoints.value = current.points;
    uniforms.uHiA.value.set(hi[0], hi[1], hi[2], hi[3]);
    uniforms.uHiB.value.set(hi[4], hi[5], hi[6], hi[7]);
    applyCamera();
    renderer.render(scene, camera);
  }

  function setTarget(s) {
    for (const key of KEYS) if (s[key] !== undefined) target[key] = s[key];
  }
  function snap() { Object.assign(current, target); }

  function setHighlight(name) {
    hiTarget.fill(0);
    if (name && name in GROUP) hiTarget[GROUP[name]] = 1;
    if (name === "all") hiTarget.fill(0.75, 0, 7);
  }
  function pulse(name) {
    if (name === "all") { for (let i = 0; i < 7; i++) flash[i] = 0.9; return; }
    if (name in GROUP) flash[GROUP[name]] = 1.1;
  }
  function setDraw(v) { uniforms.uDraw.value = v; if (reduced) renderer.render(scene, camera); }
  function setPointer(x, y) { pointer.x = x; pointer.y = y; }
  function renderOnce() { applyCamera(); renderer.render(scene, camera); }

  function destroy() {
    geo.dispose(); lineMat.dispose(); pointMat.dispose(); renderer.dispose();
  }

  window.addEventListener("resize", resize);
  resize();

  return { update, setTarget, snap, setHighlight, pulse, setDraw, setPointer, renderOnce, resize, destroy, groups: hiNames, uniforms };
}
