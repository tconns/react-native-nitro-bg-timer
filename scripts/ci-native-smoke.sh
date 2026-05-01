#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT}"

echo "native-smoke: node scheduler benchmarks + bridge overhead + typed bridge stress..."
npm run benchmark:node
npm run benchmark:bridge
npm run benchmark:core-native
npm run stress:smoke
