import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { BackgroundTimer } from 'react-native-nitro-bg-timer'
import { Section } from '../components/Section'
import { useLog } from '../context/LogContext'

export function SetIntervalTest() {
  const [seconds, setSeconds] = useState(0)
  const [running, setRunning] = useState(false)
  const intervalRef = useRef<number | null>(null)
  const { addLog } = useLog()

  const start = useCallback(() => {
    if (intervalRef.current) return
    setRunning(true)
    addLog('[setInterval] Started counter')
    intervalRef.current = BackgroundTimer.setInterval(() => {
      setSeconds((prev) => prev + 1)
    }, 1000)
  }, [addLog])

  const stop = useCallback(() => {
    if (intervalRef.current) {
      BackgroundTimer.clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    setRunning(false)
    addLog('[setInterval] Stopped counter')
  }, [addLog])

  const reset = useCallback(() => {
    stop()
    setSeconds(0)
    addLog('[setInterval] Reset counter')
  }, [stop, addLog])

  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        BackgroundTimer.clearInterval(intervalRef.current)
      }
    }
  }, [])

  return (
    <Section title="2. setInterval Counter">
      <Text style={styles.counter}>{seconds}s</Text>
      <View style={styles.row}>
        <Pressable
          style={[styles.btn, styles.btnGreen, running && styles.btnDisabled]}
          onPress={start}
          disabled={running}
        >
          <Text style={styles.btnText}>Start</Text>
        </Pressable>
        <Pressable
          style={[styles.btn, styles.btnOrange, !running && styles.btnDisabled]}
          onPress={stop}
          disabled={!running}
        >
          <Text style={styles.btnText}>Stop</Text>
        </Pressable>
        <Pressable style={[styles.btn, styles.btnRed]} onPress={reset}>
          <Text style={styles.btnText}>Reset</Text>
        </Pressable>
      </View>
    </Section>
  )
}

const styles = StyleSheet.create({
  counter: {
    fontSize: 36,
    fontWeight: '700',
    textAlign: 'center',
    color: '#1a1a2e',
    marginBottom: 12,
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
