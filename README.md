# m-poc — Rosetta M

**Live demo: <https://sw-ml-study.github.io/m-poc/>** — the committed
`pages/` directory, published as is on every push to `main`. Until step 5
of the plan lands it is a placeholder; after that it is the stone.

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

## Status

Steps 1–2 of [the plan](docs/plan.md) are done: the gate (structure,
gitignore, abstraction, links, style, mlplunit, reg-rs) and the equation IR
with the one-neuron instance, whose Math and M faces are pinned by tests and
a reg-rs baseline. Next: the training trace (`demos/one-neuron/train.mlpl`,
real gradient descent with `grad`, replayed by the page).

## License

MIT — see [`LICENSE`](LICENSE) and [`COPYRIGHT`](COPYRIGHT).
