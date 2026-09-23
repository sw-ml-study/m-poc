# m-poc — Rosetta M

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
w ← w − η ∂L/∂w              W ← W − η×∇W L             w, b, ∂L/∂w, ∂L/∂b
```

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

## Status

Scaffold in place: the gate runs end to end over a smoke suite that pins
the two interpreter capabilities the plan rests on (`svg(…, "equation")`
renders Unicode math and proposed-M glyphs; `grad` trains a `param`) and a
reg-rs baseline that pins the interpreter version. Next: the equation IR
(`lib/rosetta/ir.mlpl`).

## License

MIT — see [`LICENSE`](LICENSE) and [`COPYRIGHT`](COPYRIGHT).
