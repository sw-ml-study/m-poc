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

// ---------------------------------------------------------------- the stone

function makeStone(stage, stone, onChange) {
  const FACE_ANGLE = { math: 0, m: -120, visual: -240 };
  const FACES = Object.keys(FACE_ANGLE);
  const DEFAULT = { yaw: -20, pitch: -4, scale: 1 };
  const SPEED = 9; // degrees per second
  const SCALES = [0.5, 0.65, 0.8, 1, 1.25, 1.6, 2, 2.5];
  let yaw = fixedYaw ?? DEFAULT.yaw;
  let pitch = DEFAULT.pitch;
  let scale = initialScale ?? DEFAULT.scale;
  let spinning = !reducedMotion && fixedYaw === null;
  let dragging = null;
  let reading = null;      // the face being read, or null
  let before = null;       // the view to restore when reading ends
  let last = performance.now();

  function apply() {
    stone.style.setProperty("--yaw", `${yaw}deg`);
    stone.style.setProperty("--pitch", `${pitch}deg`);
    stone.style.setProperty("--view-scale", String(scale));
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
  // the face width that fills the viewport height in read mode, width permitting;
  // read mode enlarges the layout box itself, so the stage sizes to it
  function fitWidth() {
    const width = stage.getBoundingClientRect().width - 16;
    const height = Math.max(240, window.innerHeight - 32 - 68);
    return Math.max(200, Math.min(width, height / 0.78));
  }
  stage.addEventListener("pointerdown", (e) => {
    if (reading) return;
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
        stone.style.setProperty("--face-w", `${fitWidth()}px`);
        settle(() => { turnTo(face); pitch = 0; scale = 1; });
        stage.scrollIntoView({ block: "start" });
      });
    },
    endRead() {
      if (!reading) return;
      reading = null;
      stone.style.removeProperty("--face-w");
      document.body.classList.remove("reading");
      for (const el of stone.querySelectorAll(".face")) el.classList.remove("reading-face");
      settle(() => { ({ yaw, pitch, scale, spinning } = before); });
      before = null;
    },
    reset() {
      const wasReading = reading;
      reading = null;
      stone.style.removeProperty("--face-w");
      document.body.classList.remove("reading");
      for (const el of stone.querySelectorAll(".face")) el.classList.remove("reading-face");
      settle(() => { yaw = DEFAULT.yaw; pitch = DEFAULT.pitch; scale = DEFAULT.scale; spinning = !reducedMotion; });
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
  }
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
  }
  svg.appendChild(labelGroup);

  function frame(t) {
    const base = t * n * 3;
    for (let e = 0; e < m; e++) {
      const a = base + edges[e * 2] * 3;
      const b = base + edges[e * 2 + 1] * 3;
      const line = lines[e];
      line.setAttribute("x1", px(all[a]).toFixed(1));
      line.setAttribute("y1", py(all[a + 1]).toFixed(1));
      line.setAttribute("x2", px(all[b]).toFixed(1));
      line.setAttribute("y2", py(all[b + 1]).toFixed(1));
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
    legend: [
      ["#c7ccdf", "Dataflow (left)", "the equation as boxes: values flow left to right from x, w and b through × and + to ŷ, then with y through − and ² to the loss L."],
      ["#ff9940", "Gradient paths", "the orange lines carry ∂L/∂w and ∂L/∂b back from L to w and b; η beside them is the step size."],
      ["#f2d966", "Data (middle)", "the four training points as diamonds on x and y axes."],
      ["#66d9f2", "Fitted line", "ŷ = wx + b at this epoch, with each point's residual y − ŷ in red; watch it settle onto the points."],
      ["#b894f2", "Parameters (right)", "the path (w, b) has taken so far in parameter space, and the arrow to next epoch's (w, b): its legs are −η ∂L/∂w and −η ∂L/∂b."],
    ],
  },
};

function makeFaceCard(root, equation) {
  const purpose = root.querySelector("#stone-purpose");
  const title = root.querySelector("#face-card-title");
  const text = root.querySelector("#face-card-purpose");
  const legend = root.querySelector("#face-card-legend");
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
  };
}

// ------------------------------------------------------------------ focus

// One symbol id is focused at a time. Every element carrying data-id, on any
// face or in the readout, is both a target and a highlight; focus knows only
// ids. The caption names the symbol from the equation record and shows its
// value at the current epoch when the trace has one.
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
  const faceCard = makeFaceCard(document.getElementById("face-card"), equation);
  // orientation cues follow the view: the front face's button and minimap edge light up
  const stone = makeStone(stage, document.getElementById("stone"), (v) => {
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

  setEpoch(fixedEpoch ?? 0);
  if (initialFocus) focus.set(initialFocus);
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
