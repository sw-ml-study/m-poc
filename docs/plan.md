# Rosetta M delivery plan

## Outcome

A working mock-up of **Rosetta M**: one small machine-learning computation
shown as a **4D Rosetta Stone** — a 3D stone whose faces are the
**Math**, the **proposed M code**, and the **Visual** (structure and live
data) of the same computation, with **time** (training epochs) as the fourth
dimension. Rotate the stone and the representation changes; scrub time and
the values, parameters, gradients and loss animate while the equation, the M
source and the dataflow graph stay put. Click a symbol on one face and the
same thing lights up on the others.

This repository is a deliberately small subset of
[`research.txt`](research.txt). It prototypes the *visualization* of the M
idea — the parts of the research that describe the stone, its faces, its
verbs and its time axis (sections 24, 36–37, 41–43, 53–54, 60–62) — and
nothing of the language implementation. There is no M parser, no math
parser, no lowering pass and no M evaluator here. **M code is proposed, not
run.** Where code has to execute, it is ordinary sw-MLPL.

The headline question this mock-up serves:

> Does a 3D stone with Math / M / Visual faces and an epoch scrubber make the
> "one computation, several equivalent views, across time" idea legible
> enough to be worth building the language behind it?

## What the mock-up is, in one picture

```text
                 Mathematics                       time (epochs)
                     ▲                             ──────────────▶
                    /|\                     w₀ w₁ w₂ … w₁₀₀ ; loss ↓
                   / | \
   proposed M  ◀──┼──┼──▶  Visual
  Ŷ ← B + W×X     \ | /    structure: X,W ─× ─+ ─ Ŷ ─ loss ─ L
  L ← (Y−Ŷ)*2      \|/     data: points, fitted line, gradient arrow
  W ← W − η×∇W L
                 the stone
```

The four interaction verbs from the research, and what each means here:

| Verb   | Question it answers            | In the mock-up                                                        |
|--------|--------------------------------|-----------------------------------------------------------------------|
| Rotate | show me this differently       | the stone physically turns; each face is one representation           |
| Travel | show me this at another time   | an epoch scrubber replays a recorded training trace                   |
| Focus  | what am I looking at?          | click a token on any face; the linked tokens highlight on every face  |
| Zoom   | show me what is inside         | **not in v1** (one abstraction level only); listed as a next step     |

"4D" is used the way the research finally defines it — representation ×
time, with abstraction and provenance deferred — and the stone is the
literal UI manifestation of it, as the research suggests for a landing-page
demonstration.

## The first equation: one neuron, trained

The smallest ML computation with a genuine time axis (research §37):

```text
Math                         proposed M                 what animates over epochs
ŷ = wx + b                   Ŷ ← B + W×X                ŷ for every x
L = (y − ŷ)²                 L ← (Y−Ŷ)*2                L
w ← w − η ∂L/∂w              W ← W − η×∇W L             w, b, ∂L/∂w, ∂L/∂b
```

A linear fit over four points, full-batch gradient descent, ~30 epochs. No
sigmoid in v1: it adds nothing to the visualization and one more glyph to
argue about. The proposed-M glyph vocabulary used is provisional and is
documented as such in the page and the README: `←` assignment, `×`
multiply, `*` power, `∇W` gradient with respect to `W`, `⋄` statement
separator, right-to-left evaluation. It is a mock-up of a notation, not a
language definition; the research explicitly defers glyph selection until
after the semantic inventory, and so do we.

The second equation, if the first stone works, is matrix multiplication
`C ← A +.× B` (research §61: "the first true Rosetta Stone"), where time is
the contraction index `k` rather than epochs. It proves the stone is not
one-neuron-shaped. It is the last planned step and may be cut.

## Architecture

Everything semantic is computed by **real sw-MLPL programs run by the native
`mlpl-repl`**; the page is a **static, build-free HTML/CSS/JS replay** of
what MLPL emitted. No Rust, no WASM, no bundler.

```text
  MLPL (native mlpl-repl 0.22.0, the real code)         pages/ (static, committed)
  ───────────────────────────────────────────           ────────────────────────────
  lib/rosetta/ir.mlpl
    one IR record per equation ──▶ Math text  ──▶ svg(…,"equation") ─┐
                               ──▶ M text     ──▶ svg(…,"equation") ─┤
                               ──▶ token table (ids shared by faces)  │   index.html
  demos/one-neuron/train.mlpl                                          ├─▶ rosetta.js   CSS 3D stone,
    real training loop (grad)  ──▶ trace.json (per epoch: w b ŷ L ∇) ─┤   style.css    epoch scrubber,
  demos/one-neuron/scene.mlpl                                          │                 focus highlight,
    MLPL-owned line-scene arrays ─▶ scene.json (positions/edges/ids) ──┘                 line projector
```

Rules that follow from this:

- **MLPL owns meaning; JavaScript owns pixels.** This is the
  `../demo-extensions` native3d approach carried to the browser: MLPL emits
  geometry as `positions[N,3]` / `edges[M,2]` / `colors` / `ids` arrays in
  the `sw-ml-study.native3d.line-scene` schema, and the JS is a generic
  projector that draws whatever arrays it is given. It knows nothing about
  neurons. The same JSON could feed the native viewer later.
- **The three faces come from one record.** Math text, M text and the token
  table are all rendered from the same IR record in `lib/rosetta/ir.mlpl`,
  so the faces cannot drift apart. This is the mock-up of the research's
  "one semantic IR, several surface syntaxes".
- **Numbers are real, notation is proposed.** The trace is produced by
  sw-MLPL's `grad`, not typed in. The M code is a string the IR renders.
  The page says which is which.
- **Math and M glyphs are rendered upstream.** sw-MLPL's
  `svg(text, "equation")` turns a Unicode math string into a self-contained
  SVG (stacked `∑` limits, sub/superscripts, no fonts). Both text faces use
  it; no font work in this repository.
- **Replay, don't recompute.** The page ships `trace.json` and replays it
  (research §54). A "run it yourself" link points at sw-MLPL's Live Editor
  with the training program.

## Repository layout

```text
lib/rosetta/        equation IR, Math/M renderers, token table, scene helpers   (no demo names)
demos/one-neuron/   the IR instance, training program, scene program, build script
demos/matmul/       second stone, if reached
fixtures/           emitted trace.json, scene.json, faces/*.svg (committed, reviewed)
pages/              the static site: index.html, rosetta.js, style.css + copied fixtures
tests/              mlplunit suites (test_*.mlpl) and tests/reg/ (reg-rs baselines)
scripts/            select-mlpl, select-mlplunit, run-tests, run-reg, build-site, check
docs/               this plan, research.txt, notes
```

`lib/` may not mention neurons, epochs or the demo; checked by script, as in
the sibling repositories.

## Toolchain

- the adjacent `../sw-mlpl` checkout's `target/release/mlpl-repl` (measured
  against 0.22.0), or an absolute `MLPL` override;
- `mlplunit` on `PATH`, an absolute `MLPLUNIT` override, or the adjacent
  `../../softwarewrighter/mlplunit/bin/mlplunit`;
- `reg-rs` on `PATH`, with `REG_RS_DATA_DIR=tests/reg` so baselines live in
  the repository;
- [`just`](https://github.com/casey/just);
- a browser, to look at `pages/` (`just serve-site`). Nothing else.

## Test contract

Three layers, all run by `just check`, which is the pre-commit gate:

1. **mlplunit** (`tests/test_*.mlpl`): the IR renders the expected Math and
   M strings; the token table is consistent across faces; the training loss
   is monotone non-increasing and ends below a threshold; scene arrays have
   the shapes and index bounds the schema requires; invalid inputs fail
   closed.
2. **reg-rs** (`tests/reg/`): golden baselines of what MLPL *emits* — the
   Math string, the proto-M string, the rounded `trace.json`, `scene.json`
   and the face SVGs — captured from `mlpl-repl -f …` stdout and the
   fixture files. A change to any face or to the numbers is a diff to look
   at, and `reg-rs rebase` is the deliberate act of accepting it.
3. **structure**: MLPL style (module comment, docstrings, canonical format),
   the `lib/` abstraction rule, doc links, and that `pages/` matches a fresh
   `build-site`.

There is no automated browser test in v1. The page is checked by eye; a
still and an animated WebP capture are committed under `captures/` so the
README shows the stone without a build.

## Steps

Each step ends with `just check` green, a commit to `main`, a push and an
`agentrail complete`.

| #  | Slug                 | Result                                                                                                                                                             |
|----|----------------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| 1  | scaffold             | `justfile`, `scripts/` (select-mlpl, select-mlplunit, run-tests, run-reg, check), `mlplunit.conf`, `.gitignore`, `tests/reg/`, Pages workflow, README stub; one smoke test passes through `just check` |
| 2  | equation-ir          | `lib/rosetta/ir.mlpl`: the IR record shape, `Math` and `M` text renderers, token table with shared ids; `demos/one-neuron/equation.mlpl` instantiates it; mlplunit + reg-rs baselines of both strings |
| 3  | one-neuron-trace     | `demos/one-neuron/train.mlpl`: real gradient-descent loop with `grad`, per-epoch record (w, b, ŷ, L, ∂L/∂w, ∂L/∂b), written to `fixtures/one-neuron/trace.json` with `write_atomic`; loss tests; reg-rs baseline of the rounded trace |
| 4  | faces                | `lib/rosetta/faces.mlpl` renders the Math and M faces through `svg(…,"equation")`; `demos/one-neuron/scene.mlpl` builds the Visual face as line-scene arrays (dataflow boxes; data points, fitted line and gradient arrow per epoch) into `scene.json`; schema tests; reg-rs baselines |
| 5  | stone-page           | `pages/`: CSS 3D stone (`preserve-3d`) with the three face SVGs, auto-rotation plus drag to rotate, epoch scrubber with play/pause replaying `trace.json`, generic line projector for `scene.json`; `scripts/build-site` copies fixtures; `just serve-site` |
| 6  | focus                | click a token on any face and the linked ids highlight on all faces; the Visual face highlights the matching box/edge; epoch readout shows the focused value |
| 7  | capture-and-publish  | `captures/` still + animated WebP, README with the stone, the provisional-glyph note and the run-it-yourself link, Pages deploy verified                          |
| 8  | matmul-stone         | optional: second IR instance `C ← A +.× B`, time = `k`; proves the IR and page are not one-neuron-shaped                                                          |

## Non-goals (v1)

- Parsing anything: no M lexer, no 2-D math parser, no LaTeX import.
- Lowering or running M. The M face is a rendered string.
- Zoom (abstraction levels), trace/why (provenance), compare, the Machine
  face. Named as next steps, not built.
- Native rendering. Unicode in the wgpu window is out of scope; the
  line-scene JSON keeps that door open.
- WASM / Yew / any build toolchain for the page.
- Choosing M's glyph set. The glyphs used are placeholders.
- A neural network larger than one neuron; sigmoid; Adam; tuples.

## Open decisions

- Whether the second stone (step 8) is matmul or softmax. Matmul is the
  research's pick; softmax is the research's front-page equation. Decide
  when step 7 is done and the first stone has been looked at.
- Whether the Visual face is one face (structure and data overlaid) or the
  stone gets a fourth face. Start with one; split it if it is unreadable.
