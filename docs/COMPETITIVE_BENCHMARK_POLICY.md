# Competitive Benchmark Policy

This document defines how to run and publish fair comparisons against peer RN timer/background schedulers.

## Benchmark scope

- Throughput (`schedule`/`cancel` ops)
- Callback drift (`p95`, `p99`)
- Restore reliability after relaunch
- Heap growth over soak runs

## Fairness rules

1. Same device class and OS version for all candidates.
2. Same workload profile, seed, and runtime window.
3. Warmup run excluded from comparison.
4. Publish both raw logs and summarized metrics.

## Candidate set (initial)

- `react-native-background-timer`
- `react-native-background-fetch` (where feature-equivalent)
- `expo-background-task` (where feature-equivalent)
- `react-native-nitro-bg-timer`

## Cadence

- Run monthly and before any minor release.
- Keep last 3 benchmark snapshots linked from release notes.

## Output artifact schema

```json
{
  "benchmarkSuite": "competitive-monthly",
  "deviceClass": "android-flagship",
  "metrics": {
    "throughputOpsPerSec": 0,
    "driftP95Ms": 0,
    "driftP99Ms": 0,
    "restoreSuccessRate": 0,
    "heapDeltaMb": 0
  }
}
```
