# Native / bridge benchmark thresholds

This repository runs fast, deterministic **Node smoke workloads** inside CI (`npm run benchmark:native-smoke`). Full emulator harnesses belong in downstream apps until a dedicated RN test target lands here.

| Script | What it validates | Typical healthy range on GitHub-hosted runners |
| ------ | ----------------- | --------------------------------------------- |
| `benchmark:node` | JS scheduling harness throughput | Completes without throwing; timings logged for manual diff |
| `benchmark:bridge` | Typed façade vs mocked JSON payloads | Completes without throwing; regressions surfaced by inspecting printed ratios locally |
| `stress:smoke` | 5 rounds x 25k `schedule`/`cancel`/`persist` calls via mocked Nitro hybrids | **p95 `≤ 800ms`** and heap delta **`≤ 32MB`** (`NITRO_BG_STRESS_MAX_MS`, `NITRO_BG_STRESS_MAX_HEAP_MB`) |
| `stress:soak` | 40 rounds stress for leak trend checks | p95 `≤ 2000ms` and heap delta `≤ 64MB` |

Tune `NITRO_BG_STRESS_MAX_MS` in constrained CI if runners throttle:

```bash
NITRO_BG_STRESS_MAX_MS=1200 NITRO_BG_STRESS_MAX_HEAP_MB=48 npm run stress:smoke
```

Nightly lane `nightly-native-bench` executes:

- Android runtime smoke on emulator (`connectedAndroidTest`)
- iOS runtime smoke via native ObjC++ bridge binary (`scripts/ios-runtime-smoke.sh`)
- Node/bridge smoke + stress soak (`benchmark:native-smoke`, `stress:soak`)

When adding a hosted emulator/simulator lane, duplicate the matrix here with device-specific SLA numbers and link to the workflow artifact.
