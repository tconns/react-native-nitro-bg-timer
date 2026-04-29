# react-native-nitro-bg-timer

High-performance background-safe timers for React Native, powered by Nitro Modules.

`react-native-nitro-bg-timer` provides a simple timer API (`setTimeout`, `setInterval`) with native implementations on iOS and Android to reduce JS timer limitations while your app moves between foreground and background states.

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

Add background modes in `Info.plist`:

```xml
<key>UIBackgroundModes</key>
<array>
  <string>background-processing</string>
  <string>background-fetch</string>
</array>
```

Then install pods:

```bash
cd ios && pod install
```

### Android

Add required permissions in `android/app/src/main/AndroidManifest.xml`:

```xml
<uses-permission android:name="android.permission.WAKE_LOCK" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
```

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

## API

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

## Troubleshooting

### `Unable to resolve module react-native-nitro-bg-timer`

- Ensure package exists in app `node_modules`
- Reinstall dependencies: `rm -rf node_modules && npm install`
- Reset metro cache: `npx react-native start --reset-cache`

### Timers do not fire reliably in background

- Verify iOS `UIBackgroundModes` setup
- Verify Android permissions in `AndroidManifest.xml`
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
- `npm run specs`

## Project structure

- `src/`: TypeScript API surface
- `src/specs/`: Nitro interface definitions
- `android/`: Android native implementation
- `ios/`: iOS native implementation
- `nitrogen/`: generated Nitro bindings
- `lib/`: compiled output

## Roadmap (short-term)

- Better scheduling controls (policies/options)
- Improved diagnostics and debug hooks
- Stronger background reliability strategy across app lifecycle transitions

## License

MIT © [Thành Công](https://github.com/tconns)
