# ⚡ react-native-nitro-bg-timer

<p align="center">
  <b>Production-grade background-safe timers for React Native.</b><br/>
  Powered by Nitro Modules with a shared C++ scheduler core on Android and iOS.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/react-native-nitro-bg-timer"><img alt="npm version" src="https://img.shields.io/npm/v/react-native-nitro-bg-timer?color=2ea44f"></a>
  <a href="https://www.npmjs.com/package/react-native-nitro-bg-timer"><img alt="npm downloads" src="https://img.shields.io/npm/dm/react-native-nitro-bg-timer?color=blue"></a>
  <img alt="platform" src="https://img.shields.io/badge/platform-iOS%20%7C%20Android-8A2BE2">
  <img alt="native stack" src="https://img.shields.io/badge/native-C%2B%2B%20%7C%20Swift%20%7C%20Kotlin-orange">
  <img alt="license" src="https://img.shields.io/badge/license-MIT-brightgreen">
</p>

---

## 🚀 Release Status

This package is being finalized for the **official 1.x stable line**.

- `0.x`: rapid iteration and compatibility hardening
- `1.x`: stable public contract
- SemVer policy: breaking changes only in major releases

See `docs/RELEASE_GOVERNANCE.md` and `docs/FEATURE_UPGRADE_STATUS.md` for release gates and live status.

---

## ✨ Why Teams Choose It

- 🔥 Native-backed timers through Nitro Modules
- 🧠 Shared C++ scheduler core for cross-platform consistency
- 🎯 Legacy API + scheduler-first API in one package
- 🧩 Group controls and drift policies
- 📊 Stats and lifecycle events for production observability
- 🛡️ Retry/token/profile metadata flow with validation safeguards

## C++ and Native Performance Proof

This module runs critical scheduling paths in native code (C++ core + Swift/Kotlin adapters) instead of keeping hot scheduling loops in JavaScript.

- Typed bridge overhead improvement: about `99%` faster than JSON bridge path (`benchmark:bridge`).
- Native C++ core load benchmark: around `15ms` for `50,000` tasks on recent CI runs (`benchmark:core-native`).
- Stress smoke signal: `p95 ~ 3.5ms`, heap delta about `4.6MB` (`stress:smoke`).

These numbers come from the current release verification lane (`npm run verify:release`) and are intended as practical indicators, not synthetic peak claims.

---

## 📦 Requirements

- React Native `>= 0.76`
- Node.js `>= 18`
- `react-native-nitro-modules` `>= 0.35.x`

---

## 🛠 Installation

```bash
npm install react-native-nitro-bg-timer react-native-nitro-modules
```

or

```bash
yarn add react-native-nitro-bg-timer react-native-nitro-modules
```

---

## 🧭 Platform Setup

### iOS

- Uses `UIApplication.beginBackgroundTask` internally
- No runtime permission prompt
- `BGTaskScheduler` is not required by default

```bash
cd ios && pod install
```

### Android

This library uses `PARTIAL_WAKE_LOCK` while timers are active.

```xml
<uses-permission android:name="android.permission.WAKE_LOCK" />
```

`FOREGROUND_SERVICE` is not required unless your app uses foreground services for other workloads.

## Expo Integration (SDK 55+)

This package contains native code, so Expo integration requires native project generation.

- Expo Go: not supported for this library.
- Expo Managed + Dev Client: supported via config plugin + prebuild.
- Bare Expo projects: supported as a standard React Native native module.

### app.json / app.config.js

```json
{
  "expo": {
    "plugins": ["react-native-nitro-bg-timer"]
  }
}
```

### Setup flow (Managed + Dev Client)

```bash
npx expo install react-native-nitro-bg-timer react-native-nitro-modules
npx expo prebuild
npx expo run:android
# or
npx expo run:ios
```

The included Expo config plugin automatically injects `android.permission.WAKE_LOCK` during prebuild.

### Tested matrix

| Expo SDK | React Native | Status |
| --- | --- | --- |
| 55 | 0.83.x (Expo default) | planned validation target on `expo-support` branch |
| 54 | 0.81.x/0.82.x | expected to work; verify in host app |

### Expo troubleshooting

- Permission not present after install: run `npx expo prebuild --clean`.
- Native changes not picked up: remove native folders and prebuild again.
- Build fails after SDK upgrade: align Expo SDK + RN versions before prebuild.

---

## ⚡ Quick Start

```ts
import { BackgroundTimer } from 'react-native-nitro-bg-timer'

const timeoutId = BackgroundTimer.setTimeout(() => {
  console.log('Runs once after 5 seconds')
}, 5000)

const intervalId = BackgroundTimer.setInterval(() => {
  console.log('Runs every 2 seconds')
}, 2000)

BackgroundTimer.clearTimeout(timeoutId)
BackgroundTimer.clearInterval(intervalId)
```

---

## 🧠 Scheduler API (1.x Preferred)

```ts
import { BackgroundTimer, BackgroundScheduler } from 'react-native-nitro-bg-timer'

const handle = BackgroundTimer.schedule(() => {
  console.log('Sync fired')
}, {
  kind: 'interval',
  intervalMs: 1000,
  group: 'sync',
  driftPolicy: 'coalesce',
  retryMaxAttempts: 3,
  retryInitialBackoffMs: 250,
  cancellationToken: 'sync-job',
  policyProfile: 'balanced',
  tags: ['sync', 'foreground'],
})

BackgroundTimer.pauseGroup('sync')
BackgroundTimer.resumeGroup('sync')

const cronHandle = BackgroundScheduler.scheduleCron(() => {
  console.log('Every 2 minutes')
}, '*/2 * * * *')

handle.cancel()
cronHandle.cancel()
```

---

## 📚 API Overview

### `BackgroundTimer`

- `setTimeout(callback, durationMs): number`
- `clearTimeout(id): void`
- `setInterval(callback, intervalMs): number`
- `clearInterval(id): void`
- `schedule(callback, options): ScheduledTaskHandle`
- `pauseGroup(group): number`
- `resumeGroup(group): number`
- `cancelGroup(group): number`
- `listActiveTimerIds(): number[]`
- `getStats(): SchedulerStats`
- `onStats(listener): () => void`
- `onEvent(listener): () => void`
- `getPersistWireJson(): string`
- `restorePersistWireJson(wireJson): void`

### `BackgroundScheduler`

- `scheduleAt(callback, runAtMs, options?)`
- `scheduleInterval(callback, intervalMs, options?)`
- `scheduleCron(callback, expression, options?)`

---

## 🔄 Migration Guidance

- Existing timer usage (`setTimeout`, `setInterval`) remains supported.
- New code should prefer `BackgroundTimer.schedule(...)` and `BackgroundScheduler.*`.
- For migration details, see `docs/MIGRATION_V2.md`.

---

## 🧪 Verification & Benchmarks

- `npm run test`
- `npm run benchmark:node`
- `npm run benchmark:bridge`
- `npm run benchmark:core-native`
- `npm run stress:smoke`
- `npm run stress:soak`
- `npm run benchmark:native-smoke`
- `npm run verify:release`

`npm run verify:release` is the recommended pre-publish gate.

---

## 📊 Reliability Notes

- iOS execution remains bounded by OS lifecycle policy.
- Android behavior may vary under OEM battery optimization and Doze.
- For durable long-running workloads, combine with platform job schedulers.

---

## 🔗 Documentation

Core docs:

- `docs/FEATURE_UPGRADE_STATUS.md`
- `docs/RELEASE_GOVERNANCE.md`
- `docs/MIGRATION_V2.md`
- `docs/OBSERVABILITY_EVENT_CONTRACT.md`
- `docs/NATIVE_BENCH_THRESHOLDS.md`
- `docs/RELIABILITY_LAB_SCORECARD.md`
- `docs/PERSISTENCE.md`
- `docs/PLATFORM_LIFECYCLE_MATRIX.md`

---

## 🤝 Contributing

When changing Nitro specs (`src/specs/*.nitro.ts`), regenerate bindings:

```bash
npx nitrogen
```

Before opening PRs:

```bash
npm run verify:release
```

---

## Acknowledgements

Special thanks to the following open-source projects which inspired and supported the development of this library:

- [mrousavy/nitro](https://github.com/mrousavy/nitro) – for the Nitro Modules architecture and tooling

## 📄 License

MIT © [Thành Công](https://github.com/tconns)


<a href="https://www.buymeacoffee.com/tconns94" target="_blank">
  <img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt="Buy Me A Coffee" width="200"/>
</a>
