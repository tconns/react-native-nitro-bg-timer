import React from 'react'
import {
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { SafeAreaView, SafeAreaProvider } from 'react-native-safe-area-context'
import { LogProvider } from './src/context/LogContext'
import { LogView } from './src/components/LogView'
import { SetTimeoutTest } from './src/sections/SetTimeoutTest'
import { SetIntervalTest } from './src/sections/SetIntervalTest'
import { BackgroundTest } from './src/sections/BackgroundTest'
import { ConcurrentTimers } from './src/sections/ConcurrentTimers'
import { CleanupTest } from './src/sections/CleanupTest'
import { HookTest } from './src/sections/HookTest'
import { StressTest } from './src/sections/StressTest'

function App() {
  return (
    <SafeAreaProvider>
    <LogProvider>
      <SafeAreaView style={styles.safe}>
        <StatusBar barStyle="dark-content" />
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
        >
          <View style={styles.header}>
            <Text style={styles.title}>Nitro BG Timer</Text>
            <Text style={styles.subtitle}>Test Suite</Text>
          </View>

          <SetTimeoutTest />
          <SetIntervalTest />
          <BackgroundTest />
          <ConcurrentTimers />
          <CleanupTest />
          <HookTest />
          <StressTest />
          <LogView />
        </ScrollView>
      </SafeAreaView>
    </LogProvider>
    </SafeAreaProvider>
  )
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 20,
    paddingTop: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#1a1a2e',
  },
  subtitle: {
    fontSize: 14,
    color: '#888',
    marginTop: 2,
  },
})

export default App
