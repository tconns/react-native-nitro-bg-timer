import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { BackgroundTimer } from 'react-native-nitro-bg-timer'
import { Section } from '../components/Section'
import { useLog } from '../context/LogContext'

const INTERVALS = [500, 1000, 1500, 2000, 3000]

type TimerState = {
  id: number | null
  count: number
  interval: number
}

export function ConcurrentTimers() {
  const [timers, setTimers] = useState<TimerState[]>(
    INTERVALS.map((interval) => ({ id: null, count: 0, interval }))
  )
  const timersRef = useRef(timers)
  timersRef.current = timers
  const { addLog } = useLog()

  useEffect(() => {
    return () => {
      timersRef.current.forEach((t) => {
        if (t.id !== null) BackgroundTimer.clearInterval(t.id)
      })
    }
  }, [])

  const running = timers.some((t) => t.id !== null)

  const startAll = useCallback(() => {
    timersRef.current.forEach((t) => {
      if (t.id !== null) BackgroundTimer.clearInterval(t.id)
    })
    const newTimers = INTERVALS.map((interval, idx) => {
      const id = BackgroundTimer.setInterval(() => {
        setTimers((prev) =>
          prev.map((t, i) => (i === idx ? { ...t, count: t.count + 1 } : t))
        )
      }, interval)
      return { id, count: 0, interval }
    })
    setTimers(newTimers)
    addLog(`[Concurrent] Started ${INTERVALS.length} timers`)
  }, [addLog])

  const stopAll = useCallback(() => {
    timersRef.current.forEach((t) => {
      if (t.id !== null) BackgroundTimer.clearInterval(t.id)
    })
    setTimers(INTERVALS.map((interval) => ({ id: null, count: 0, interval })))
    addLog('[Concurrent] Stopped all timers')
  }, [addLog])

  const stopRandom = useCallback(() => {
    const activeIndices = timersRef.current
      .map((t, i) => (t.id !== null ? i : -1))
      .filter((i) => i >= 0)
    if (activeIndices.length === 0) return

    const idx = activeIndices[Math.floor(Math.random() * activeIndices.length)]!
    const timer = timersRef.current[idx]!
    if (timer.id !== null) {
      BackgroundTimer.clearInterval(timer.id)
    }
    setTimers((prev) =>
      prev.map((t, i) => (i === idx ? { ...t, id: null } : t))
    )
    addLog(`[Concurrent] Stopped timer ${timer.interval}ms`)
  }, [addLog])

  return (
    <Section title="4. Concurrent Timers">
      <View style={styles.timerGrid}>
        {timers.map((t, i) => (
          <View
            key={i}
            style={[
              styles.timerBox,
              { opacity: t.id !== null || !running ? 1 : 0.4 },
            ]}
          >
            <Text style={styles.timerInterval}>{t.interval}ms</Text>
            <Text style={styles.timerCount}>{t.count}</Text>
            <View
              style={[
                styles.dot,
                { backgroundColor: t.id !== null ? '#27ae60' : '#ccc' },
              ]}
            />
          </View>
        ))}
      </View>
      <View style={styles.row}>
        <Pressable
          style={[styles.btn, styles.btnGreen, running && styles.btnDisabled]}
          onPress={startAll}
          disabled={running}
        >
          <Text style={styles.btnText}>Start All</Text>
        </Pressable>
        <Pressable
          style={[styles.btn, styles.btnOrange, !running && styles.btnDisabled]}
          onPress={stopRandom}
          disabled={!running}
        >
          <Text style={styles.btnText}>Stop Random</Text>
        </Pressable>
        <Pressable
          style={[styles.btn, styles.btnRed, !running && styles.btnDisabled]}
          onPress={stopAll}
          disabled={!running}
        >
          <Text style={styles.btnText}>Stop All</Text>
        </Pressable>
      </View>
    </Section>
  )
}

const styles = StyleSheet.create({
  timerGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 12,
  },
  timerBox: {
    width: 80,
    alignItems: 'center',
    padding: 8,
    backgroundColor: '#f8f8f8',
    borderRadius: 8,
  },
  timerInterval: {
    fontSize: 11,
    color: '#888',
  },
  timerCount: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1a1a2e',
    marginVertical: 2,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  row: {
    flexDirection: 'row',
    gap: 8,
  },
  btn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  btnGreen: { backgroundColor: '#27ae60' },
  btnOrange: { backgroundColor: '#f39c12' },
  btnRed: { backgroundColor: '#e74c3c' },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
})
