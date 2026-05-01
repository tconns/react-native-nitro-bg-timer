# Native / bridge benchmark thresholds

This repository runs fast, deterministic **Node smoke workloads** inside CI (`npm run benchmark:native-smoke`). Full emulator harnesses belong in downstream apps until a dedicated RN test target lands here.

| Script | What it validates | Typical healthy range on GitHub-hosted runners |
| ------ | ----------------- | --------------------------------------------- |
| `benchmark:node` | JS scheduling harness throughput | Completes without throwing; timings logged for manual diff |
| `benchmark:bridge` | Typed façade vs mocked JSON payloads | Completes without throwing; regressions surfaced by inspecting printed ratios locally |
| `stress:smoke` | 25k `schedule`/`cancel`/`persist` calls via mocked Nitro hybrids | **`≤ 800ms` wall CPU** (`NITRO_BG_STRESS_MAX_MS` overrides) |

Tune `NITRO_BG_STRESS_MAX_MS` in constrained CI if runners throttle:

```bash
NITRO_BG_STRESS_MAX_MS=1200 npm run stress:smoke
```

When adding a hosted emulator/simulator lane, duplicate the matrix here with device-specific SLA numbers and link to the workflow artifact.
