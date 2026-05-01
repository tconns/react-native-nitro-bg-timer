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
| Reliability scorecard (callback/drift/restore/battery) | planned | planned | planned | planned | planned | Required to prove top-tier stability against device variance |
| Benchmark baseline (scheduler throughput) | done | done | n/a | n/a | n/a | `benchmark:node` |
| Bridge overhead benchmark (typed vs JSON path) | done | done | n/a | n/a | n/a | `benchmark:bridge` |
| Native-path benchmark automation | done | smoke | smoke | smoke | smoke | CI smoke (`benchmark:native-smoke`) + nightly Android/iOS compile/runtime smoke; thresholds in `docs/NATIVE_BENCH_THRESHOLDS.md` |

## Feature Expansion Roadmap

| Feature | Status | JS | Android | iOS | C++ Core | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| Persistence + restore after relaunch | done | done | done | done | planned | Requires host app remap of JS closures — see `docs/PERSISTENCE.md` |
| Advanced scheduling DSL (calendar/cron+) | in_progress | in_progress | planned | planned | planned | Minute cron helper + enterprise doc; widen parser deliberately |
| Retry/backoff and cancellation tokens | planned | in_progress | planned | planned | planned | JS fields reserved; pending Nitro/native semantic wiring |
| Task tags + policy profiles | planned | in_progress | planned | planned | planned | `tagMaskFromStrings` scaffolding client-side; policy engine pending |
| Policy profile engine (`batterySaver`/`balanced`/`latencyFirst`) | planned | planned | planned | planned | planned | Strategic differentiator vs existing timer libraries |
| Process-death recovery matrix | done | n/a | n/a | n/a | planned | Behaviour captured in docs + PLATFORM matrix; host storage still required |

## Hardening and QA

| Feature | Status | JS | Android | iOS | C++ Core | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| Stress/fuzz/soak harness | done | done | planned | planned | planned | Node stress runner + checklist in `CONTRIBUTING.md` |
| Lifecycle transition reliability matrix | done | n/a | done | done | n/a | Documented in `docs/PLATFORM_LIFECYCLE_MATRIX.md` |
| Release quality gate (`verify:release`) | done | done | n/a | n/a | n/a | Runs typed smoke benchmarks before publish |
| Production observability event contract | in_progress | in_progress | planned | planned | planned | Event schema drafted in `docs/OBSERVABILITY_EVENT_CONTRACT.md`; native emitters pending |

## Next Actions

| Action | Owner | Target Date | Status |
| --- | --- | --- | --- |
| Add hosted iOS simulator app runtime lane for end-to-end callbacks | TBD | TBD | in_progress |
| Promote richer retry/native token fields through Nitrogen | TBD | TBD | planned |
| Teach `SchedulerCore` about optional opaque metadata keys | TBD | TBD | planned |
| Build reliability lab scorecard with callback/drift/restore/battery SLA | TBD | TBD | in_progress |
| Implement native policy profiles and parity tests across Android/iOS | TBD | TBD | in_progress |
| Publish production event schema + metadata safety constraints | TBD | TBD | in_progress |
