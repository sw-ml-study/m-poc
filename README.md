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
symbols (each with a role, a name and a one-sentence doc), and per face an
ordered list of tokens that render them. `=` on the Math face and `←` on the M face are the
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

## Captures

Stills of every stone and an animated capture of every Visual face across
its time axis live under [`captures/`](captures), made from the served page
by [`scripts/capture-site`](scripts/capture-site) with headless Chrome
(`?stone=ID&yaw=DEG&epoch=T` and `?read=visual&epoch=T`), so what is shown
is exactly what the page replays. The animated captures
are WebP: [dot product](captures/dot-product-visual.webp),
[matmul](captures/matmul-visual.webp), [softmax](captures/softmax-visual.webp),
[CNN](captures/cnn-visual.webp); the stills are the `*-stone.png` files.

## Run it yourself

Every number on the page came from sw-MLPL. To run the neuron's training
loop yourself, paste [`demos/one-neuron/neuron.mlpl`](demos/one-neuron/neuron.mlpl)
(the model and `u:on_train`) into the sw-MLPL playground at
<https://mlpl.softwarewrighter.com/> and call `u:on_train(0.1, 30)`, or run
`just mlpl demos/one-neuron/train.mlpl` against the adjacent checkout. The
other stones' programs are under `demos/<stone>/`. The M face is never run
anywhere: it is notation rendered from the record, and its glyphs are
placeholders.

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

## The stones

The page is a tour: a dropdown in the header chooses the stone, and
`?stone=ID` links to one. Every stone is one equation record with the
same three faces, verbs and fixtures; [`docs/stones.md`](docs/stones.md)
is the layout and the manifest. The tour so far:

1. **One neuron**, ŷ = wx + b trained by gradient descent; time is the
   epoch. The headline stone.
2. **Feature normalization**, zᵢ = (xᵢ − μᵢ)/σᵢ over Fin(3), the
   applicative stone from [`docs/research2.txt`](docs/research2.txt):
   every position computes on its own, nothing is summed, and the M face
   shows the same expression with and without homogeneous tuples; time is
   the position.
3. **Dot product**, s = ∑ᵢ wᵢxᵢ, pointwise plus a reduction: on the M face
   `+/ W×X` says it with no index at all; time is the index, one term per
   step.
4. **Matrix multiply**, Cᵢⱼ = ∑ₖ AᵢₖBₖⱼ, the research's first true Rosetta
   Stone: `C ← A +.× B` is APL's inner product; time is the contraction
   index k, and every cell of C accumulates one product per step.
5. **Softmax**, σ(z)ᵢ = eᶻⁱ / ∑ⱼ eᶻʲ, the research's front-page equation:
   `P ← (*Z) ÷ +/ *Z`; time is the temperature falling from 4 to 0.2, and
   the probabilities sharpen from nearly flat to one winner.
6. **Image normalization**, z[h,w,c] = (x[h,w,c] − μ[c]) / σ[c] over
   Fin(4) × Fin(4) × Fin(3), the second applicative stone from
   [`docs/research2.txt`](docs/research2.txt): the feature stone's M line
   `Z ← (X − Μ) ÷ Σ` unchanged, with the shapes `X : Tuple[4,4,3]` and
   `Μ Σ : Tuple[3]` on the second line. Subtracting a 3-tuple from a
   4×4×3 one is broadcasting as an index projection, (h, w, c) ↦ c, and
   the tuples are never copied to the image's shape; the Visual face draws
   μ and σ once, three cells each, with a leader from the current pixel.
   The image is computed by MLPL (a ramp per channel plus a bright spot),
   z by trailing-axis broadcasting, checked against three explicit loops;
   time is the pixel, row by row, and three output grids fill in.
7. **CNN triple sum**, y[r,x,y] = ∑q ∑u ∑v W[r,q,u,v] · X[q, x+u, y+v], one
   convolutional layer as Zhao et al. (2018) write it and as sw-MLPL says
   it: `Y ← +/[channel,kernel-y,kernel-x] W × ⧉[Mw,Nw] X`, the window glyph
   and a reduce over named axes; time is the output position the 3×3
   window slides over, and the output map fills in one cell per step. The
   numbers come from `windows`, a broadcast multiply and `reduce`, checked
   against `conv2d` and the im2col matmul. Sources: the literate derivation
   [`cnn-convolution.org`](https://github.com/sw-ml-study/sw-mlpl/blob/main/examples/literate/cnn-convolution.org)
   in sw-mlpl and the blog post
   [*Teaching an Array Language to Say CNN*](https://blog.softwarewrighter.com/2026/09/10/ml-cnn-from-equations-mlpl/).
8. **Sigmoid neuron**, ŷ = σ(wx + b), the research's own one-neuron example:
   the same four lines with one function glyph added, trained through
   sigmoid on targets 0, 0, 1, 1; time is the epoch, and the S-shaped fit
   steepens between the two groups of points.
9. **Attention**, S = QKᵀ/√d, P = softmax(S), A = PV, the composed stone
   the research calls R10: three lines made of the matmul stone's `+.×`
   (twice), the softmax stone's `σ` and a transpose `⍉`, with nothing new,
   `S ← (Q +.× ⍉K) ÷ √d`, `P ← σ S`, `A ← P +.× V`. Three tokens of width
   two, computed with MLPL's `matmul`, `transpose` and `softmax`; time is
   the query position, and the Visual face lights one query row of Q,
   shows its score row and weight row as bars, and fills in its row of A.

The dropdown lists the stones in this order, simplest notation to most
complex, the headline first and the variants last; Adam is next.

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
  triangle. It auto-rotates so the faces come round as Math, M, Visual, drags with
  the pointer, and the Rotate buttons turn it to a face;
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
- **callouts**: rest the pointer on a face and everything within reach
  gets a callout at once, up to six, fanned out around the pointer with a
  leader line each; the nearest is emphasised. Move down a row and the
  previous row's callouts give way to the next row's. A symbol's callout
  gives its glyph, name, role, one-sentence doc from the equation record,
  its value at this epoch, and what its line says; a line's callout (rest
  on the line outside a token) gives the line's doc; the Visual face's
  panels come from the scene's `panels`. Tokens have generous hit areas
  (their whole box, and wide invisible twins behind the Visual edges), and
  a face's own callout is on its header. Controls, the minimap and the
  readout get a single callout each. Keyboard focus shows one too. The
  face card lists the front face's lines with their docs. An invisible token (the Math
  face's juxtaposition multiply) says so in its title and gets a hollow ring
  at its place, for callouts and for focus alike. Anchors are exact on the turned
  stone too: each glyph's box is projected through the same matrices CSS
  applies (face, stone, perspective). The whole-line callout is the larger
  one at the left of the fan, and the glyph callouts follow in expression
  order, left to right, on one side of the row, wrapping into further rows
  that read top to bottom. Callouts stay anchored to the glyph they were
  made for: as the stone turns, drags, scales or enters
  read mode, every box and leader follows its own glyph, and the set only
  changes when the pointer really moves. `?hover=ID` and `?near=ID` show
  them for stills, `?then=yaw:DEG` moves the view afterwards. Keyboard focus and taps show them too; Esc
  hides one; the Hints button turns them off. `?hover=ID` shows one for a
  still;
- **focus**: click any symbol on any face, or in the readout, and every
  element carrying the same symbol id lights up on every face (token tspans
  on the text faces, edges and labels on the Visual face, the readout row),
  with a caption naming the symbol from the equation record and its value
  at the current epoch. Esc or Clear ends it. Focus knows only ids.

`just serve-site` serves it at <http://127.0.0.1:8765/>; the page fetches
its data (the manifest, then the chosen stone's files under
`data/<stone>/`), so it needs HTTP rather than `file://`. The footer carries the
copyright, the license, the repository link and the build facts that
`scripts/build-site` writes to `pages/data/build-info.json`: host, short
SHA (`-dirty` when the tree had uncommitted changes), UTC time.

## Status

Steps 1–32 of [the plan](docs/plan.md) are done: the gate; the equation
IR with the one-neuron instance; the training trace; the three faces as
fixtures; the page; focus; read mode with view scale, orientation cues and
the face card; the scalene prism with faces sized to their content; the
modal keys; hover callouts with every symbol's doc in the record and the
Visual face's panels in the scene; per-line docs on the text faces;
proximity callouts; the plan update that turns the page into a tour of
five stones (one neuron, dot product, matmul, softmax, CNN) chosen from a
dropdown; callouts that stay anchored to their glyphs; and faces v2, whose
tokens may be subscripts, superscripts, big operators and their limits, so
the tour's sums render and stay focusable; invisible tokens that announce
themselves; the multi-stone page: a manifest, per-stone fixtures, a
dropdown, and every face's title and purpose in the record; the five
stones of the tour; exact callout anchors on the turned stone; and the
captures; callouts in expression order; and, in v1.1 so far, the sigmoid
neuron, the two applicative stones, feature normalization and image
normalization, and attention composed from the matmul and softmax stones;
and the hover fix: the yaw turns the faces rather than the
stone's box, which Chrome's 3D hit testing let shadow a face turned to
the front ([`tests/hover-sweep.mjs`](tests/hover-sweep.mjs) checks every
view of a stone by keys and drags); and the callout fan spaced out: one
overall callout, leftmost and highest, glyph tiers that spill to the other
side of the row rather than pile up. Every face header names the stone it shows, from the record.

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
Next in v1.1: Adam, the Trace face (the stone as a box), and the Zoom verb
(one level inside).

## License

MIT — see [`LICENSE`](LICENSE) and [`COPYRIGHT`](COPYRIGHT).
