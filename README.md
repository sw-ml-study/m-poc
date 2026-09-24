# m-poc — Rosetta M

**Live demo: <https://sw-ml-study.github.io/m-poc/>** — the committed
`pages/` directory, published as is on every push to `main`. Drag the stone
to rotate it, press Play or scrub the epochs; `?yaw=DEG&epoch=T` in the URL
fixes a view for a still, `?focus=ID` (a symbol id such as `w` or
`grad_w`) starts with that symbol focused, `?read=FACE` opens a face in
read mode and `?scale=S` sets the view scale.

A mock-up of **Rosetta M**: a 4D Rosetta Stone for a proposed array language
for machine learning. One small computation — a single neuron trained by
gradient descent — is shown as a 3D stone whose faces are the **Math**, the
**proposed M code**, and the **Visual** (structure and live data) of the same
thing, with training **time** as the fourth dimension. Rotate the stone and
the representation changes; scrub epochs and the numbers animate while the
equation, the M source and the dataflow stay put.

```text
Math                         proposed M                 animates over epochs
ŷ = wx + b                   Ŷ ← B + W×X                ŷ for every x
L = (y − ŷ)²                 L ← (Y−Ŷ)*2                L
w ← w − η ∂L/∂w              W ← W − η×∇W L             w, ∂L/∂w
b ← b − η ∂L/∂b              B ← B − η×∇B L             b, ∂L/∂b
```

Both columns are rendered from one record,
[`demos/one-neuron/equation.mlpl`](demos/one-neuron/equation.mlpl), built
with the IR in [`lib/rosetta/ir.mlpl`](lib/rosetta/ir.mlpl): seventeen
symbols (each with a role and a name), and per face an ordered list of
tokens that render them. `=` on the Math face and `←` on the M face are the
same symbol; so are `²` and `*2`; and the multiplication that paper notation
leaves invisible in `wx` is carried on the Math face by U+2062 INVISIBLE
TIMES so a click on `×` has somewhere to land. `just mlpl
demos/one-neuron/show.mlpl` prints both faces and the token table as JSON.

**M code here is proposed, not run.** There is no M parser or evaluator in
this repository, and the glyphs are placeholders. Everything that executes is
[sw-MLPL](https://github.com/sw-ml-study/sw-mlpl): it renders the faces from
one equation record, trains the neuron with `grad`, and emits the trace and
geometry that the static page replays.

[`docs/plan.md`](docs/plan.md) is the delivery plan. It implements the
visualization slice of [`docs/research.txt`](docs/research.txt) and nothing
of the language.

## Build and test

There is nothing to build. The scripts select existing tools and never
install them:

- the adjacent `../sw-mlpl` checkout's `target/release/mlpl-repl` (measured
  against 0.22.0), or an absolute `MLPL` override;
- `mlplunit` on `PATH`, an absolute `MLPLUNIT` override, or the adjacent
  `../../softwarewrighter/mlplunit/bin/mlplunit`;
- `reg-rs` on `PATH`; its baselines live in [`tests/reg/`](tests/reg) and
  run from the repository root;
- [`just`](https://github.com/casey/just).

```sh
just check        # the pre-commit gate: structure, gitignore, abstraction, links, style, mlplunit, reg-rs
just tests        # the mlplunit suites under tests/
just reg -vv      # the reg-rs baselines, with full diffs on failure
just reg-rebase NAME   # accept a changed output as the new baseline (a reviewed change)
just serve-site   # the committed pages/ at http://127.0.0.1:8765/
```

## The page

[`pages/`](pages) is static: `index.html`, `style.css`, `rosetta.js` and,
under `pages/data/`, a copy of the fixtures made by `just build-site`
(`scripts/check-site` fails the gate if the copy is stale). No bundler, no
framework. The script has three parts, none of which knows what a neuron is:

- **the stone**: a CSS 3D triangular prism (`preserve-3d`) whose three
  faces are the two renderer SVGs, inlined so every token tspan is a DOM
  node, and the Visual face. Each face has its own width, sized to its
  content (the Visual face is wide, the text faces are not), so the
  cross-section is the scalene triangle with those three sides. Every side
  of a triangle is tangent to its inscribed circle, so every face sits at
  the inradius from the axis and differs only in the angle of its outward
  normal and a small in-plane offset; the script computes those from the
  widths and hands them to CSS as variables, and the minimap draws the real
  triangle. It auto-rotates, drags with the pointer, and the Rotate buttons
  turn it to a face;
- **a line projector**: draws any line-scene record (see
  [`docs/scene.md`](docs/scene.md)) into an SVG with a fixed orthographic
  camera fitted to the scene's bounding box over every frame, one `<line>`
  per edge carrying its color and id, labels at their anchors;
- **the time axis**: a scrubber with play/pause over the trace's epochs
  that sets the projector's frame and fills a readout of every channel,
  labelled with the Math face's text for that symbol from the equation
  record;
- **view**: double-click a face, or press Read this face, and it comes
  flat and enlarged in front of the stone, fitted so nothing is cropped,
  still live; Esc, Back or Reset view returns to the stone. The view-scale
  buttons resize the stone. The buttons of the Rotate row and a small
  top-down minimap of the prism show which face is toward you. (The plan's
  fourth verb, Zoom into an abstraction level, is still deferred; this is
  only magnification.) A face card under the stone says what the stone is
  for and what the front face shows, with a legend for the Visual face;
- **keys**, Blender's grammar: a key arms a mode, the mouse acts, a click
  or Enter confirms, Esc cancels and restores. `g` grab (move the stone),
  `r` rotate, `s` scale, `t` travel (scrub the epoch; arrows step one), `f`
  focus (the next click picks a symbol); `1` `2` `3` turn to a face, Enter
  reads the front face, Space plays or pauses, `a` toggles auto-rotate,
  Home or `0` resets the view, `?` lists the keys. The Keys row names the
  armed mode;
- **focus**: click any symbol on any face, or in the readout, and every
  element carrying the same symbol id lights up on every face (token tspans
  on the text faces, edges and labels on the Visual face, the readout row),
  with a caption naming the symbol from the equation record and its value
  at the current epoch. Esc or Clear ends it. Focus knows only ids.

`just serve-site` serves it at <http://127.0.0.1:8765/>; the page fetches
its data, so it needs HTTP rather than `file://`.

## Status

Steps 1–9 of [the plan](docs/plan.md) are done: the gate; the equation IR
with the one-neuron instance; the training trace; the three faces as
fixtures; the page; focus; read mode with view scale, orientation cues and
the face card; the scalene prism with faces sized to their content; and the
modal keys. Every face header names the equation it shows, from the record.

- [`demos/one-neuron/train.mlpl`](demos/one-neuron/train.mlpl) trains the
  neuron for real (sw-MLPL `param` leaves, gradients from `grad`, thirty
  full-batch epochs at η = 0.1 over four points) and writes
  [`fixtures/one-neuron/trace.json`](fixtures/one-neuron/trace.json): per
  epoch `w`, `b`, the loss, both gradients and every prediction, keyed by
  the equation's symbol ids. [`docs/trace.md`](docs/trace.md) is the schema.
  The loss goes from 20.5 to 0.013 and never rises.
- [`demos/one-neuron/faces.mlpl`](demos/one-neuron/faces.mlpl) renders the
  Math and proposed-M faces to
  [`fixtures/one-neuron/faces/`](fixtures/one-neuron/faces) through
  sw-MLPL's `svg(…, "equation")`, with every token wrapped in a tspan
  carrying its symbol id, and writes the equation record itself as JSON.
- [`demos/one-neuron/scene.mlpl`](demos/one-neuron/scene.mlpl) builds the
  Visual face from the trace as a line scene,
  [`fixtures/one-neuron/scene.json`](fixtures/one-neuron/scene.json): the
  dataflow as labelled boxes with the gradient paths, the data with the
  fitted line and residuals, and parameter space with the path and the
  update arrow, one frame per epoch. [`docs/scene.md`](docs/scene.md) is the
  contract for both.
- [`pages/`](pages) is the stone, described above, with all three verbs of
  v1: Rotate, Travel and Focus.

Every fixture is checked fresh by the gate and pinned by a reg-rs baseline.
Next: hover callouts that explain every element from the equation record,
then the plan update, IR v2 for sums and indices, the multi-stone page, and
the dot-product, matmul, softmax and CNN stones, then captures.

## License

MIT — see [`LICENSE`](LICENSE) and [`COPYRIGHT`](COPYRIGHT).
