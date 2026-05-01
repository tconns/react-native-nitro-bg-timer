# Migration Guide: v1 to v2

## What stays the same

- `BackgroundTimer.setTimeout`
- `BackgroundTimer.clearTimeout`
- `BackgroundTimer.setInterval`
- `BackgroundTimer.clearInterval`

## New capabilities

- Generic scheduler API with structured options.
- Group operations for bulk lifecycle controls.
- Cron shorthand (`*/N * * * *`) for simple periodic use-cases.
- Runtime stats (`getStats`) and event hook (`onStats`).

## Typical migration

### v1

```ts
const id = BackgroundTimer.setInterval(work, 1000)
BackgroundTimer.clearInterval(id)
```

### v2

```ts
const handle = BackgroundTimer.schedule(work, {
  kind: 'interval',
  intervalMs: 1000,
  group: 'sync',
  driftPolicy: 'coalesce',
})
handle.cancel()
```

## Rollout strategy

1. Keep v1 API in place.
2. Migrate one feature area to v2 scheduler.
3. Monitor `getStats()` in QA/prod canary.
4. Move remaining timer callsites.
