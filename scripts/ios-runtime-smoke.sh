#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "${TMP_DIR}"' EXIT

cat > "${TMP_DIR}/main.mm" <<'EOF'
#import <Foundation/Foundation.h>
#import "SchedulerBridge.h"

int main() {
  @autoreleasepool {
    SchedulerCppBridge *bridge = [SchedulerCppBridge new];
    int64_t nowMs = (int64_t)([[NSDate date] timeIntervalSince1970] * 1000.0);
    [bridge scheduleWithId:901
                  dueAtMs:nowMs + 10
                      kind:@"timeout"
                intervalMs:1
                     group:@"runtime"
               driftPolicy:@"coalesce"
                   maxRuns:1
              metadataJson:@"{}"];
    NSArray<NSNumber *> *pairs = [bridge popDuePairsAtNowMs:nowMs + 50];
    if (pairs.count < 2 || ![pairs.firstObject isEqualToNumber:@901]) {
      fprintf(stderr, "ios-runtime-smoke: unexpected due pairs\\n");
      return 2;
    }
    printf("ios-runtime-smoke: ok (pairs=%lu)\\n", (unsigned long)pairs.count);
  }
  return 0;
}
EOF

xcrun clang++ \
  -std=c++17 \
  -fobjc-arc \
  -ObjC++ \
  -I"${ROOT}/ios" \
  -I"${ROOT}/cpp" \
  "${ROOT}/ios/SchedulerBridge.mm" \
  "${ROOT}/cpp/SchedulerCore.cpp" \
  "${TMP_DIR}/main.mm" \
  -framework Foundation \
  -o "${TMP_DIR}/ios_runtime_smoke"

"${TMP_DIR}/ios_runtime_smoke"
