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

// ---------------------------------------------------------------- the stone

function makeStone(stage, stone) {
  const FACE_ANGLE = { math: 0, m: -120, visual: -240 };
  let yaw = fixedYaw ?? -20;
  let spinning = !reducedMotion && fixedYaw === null;
  let dragging = null;
  let last = performance.now();
  const SPEED = 9; // degrees per second

  function apply() {
    stone.style.setProperty("--yaw", `${yaw}deg`);
  }
  function tick(now) {
    if (spinning && !dragging) yaw += (SPEED * (now - last)) / 1000;
    last = now;
    apply();
    requestAnimationFrame(tick);
  }
  stage.addEventListener("pointerdown", (e) => {
    dragging = { x: e.clientX, yaw };
    stage.classList.add("dragging");
    stage.setPointerCapture(e.pointerId);
  });
  stage.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    yaw = dragging.yaw + (e.clientX - dragging.x) * 0.45;
    if (Math.abs(e.clientX - dragging.x) > 4) dragging.moved = true;
    apply();
  });
  const release = () => {
    if (dragging && dragging.moved) stage.dataset.suppressClick = "1";
    dragging = null;
    stage.classList.remove("dragging");
  };
  // a click that ends a drag is not a focus request
  stage.addEventListener("click", (e) => {
    if (stage.dataset.suppressClick) { delete stage.dataset.suppressClick; e.stopPropagation(); }
  }, true);
  stage.addEventListener("pointerup", release);
  stage.addEventListener("pointercancel", release);

  requestAnimationFrame(tick);
  return {
    turnTo(face) {
      spinning = false;
      // shortest way round to the face's angle
      const target = FACE_ANGLE[face];
      const delta = ((target - yaw) % 360 + 540) % 360 - 180;
      yaw += delta;
      apply();
    },
    setSpinning(on) { spinning = on; },
    get spinning() { return spinning; },
  };
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

  const stone = makeStone(document.getElementById("stage"), document.getElementById("stone"));
  const projector = makeProjector(document.getElementById("face-visual"), scene);
  const show = makeReadout(document.getElementById("readout"), trace, equation);
  const focus = makeFocus(document.getElementById("focus-caption"), document.getElementById("unfocus"), trace, equation);

  const range = document.getElementById("epoch");
  const out = document.getElementById("epoch-out");
  const play = document.getElementById("play");
  const spin = document.getElementById("spin");
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

  spin.addEventListener("click", () => {
    stone.setSpinning(!stone.spinning);
    spin.setAttribute("aria-pressed", String(stone.spinning));
  });
  spin.setAttribute("aria-pressed", String(stone.spinning));
  for (const button of document.querySelectorAll("[data-turn]")) {
    button.addEventListener("click", () => {
      stone.turnTo(button.dataset.turn);
      spin.setAttribute("aria-pressed", "false");
    });
  }

  setEpoch(fixedEpoch ?? 0);
  if (initialFocus) focus.set(initialFocus);
  if (!reducedMotion && fixedEpoch === null) setPlaying(true);
}

main().catch((err) => {
  const p = document.createElement("p");
  p.className = "note";
  p.textContent = `Could not load the stone's data (${err.message}). Serve this directory over HTTP: just serve-site.`;
  document.querySelector("main").prepend(p);
  console.error(err);
});
