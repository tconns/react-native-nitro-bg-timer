# Feature Upgrade Status

This file tracks comprehensive feature upgrades and implementation status for the module.

Status values:

- `done`
- `in_progress`
- `planned`
- `blocked`

## Core Runtime Features

| Feature | Status | JS | Android | iOS | C++ Core | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| V2 scheduler API (`schedule`, group controls) | done | done | done | done | done | Behaviour unified through `SchedulerCore` when adapters opt into the C++ queue |
| Typed schedule bridge payload (no JSON options) | done | done | done | done | planned | Persist wire still JSON for storage integrations |
| Centralized queue scheduler per platform | done | n/a | done | done | done | Kotlin/Swift adapters host wake locks/ticks |
| Shared C++ scheduler core foundation | done | n/a | n/a | n/a | done | `SchedulerCore.*` authoritative for queue logic when JNI/ObjC bridges are wired |
| Wire snapshot + guarded restore hooks | done | done | done | done | done | `getPersistWireJson`/`restorePersistWireJson`; legacy Kotlin/Swift disables restore intentionally |
| Legacy v1 compatibility wrappers | done | done | done | done | n/a | `setTimeout`/`setInterval` compatibility preserved |

## Performance and Reliability

| Feature | Status | JS | Android | iOS | C++ Core | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| Scheduler stats (`active`, `callback`, `missed`, `wakeup`) | done | done | done | done | planned | Core stats surfaced through adapters + telemetry merge |
| Late-dispatch telemetry (`late`, `avg`, `p95`) | done | done | done | done | planned | Still adapter-owned lateness trackers |
| JS façade churn reduction | done | done | n/a | n/a | n/a | `stats` emitter throttled (~250 ms) on advanced schedules |
| Benchmark baseline (scheduler throughput) | done | done | n/a | n/a | n/a | `benchmark:node` |
| Bridge overhead benchmark (typed vs JSON path) | done | done | n/a | n/a | n/a | `benchmark:bridge` |
| Native-path benchmark automation | done | smoke | smoke | smoke | smoke | Aggregated pipeline `benchmark:native-smoke` (+ `stress:smoke`); thresholds in `docs/NATIVE_BENCH_THRESHOLDS.md` |

## Feature Expansion Roadmap

| Feature | Status | JS | Android | iOS | C++ Core | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| Persistence + restore after relaunch | done | done | done | done | planned | Requires host app remap of JS closures — see `docs/PERSISTENCE.md` |
| Advanced scheduling DSL (calendar/cron+) | in_progress | in_progress | planned | planned | planned | Minute cron helper + enterprise doc; widen parser deliberately |
| Retry/backoff and cancellation tokens | planned | planned | planned | planned | planned | JS fields reserved (`ScheduleOptions.retry*`, correlation token) |
| Task tags + policy profiles | planned | planned | planned | planned | planned | `tagMaskFromStrings` scaffolding client-side (`docs/ENTERPRISE_EXTENSIONS.md`) |
| Process-death recovery matrix | done | n/a | n/a | n/a | planned | Behaviour captured in docs + PLATFORM matrix; host storage still required |

## Hardening and QA

| Feature | Status | JS | Android | iOS | C++ Core | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| Stress/fuzz/soak harness | done | done | planned | planned | planned | Node stress runner + checklist in `CONTRIBUTING.md` |
| Lifecycle transition reliability matrix | done | n/a | done | done | n/a | Documented in `docs/PLATFORM_LIFECYCLE_MATRIX.md` |
| Release quality gate (`verify:release`) | done | done | n/a | n/a | n/a | Runs typed smoke benchmarks before publish |

## Next Actions

| Action | Owner | Target Date | Status |
| --- | --- | --- | --- |
| Add hosted emulator/Xcode smoke lane for JNI/Swift bridging | TBD | TBD | planned |
| Promote richer retry/native token fields through Nitrogen | TBD | TBD | planned |
| Teach `SchedulerCore` about optional opaque metadata keys | TBD | TBD | planned |
