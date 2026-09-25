# The face fixtures: SVG text faces and the Visual scene

Three files under `fixtures/one-neuron/` are the faces of the stone, and a
fourth, `trace-scene.json`, is its Trace face (below). All are emitted by
MLPL, all are committed, and `scripts/check-fixtures` fails the gate if any
differs from a fresh run.

| File              | Emitted by                                                        | Baseline                     |
|-------------------|-------------------------------------------------------------------|------------------------------|
| `faces/math.svg`  | [`demos/one-neuron/faces.mlpl`](../demos/one-neuron/faces.mlpl)   | `rosetta_one_neuron_faces`   |
| `faces/m.svg`     | the same script                                                   | the same baseline            |
| `scene.json`      | [`demos/one-neuron/scene.mlpl`](../demos/one-neuron/scene.mlpl)   | `rosetta_one_neuron_scene`   |
| `trace-scene.json` | [`demos/one-neuron/trace-scene.mlpl`](../demos/one-neuron/trace-scene.mlpl) | `rosetta_one_neuron_trace_scene` |

## The text faces

[`lib/rosetta/faces.mlpl`](../lib/rosetta/faces.mlpl) renders a face of an
equation record by handing its text to sw-MLPL's equation renderer,
`svg(text, "equation")`, which lays the glyphs out: one `<text>` per line,
one `<tspan>` holding the line, a font stack of math fonts, a dark
background rectangle. This repository does no layout of its own. It then
replaces each line's single tspan with one tspan per token:

```html
<tspan class="rs-token" data-id="w">w</tspan><tspan class="rs-token" data-id="mul">⁢</tspan><tspan class="rs-token" data-id="x">x</tspan>
```

`data-id` is the token's symbol id from the equation record, the same id the
other faces and the trace use. Tokens may be scripted: a line spec marks a
token `_` subscript, `^` superscript, `!` big operator, `<` lower limit or
`>` upper limit (lower-limit tokens listed before upper-limit ones), the
face's text carries the renderer's `_{ }` and `^{ }` markers for such runs,
and the wrapper follows the renderer's several runs per line: plain and
shifted tspans, and for a big operator its centred glyph followed by its
upper and then its lower limit as centred text elements, each getting its
own tagged tspan inside. Every text element of a line carries `data-line`. The tspans (and the bare spaces between the
tokens that asked for one) concatenate to exactly the line the renderer laid
out, so the layout still applies; the render fails closed if the renderer
did not emit one plain tspan per line holding exactly the line's text, or if
a token's text holds a markup character. The M face shows proposed notation
whose glyphs are placeholders.

## The Visual face: schema `sw-ml-study.native3d.line-scene`, version 1

`scene.json` is a line scene in the schema of the `../demo-extensions`
native viewer, extended. The core fields are what that viewer parses; the
extensions are what the page uses. Arrays of rank two or more are `shape`
plus flat row-major `values`.

```text
{
  "schema": "sw-ml-study.native3d.line-scene", "version": 1,
  "positions": {"shape": [N, 3], "values": [...]},   the vertices at rest (frame 0)
  "edges":     {"shape": [M, 2], "values": [...]},   vertex index pairs
  "controls":  {"rotation_speed": 0, "line_color": [r,g,b,a], "line_thickness": 2},
                                                     ── extensions ──
  "ids":       [M strings],                          a symbol id per edge
  "colors":    {"shape": [M, 4], "values": [...]},   an RGBA per edge, in the unit interval
  "labels":    {"count": K, "ids": [K strings], "texts": [K strings],
                "positions": {"shape": [K, 3], "values": [...]}},
  "frames":    {"axis": "epoch", "count": T,
                "positions": {"shape": [T, N, 3], "values": [...]}},
  "panels":    {"count": P, "ids": [...], "titles": [...], "docs": [...],
                "bounds": {"shape": [P, 4], "values": [x0, y0, x1, y1, ...]},
                "colors": {"shape": [P, 4], "values": [...]}}
}
```

`panels` is explanation, not geometry: each names a region of the plane
with a title, a one-sentence doc and a swatch color. The page builds the
Visual face's legend from them and shows a callout when the pointer rests
on a region. Nothing is drawn for a panel.

Every frame holds every vertex; edges, ids, colors and labels never change.
A projector draws frame `t` by projecting `frames.positions[t]` and joining
the pairs in `edges`; it draws labels at their anchors; it knows nothing
about what the vertices mean. The builder in
[`lib/rosetta/scene.mlpl`](../lib/rosetta/scene.mlpl) refuses an edge that
names a vertex outside the scene, a fractional index, a color outside the
unit interval, a non-finite position, a frame with the wrong vertex count,
or an id with a delimiter, so what reaches the file is already what the
Rust parser would accept.

## The Trace face: the same schema, one series over the axis

A stone whose trace has a headline scalar (the loss for the neuron, sigmoid
and Adam stones; the running sum for the dot product; the cell being
computed for the CNN) has a fourth face, `trace-scene.json`, emitted by
`demos/<stone>/trace-scene.mlpl` through
[`lib/rosetta/timeline.mlpl`](../lib/rosetta/timeline.mlpl). It is a line
scene like the Visual face, 16 units by 9: the step axis and the value
axis, the whole series as a polyline, and a marker at the current step (a
drop line from the baseline and a diamond on the curve), with the series'
symbol as the label at the top of the value axis, the axis name at the end
of the step axis, and the smallest and largest values beside the value
axis. Every edge and label carries the series' symbol id, so focus on `L`
lights the curve; one panel names the face for the page's card and
callouts. It has one frame per step of the axis, and only the marker's
vertices change between frames. The page draws it with a second instance
of the same projector.

## What the one-neuron scene draws

[`demos/one-neuron/visual.mlpl`](../demos/one-neuron/visual.mlpl) builds the
face from the parsed trace (see [`trace.md`](trace.md)), on the `z = 0`
plane, roughly 16 units wide by 9 high, in three panels:

- **Dataflow** (left): the equation as labelled boxes, `x, w → × → + ← b →
  ŷ` and `ŷ, y → − → ² → L`, edges carrying the id of the value that flows
  along them, and the two gradient paths routed back from `L` to `w` and `b`
  (ids `grad_w`, `grad_b`) with `η` labelled beside them.
- **Data** (middle): axes, the four points (id `y`), the line the neuron
  fits at this epoch through `ŷ` at the first and last `x` (id `yhat`),
  and each point's residual (id `sub`).
- **Parameters** (right): `w` and `b` axes, the path `(w, b)` has taken up
  to this epoch (id `assign`; later points fold onto the current one so
  every frame has the same vertices), the current point, and the update
  arrow whose legs are `−η ∂L/∂w` (id `grad_w`) and `−η ∂L/∂b` (id
  `grad_b`) and whose resultant, with its head, lands on the next epoch's
  parameters (id `assign`). In the last frame the arrow shows the recorded
  but unapplied gradient.

Every id is a symbol of the equation record, checked by
[`tests/test_one_neuron_visual.mlpl`](../tests/test_one_neuron_visual.mlpl),
which also checks that the line ends and the arrow tip match the trace at
every epoch and that the committed file is fresh. Positions are rounded to
four decimals. Colors are data in the scene (one RGBA per edge, chosen in
`visual.mlpl`); the page may restyle a focused id but does not choose the
palette.
