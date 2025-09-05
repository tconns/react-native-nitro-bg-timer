# react-native-nitro-bg-timer

Native background timer for React Native built with Nitro Modules.

## Overview

This module provides high-performance background timer functionality for React Native applications. It allows you to run timers (setTimeout, setInterval) that continue to work even when the app is in the background, built with Nitro Modules for optimal native performance.

## Features

- ⚡ High-performance native implementation using Nitro Modules
- 🎯 Background-safe timers (setTimeout, clearTimeout, setInterval, clearInterval)
- 🔄 Continues running when app is backgrounded
- 📱 Cross-platform support (iOS & Android)
- 🚀 Zero-bridge overhead with direct native calls
- 🛡️ Memory-safe with automatic cleanup

## Requirements

- React Native >= 0.76
- Node >= 18
- `react-native-nitro-modules` must be installed (Nitro runtime)

## Installation

```bash
npm install react-native-nitro-bg-timer react-native-nitro-modules
# or
yarn add react-native-nitro-bg-timer react-native-nitro-modules
```

## Platform Configuration

### iOS

Add background processing capability to your `Info.plist`:

```xml
<key>UIBackgroundModes</key>
<array>
    <string>background-processing</string>
    <string>background-fetch</string>
</array>
```

For background tasks to work properly, you may also need to register background task identifiers in your `Info.plist`:

```xml
<key>BGTaskSchedulerPermittedIdentifiers</key>
<array>
    <string>com.yourapp.background-timer</string>
</array>
```

### Android

Add the following permissions to your `android/app/src/main/AndroidManifest.xml`:

```xml
<manifest xmlns:android="http://schemas.android.com/apk/res/android">
    <!-- Allow the app to run in background -->
    <uses-permission android:name="android.permission.WAKE_LOCK" />
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
    
    <application
        android:name=".MainApplication"
        android:allowBackup="false"
        android:theme="@style/AppTheme">
            
        <activity
            android:name=".MainActivity"
            android:exported="true"
            android:theme="@style/LaunchTheme">
            <!-- Your existing activity configuration -->
        </activity>
    </application>
</manifest>
```

## Quick Usage

```ts
import { BackgroundTimer } from 'react-native-nitro-bg-timer'

// setTimeout - runs once after delay
const timeoutId = BackgroundTimer.setTimeout(() => {
  console.log('This runs after 5 seconds, even in background!')
}, 5000)

// Clear timeout if needed
BackgroundTimer.clearTimeout(timeoutId)

// setInterval - runs repeatedly
const intervalId = BackgroundTimer.setInterval(() => {
  console.log('This runs every 2 seconds, even in background!')
}, 2000)

// Clear interval when done
BackgroundTimer.clearInterval(intervalId)
```

## API Reference

### BackgroundTimer

The main API object providing background-safe timer functionality.

#### `setTimeout(callback: () => void, duration: number): number`

Creates a timer that calls the callback function after the specified duration.

- **callback**: Function to execute after the timer expires
- **duration**: Time in milliseconds to wait before executing the callback
- **Returns**: Timer ID that can be used with `clearTimeout`

```ts
const id = BackgroundTimer.setTimeout(() => {
  console.log('Timer executed!')
}, 3000)
```

#### `clearTimeout(id: number): void`

Cancels a timeout timer created with `setTimeout`.

- **id**: Timer ID returned from `setTimeout`

```ts
const id = BackgroundTimer.setTimeout(() => {
  console.log('This will not run')
}, 5000)

BackgroundTimer.clearTimeout(id) // Cancel the timer
```

#### `setInterval(callback: () => void, interval: number): number`

Creates a timer that repeatedly calls the callback function at specified intervals.

- **callback**: Function to execute on each interval
- **interval**: Time in milliseconds between each execution
- **Returns**: Timer ID that can be used with `clearInterval`

```ts
const id = BackgroundTimer.setInterval(() => {
  console.log('Repeating timer!')
}, 1000) // Runs every second
```

#### `clearInterval(id: number): void`

Cancels an interval timer created with `setInterval`.

- **id**: Timer ID returned from `setInterval`

```ts
const id = BackgroundTimer.setInterval(() => {
  console.log('This will stop after 10 seconds')
}, 1000)

// Stop the interval after 10 seconds
BackgroundTimer.setTimeout(() => {
  BackgroundTimer.clearInterval(id)
}, 10000)
```

## Real-world Examples

### Basic Timer Usage

```ts
import React, { useEffect, useState } from 'react'
import { View, Text, Button } from 'react-native'
import { BackgroundTimer } from 'react-native-nitro-bg-timer'

const TimerExample = () => {
  const [seconds, setSeconds] = useState(0)
  const [intervalId, setIntervalId] = useState<number | null>(null)

  const startTimer = () => {
    const id = BackgroundTimer.setInterval(() => {
      setSeconds(prev => prev + 1)
    }, 1000)
    setIntervalId(id)
  }

  const stopTimer = () => {
    if (intervalId) {
      BackgroundTimer.clearInterval(intervalId)
      setIntervalId(null)
    }
  }

  const resetTimer = () => {
    stopTimer()
    setSeconds(0)
  }

  useEffect(() => {
    return () => {
      if (intervalId) {
        BackgroundTimer.clearInterval(intervalId)
      }
    }
  }, [intervalId])

  return (
    <View style={{ padding: 20 }}>
      <Text style={{ fontSize: 24, textAlign: 'center' }}>
        Timer: {seconds}s
      </Text>
      <Button title="Start" onPress={startTimer} disabled={!!intervalId} />
      <Button title="Stop" onPress={stopTimer} disabled={!intervalId} />
      <Button title="Reset" onPress={resetTimer} />
    </View>
  )
}
```

### Background Task Simulation

```ts
import { BackgroundTimer } from 'react-native-nitro-bg-timer'

class BackgroundTaskManager {
  private taskId: number | null = null

  startPeriodicSync(interval: number = 30000) { // 30 seconds
    this.taskId = BackgroundTimer.setInterval(() => {
      this.performBackgroundSync()
    }, interval)
  }

  stopPeriodicSync() {
    if (this.taskId) {
      BackgroundTimer.clearInterval(this.taskId)
      this.taskId = null
    }
  }

  private async performBackgroundSync() {
    try {
      // Simulate API call or data processing
      console.log('Performing background sync...', new Date().toISOString())
      
      // Your background logic here
      // await syncDataWithServer()
      // await processLocalData()
      
    } catch (error) {
      console.error('Background sync failed:', error)
    }
  }

  scheduleDelayedTask(delay: number, task: () => void) {
    return BackgroundTimer.setTimeout(task, delay)
  }
}

// Usage
const taskManager = new BackgroundTaskManager()

// Start periodic background sync
taskManager.startPeriodicSync(60000) // Every minute

// Schedule a one-time delayed task
taskManager.scheduleDelayedTask(5000, () => {
  console.log('Delayed task executed!')
})
```

### React Hook for Background Timers

```ts
import { useEffect, useRef, useCallback } from 'react'
import { BackgroundTimer } from 'react-native-nitro-bg-timer'

export const useBackgroundTimer = (
  callback: () => void,
  interval: number,
  immediate: boolean = false
) => {
  const intervalRef = useRef<number | null>(null)
  const savedCallback = useRef(callback)

  // Remember the latest callback
  useEffect(() => {
    savedCallback.current = callback
  }, [callback])

  const start = useCallback(() => {
    if (intervalRef.current) return // Already running

    if (immediate) {
      savedCallback.current()
    }

    intervalRef.current = BackgroundTimer.setInterval(() => {
      savedCallback.current()
    }, interval)
  }, [interval, immediate])

  const stop = useCallback(() => {
    if (intervalRef.current) {
      BackgroundTimer.clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }, [])

  const restart = useCallback(() => {
    stop()
    start()
  }, [stop, start])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stop()
    }
  }, [stop])

  return { start, stop, restart, isRunning: !!intervalRef.current }
}

// Usage in component
const MyComponent = () => {
  const { start, stop, isRunning } = useBackgroundTimer(
    () => console.log('Background task executed!'),
    5000, // 5 seconds
    true  // Run immediately
  )

  return (
    <View>
      <Button 
        title={isRunning ? "Stop Timer" : "Start Timer"} 
        onPress={isRunning ? stop : start} 
      />
    </View>
  )
}
```

## Best Practices

### Memory Management

Always clean up timers to prevent memory leaks:

```ts
useEffect(() => {
  const timers: number[] = []

  // Store timer IDs
  timers.push(BackgroundTimer.setInterval(() => {
    // Your logic
  }, 1000))

  timers.push(BackgroundTimer.setTimeout(() => {
    // Your logic
  }, 5000))

  // Cleanup function
  return () => {
    timers.forEach(id => {
      BackgroundTimer.clearInterval(id)
      BackgroundTimer.clearTimeout(id)
    })
  }
}, [])
```

### Performance Considerations

- Use appropriate intervals - avoid too frequent executions
- Consider batching operations in timer callbacks
- Be mindful of battery usage on mobile devices

```ts
// Good: Batch multiple operations
BackgroundTimer.setInterval(() => {
  performDataSync()
  updateLocalCache()
  checkNotifications()
}, 30000) // Every 30 seconds

// Avoid: Multiple frequent timers
// BackgroundTimer.setInterval(performDataSync, 5000)
// BackgroundTimer.setInterval(updateLocalCache, 3000)
// BackgroundTimer.setInterval(checkNotifications, 7000)
```

### Error Handling

```ts
BackgroundTimer.setInterval(() => {
  try {
    performRiskyOperation()
  } catch (error) {
    console.error('Timer callback failed:', error)
    // Handle error appropriately
  }
}, 10000)
```

## Platform Support

### Android Implementation Details

- ✅ Full support with foreground service
- ✅ Battery optimization handling
- ✅ Doze mode compatibility
- ✅ Works with Android 12+ background restrictions

### iOS Implementation Details

- ✅ Full support with background task API
- ✅ Background app refresh integration
- ✅ iOS 13+ background processing
- ✅ Automatic task expiration handling

## Troubleshooting

### Common Issues

### Issue Resolution

#### Timers stop working in background (Android)

- Ensure proper permissions are added to AndroidManifest.xml
- Request battery optimization exemption for your app
- Check if foreground service is properly configured

#### Timers not firing on iOS

- Verify background modes are enabled in Info.plist
- Ensure background app refresh is enabled for your app
- Check iOS background task time limits

#### Memory leaks

- Always clear timers when components unmount
- Use cleanup functions in useEffect hooks
- Monitor timer IDs and clean them appropriately

### Debug Mode

You can enable debug logging to troubleshoot timer issues:

```ts
// Enable debug mode (if supported by the native implementation)
if (__DEV__) {
  console.log('Timer created with ID:', timerId)
}
```

## Migration Guide

### From JavaScript timers

```ts
// Before (standard JavaScript timers)
const timeoutId = setTimeout(() => {
  console.log('This might not work in background')
}, 5000)

const intervalId = setInterval(() => {
  console.log('This will pause in background')
}, 1000)

// After (BackgroundTimer)
const timeoutId = BackgroundTimer.setTimeout(() => {
  console.log('This works in background!')
}, 5000)

const intervalId = BackgroundTimer.setInterval(() => {
  console.log('This continues in background!')
}, 1000)
```

### From other background timer libraries

The API is designed to be a drop-in replacement for most background timer libraries:

```ts
// Just replace the import
import { BackgroundTimer } from 'react-native-nitro-bg-timer'
// The rest of your code should work the same
```

## Contributing

See `CONTRIBUTING.md` for contribution workflow.

When updating spec files in `src/specs/*.nitro.ts`, regenerate Nitro artifacts:

```bash
npx nitro-codegen
```

## Project Structure

- `android/` — Native Android implementation (Kotlin/Java)
- `ios/` — Native iOS implementation (Swift/Objective-C)
- `src/` — TypeScript source code and exports
- `nitrogen/` — Generated Nitro artifacts (auto-generated)
- `lib/` — Compiled JavaScript output

## Acknowledgements

Special thanks to the following projects that inspired this library:

- [mrousavy/nitro](https://github.com/mrousavy/nitro) – Nitro Modules architecture
- [react-native-background-timer](https://github.com/ocetnik/react-native-background-timer) – Background timer concepts
- [react-native-background-job](https://github.com/vikeri/react-native-background-job) – Background processing patterns

## License

MIT © [Thành Công](https://github.com/tconns)
          
<a href="https://www.buymeacoffee.com/tconns94" target="_blank">
  <img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt="Buy Me A Coffee" width="200"/>
</a>
