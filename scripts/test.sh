#!/usr/bin/env bash
set -euo pipefail

MODE="${1:-run}"

case "$MODE" in
  run)
    npx vitest run
    ;;
  watch|w)
    npx vitest
    ;;
  coverage|c)
    npx vitest run --coverage
    ;;
  *)
    echo "Usage: $0 {run|watch|coverage}"
    echo ""
    echo "  run       Run all tests once (default)"
    echo "  watch     Run tests in watch mode"
    echo "  coverage  Run tests with coverage report"
    exit 1
    ;;
esac
