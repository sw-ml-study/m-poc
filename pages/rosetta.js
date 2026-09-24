// Rosetta M: the stone page. Three responsibilities, none of which know what
// a neuron is:
//   1. the stone: a CSS 3D prism that auto-rotates and can be dragged;
//   2. a generic line projector that draws a line-scene record (positions,
//      edges, colors, ids, labels, frames) into an SVG element;
//   3. the time axis: a scrubber over the trace's frames, with a readout of
//      every scalar channel, labelled from the equation record.
// Everything shown is replayed from the fixtures under data/; nothing is
// recomputed here.
"use strict";

const DATA = {
  trace: "data/trace.json",
  scene: "data/scene.json",
  equation: "data/faces/equation.json",
  faces: { math: "data/faces/math.svg", m: "data/faces/m.svg" },
};

const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// ?yaw=DEG fixes the stone's angle and ?epoch=T the frame, for stills and
// captures; either one also turns the corresponding motion off.
const params = new URLSearchParams(location.search);
const fixedYaw = params.has("yaw") ? Number(params.get("yaw")) : null;
const fixedEpoch = params.has("epoch") ? Number(params.get("epoch")) : null;
const initialFocus = params.get("focus");
const initialRead = params.get("read");
const initialScale = params.has("scale") ? Number(params.get("scale")) : null;
const showHelp = params.has("help");
const initialHover = params.get("hover");

// ------------------------------------------------------------- the geometry

// Face widths come from the content: the Visual face is wide, the text faces
// are not. The stone is the triangular prism whose cross-section has those
// three widths as its sides. Every side of a triangle is tangent to its
// inscribed circle, so every face sits at the inradius r from the axis and
// differs only in the angle of its outward normal and in a small in-plane
// offset (a side's midpoint is not its tangent point unless the triangle is
// isosceles about it). All in abstract units; --unit is pixels per unit.
const FACE_WIDTHS = { visual: 720, m: 480, math: 480 };
const FACE_HEIGHT = 440;

function makeGeometry(widths) {
  const faces = Object.keys(widths);
  let [a, b, c] = faces.map((f) => widths[f]);
  if (a >= b + c || b >= a + c || c >= a + b) {
    console.error("face widths violate the triangle inequality; using equal widths", widths);
    a = b = c = Math.max(a, b, c);
  }
  // vertices (x, z): P0-P1 is the first face's side, counterclockwise seen from above
  const P0 = [0, 0], P1 = [a, 0];
  const x2 = (a * a + c * c - b * b) / (2 * a);
  const P2 = [x2, Math.sqrt(Math.max(0, c * c - x2 * x2))];
  const sides = [[P0, P1, a], [P1, P2, b], [P2, P0, c]];
  const s = (a + b + c) / 2;
  const area = Math.sqrt(s * (s - a) * (s - b) * (s - c));
  const r = area / s;
  // incenter: vertices weighted by the opposite side lengths
  const I = [(b * P0[0] + c * P1[0] + a * P2[0]) / (2 * s), (b * P0[1] + c * P1[1] + a * P2[1]) / (2 * s)];
  const out = {};
  faces.forEach((face, k) => {
    const [Pi, Pj, w] = sides[k];
    const M = [(Pi[0] + Pj[0]) / 2, (Pi[1] + Pj[1]) / 2];
    const len = Math.hypot(Pj[0] - Pi[0], Pj[1] - Pi[1]);
    const u = [(Pj[0] - Pi[0]) / len, (Pj[1] - Pi[1]) / len];
    let n = [u[1], -u[0]];                               // a perpendicular
    if ((M[0] - I[0]) * n[0] + (M[1] - I[1]) * n[1] < 0) n = [-n[0], -n[1]]; // outward
    const angle = Math.atan2(n[0], n[1]) * 180 / Math.PI; // rotateY(angle) sends +z to (sin, cos)
    const T = [I[0] + r * n[0], I[1] + r * n[1]];        // tangent point
    const t = [Math.cos(angle * Math.PI / 180), -Math.sin(angle * Math.PI / 180)]; // the face's local x
    const offset = (M[0] - T[0]) * t[0] + (M[1] - T[1]) * t[1];
    out[face] = { width: w, angle, offset, from: [Pi[0] - I[0], Pi[1] - I[1]], to: [Pj[0] - I[0], Pj[1] - I[1]] };
  });
  // turn the whole cross-section so the first face listed after the widest
  // (the Math face) has its normal at 0: yaw 0 then means "Math toward you",
  // and no face sits at exactly 180, which Chrome's 3D hit boxes mishandle
  const zero = out.math ? out.math.angle : 0;
  for (const g of Object.values(out)) {
    g.angle = ((g.angle - zero) % 360 + 540) % 360 - 180;
    const c = Math.cos(-zero * Math.PI / 180), sn = Math.sin(-zero * Math.PI / 180);
    g.from = [g.from[0] * c - g.from[1] * sn, g.from[0] * sn + g.from[1] * c];
    g.to = [g.to[0] * c - g.to[1] * sn, g.to[0] * sn + g.to[1] * c];
  }
  return { faces: out, r, height: FACE_HEIGHT, stoneWidth: Math.max(a, b, c) };
}

// ---------------------------------------------------------------- the stone

function makeStone(stage, stone, geometry, onChange) {
  // the yaw at which a face looks at the viewer cancels its normal's angle
  const FACE_ANGLE = {};
  for (const [face, g] of Object.entries(geometry.faces)) FACE_ANGLE[face] = -g.angle;
  const FACES = Object.keys(FACE_ANGLE);
  stone.style.setProperty("--r", String(geometry.r));
  stone.style.setProperty("--stone-w", String(geometry.stoneWidth));
  stone.style.setProperty("--face-hu", String(geometry.height));
  stage.style.setProperty("--face-hu", String(geometry.height));
  for (const el of stone.querySelectorAll(".face")) {
    const g = geometry.faces[el.dataset.face];
    if (!g) continue;
    el.style.setProperty("--w", String(g.width));
    el.style.setProperty("--a", String(g.angle));
    el.style.setProperty("--o", String(g.offset));
  }
  const DEFAULT = { yaw: FACE_ANGLE.math - 20, pitch: -4, scale: 1 };
  const SPEED = 9; // degrees per second
  const SCALES = [0.5, 0.65, 0.8, 1, 1.25, 1.6, 2, 2.5];
  let yaw = fixedYaw ?? DEFAULT.yaw;
  let pitch = DEFAULT.pitch;
  let scale = initialScale ?? DEFAULT.scale;
  let pan = [0, 0];
  let spinning = !reducedMotion && fixedYaw === null;
  let dragging = null;
  let reading = null;      // the face being read, or null
  let before = null;       // the view to restore when reading ends
  let last = performance.now();

  function apply() {
    stone.style.setProperty("--yaw", `${yaw}deg`);
    stone.style.setProperty("--pitch", `${pitch}deg`);
    stone.style.setProperty("--view-scale", String(scale));
    stone.style.setProperty("--pan-x", `${pan[0]}px`);
    stone.style.setProperty("--pan-y", `${pan[1]}px`);
    stage.style.setProperty("--view-scale", String(scale));
    onChange(view());
  }
  function view() {
    return { yaw, pitch, scale, spinning, reading, front: frontFace() };
  }
  // the face whose normal is closest to the viewer
  function frontFace() {
    let best = null, bestDist = Infinity;
    for (const face of FACES) {
      const d = Math.abs(((yaw - FACE_ANGLE[face]) % 360 + 540) % 360 - 180);
      if (d < bestDist) { bestDist = d; best = face; }
    }
    return best;
  }
  function tick(now) {
    if (spinning && !dragging && !reading) yaw += (SPEED * (now - last)) / 1000;
    last = now;
    apply();
    requestAnimationFrame(tick);
  }
  function restoreGeometry() {
    stone.style.removeProperty("--unit");
    stone.style.setProperty("--stone-w", String(geometry.stoneWidth));
    stone.style.setProperty("--r", String(geometry.r));
    for (const el of stone.querySelectorAll(".face")) el.style.setProperty("--o", String(geometry.faces[el.dataset.face].offset));
  }
  function settle(fn) {
    stone.classList.add("settling");
    fn();
    apply();
    setTimeout(() => stone.classList.remove("settling"), 400);
  }
  function turnTo(face) {
    const target = FACE_ANGLE[face];
    const delta = ((target - yaw) % 360 + 540) % 360 - 180;
    yaw += delta;
  }
  // the pixels per unit at which a face fills the viewport height in read
  // mode, width permitting; read mode enlarges the layout box itself, so the
  // stage sizes to it
  function fitUnit(face) {
    const width = stage.getBoundingClientRect().width - 16;
    const height = Math.max(240, window.innerHeight - 32 - 68);
    return Math.max(0.25, Math.min(width / geometry.faces[face].width, height / geometry.height));
  }
  stage.addEventListener("pointerdown", (e) => {
    if (reading || document.body.dataset.mode) return;
    dragging = { x: e.clientX, y: e.clientY, yaw, pitch };
    stage.classList.add("dragging");
    stage.setPointerCapture(e.pointerId);
  });
  stage.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    yaw = dragging.yaw + (e.clientX - dragging.x) * 0.45;
    pitch = Math.max(-30, Math.min(30, dragging.pitch - (e.clientY - dragging.y) * 0.15));
    if (Math.abs(e.clientX - dragging.x) > 4 || Math.abs(e.clientY - dragging.y) > 4) dragging.moved = true;
    apply();
  });
  const release = () => {
    if (dragging && dragging.moved) stage.dataset.suppressClick = "1";
    dragging = null;
    stage.classList.remove("dragging");
  };
  stage.addEventListener("pointerup", release);
  stage.addEventListener("pointercancel", release);
  // a click that ends a drag is not a focus request
  stage.addEventListener("click", (e) => {
    if (stage.dataset.suppressClick) { delete stage.dataset.suppressClick; e.stopPropagation(); }
  }, true);

  requestAnimationFrame(tick);
  const api = {
    // the modal keys work on a snapshot: set() applies live, restore() cancels
    snapshot() { return { yaw, pitch, scale, pan: [...pan], spinning }; },
    set(v) {
      if ("yaw" in v) yaw = v.yaw;
      if ("pitch" in v) pitch = Math.max(-30, Math.min(30, v.pitch));
      if ("scale" in v) scale = Math.max(0.5, Math.min(2.5, v.scale));
      if ("pan" in v) pan = [...v.pan];
      if ("spinning" in v) spinning = v.spinning;
      apply();
    },
    turnTo(face) {
      spinning = false;
      settle(() => turnTo(face));
    },
    setSpinning(on) { spinning = on; apply(); },
    get spinning() { return spinning; },
    get reading() { return reading; },
    front: frontFace,
    scaleBy(steps) {
      const i = SCALES.reduce((best, s, k) => (Math.abs(s - scale) < Math.abs(SCALES[best] - scale) ? k : best), 0);
      const next = SCALES[Math.max(0, Math.min(SCALES.length - 1, i + steps))];
      settle(() => { scale = next; });
    },
    // read mode: one face flat and enlarged to fill the stage, the others hidden
    read(face) {
      if (!FACE_ANGLE[face]) face = face in FACE_ANGLE ? face : frontFace();
      if (!reading) before = { yaw, pitch, scale, spinning };
      reading = face;
      spinning = false;
      document.body.classList.add("reading");
      for (const el of stone.querySelectorAll(".face")) el.classList.toggle("reading-face", el.dataset.face === face);
      // the stage has its reading height after the class change; fit to it on the next frame
      requestAnimationFrame(() => {
        stone.style.setProperty("--unit", `${fitUnit(face)}px`);
        stone.style.setProperty("--stone-w", String(geometry.faces[face].width));
        stone.style.setProperty("--r", "0");
        for (const el of stone.querySelectorAll(".face")) el.style.setProperty("--o", el.dataset.face === face ? "0" : String(geometry.faces[el.dataset.face].offset));
        settle(() => { turnTo(face); pitch = 0; scale = 1; });
        stage.scrollIntoView({ block: "start" });
      });
    },
    endRead() {
      if (!reading) return;
      reading = null;
      restoreGeometry();
      document.body.classList.remove("reading");
      for (const el of stone.querySelectorAll(".face")) el.classList.remove("reading-face");
      settle(() => { ({ yaw, pitch, scale, spinning } = before); });
      before = null;
    },
    reset() {
      const wasReading = reading;
      reading = null;
      restoreGeometry();
      document.body.classList.remove("reading");
      for (const el of stone.querySelectorAll(".face")) el.classList.remove("reading-face");
      settle(() => { yaw = DEFAULT.yaw; pitch = DEFAULT.pitch; scale = DEFAULT.scale; pan = [0, 0]; spinning = !reducedMotion; });
      before = null;
      return wasReading;
    },
  };
  return api;
}

// ------------------------------------------------------ the line projector

// Draw a line-scene record into an SVG element. The scene is a set of 3D
// vertices, index pairs, an RGBA color and an id per edge, labels at anchor
// points, and frames: one complete vertex array per step. The camera is a
// fixed orthographic view of the x-y plane, fitted to the scene's bounding
// box across every frame, so nothing moves out of view while replaying.
function makeProjector(svg, scene) {
  const NS = "http://www.w3.org/2000/svg";
  const n = scene.positions.shape[0];
  const edges = scene.edges.values;
  const m = scene.edges.shape[0];
  const colors = scene.colors.values;
  const frames = scene.frames;
  const T = frames.count;
  const all = frames.positions.values;

  // bounding box over every frame and every label anchor
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const grow = (x, y) => { if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; };
  for (let i = 0; i < all.length; i += 3) grow(all[i], all[i + 1]);
  const lp = scene.labels.positions.values;
  for (let i = 0; i < lp.length; i += 3) grow(lp[i], lp[i + 1]);
  const pad = 0.6;
  minX -= pad; maxX += pad; minY -= pad; maxY += pad;
  svg.setAttribute("viewBox", `0 0 ${(maxX - minX) * 100} ${(maxY - minY) * 100}`);
  svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
  const px = (x) => (x - minX) * 100;
  const py = (y) => (maxY - y) * 100;

  const rgba = (e) => {
    const c = colors.slice(e * 4, e * 4 + 4);
    return `rgba(${Math.round(c[0] * 255)},${Math.round(c[1] * 255)},${Math.round(c[2] * 255)},${c[3]})`;
  };

  const lines = [];
  const hits = [];
  const hitGroup = document.createElementNS(NS, "g");
  hitGroup.setAttribute("class", "hit");
  const edgeGroup = document.createElementNS(NS, "g");
  edgeGroup.setAttribute("class", "edges");
  for (let e = 0; e < m; e++) {
    const line = document.createElementNS(NS, "line");
    line.setAttribute("stroke", rgba(e));
    line.setAttribute("stroke-width", "2.5");
    line.setAttribute("vector-effect", "non-scaling-stroke");
    line.dataset.id = scene.ids[e];
    edgeGroup.appendChild(line);
    lines.push(line);
    // an invisible wide twin, so the edge is easy to rest the pointer on
    const hit = document.createElementNS(NS, "line");
    hit.dataset.id = scene.ids[e];
    hitGroup.appendChild(hit);
    hits.push(hit);
  }
  svg.appendChild(hitGroup);
  svg.appendChild(edgeGroup);

  const labelGroup = document.createElementNS(NS, "g");
  labelGroup.setAttribute("class", "labels");
  labelGroup.setAttribute("font-size", "38"); // 0.38 scene units
  for (let k = 0; k < scene.labels.count; k++) {
    const text = document.createElementNS(NS, "text");
    text.setAttribute("x", px(lp[k * 3]));
    text.setAttribute("y", py(lp[k * 3 + 1]));
    text.dataset.id = scene.labels.ids[k];
    text.textContent = scene.labels.texts[k];
    labelGroup.appendChild(text);
    const pad = document.createElementNS(NS, "rect");
    pad.dataset.id = scene.labels.ids[k];
    pad.setAttribute("x", px(lp[k * 3]) - 30); pad.setAttribute("y", py(lp[k * 3 + 1]) - 30);
    pad.setAttribute("width", 60); pad.setAttribute("height", 60);
    hitGroup.appendChild(pad);
  }
  svg.appendChild(labelGroup);

  // panels: invisible hit rectangles the callouts explain; nothing drawn
  if (scene.panels && scene.panels.count) {
    const panelGroup = document.createElementNS(NS, "g");
    panelGroup.setAttribute("class", "panels");
    const b = scene.panels.bounds.values;
    for (let k = 0; k < scene.panels.count; k++) {
      const rect = document.createElementNS(NS, "rect");
      rect.setAttribute("class", "panel-hit");
      rect.setAttribute("x", px(b[k * 4]));
      rect.setAttribute("y", py(b[k * 4 + 3]));
      rect.setAttribute("width", (b[k * 4 + 2] - b[k * 4]) * 100);
      rect.setAttribute("height", (b[k * 4 + 3] - b[k * 4 + 1]) * 100);
      rect.dataset.panel = scene.panels.ids[k];
      panelGroup.appendChild(rect);
    }
    svg.insertBefore(panelGroup, edgeGroup);
  }

  function frame(t) {
    const base = t * n * 3;
    for (let e = 0; e < m; e++) {
      const a = base + edges[e * 2] * 3;
      const b = base + edges[e * 2 + 1] * 3;
      const line = lines[e];
      const x1 = px(all[a]).toFixed(1), y1 = py(all[a + 1]).toFixed(1);
      const x2 = px(all[b]).toFixed(1), y2 = py(all[b + 1]).toFixed(1);
      line.setAttribute("x1", x1); line.setAttribute("y1", y1);
      line.setAttribute("x2", x2); line.setAttribute("y2", y2);
      const hit = hits[e];
      hit.setAttribute("x1", x1); hit.setAttribute("y1", y1);
      hit.setAttribute("x2", x2); hit.setAttribute("y2", y2);
    }
  }
  return { frame, count: T, axis: frames.axis };
}

// ----------------------------------------------------------- the time axis

function fmt(v) {
  if (typeof v !== "number") return String(v);
  const a = Math.abs(v);
  return a >= 100 ? v.toFixed(2) : a >= 1 ? v.toFixed(4) : v.toFixed(5);
}

// The label for a channel id: the Math face's text for that symbol, from the
// equation record; the id itself if the record does not render it.
function labelFor(equation, id) {
  const face = equation.faces.math;
  const k = face.ids.indexOf(id);
  if (k < 0) return id;
  const text = face.texts[k];
  return text.trim().length ? text : equation.symbols.names[equation.symbols.ids.indexOf(id)];
}

function makeReadout(dl, trace, equation) {
  const scalars = [];
  const tables = [];
  for (const id of Object.keys(trace.channels)) {
    const ch = trace.channels[id];
    (Array.isArray(ch) ? scalars : tables).push(id);
  }
  // symbol order of the equation record, so the readout reads like the faces
  const order = equation.symbols.ids;
  const byRecord = (a, b) => order.indexOf(a) - order.indexOf(b);
  scalars.sort(byRecord);
  tables.sort(byRecord);

  const cells = new Map();
  const add = (id, cls) => {
    const div = document.createElement("div");
    if (cls) div.className = cls;
    const dt = document.createElement("dt");
    dt.textContent = labelFor(equation, id);
    dt.dataset.id = id;
    const dd = document.createElement("dd");
    dd.dataset.id = id;
    div.append(dt, dd);
    dl.appendChild(div);
    cells.set(id, dd);
  };
  scalars.forEach((id) => add(id));
  tables.forEach((id) => add(id, "points"));

  return function show(t) {
    for (const id of scalars) cells.get(id).textContent = fmt(trace.channels[id][t]);
    for (const id of tables) {
      const ch = trace.channels[id];
      const width = ch.shape[1];
      const row = ch.values.slice(t * width, (t + 1) * width);
      cells.get(id).textContent = row.map((v) => fmt(v)).join("  ");
    }
  };
}

// ------------------------------------------------------------ face titles

// Every face names the equation it shows, from the record: the description's
// lead ("One neuron") and that face's first line, so a face is never just
// "Math". Page words (which face this is) stay in the page.
function titleFaces(equation) {
  const lead = equation.description.split(":")[0].trim();
  const first = (face) => (equation.faces[face].text.split("\n")[0] || "").trim();
  const parts = {
    math: [lead, first("math")],
    m: [lead, first("m"), "proposed notation · placeholder glyphs"],
    visual: [lead, "structure and data at this epoch"],
  };
  for (const el of document.querySelectorAll(".face > h2")) {
    const face = el.parentElement.dataset.face;
    const small = document.createElement("small");
    small.textContent = parts[face].join(" · ");
    el.replaceChildren(el.firstChild.textContent.trim(), " ", small);
    el.dataset.title = `${lead}: ${parts[face][1]}`;
  }
}

// -------------------------------------------------------------- face card

// What each face is for. Page vocabulary: the faces are the page's idea; the
// equation's own purpose comes from the record's description.
const FACE_DOCS = {
  math: {
    title: "Math: the equation as written on paper",
    purpose: "The four lines are the whole computation: a prediction, how wrong it is, and how the two parameters move to be less wrong next epoch. This is the face the other two are translations of.",
    legend: [],
  },
  m: {
    title: "M: the same four lines in the proposed notation",
    purpose: "Rendered from the same record as the Math face, token for token, in an APL-style array notation that reads right to left. Nothing runs it; the glyphs are placeholders until the language's semantics are settled.",
    legend: [],
  },
  visual: {
    title: "Visual: the structure of the computation and its live data",
    purpose: "Three panels on one plane, redrawn at every epoch from the recorded trace. Click any box, line or label to focus that symbol on every face.",
    legend: [],
  },
};

function makeFaceCard(root, equation, scene) {
  // the Visual legend comes from the scene's panels, not from page text
  if (scene.panels && scene.panels.count) {
    const c = scene.panels.colors.values;
    FACE_DOCS.visual.legend = scene.panels.ids.map((id, k) => {
      const rgb = `rgb(${Math.round(c[k * 4] * 255)},${Math.round(c[k * 4 + 1] * 255)},${Math.round(c[k * 4 + 2] * 255)})`;
      return [rgb, scene.panels.titles[k], scene.panels.docs[k]];
    });
  }
  const purpose = root.querySelector("#stone-purpose");
  const title = root.querySelector("#face-card-title");
  const text = root.querySelector("#face-card-purpose");
  const legend = root.querySelector("#face-card-legend");
  const lines = root.querySelector("#face-card-lines");
  purpose.textContent = `${equation.description} This stone shows that one computation three ways; time runs along the epochs below.`;
  let shown = null;
  return function show(face) {
    if (face === shown) return;
    shown = face;
    const doc = FACE_DOCS[face];
    if (!doc) return;
    title.textContent = doc.title;
    text.textContent = doc.purpose;
    legend.replaceChildren(...doc.legend.map(([color, name, what]) => {
      const li = document.createElement("li");
      const swatch = document.createElement("span");
      swatch.className = "swatch";
      swatch.style.background = color;
      const b = document.createElement("b");
      b.textContent = `${name}: `;
      li.append(swatch, b, what);
      return li;
    }));
    legend.hidden = doc.legend.length === 0;
    // the lines of a text face, each with its doc from the record
    const f = equation.faces[face];
    if (f && f.line_docs) {
      const texts = f.text.split("\n");
      lines.replaceChildren(...texts.map((t, i) => {
        const li = document.createElement("li");
        const b = document.createElement("b");
        b.textContent = t;
        li.append(b, f.line_docs[i] || "");
        return li;
      }));
      lines.hidden = false;
    } else {
      lines.replaceChildren();
      lines.hidden = true;
    }
  };
}

// ------------------------------------------------------------------ focus

// One symbol id is focused at a time. Every element carrying data-id, on any
// face or in the readout, is both a target and a highlight; focus knows only
// ids. The caption names the symbol from the equation record and shows its
// value at the current epoch when the trace has one.
// The value a symbol has at an epoch, as text: a channel row, a constant,
// or nothing for an operator.
function valueText(trace, id, epoch) {
  const ch = trace.channels[id];
  if (Array.isArray(ch)) return fmt(ch[epoch]);
  if (ch && ch.values) {
    const w = ch.shape[1];
    return ch.values.slice(epoch * w, (epoch + 1) * w).map(fmt).join("  ");
  }
  if (id in trace.constants) {
    const c = trace.constants[id];
    return Array.isArray(c) ? c.map(fmt).join("  ") : fmt(c);
  }
  return "";
}

function makeFocus(caption, clearButton, trace, equation) {
  let current = null;
  let epoch = 0;

  function describe(id) {
    const k = equation.symbols.ids.indexOf(id);
    const name = k < 0 ? id : equation.symbols.names[k];
    const role = k < 0 ? "" : equation.symbols.roles[k];
    const glyph = labelFor(equation, id);
    let value = "";
    const ch = trace.channels[id];
    if (Array.isArray(ch)) value = fmt(ch[epoch]);
    else if (ch && ch.values) {
      const w = ch.shape[1];
      value = ch.values.slice(epoch * w, (epoch + 1) * w).map(fmt).join("  ");
    } else if (id in trace.constants) {
      const c = trace.constants[id];
      value = Array.isArray(c) ? c.map(fmt).join("  ") : fmt(c);
    }
    caption.replaceChildren();
    const b = document.createElement("b");
    b.textContent = glyph;
    caption.append(b, ` ${name}`);
    if (role) caption.append(` (${role})`);
    if (value) {
      const span = document.createElement("span");
      span.className = "val";
      span.textContent = value;
      caption.append(id in trace.constants ? " · constant: " : ` · at ${trace.axis.name} ${epoch}: `, span);
    } else {
      caption.append(" · an operator: no value of its own");
    }
  }

  function apply(id) {
    current = id;
    for (const el of document.querySelectorAll("[data-id]")) {
      el.classList.toggle("focus", el.dataset.id === id);
    }
    document.body.classList.toggle("has-focus", id !== null);
    clearButton.hidden = id === null;
    if (id === null) caption.textContent = "Click any symbol on any face, or in the readout, to focus it everywhere. Esc clears.";
    else describe(id);
  }

  document.addEventListener("click", (e) => {
    const el = e.target.closest("[data-id]");
    if (!el) return;
    apply(el.dataset.id === current ? null : el.dataset.id);
  });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") apply(null); });
  clearButton.addEventListener("click", () => apply(null));

  return {
    set: apply,
    epoch(t) { epoch = t; if (current !== null) describe(current); },
  };
}

// --------------------------------------------------------------- callouts

// What the page's own parts are for. Page vocabulary; the symbols' and the
// Visual panels' docs come from the records instead.
const CHROME_DOCS = {
  "face-math": ["The Math face", "The equation as written on paper. Every symbol is a token you can click to focus or rest on to read about."],
  "face-m": ["The M face", "The same equation in the proposed array notation, rendered from the same record. Nothing runs it; the glyphs are placeholders."],
  "face-visual": ["The Visual face", "The structure of the computation and its live data, redrawn at every epoch from the recorded trace."],
  "minimap": ["Where you are", "The stone seen from above, with you below it. The lit edge is the face toward you."],
  "back": ["Back", "Leave read mode and return to the stone at the view you had."],
  "rotate": ["Rotate", "Show me this differently: the stone turns and each face is one representation. Drag the stone, press a button, or use the r key."],
  "turn-math": ["Turn to Math", "Bring the Math face toward you (key 1)."],
  "turn-m": ["Turn to M", "Bring the M face toward you (key 2)."],
  "turn-visual": ["Turn to Visual", "Bring the Visual face toward you (key 3)."],
  "spin": ["Auto-rotate", "Let the stone turn on its own; dragging or turning to a face stops it (key a)."],
  "view": ["View", "Magnify without changing meaning: read a face flat, scale the stone, or reset."],
  "read": ["Read this face", "The face toward you comes flat and enlarged, never cropped, still live (Enter, or double-click a face). Esc returns."],
  "scale": ["View scale", "Grow or shrink the stone (key s, then move the mouse). Not the plan's Zoom, which would change abstraction level."],
  "reset": ["Reset view", "Put the stone back: default angle, size and position, auto-rotating (Home or 0)."],
  "travel": ["Travel", "Show me this at another time: every number on the page is replayed from the recorded trace at the chosen epoch."],
  "play": ["Play / Pause", "Step through the epochs on their own (Space)."],
  "epoch": ["Epoch", "One full pass of gradient descent over the data. Epoch 0 is the untrained state; the last epoch is the trained one."],
  "scrubber": ["Scrubber", "Drag to any epoch; the Visual face, the readout and the focused value follow (key t, then move the mouse; arrows step one)."],
  "readout": ["Readout", "Every value the trace recorded at this epoch, labelled with the Math face's spelling. Click a row to focus that symbol."],
  "focus": ["Focus", "What am I looking at: click a symbol on any face and the same symbol lights up on every face, with its value here."],
  "keys": ["Keys", "Blender's grammar: press a key to arm a mode, move the mouse, click or Enter to confirm, Esc to cancel."],
  "hints": ["Hints", "Turn these callouts off or on."],
  "help": ["Help", "The full list of keys."],
};

function makeCallouts({ root, equation, trace, scene, valueAt, hintsButton }) {
  const NS = "http://www.w3.org/2000/svg";
  const leaders = root.querySelector(".callout-leader");
  let timer = null;
  let enabled = true;
  let shown = [];          // {el, box, g} currently on screen
  let mode = null;         // "single" | "near"
  let lastPoint = null;

  // ---- docs
  const lineDoc = (el, index) => {
    const section = el.closest("[data-face]");
    const face = section && equation.faces[section.dataset.face];
    if (!face || !face.line_docs) return null;
    const texts = face.text.split("\n");
    return { text: texts[index] || "", doc: face.line_docs[index] || "" };
  };
  const symbolDoc = (el, id) => {
    const k = equation.symbols.ids.indexOf(id);
    if (k < 0) return null;
    const textEl = el.closest && el.closest("text[data-line]");
    const line = textEl ? lineDoc(el, Number(textEl.dataset.line)) : null;
    const where = line && line.doc ? ` · line ${Number(textEl.dataset.line) + 1}: ${line.doc}` : "";
    return { title: `${labelFor(equation, id)}  ${equation.symbols.names[k]}`, body: equation.symbols.docs[k] || "", extra: `${equation.symbols.roles[k]} · ${valueAt(id)}${where}` };
  };
  const lineCallout = (el) => {
    const line = lineDoc(el, Number(el.dataset.line));
    if (!line) return null;
    return { title: line.text, body: line.doc || "", extra: `line ${Number(el.dataset.line) + 1}` };
  };
  const panelDoc = (id) => {
    const k = scene.panels ? scene.panels.ids.indexOf(id) : -1;
    if (k < 0) return null;
    return { title: scene.panels.titles[k], body: scene.panels.docs[k], extra: "" };
  };
  const chromeDoc = (key) => (CHROME_DOCS[key] ? { title: CHROME_DOCS[key][0], body: CHROME_DOCS[key][1], extra: "" } : null);
  function docFor(el) {
    if (el.dataset.id) return symbolDoc(el, el.dataset.id);
    if (el.dataset.line !== undefined) return lineCallout(el);
    if (el.dataset.panel) return panelDoc(el.dataset.panel);
    if (el.dataset.doc) return chromeDoc(el.dataset.doc);
    return null;
  }

  // ---- anchors. Client rects of SVG children inside a 3D-rotated face come
  // back mirrored in Chrome, so every SVG anchor is computed from the SVG
  // root's rect (which is right) and the element's extent in viewBox units.
  function svgToClient(svg, b) {
    const sr = svg.getBoundingClientRect();
    const vb = svg.viewBox.baseVal;
    const k = Math.min(sr.width / vb.width, sr.height / vb.height);
    const ox = sr.left + (sr.width - vb.width * k) / 2 - vb.x * k;
    const oy = sr.top + (sr.height - vb.height * k) / 2 - vb.y * k;
    const left = ox + b.x * k, top = oy + b.y * k, width = b.width * k, height = b.height * k;
    return { left, top, width, height, right: left + width, bottom: top + height };
  }
  // a tspan's extent: the union of its characters' extents within its text
  function tspanBox(tspan) {
    const text = tspan.closest("text");
    let start = 0;
    for (const node of text.childNodes) {
      if (node === tspan) break;
      start += node.textContent.length;
    }
    const n = tspan.textContent.length;
    let box = null;
    for (let i = start; i < start + n && i < text.getNumberOfChars(); i++) {
      const e = text.getExtentOfChar(i);
      if (!box) box = { x: e.x, y: e.y, right: e.x + e.width, bottom: e.y + e.height };
      else { box.x = Math.min(box.x, e.x); box.y = Math.min(box.y, e.y); box.right = Math.max(box.right, e.x + e.width); box.bottom = Math.max(box.bottom, e.y + e.height); }
    }
    return box ? { x: box.x, y: box.y, width: box.right - box.x, height: box.bottom - box.y } : text.getBBox();
  }
  function anchorRect(el, point) {
    if (point) return { left: point[0], top: point[1], width: 0, height: 0, right: point[0], bottom: point[1] };
    const svg = el.ownerSVGElement;
    if (svg && svg.viewBox && svg.viewBox.baseVal.width) {
      if (el.tagName === "tspan") return svgToClient(svg, tspanBox(el));
      if (el.getBBox) return svgToClient(svg, el.getBBox());
    }
    return el.getBoundingClientRect();
  }

  // ---- drawing
  function makeBox(doc, cls) {
    const box = document.createElement("div");
    box.className = `callout-box ${cls}`;
    const b = document.createElement("b"); b.textContent = doc.title;
    const span = document.createElement("span"); span.textContent = doc.body;
    const small = document.createElement("small"); small.textContent = doc.extra;
    box.append(b, span, small);
    root.appendChild(box);
    return box;
  }
  function makeLeader(cls) {
    const g = document.createElementNS(NS, "g");
    g.setAttribute("class", cls);
    g.appendChild(document.createElementNS(NS, "line"));
    g.appendChild(document.createElementNS(NS, "path"));
    leaders.appendChild(g);
    return g;
  }
  function drawLeader(g, box, r) {
    const bx = parseFloat(box.style.left), by = parseFloat(box.style.top);
    const bw = box.offsetWidth, bh = box.offsetHeight;
    const tx = r.left + r.width / 2, ty = r.top + r.height / 2;
    // leave the box from the edge nearest the anchor
    const cx = Math.max(bx + 10, Math.min(bx + bw - 10, tx));
    const above = by + bh <= ty;
    const ay = above ? by + bh : (by >= ty ? by : by + bh / 2);
    const ax = (above || by >= ty) ? cx : (tx < bx ? bx : bx + bw);
    const ey = above ? r.top - 2 : (by >= ty ? r.bottom + 2 : ty);
    const ex = (above || by >= ty) ? tx : (tx < bx ? r.right + 2 : r.left - 2);
    const line = g.querySelector("line"), head = g.querySelector("path");
    line.setAttribute("x1", ax); line.setAttribute("y1", ay); line.setAttribute("x2", ex); line.setAttribute("y2", ey);
    const dx = ex - ax, dy = ey - ay, len = Math.hypot(dx, dy) || 1;
    const ux = dx / len, uy = dy / len;
    head.setAttribute("d", `M${ex},${ey} L${ex - 8 * ux + 4 * uy},${ey - 8 * uy - 4 * ux} L${ex - 8 * ux - 4 * uy},${ey - 8 * uy + 4 * ux} Z`);
  }
  function clear() {
    for (const s of shown) { s.box.remove(); s.g.remove(); }
    shown = [];
    root.hidden = true;
  }

  // one callout above (or below) its anchor, clamped to the viewport
  function placeSingle(box, r) {
    const vw = window.innerWidth, vh = window.innerHeight, gap = 14;
    const bw = box.offsetWidth, bh = box.offsetHeight;
    let above = r.top - gap - bh >= 8;
    let top = above ? r.top - gap - bh : r.bottom + gap;
    if (!above && top + bh > vh - 8) top = Math.max(8, r.top - gap - bh);
    let left = Math.max(8, Math.min(vw - bw - 8, r.left + r.width / 2 - bw / 2));
    box.style.left = `${left}px`; box.style.top = `${top}px`;
  }

  function showSingle(el, point) {
    const doc = docFor(el);
    if (!doc) return;
    clear();
    mode = "single"; lastPoint = point;
    root.hidden = false;
    const box = makeBox(doc, "near");
    const g = makeLeader("near");
    const r = anchorRect(el, point);
    placeSingle(box, r);
    drawLeader(g, box, r);
    shown = [{ el, box, g, point }];
  }

  // ---- proximity: everything within reach of the pointer, fanned out
  const RADIUS = 90, MAX = 6;
  function candidates(face) {
    const out = [];
    const seen = new Set();
    for (const el of face.querySelectorAll("tspan[data-id], text[data-line], .labels text[data-id], .edges line[data-id], .panel-hit")) {
      // one entry per symbol id on the Visual face: a label beats an edge, the nearest edge stands for the rest
      const key = el.tagName === "line" || (el.tagName === "text" && el.dataset.id) ? `id:${el.dataset.id}` : el.tagName === "rect" ? `panel:${el.dataset.panel}` : null;
      out.push({ el, key, label: el.tagName === "text" && !!el.dataset.id });
    }
    return out;
  }
  const distance = (r, p) => {
    const dx = Math.max(r.left - p[0], 0, p[0] - r.right);
    const dy = Math.max(r.top - p[1], 0, p[1] - r.bottom);
    return Math.hypot(dx, dy);
  };
  function showNear(face, point) {
    const found = [];
    const best = new Map();
    for (const c of candidates(face)) {
      const r = anchorRect(c.el, null);
      const d = distance(r, point);
      if (d > RADIUS) continue;
      const doc = docFor(c.el);
      if (!doc) continue;
      if (c.key) {
        const prev = best.get(c.key);
        if (prev && (prev.label || (!c.label && prev.d <= d))) continue;
        best.set(c.key, { el: c.el, r, d, doc, label: c.label });
        continue;
      }
      found.push({ el: c.el, r, d, doc });
    }
    for (const v of best.values()) found.push(v);
    found.sort((a, b) => a.d - b.d);
    const pick = found.slice(0, MAX);
    clear();
    if (!pick.length) return;
    mode = "near"; lastPoint = point;
    root.hidden = false;
    // Layout: the row under the pointer (the union of the anchors) is kept
    // clear; boxes go in tiers above and below it, alternating sides, ordered
    // left to right by their anchor so leaders do not cross, and a tier that
    // runs off the viewport starts another further out.
    const vw = window.innerWidth, vh = window.innerHeight;
    const keep = { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity };
    for (const c of pick) { keep.left = Math.min(keep.left, c.r.left); keep.top = Math.min(keep.top, c.r.top); keep.right = Math.max(keep.right, c.r.right); keep.bottom = Math.max(keep.bottom, c.r.bottom); }
    keep.top = Math.min(keep.top, point[1]) - 12; keep.bottom = Math.max(keep.bottom, point[1]) + 12;
    const items = pick.map((c, i) => {
      const cls = i === 0 ? "near" : "far";
      const box = makeBox(c.doc, cls);
      const g = makeLeader(cls);
      return { c, box, g, side: i % 2 === 0 ? -1 : 1, bw: box.offsetWidth, bh: box.offsetHeight };
    });
    // if one side has no room, everything goes to the other
    const roomAbove = keep.top - 8 - 40 > 8, roomBelow = keep.bottom + 8 + 40 < vh - 8;
    for (const it of items) { if (it.side < 0 && !roomAbove) it.side = 1; if (it.side > 0 && !roomBelow) it.side = -1; }
    for (const side of [-1, 1]) {
      const group = items.filter((it) => it.side === side).sort((a, b) => (a.c.r.left + a.c.r.width / 2) - (b.c.r.left + b.c.r.width / 2));
      let edge = side < 0 ? keep.top - 16 : keep.bottom + 16;   // the tier's near edge
      let cursor = -Infinity, tierDepth = 0;
      for (const it of group) {
        let left = Math.max(8, it.c.r.left + it.c.r.width / 2 - it.bw / 2);
        if (left < cursor + 8) left = cursor + 8;
        if (left + it.bw > vw - 8) {
          // next tier, further from the row
          edge = side < 0 ? edge - tierDepth - 8 : edge + tierDepth + 8;
          cursor = -Infinity; tierDepth = 0;
          left = Math.max(8, Math.min(vw - it.bw - 8, it.c.r.left + it.c.r.width / 2 - it.bw / 2));
        }
        const top = side < 0 ? edge - it.bh : edge;
        it.box.style.left = `${left}px`; it.box.style.top = `${Math.max(8, Math.min(vh - it.bh - 8, top))}px`;
        cursor = left + it.bw; tierDepth = Math.max(tierDepth, it.bh);
        drawLeader(it.g, it.box, it.c.r);
        shown.push({ el: it.c.el, box: it.box, g: it.g });
      }
    }
  }

  const targetOf = (e) => e.target.closest && e.target.closest("[data-id], [data-line], [data-panel], [data-doc]");
  const faceOf = (e) => e.target.closest && e.target.closest(".face");
  const inFaceBody = (e) => { const f = faceOf(e); return f && !e.target.closest("h2") ? f : null; };

  let lastFace = null;
  document.addEventListener("pointermove", (e) => {
    if (!enabled || e.pointerType === "touch") return;
    const face = inFaceBody(e);
    if (face) {
      lastFace = face;
      clearTimeout(timer);
      const point = [e.clientX, e.clientY];
      timer = setTimeout(() => showNear(face, point), mode === "near" ? 40 : 180);
      return;
    }
    if (mode === "near") { clear(); mode = null; }
    const el = targetOf(e);
    if (!el) { if (mode === "single") { clear(); mode = null; } return; }
    if (shown[0] && shown[0].el === el) { const point = [e.clientX, e.clientY]; lastPoint = point; const r = anchorRect(el, point); placeSingle(shown[0].box, r); drawLeader(shown[0].g, shown[0].box, r); return; }
    clearTimeout(timer);
    const point = [e.clientX, e.clientY];
    timer = setTimeout(() => showSingle(el, point), 200);
  });
  document.addEventListener("pointerleave", () => { clearTimeout(timer); clear(); mode = null; });
  document.addEventListener("pointerdown", (e) => {
    if (e.pointerType !== "touch" || !enabled) return;
    const face = inFaceBody(e);
    if (face) showNear(face, [e.clientX, e.clientY]);
    else { const el = targetOf(e); if (el) showSingle(el, null); }
  });
  document.addEventListener("focusin", (e) => { if (enabled) { const el = targetOf(e); if (el) showSingle(el, null); } });
  document.addEventListener("focusout", () => { if (mode === "single") { clear(); mode = null; } });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") { clearTimeout(timer); clear(); mode = null; } });
  const relayout = () => { if (mode === "near" && lastFace && lastPoint) showNear(lastFace, lastPoint); else if (mode === "single" && shown[0]) showSingle(shown[0].el, shown[0].point); };
  document.addEventListener("scroll", relayout, true);
  window.addEventListener("resize", relayout);

  hintsButton.addEventListener("click", () => {
    enabled = !enabled;
    hintsButton.setAttribute("aria-pressed", String(enabled));
    document.body.classList.toggle("no-hints", !enabled);
    if (!enabled) { clearTimeout(timer); clear(); mode = null; }
  });

  return {
    refresh: relayout,
    showFor(selector) { const el = document.querySelector(selector); if (el) showSingle(el, null); },
    // for stills: proximity mode at the centre of an element, preferring the face being read
    showNearFor(id) {
      const scope = document.querySelector(".face.reading-face") || document;
      const el = scope.querySelector(`[data-id="${id}"], [data-panel="${id}"]`);
      const face = el && el.closest(".face");
      if (!face) return;
      const r = anchorRect(el, null);
      showNear(face, [r.left + r.width / 2, r.top + r.height / 2]);
    },
  };
}

// ------------------------------------------------------------- modal keys

// Blender's grammar: a key arms a mode, the mouse acts, a click or Enter
// confirms, Escape cancels and restores. Nothing here knows what the faces
// show; it moves the stone, the time and the focus through their APIs.
function makeModes({ stone, time, focus, legend, help }) {
  const MODES = {
    grab: "Grab: move the mouse to move the stone",
    rotate: "Rotate: left and right turns, up and down tilts",
    scale: "Scale: mouse up grows the view, down shrinks it",
    travel: "Travel: left and right scrubs the epoch, ← → step one",
    focus: "Focus: click a symbol on any face; f again or Esc clears",
  };
  const IDLE = [["g", "grab"], ["r", "rotate"], ["s", "scale"], ["t", "travel"], ["f", "focus"], ["1 2 3", "faces"], ["Enter", "read"], ["Space", "play"], ["a", "spin"], ["Home", "reset"], ["?", "help"]];
  let mode = null;
  let origin = null;   // mouse position when the mode was armed
  let before = null;   // what to restore on cancel

  function showLegend() {
    legend.classList.toggle("active", mode !== null);
    if (mode) { legend.textContent = MODES[mode] + " · click or Enter confirms · Esc cancels"; return; }
    legend.replaceChildren(...IDLE.flatMap(([k, what], i) => {
      const kbd = document.createElement("kbd");
      kbd.textContent = k;
      return [...(i ? [" · "] : []), kbd, ` ${what}`];
    }));
  }
  function arm(next, e) {
    if (mode === next) { if (next === "focus") focus.set(null); return disarm(); }
    mode = next;
    origin = e ? [e.clientX ?? 0, e.clientY ?? 0] : null;
    before = { view: stone.snapshot(), epoch: time.epoch };
    if (mode === "rotate" || mode === "grab" || mode === "scale") stone.set({ spinning: false });
    document.body.dataset.mode = mode;
    showLegend();
  }
  function disarm() {
    mode = null; origin = null; before = null;
    delete document.body.dataset.mode;
    showLegend();
  }
  function cancel() {
    if (!mode) return false;
    if (before) { stone.set(before.view); time.set(before.epoch); }
    disarm();
    return true;
  }

  document.addEventListener("mousemove", (e) => {
    if (!mode || stone.reading) return;
    if (!origin) { origin = [e.clientX, e.clientY]; return; }
    const dx = e.clientX - origin[0], dy = e.clientY - origin[1];
    const v = before.view;
    if (mode === "grab") stone.set({ pan: [v.pan[0] + dx, v.pan[1] + dy] });
    else if (mode === "rotate") stone.set({ yaw: v.yaw + dx * 0.45, pitch: v.pitch - dy * 0.15 });
    else if (mode === "scale") stone.set({ scale: v.scale * Math.exp(-dy / 250) });
    else if (mode === "travel") time.set(before.epoch + Math.round(dx / 24));
  });
  // a click confirms every mode but focus, where the click is the pick itself
  document.addEventListener("click", (e) => {
    if (!mode) return;
    if (mode === "focus") { if (e.target.closest("[data-id]")) disarm(); return; }
    if (e.target.closest("button, input, a")) return;
    e.stopPropagation();
    disarm();
  }, true);

  const typing = (e) => e.target.closest("input, textarea, select, [contenteditable]");
  document.addEventListener("keydown", (e) => {
    if (typing(e)) return;
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const k = e.key;
    if (k === "Escape") {
      if (!help.hidden) { help.hidden = true; return; }
      if (cancel()) { e.stopImmediatePropagation(); return; }
      return; // read mode and focus handle their own Escape
    }
    if (k === "?") { help.hidden = !help.hidden; e.preventDefault(); return; }
    if (!help.hidden) return;
    if (k === "Enter") {
      if (mode) { disarm(); e.preventDefault(); return; }
      if (e.target.closest("button, a")) return;
      if (stone.reading) stone.endRead(); else stone.read(stone.front());
      e.preventDefault(); return;
    }
    if (k === " ") { if (e.target.closest("button")) return; time.toggle(); e.preventDefault(); return; }
    if (k === "ArrowLeft" || k === "ArrowRight") {
      if (e.target.closest("input")) return;
      time.set(time.epoch + (k === "ArrowRight" ? 1 : -1)); e.preventDefault(); return;
    }
    const lower = k.toLowerCase();
    if (lower === "g" || lower === "r" || lower === "s" || lower === "t" || lower === "f") {
      if (stone.reading && lower !== "f" && lower !== "t") return;
      arm({ g: "grab", r: "rotate", s: "scale", t: "travel", f: "focus" }[lower]);
      e.preventDefault(); return;
    }
    if (lower === "a") { stone.setSpinning(!stone.spinning); return; }
    if (k === "1" || k === "2" || k === "3") {
      const face = ["math", "m", "visual"][Number(k) - 1];
      stone.endRead(); stone.turnTo(face); return;
    }
    if (k === "Home" || k === "0") { cancel(); stone.reset(); e.preventDefault(); return; }
  });

  showLegend();
  return { get mode() { return mode; }, cancel };
}

// ------------------------------------------------------------------- boot

async function load(url, asText) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: ${res.status}`);
  return asText ? res.text() : res.json();
}

async function main() {
  const [trace, scene, equation, mathSvg, mSvg] = await Promise.all([
    load(DATA.trace), load(DATA.scene), load(DATA.equation),
    load(DATA.faces.math, true), load(DATA.faces.m, true),
  ]);

  // text faces: inline the renderer's SVG so every token tspan is a DOM node
  document.getElementById("face-math").innerHTML = mathSvg;
  document.getElementById("face-m").innerHTML = mSvg;

  const stage = document.getElementById("stage");
  const spin = document.getElementById("spin");
  const back = document.getElementById("back");
  const scaleOut = document.getElementById("scale-out");
  const turnButtons = [...document.querySelectorAll("[data-turn]")];
  const minimapLines = [...document.querySelectorAll("#minimap line")];
  const minimapPrism = document.getElementById("minimap-prism");
  const geometry = makeGeometry(FACE_WIDTHS);
  // the minimap is the real cross-section, incenter at the origin, viewer below (+z down)
  {
    const reach = Math.max(...Object.values(geometry.faces).map((g) => Math.hypot(g.from[0], g.from[1])));
    const k = 27 / reach;
    const pts = [];
    for (const line of minimapLines) {
      const g = geometry.faces[line.dataset.face];
      if (!g) continue;
      line.setAttribute("x1", (g.from[0] * k).toFixed(1)); line.setAttribute("y1", (g.from[1] * k).toFixed(1));
      line.setAttribute("x2", (g.to[0] * k).toFixed(1)); line.setAttribute("y2", (g.to[1] * k).toFixed(1));
      pts.push(`${(g.from[0] * k).toFixed(1)},${(g.from[1] * k).toFixed(1)}`);
    }
    minimapPrism.querySelector("polygon").setAttribute("points", pts.join(" "));
  }
  titleFaces(equation);
  const faceCard = makeFaceCard(document.getElementById("face-card"), equation, scene);
  // orientation cues follow the view: the front face's button and minimap edge light up
  const stone = makeStone(stage, document.getElementById("stone"), geometry, (v) => {
    faceCard(v.reading || v.front);
    for (const b of turnButtons) b.setAttribute("aria-pressed", String(b.dataset.turn === v.front));
    for (const l of minimapLines) l.classList.toggle("front", l.dataset.face === v.front);
    minimapPrism.setAttribute("transform", `rotate(${-v.yaw})`);
    spin.setAttribute("aria-pressed", String(v.spinning));
    scaleOut.value = `${Math.round(v.scale * 100)}%`;
    back.hidden = !v.reading;
  });
  const projector = makeProjector(document.getElementById("face-visual"), scene);
  const show = makeReadout(document.getElementById("readout"), trace, equation);
  const focus = makeFocus(document.getElementById("focus-caption"), document.getElementById("unfocus"), trace, equation);
  let epochNow = 0;
  const callouts = makeCallouts({
    root: document.getElementById("callout"), equation, trace, scene,
    valueAt: (id) => {
      const v = valueText(trace, id, epochNow);
      return v ? `at ${trace.axis.name} ${epochNow}: ${v}` : "an operator, no value of its own";
    },
    hintsButton: document.getElementById("hints"),
  });

  const range = document.getElementById("epoch");
  const out = document.getElementById("epoch-out");
  const play = document.getElementById("play");
  const T = Math.min(trace.axis.count, projector.count);
  range.max = String(T - 1);

  let t = 0;
  function setEpoch(next) {
    t = ((next % T) + T) % T;
    range.value = String(t);
    out.value = String(t);
    projector.frame(t);
    show(t);
    focus.epoch(t);
    epochNow = t;
    callouts.refresh();
  }
  range.addEventListener("input", () => setEpoch(Number(range.value)));

  let playing = false;
  let timer = null;
  function setPlaying(on) {
    playing = on;
    play.setAttribute("aria-pressed", String(on));
    play.textContent = on ? "Pause" : "Play";
    if (timer) { clearInterval(timer); timer = null; }
    if (on) timer = setInterval(() => setEpoch(t + 1), 400);
  }
  play.addEventListener("click", () => setPlaying(!playing));
  const time = { get epoch() { return t; }, set: setEpoch, toggle: () => setPlaying(!playing) };

  spin.addEventListener("click", () => stone.setSpinning(!stone.spinning));
  for (const button of turnButtons) {
    button.addEventListener("click", () => { stone.endRead(); stone.turnTo(button.dataset.turn); });
  }

  // view: read mode, view scale, reset
  document.getElementById("read").addEventListener("click", () => stone.read(stone.front()));
  document.getElementById("scale-down").addEventListener("click", () => stone.scaleBy(-1));
  document.getElementById("scale-up").addEventListener("click", () => stone.scaleBy(1));
  document.getElementById("reset-view").addEventListener("click", () => stone.reset());
  back.addEventListener("click", () => stone.endRead());
  for (const face of document.querySelectorAll(".face")) {
    face.addEventListener("dblclick", (e) => { e.preventDefault(); stone.read(face.dataset.face); });
  }
  stage.addEventListener("click", (e) => { if (stone.reading && e.target === stage) stone.endRead(); });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && stone.reading) { stone.endRead(); e.stopImmediatePropagation(); }
  }, true);
  window.addEventListener("resize", () => { if (stone.reading) stone.read(stone.reading); });

  const help = document.getElementById("help");
  document.getElementById("help-button").addEventListener("click", () => { help.hidden = false; });
  document.getElementById("help-close").addEventListener("click", () => { help.hidden = true; });
  help.addEventListener("click", (e) => { if (e.target === help) help.hidden = true; });
  makeModes({ stone, time, focus, legend: document.getElementById("key-legend"), help });
  if (showHelp) help.hidden = false;

  fetch("data/build-info.json").then((r) => (r.ok ? r.json() : null)).then((b) => {
    if (!b) return;
    document.getElementById("build-info").textContent = `built on ${b.host} at ${b.sha}, ${b.timestamp}`;
  }).catch(() => {});

  setEpoch(fixedEpoch ?? 0);
  if (initialFocus) focus.set(initialFocus);
  // for stills: after read mode and the layout have settled
  const nearParam = params.get("near");
  if (nearParam) setTimeout(() => callouts.showNearFor(nearParam), 900);
  if (initialHover) setTimeout(() => callouts.showFor(`[data-id="${initialHover}"], [data-panel="${initialHover}"], [data-doc="${initialHover}"], ${/^line\d$/.test(initialHover) ? `.face[data-face="math"] text[data-line="${initialHover.slice(4)}"]` : "#none"}`), 700);
  if (initialRead) stone.read(initialRead);
  if (!reducedMotion && fixedEpoch === null) setPlaying(true);
}

main().catch((err) => {
  const p = document.createElement("p");
  p.className = "note";
  p.textContent = `Could not load the stone's data (${err.message}). Serve this directory over HTTP: just serve-site.`;
  document.querySelector("main").prepend(p);
  console.error(err);
});
