# Nitro BG Timer V2 Architecture

## Overview

V2 uses a scheduler-first model:

- JS/TS side submits scheduling intents.
- Native side keeps a centralized queue.
- A single native tick drives due task dispatch.
- Callback telemetry is exposed through `getStats()`.

## Data flow

1. App schedules with `BackgroundTimer.schedule(...)`.
2. JS passes typed scheduling fields over Nitro bridge (`kind`, `intervalMs`, `group`, `driftPolicy`, `maxRuns`).
3. Native scheduler stores task metadata and computes next dispatch.
4. Scheduler wakes once for earliest due task.
5. Due tasks invoke callback through Nitro bridge.
6. Interval tasks re-enqueue according to drift policy.

## Performance model

- Single scheduling loop instead of one timer per task.
- O(log n) queue operations.
- Group controls (`pauseGroup`, `resumeGroup`, `cancelGroup`) enable bulk operations.
- Built-in stats support release performance gating.
- Shared C++ scheduler core (`cpp/SchedulerCore.*`) is available as the cross-platform engine foundation.
