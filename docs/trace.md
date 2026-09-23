# The trace fixture

`fixtures/one-neuron/trace.json` is the fourth dimension of the stone: what
the numbers were at every epoch of training. It is emitted by
[`demos/one-neuron/train.mlpl`](../demos/one-neuron/train.mlpl) from a real
gradient-descent loop (the parameters are sw-MLPL `param` leaves and every
gradient comes from `grad`; see
[`demos/one-neuron/neuron.mlpl`](../demos/one-neuron/neuron.mlpl)), and the
page replays it. Nothing is recomputed in the browser.

## Schema `sw-ml-study.rosetta.trace`, version 1

```text
{
  "schema": "sw-ml-study.rosetta.trace", "version": 1,
  "equation": "one-neuron",                 the IR record the keys below belong to
  "axis": {"name": "epoch", "count": 31},   the time axis: rows 0 … count−1
  "constants": {                            values that do not change over time
    "eta": 0.1, "x": [0,1,2,3], "y": [1.2,2.9,5.1,6.8]
  },
  "channels": {                             one entry per row of the axis
    "w": [...], "b": [...],                 the parameters before that epoch's update
    "L": [...],                             the loss at those parameters
    "grad_w": [...], "grad_b": [...],       the gradients there (row count−1: recorded, not applied)
    "yhat": {"shape": [31, 4], "values": [...]}   the prediction for every point, row-major
  }
}
```

Every key under `constants` and `channels` is a symbol id of the one-neuron
equation record in
[`demos/one-neuron/equation.mlpl`](../demos/one-neuron/equation.mlpl). That
is the link the focus verb uses: click `w` on any face and the readout looks
up `channels.w[epoch]`. Arrays of rank two are written the way the
`sw-ml-study.native3d.line-scene` schema writes them, as `shape` plus flat
row-major `values`, so a fixture never holds nested lists and reads back into
MLPL with `parse_json`.

Row `t` is the state *before* epoch `t`'s update: `w[t+1] = w[t] − η
grad_w[t]`, and `yhat[t] = w[t] x + b[t]`. Row 0 is the untrained neuron and
the last row is the trained one; its gradients are recorded so the last
frame has an arrow too, but they are not applied.

`L` is the quantity that was trained: the mean over the four points of
`(y − ŷ)²`. The Math face shows the per-point form; the mean is the
full-batch loss.

## Numbers

Values are rounded to six decimals before they leave MLPL (rounding is
`u:rs_round` in [`lib/rosetta/emit.mlpl`](../lib/rosetta/emit.mlpl)), so the
fixture is identical on every machine and small enough to read. Training
itself runs at full precision; only the recorded copy is rounded. The
learning rate, the epoch count and the four points are set in
`train.mlpl` and `neuron.mlpl`; the tests in
[`tests/test_one_neuron_trace.mlpl`](../tests/test_one_neuron_trace.mlpl)
pin what matters about them: the loss never rises and ends below 0.015 (the
least-squares floor of these points is 0.0125), `grad` agrees with the
closed-form gradient at every epoch, and every row obeys the update rule and
the prediction equation.

## Freshness

Three things keep the committed fixture honest:

- `scripts/check-fixtures` regenerates it into `tmp/` and compares byte for
  byte; a stale fixture fails `just check`.
- the mlplunit test `the committed fixture is the trace the program emits`
  does the same comparison from inside MLPL.
- the reg-rs baseline `rosetta_one_neuron_trace` pins the emitted JSON, so a
  change to the numbers is a diff to review and `just reg-rebase
  rosetta_one_neuron_trace` is the act of accepting it.

Regenerate with `just mlpl demos/one-neuron/train.mlpl`.
