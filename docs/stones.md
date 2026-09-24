# The stones: one page, several equations

The page is a tour of stones. Each stone is one equation record with the
same three faces, the same verbs and the same fixture shape; a dropdown in
the page header chooses one, and `?stone=ID` links straight to it.

## Layout

```text
fixtures/stones.json                 the manifest (emitted by demos/stones.mlpl)
fixtures/<stone>/trace.json          the time axis (docs/trace.md)
fixtures/<stone>/scene.json          the Visual face (docs/scene.md)
fixtures/<stone>/faces/math.svg      the Math face
fixtures/<stone>/faces/m.svg         the M face
fixtures/<stone>/faces/equation.json the record: symbols, docs, faces, titles
demos/<stone>/{equation,train,faces,scene}.mlpl   the programs that emit them
pages/data/...                       the same, copied by scripts/build-site
```

`scripts/check-fixtures` regenerates every stone from its programs and
`scripts/check-site` compares the copy under `pages/data/`, both by walking
the stone directories; `scripts/check-structure` lists the manifest.

## The manifest, schema `sw-ml-study.rosetta.stones` version 1

```text
{
  "schema": "sw-ml-study.rosetta.stones", "version": 1,
  "ids":      ["one-neuron", ...],        the record names, in tour order
  "titles":   ["One neuron", ...],        from each record's title
  "purposes": ["One neuron: a linear fit ...", ...],   each record's description
  "widths":   {"math": [480, ...], "m": [480, ...], "visual": [720, ...]}
}
```

Parallel lists, one entry per stone (MLPL records cannot hold a list of
records). `widths` are the face widths in the stone's units; the page's
geometry builds the scalene prism from them (see the README), so a stone
with a wide Visual face can say so. The three widths must make a triangle.

## What a record carries for the page

Besides its symbols, docs and faces (docs/scene.md), a record now has a
short `title` (the selector entry and the face headers), and a title and
purpose for each of its three faces, `faces.math.title`,
`faces.m.purpose`, `visual.title` and so on, set with `u:rs_ir_titled` and
`u:rs_ir_face_doc`. The face card and the callouts read them; the page
holds no text about any stone.

Adding a stone: a `demos/<stone>/` directory with the four programs, an
entry in `demos/stones.mlpl`, and regenerated fixtures (`just build-site`
copies them). The page needs no change.
