#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

cargo fmt --all --check
cargo clippy --workspace --all-targets -- -D warnings
cargo test --workspace
test -n "$(ls ui/src/backend/generated 2>/dev/null)" || [ "${FOLIO_ALLOW_NO_BINDINGS:-0}" = 1 ]
git diff --exit-code -- ui/src/backend/generated
! cargo tree -p folio-core | grep -qi tauri
npm run -w ui lint
npm run -w ui typecheck
npm run -w ui test
