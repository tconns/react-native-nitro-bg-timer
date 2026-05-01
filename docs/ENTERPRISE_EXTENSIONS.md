# Enterprise scheduling roadmap

This note tracks optional control-plane primitives that deliberately ship **incrementally**. Nothing here is required for standard timer usage.

## JavaScript façade (today)

| Capability | Surface | Notes |
| ---------- | ------- | ----- |
| Tag routing hint | `tagMaskFromStrings` + `ScheduleOptions.tagMaskHint` | Computed client-side unless you augment the persisted wire externally |
| Correlation bookkeeping | `ScheduleOptions.correlationToken` | Not forwarded natively yet; usable for telemetry while firing |
| Retry knobs | `retryMaxAttempts`, `retryInitialBackoffMs` | Reserved for layered retry wrappers; compose with `BackgroundTimer.schedule` in app code until native backoff lands |
| Priority string | `ScheduleOptions.priority` | Forward-compat hint; native routers may interpret when policy profiles ship |

Cron-style helpers remain in [`src/scheduler-utils.ts`](../src/scheduler-utils.ts) (`cronToIntervalMs`).

## Nitro bridge (planned)

Future typed fields may extend `NitroBackgroundTimer.nitro.ts` without breaking callers by appending defaulted parameters:

- Structured retry metadata (`attempt`, `strategy`)
- Signed cancellation handles shared with workers/actors
- Policy profile ids derived from hashed tag tuples
- Opaque blobs referenced by datastore keys attached to persisted wire entries

Coordinate any signature change with `npm run specs` and update Android/iOS shims concurrently.

## Native core (planned)

Once both platforms permanently route through [`cpp/SchedulerCore`](../cpp/SchedulerCore.hpp), we can hoist tag masks, backoff policies, and lightweight validation into C++ without duplicating semantics per adapter.
