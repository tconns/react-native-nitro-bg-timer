# Reliability Lab Scorecard

This scorecard tracks stability metrics across platform/device classes to support top-tier reliability claims.

## Device classes

- Android flagship (recent Pixel/Samsung generation)
- Android mid-range (OEM battery policy variability)
- iOS latest major + previous major

## KPI definitions

- `callbackSuccessRate`: fired callbacks / expected callbacks.
- `driftP95Ms`: p95 lateness for interval-based schedules.
- `driftP99Ms`: p99 lateness for interval-based schedules.
- `restoreSuccessRate`: successful restore runs / total restore runs.
- `batteryImpactPctPerHour`: battery drain delta versus baseline test profile.

## Run protocol

1. Execute the same workload profile for 3 consecutive builds.
2. Store raw logs and summarized metrics.
3. Publish trend (`build N-2`, `N-1`, `N`) instead of single snapshot.

## Pass criteria (initial)

- `callbackSuccessRate >= 99.5%`
- `restoreSuccessRate = 100%` for deterministic fixtures
- No regression > `10%` on `driftP95Ms` or `driftP99Ms` against previous stable baseline
- `batteryImpactPctPerHour` stays within app-team-defined budget

## Reporting format

| Platform | DeviceClass | callbackSuccessRate | driftP95Ms | driftP99Ms | restoreSuccessRate | batteryImpactPctPerHour | Build |
| --- | --- | --- | --- | --- | --- | --- | --- |
| iOS | flagship | TBD | TBD | TBD | TBD | TBD | TBD |
| Android | mid-range | TBD | TBD | TBD | TBD | TBD | TBD |
