# External iOS Simulator E2E Lane

This repository stays library-only. End-to-end iOS callback validation runs in a consumer app repository that links this module.

## Minimum required scenarios

1. `schedule(timeout)` fires once in foreground and after background/foreground transition.
2. `schedule(interval)` respects `driftPolicy` and `maxRuns`.
3. `pauseGroup` / `resumeGroup` / `cancelGroup` parity with Android behavior.
4. `getPersistWireJson` + `restorePersistWireJson` preserve queue shape.
5. Retry/profile fields (`retry*`, `cancellationToken`, `policyProfile`) do not break callback flow.

## Required workflow artifacts

- Simulator test logs (`xcodebuild test` output).
- Callback success rate summary.
- Drift p95/p99 summary for test scenarios.
- Wire restore pass/fail summary.

## Suggested CI command (consumer repo)

```bash
xcodebuild \
  -workspace "YourApp.xcworkspace" \
  -scheme "YourAppTests" \
  -destination "platform=iOS Simulator,name=iPhone 15,OS=latest" \
  test
```

## SLA targets for consumer lane

- Callback success rate: `>= 99.5%` for deterministic test runs.
- Drift p95: `<= 250ms` for interval scenarios in foreground.
- Restore success ratio: `100%` for deterministic persisted fixtures.

## Ownership

- Owner: consumer app team owning runtime guarantees.
- This module repo should link the external workflow URL and latest green artifact in `docs/FEATURE_UPGRADE_STATUS.md`.
