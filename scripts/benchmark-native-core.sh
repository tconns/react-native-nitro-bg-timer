#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT_DIR="${ROOT}/.tmp-bench"
mkdir -p "${OUT_DIR}"

CXX_BIN="${CXX:-clang++}"
if ! command -v "${CXX_BIN}" >/dev/null 2>&1; then
  CXX_BIN="g++"
fi

"${CXX_BIN}" -std=c++17 -O2 \
  "${ROOT}/benchmarks/native-core-benchmark.cpp" \
  "${ROOT}/cpp/SchedulerCore.cpp" \
  -o "${OUT_DIR}/native-core-benchmark"

"${OUT_DIR}/native-core-benchmark"
