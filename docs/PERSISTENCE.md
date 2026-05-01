# Persistence and replay semantics

Timers cannot resurrect JavaScript closures after process death. The native runtime therefore exposes a **wire snapshot** (`getPersistWireJson`) containing only scheduler metadata. Applications must remap ids to JS work during cold start (`restorePersistWireJson`), then reschedule user callbacks explicitly.

## Wire schema v1

```json
{
  "version": 1,
  "tasks": [
    {
      "id": 1,
      "dueAtMs": 1714500000123,
      "kind": "interval",
      "intervalMs": 5000,
      "group": "sync",
      "driftPolicy": "coalesce",
      "maxRuns": -1,
      "runCount": 12,
      "paused": false
    }
  ]
}
```

Fields mirror `SchedulerCore::TaskRecord` plus `paused`. `maxRuns` uses `-1` for “unbounded interval” semantics (matches the JNI/Swift adapters).

### Platform notes

| Platform | Snapshot source | Restore |
| -------- | ---------------- | ------- |
| Android + `USE_CPP_SCHEDULER=true` | `SchedulerNative.nativeExportPersistWireJson` → C++ snapshot | Parses JSON on the JNI side caller (Kotlin `restorePersistWireJson`) then `nativeImportTask` for each row after `nativeClearAll` |
| iOS + C++ bridge | `SchedulerCppBridge.exportPersistWireJson()` | Parses JSON inside `restorePersistWireJson` on the main queue |
| Kotlin-only fallback (`USE_CPP_SCHEDULER=false`) | Best-effort export from the in-memory map | **`restorePersistWireJson` intentionally no-ops** — enable the C++ path for restores |
| Swift legacy fallback | Mirrors Kotlin export | Logs and skips restore until the C++ path is enabled |

## Replay policies (recommended app behavior)

Applications should decide how to reconcile `dueAtMs` after a restart:

| Policy | Behaviour |
| ------ | --------- |
| `skipMissed` | If `dueAtMs < now`, drop the occurrence or reschedule at `now + interval` depending on UX |
| `runOnceImmediately` | Fire overdue work once synchronously during startup planners, then realign timers |
| `coalesceBurst` | Collapse backlog into a single catch-up invocation per id |

Persist opaque domain metadata (SKU, job name, deeplink targets) separately (secure storage/DataStore/UserDefaults keyed by timer id).

## Operational checklist

1. Persist the wire blob before terminating critical flows (manual trigger from JS is easiest today).
2. On startup, hydrate native state with `restorePersistWireJson`.
3. Reattach JS callbacks based on surviving ids emitted from `listActiveTimerIds()` or decoded from paired app metadata.
4. Decide how to reconcile lateness (`skipMissed` vs immediate catch-up).

This module intentionally avoids dictating filesystem locations so host apps choose SQLite, DataStore, encrypted prefs, etc.
