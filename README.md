# react-native-nitro-bg-timer

High-performance background-safe timers for React Native, powered by Nitro Modules.

`react-native-nitro-bg-timer` provides a simple timer API (`setTimeout`, `setInterval`) with native implementations on iOS and Android to reduce JS timer limitations while your app moves between foreground and background states.

![Release screenshot](docs/Screenshot%202026-04-29%20at%2023.35.36.png)

## Why this package

- Native-backed timers via Nitro Modules
- Same API shape as common JS timer usage
- Built for React Native apps needing better timer reliability in background flows
- Lightweight integration into existing projects

## Requirements

- React Native `>= 0.76`
- Node.js `>= 18`
- `react-native-nitro-modules` `>= 0.35.x`

## Installation

```bash
npm install react-native-nitro-bg-timer react-native-nitro-modules
```

or

```bash
yarn add react-native-nitro-bg-timer react-native-nitro-modules
```

## Platform setup

### iOS

This module uses `UIApplication.beginBackgroundTask` internally.  
It does **not** require runtime permissions and does **not** require `BGTaskScheduler` by default.

Background modes in `Info.plist` are optional and depend on your app use-case (audio, location, VOIP, fetch, etc). For pure timer usage with this package, keep your `Info.plist` minimal unless your app already needs specific background capabilities.

Install pods:

```bash
cd ios && pod install
```

### Android

This module acquires a `PARTIAL_WAKE_LOCK` while timers are active.

Add the following in your app manifest:

```xml
<uses-permission android:name="android.permission.WAKE_LOCK" />
```

`FOREGROUND_SERVICE` is **not required by this library itself** because it does not start a foreground service.  
Only add `FOREGROUND_SERVICE` if **your app** uses a foreground service for other background workloads.

## Platform permission/entitlement review

### iOS

- **Runtime permission prompt:** none
- **Required key for this library:** none
- **May be needed by your app:** `UIBackgroundModes` for app-specific background categories
- **Important behavior:** iOS can still suspend/terminate apps in background; timers are best-effort within iOS policy

### Android

- **Runtime permission prompt:** none
- **Required manifest permission for this library:** `android.permission.WAKE_LOCK`
- **Not required by this library:** `android.permission.FOREGROUND_SERVICE`
- **Important behavior:** OEM battery optimization/Doze can still impact timer reliability

## Usage

```ts
import { BackgroundTimer } from 'react-native-nitro-bg-timer'

const timeoutId = BackgroundTimer.setTimeout(() => {
  console.log('runs once after 5 seconds')
}, 5000)

const intervalId = BackgroundTimer.setInterval(() => {
  console.log('runs every 2 seconds')
}, 2000)

// cleanup
BackgroundTimer.clearTimeout(timeoutId)
BackgroundTimer.clearInterval(intervalId)
```

## Example: React screen with safe cleanup

```tsx
import React, { useEffect, useRef, useState } from 'react'
import { AppState, Button, Text, View } from 'react-native'
import { BackgroundTimer } from 'react-native-nitro-bg-timer'

export function TimerDemoScreen() {
  const [ticks, setTicks] = useState(0)
  const [appState, setAppState] = useState(AppState.currentState)
  const intervalIdRef = useRef<number | null>(null)
  const timeoutIdRef = useRef<number | null>(null)

  useEffect(() => {
    const sub = AppState.addEventListener('change', setAppState)
    return () => sub.remove()
  }, [])

  const startInterval = () => {
    if (intervalIdRef.current != null) return
    intervalIdRef.current = BackgroundTimer.setInterval(() => {
      setTicks(prev => prev + 1)
    }, 1000)
  }

  const stopInterval = () => {
    if (intervalIdRef.current == null) return
    BackgroundTimer.clearInterval(intervalIdRef.current)
    intervalIdRef.current = null
  }

  const runTimeout = () => {
    if (timeoutIdRef.current != null) {
      BackgroundTimer.clearTimeout(timeoutIdRef.current)
    }
    timeoutIdRef.current = BackgroundTimer.setTimeout(() => {
      console.log('timeout fired')
      timeoutIdRef.current = null
    }, 5000)
  }

  useEffect(() => {
    return () => {
      if (intervalIdRef.current != null) {
        BackgroundTimer.clearInterval(intervalIdRef.current)
      }
      if (timeoutIdRef.current != null) {
        BackgroundTimer.clearTimeout(timeoutIdRef.current)
      }
    }
  }, [])

  return (
    <View style={{ padding: 16, gap: 8 }}>
      <Text>AppState: {appState}</Text>
      <Text>Ticks: {ticks}</Text>
      <Button title="Start interval (1s)" onPress={startInterval} />
      <Button title="Stop interval" onPress={stopInterval} />
      <Button title="Run timeout (5s)" onPress={runTimeout} />
    </View>
  )
}
```

## API

### V2 scheduler API

The v1 API remains supported, but v2 introduces scheduler-first features:

```ts
import { BackgroundScheduler, BackgroundTimer } from 'react-native-nitro-bg-timer'

const handle = BackgroundTimer.schedule(() => {
  console.log('job fired')
}, {
  kind: 'interval',
  intervalMs: 1000,
  group: 'sync',
  priority: 'interactive',
  driftPolicy: 'coalesce',
})

BackgroundTimer.pauseGroup('sync')
BackgroundTimer.resumeGroup('sync')
BackgroundTimer.cancelGroup('sync')

const cronHandle = BackgroundScheduler.scheduleCron(() => {
  console.log('every 2 minutes')
}, '*/2 * * * *')

handle.cancel()
cronHandle.cancel()
```

Supported v2 additions:

- `BackgroundTimer.schedule(callback, options)`
- `BackgroundTimer.pauseGroup(group)`
- `BackgroundTimer.resumeGroup(group)`
- `BackgroundTimer.cancelGroup(group)`
- `BackgroundTimer.listActiveTimerIds()`
- `BackgroundTimer.getStats()`
- `BackgroundTimer.onStats(listener)`
- `BackgroundScheduler.scheduleAt(callback, runAtMs, options?)`
- `BackgroundScheduler.scheduleInterval(callback, intervalMs, options?)`
- `BackgroundScheduler.scheduleCron(callback, expression, options?)`

### `BackgroundTimer.setTimeout(callback, durationMs): number`

Schedules a one-time callback.

- `callback`: function to execute
- `durationMs`: delay in milliseconds
- returns timer `id`

### `BackgroundTimer.clearTimeout(id): void`

Cancels a timeout by id.

### `BackgroundTimer.setInterval(callback, intervalMs): number`

Schedules a repeating callback.

- `callback`: function to execute each interval
- `intervalMs`: interval in milliseconds
- returns timer `id`

### `BackgroundTimer.clearInterval(id): void`

Cancels an interval by id.

## Recommended usage pattern (React)

Always clear active timers when a screen/component unmounts:

```ts
import { useEffect } from 'react'
import { BackgroundTimer } from 'react-native-nitro-bg-timer'

useEffect(() => {
  const id = BackgroundTimer.setInterval(() => {
    // do work
  }, 1000)

  return () => {
    BackgroundTimer.clearInterval(id)
  }
}, [])
```

## Important notes

- iOS background execution time is limited by system policies.
- Android behavior can still be affected by OEM battery restrictions.
- For heavy or long-running workloads, consider combining with platform-native job schedulers.
- This library is timer-focused; it is not a guaranteed persistent job scheduler across process death.

## Troubleshooting

### `Unable to resolve module react-native-nitro-bg-timer`

- Ensure package exists in app `node_modules`
- Reinstall dependencies: `rm -rf node_modules && npm install`
- Reset metro cache: `npx react-native start --reset-cache`

### Timers do not fire reliably in background

- Verify Android `WAKE_LOCK` is present in your app manifest
- On iOS, remember execution is still bounded by OS background limits
- Test on real devices (some emulator/background behaviors differ)

### iOS build/pod issues

- Run `cd ios && pod install`
- Open `.xcworkspace` (not `.xcodeproj`) in Xcode

## Development

When updating Nitro specs (`src/specs/*.nitro.ts`), regenerate artifacts:

```bash
npx nitrogen
```

Useful scripts:

- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `npm run specs`
- `npm run benchmark:node`
- `npm run benchmark:bridge`
- `npm run verify:release`

## QA checklist (production)

- Validate v1 compatibility (`setTimeout`, `setInterval`) in a host app.
- Validate v2 grouped controls (`pauseGroup`, `resumeGroup`, `cancelGroup`).
- Run real-device background scenario for at least 20 minutes on Android and iOS.
- Validate jitter under load (>=1k active intervals) and inspect `BackgroundTimer.getStats()`.
- Test foreground/background transitions repeatedly to catch lifecycle race conditions.

## Compatibility matrix

| React Native | Nitro Modules | Status |
| --- | --- | --- |
| `0.80.x` | `0.35.x` | first-class support |
| `0.76 - 0.79` | `0.35.x` | expected to work, validate in host app CI |

## Release notes

- `0.4.0` (planned): scheduler-first v2 API, grouped controls, drift policies, and runtime stats.

## Project structure

- `src/`: TypeScript API surface
- `src/specs/`: Nitro interface definitions
- `android/`: Android native implementation
- `ios/`: iOS native implementation
- `cpp/`: shared native scheduler core (C++)
- `nitrogen/`: generated Nitro bindings
- `lib/`: compiled output
- `docs/ARCHITECTURE.md`: v2 runtime architecture notes
- `docs/PLATFORM_LIFECYCLE_MATRIX.md`: platform behavior matrix
- `docs/MIGRATION_V2.md`: migration cookbook for v2
- `docs/FEATURE_UPGRADE_STATUS.md`: comprehensive feature/status tracker

## Implementation plan (to-do)

Status legend:

- `[x]` done
- `[ ]` planned
- `[~]` in progress

### Core implementation

- [x] Nitro module bridge for iOS and Android
- [x] API surface: `setTimeout`, `clearTimeout`, `setInterval`, `clearInterval`
- [x] JS wrapper with callback maps and timer id management
- [x] iOS background task integration via `beginBackgroundTask`
- [x] Android wake lock integration via `PARTIAL_WAKE_LOCK`
- [x] Basic cleanup handling on timer clear and object cleanup

### Documentation and developer experience

- [x] Installation and platform setup guide
- [x] Platform permission/entitlement review section
- [x] Practical React usage example with cleanup
- [~] Add production test checklist for QA (real-device background scenarios)
- [ ] Add compatibility matrix (RN version x Nitro version x platform notes)
- [ ] Add release notes section per version

### Reliability improvements (planned)

- [ ] Add timer drift tracking and correction strategy
- [ ] Add optional diagnostics API (active timers, last run, runtime stats)
- [ ] Add richer error propagation strategy from native callbacks
- [ ] Add stress-test example app scenario and benchmark script

### Scheduling features (planned)

- [ ] Grouped timers (tag/group based cancel)
- [ ] Optional scheduling policies (jitter, max runs, retry/backoff)
- [ ] Persistent timer restore strategy across app relaunch

### Platform hardening (planned)

- [ ] Android battery optimization guide and helper recommendations
- [ ] iOS lifecycle behavior matrix (foreground, background, suspended)
- [ ] Optional integration path with job schedulers for long-running tasks

## License

MIT © [Thành Công](https://github.com/tconns)

<a href="https://www.buymeacoffee.com/tconns94" target="_blank">
  <img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt="Buy Me A Coffee" width="200"/>
</a>
