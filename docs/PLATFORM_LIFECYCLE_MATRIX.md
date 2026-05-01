# Platform Lifecycle Matrix

## iOS

- **Foreground active**: high timer reliability.
- **Background running**: best-effort within `beginBackgroundTask` time budget.
- **Suspended**: callbacks can stop; no hard realtime guarantee.
- **Terminated**: in-memory schedules are lost.

## Android

- **Foreground active**: high timer reliability.
- **Background with wake lock**: improved continuity for short-lived workloads.
- **Doze/OEM battery saver**: callback timing can be delayed.
- **Process death**: in-memory schedules are lost.

## Recommended SLA communication

- Advertise P95/P99 jitter targets separately for foreground/background.
- Treat terminated-process restore as opt-in capability, not default guarantee.
- Validate on representative OEM devices before shipping critical flows.
