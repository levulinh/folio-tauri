#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

cargo fmt --all --check
cargo clippy --workspace --all-targets -- -D warnings
cargo test --workspace
test -n "$(ls ui/src/backend/generated 2>/dev/null)" || [ "${FOLIO_ALLOW_NO_BINDINGS:-0}" = 1 ]
git diff --exit-code -- ui/src/backend/generated
if [ -n "$(git status --porcelain -- ui/src/backend/generated)" ]; then
  echo "ui/src/backend/generated has uncommitted or untracked changes" >&2
  exit 1
fi
# package names only: `{p}` would also print paths, and this repo's path contains "tauri"
core_tree=$(cargo tree -p folio-core --prefix none --format '{p}' | awk '{print $1}')
if grep -qi tauri <<<"$core_tree"; then
  echo "folio-core must not depend on tauri" >&2
  exit 1
fi
npm run -w ui lint
npm run -w ui typecheck
npm run -w ui test
