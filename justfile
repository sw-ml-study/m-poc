set shell := ["sh", "-cu"]

# Show available repository tasks.
default:
    @just --list

# The full pre-commit gate: structure, abstraction, links, style, mlplunit, reg-rs.
check:
    ./scripts/check

# Run native mlplunit tests; arguments select paths, tags, or filters.
tests *args:
    ./scripts/run-tests {{args}}

# List tests discovered by mlplunit without executing them.
list-tests:
    ./scripts/run-tests --list

# Run the reg-rs golden baselines under tests/reg/ (`just reg -vv` for full diffs).
reg *args:
    ./scripts/run-reg {{args}}

# Accept the latest reg-rs output as the new baseline for one test: `just reg-rebase NAME`.
reg-rebase name:
    REG_RS_DATA_DIR="$(pwd)/tests/reg" reg-rs rebase -p {{name}}

# Run one MLPL script from the repository root: `just mlpl demos/one-neuron/train.mlpl`.
mlpl script *args:
    ./scripts/run-mlpl {{script}} {{args}}

# Print the selected tools without installing or replacing them.
mlpl-path:
    ./scripts/select-mlpl

mlplunit-path:
    ./scripts/select-mlplunit

# Serve the committed pages/ directory at http://127.0.0.1:8765/ exactly as Pages will.
serve-site:
    cd pages && python3 -m http.server 8765 --bind 127.0.0.1
