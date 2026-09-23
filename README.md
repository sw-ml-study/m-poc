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

## Status

Planning complete. The first step (`scaffold`) is next.

## License

MIT — see [`LICENSE`](LICENSE) and [`COPYRIGHT`](COPYRIGHT).
