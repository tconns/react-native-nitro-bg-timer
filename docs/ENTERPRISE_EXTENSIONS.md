# Enterprise scheduling roadmap

This note tracks optional control-plane primitives that deliberately ship **incrementally**. Nothing here is required for standard timer usage.

## JavaScript façade (today)

| Capability | Surface | Notes |
| ---------- | ------- | ----- |
| Tag routing hint | `tagMaskFromStrings` + `ScheduleOptions.tagMaskHint` | Forwarded to native metadata payload; behavior routing still incremental |
| Correlation bookkeeping | `ScheduleOptions.correlationToken` | Forwarded through Nitro/native metadata for telemetry joins |
| Retry knobs | `retryMaxAttempts`, `retryInitialBackoffMs` | Forwarded through Nitro/native metadata; JS wrapper retries callback failures |
| Cancellation token | `ScheduleOptions.cancellationToken` | Forwarded and normalized in metadata payload |
| Policy profile | `ScheduleOptions.policyProfile` | Supported values: `batterySaver` / `balanced` / `latencyFirst`; profile clamping applied natively |
| Priority string | `ScheduleOptions.priority` | Forward-compat hint for future policy routers |

Cron-style helpers remain in [`src/scheduler-utils.ts`](../src/scheduler-utils.ts) (`cronToIntervalMs`).

## Nitro bridge (in_progress)

Current typed fields already extended in `NitroBackgroundTimer.nitro.ts` for retry/token/tag/profile. Remaining work focuses on deeper native semantics and governance:

- Structured retry metadata (`attempt`, `strategy`)
- Signed cancellation handles shared with workers/actors
- Policy profile ids derived from hashed tag tuples
- Opaque blobs referenced by datastore keys attached to persisted wire entries

Coordinate any signature change with `npm run specs` and update Android/iOS shims concurrently.

## Native core (in_progress)

Once both platforms permanently route through [`cpp/SchedulerCore`](../cpp/SchedulerCore.hpp), we can hoist tag masks, backoff policies, and lightweight validation into C++ without duplicating semantics per adapter.
