# Migration Guide: Legacy Timer API to Scheduler API

This guide explains how to move from legacy timer calls to the scheduler-first API used as the preferred surface in the 1.x line.

## What stays the same

- `BackgroundTimer.setTimeout`
- `BackgroundTimer.clearTimeout`
- `BackgroundTimer.setInterval`
- `BackgroundTimer.clearInterval`

These APIs remain supported for compatibility.

## What you gain with scheduler API

- Structured scheduling options
- Group controls (`pauseGroup`, `resumeGroup`, `cancelGroup`)
- Drift policies (`catchUp`, `skipLate`, `coalesce`)
- Optional retry/cancellation/profile metadata fields
- Runtime observability with stats and lifecycle events

## Typical migration

### Legacy style

```ts
const id = BackgroundTimer.setInterval(work, 1000)
BackgroundTimer.clearInterval(id)
```

### Scheduler style (preferred)

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

1. Keep existing legacy calls stable.
2. Move one feature area to scheduler API.
3. Validate behavior with `BackgroundTimer.getStats()` and event hooks.
4. Expand migration to remaining call sites.

## Expo projects

- Expo Go is not supported because this library depends on native modules.
- Use Expo Dev Client with prebuild:
  1. add plugin in app config: `"plugins": ["react-native-nitro-bg-timer"]`
  2. run `npx expo prebuild`
  3. run `npx expo run:android` or `npx expo run:ios`
