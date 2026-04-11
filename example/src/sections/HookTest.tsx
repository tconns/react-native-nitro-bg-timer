import React, { useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { Section } from '../components/Section'
import { useLog } from '../context/LogContext'
import { useBackgroundTimer } from '../hooks/useBackgroundTimer'

export function HookTest() {
  const [count, setCount] = useState(0)
  const { addLog } = useLog()

  const { start, stop, restart, isRunning } = useBackgroundTimer(
    () => {
      setCount((prev) => {
        const next = prev + 1
        addLog(`[Hook] Tick #${next}`)
        return next
      })
    },
    1000,
    false
  )

  return (
    <Section title="6. useBackgroundTimer Hook">
      <Text style={styles.counter}>{count}</Text>
      <View style={styles.statusRow}>
        <View
          style={[
            styles.indicator,
            { backgroundColor: isRunning ? '#27ae60' : '#ccc' },
          ]}
        />
        <Text style={styles.statusText}>
          {isRunning ? 'Running' : 'Stopped'}
        </Text>
      </View>
      <View style={styles.row}>
        <Pressable
          style={[styles.btn, styles.btnGreen, isRunning && styles.btnDisabled]}
          onPress={start}
          disabled={isRunning}
        >
          <Text style={styles.btnText}>Start</Text>
        </Pressable>
        <Pressable
          style={[styles.btn, styles.btnOrange, !isRunning && styles.btnDisabled]}
          onPress={stop}
          disabled={!isRunning}
        >
          <Text style={styles.btnText}>Stop</Text>
        </Pressable>
        <Pressable style={[styles.btn, styles.btnBlue]} onPress={restart}>
          <Text style={styles.btnText}>Restart</Text>
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
    marginBottom: 8,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    gap: 6,
  },
  indicator: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  statusText: {
    fontSize: 13,
    color: '#666',
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
  btnBlue: { backgroundColor: '#3498db' },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
})
