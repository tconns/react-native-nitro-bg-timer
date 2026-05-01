# Native and Bridge Benchmark Thresholds

This document defines the baseline thresholds for CI and nightly performance lanes.

## Benchmarks in scope

| Script | Purpose | Baseline threshold |
| --- | --- | --- |
| `benchmark:node` | JS scheduling throughput baseline | Must complete without errors |
| `benchmark:bridge` | Typed vs JSON bridge overhead signal | Must complete without errors |
| `benchmark:core-native` | Real C++ scheduler core load | Must complete without errors |
| `stress:smoke` | 5 rounds stress (`schedule`/`cancel`/`persist`) | `p95 <= 800ms`, heap delta `<= 32MB` |
| `stress:soak` | 40 rounds leak trend signal | `p95 <= 2000ms`, heap delta `<= 64MB` |

Tune thresholds in constrained CI environments with:

```bash
NITRO_BG_STRESS_MAX_MS=1200 NITRO_BG_STRESS_MAX_HEAP_MB=48 npm run stress:smoke
```

## CI lanes

- `benchmark:native-smoke` runs node + bridge + native core benchmark + smoke stress.
- Nightly workflow runs runtime smoke (Android/iOS) and stress soak with summary artifacts.

## Related docs

- `docs/RELIABILITY_LAB_SCORECARD.md`
- `docs/FEATURE_UPGRADE_STATUS.md`
