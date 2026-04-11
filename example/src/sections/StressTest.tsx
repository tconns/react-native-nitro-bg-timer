import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { BackgroundTimer } from 'react-native-nitro-bg-timer'
import { Section } from '../components/Section'
import { useLog } from '../context/LogContext'

const TIMER_COUNT = 100

export function StressTest() {
  const [created, setCreated] = useState(0)
  const [fired, setFired] = useState(0)
  const [running, setRunning] = useState(false)
  const firedRef = useRef(0)
  const idsRef = useRef<number[]>([])
  const { addLog } = useLog()

  useEffect(() => {
    return () => {
      idsRef.current.forEach((id) => BackgroundTimer.clearTimeout(id))
    }
  }, [])

  const runTest = useCallback(() => {
    // Clear any previous timers
    idsRef.current.forEach((id) => BackgroundTimer.clearTimeout(id))
    idsRef.current = []
    firedRef.current = 0
    setFired(0)
    setCreated(TIMER_COUNT)
    setRunning(true)
    addLog(`[Stress] Creating ${TIMER_COUNT} timers...`)

    const ids: number[] = []
    for (let i = 0; i < TIMER_COUNT; i++) {
      const delay = Math.floor(Math.random() * 4900) + 100 // 100-5000ms
      const id = BackgroundTimer.setTimeout(() => {
        firedRef.current += 1
        setFired(firedRef.current)
        if (firedRef.current === TIMER_COUNT) {
          setRunning(false)
          addLog(
            `[Stress] All ${TIMER_COUNT} timers fired!`
          )
        }
      }, delay)
      ids.push(id)
    }
    idsRef.current = ids
    addLog(`[Stress] ${TIMER_COUNT} timers created (100-5000ms range)`)
  }, [addLog])

  const pending = created - fired

  return (
    <Section title="7. Stress Test (100 timers)">
      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <Text style={styles.statLabel}>Created</Text>
          <Text style={styles.statValue}>{created}</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statLabel}>Fired</Text>
          <Text style={[styles.statValue, { color: '#27ae60' }]}>{fired}</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statLabel}>Pending</Text>
          <Text style={[styles.statValue, { color: pending > 0 ? '#f39c12' : '#27ae60' }]}>
            {pending}
          </Text>
        </View>
      </View>
      <Pressable
        style={[styles.btn, running ? styles.btnDisabled : styles.btnGreen]}
        onPress={runTest}
        disabled={running}
      >
        <Text style={styles.btnText}>
          {running ? 'Running...' : 'Create 100 Timers'}
        </Text>
      </Pressable>
    </Section>
  )
}

const styles = StyleSheet.create({
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 12,
  },
  stat: {
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 12,
    color: '#888',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1a1a2e',
  },
  btn: {
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  btnGreen: { backgroundColor: '#27ae60' },
  btnDisabled: { backgroundColor: '#bbb' },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
})
