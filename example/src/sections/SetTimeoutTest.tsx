import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { BackgroundTimer } from 'react-native-nitro-bg-timer'
import { Section } from '../components/Section'
import { useLog } from '../context/LogContext'

type Status = 'idle' | 'pending' | 'fired' | 'cancelled'

export function SetTimeoutTest() {
  const [duration, setDuration] = useState('5000')
  const [status, setStatus] = useState<Status>('idle')
  const [scheduledAt, setScheduledAt] = useState<string | null>(null)
  const [firedAt, setFiredAt] = useState<string | null>(null)
  const timerRef = useRef<number | null>(null)
  const { addLog } = useLog()

  const schedule = useCallback(() => {
    if (timerRef.current !== null) {
      BackgroundTimer.clearTimeout(timerRef.current)
      timerRef.current = null
    }
    const ms = parseInt(duration, 10) || 5000
    const now = new Date().toLocaleTimeString()
    setScheduledAt(now)
    setFiredAt(null)
    setStatus('pending')
    addLog(`[setTimeout] Scheduled for ${ms}ms`)

    timerRef.current = BackgroundTimer.setTimeout(() => {
      const fireTime = new Date().toLocaleTimeString()
      setFiredAt(fireTime)
      setStatus('fired')
      timerRef.current = null
      addLog(`[setTimeout] Fired after ${ms}ms`)
    }, ms)
  }, [duration, addLog])

  const cancel = useCallback(() => {
    if (timerRef.current !== null) {
      BackgroundTimer.clearTimeout(timerRef.current)
      timerRef.current = null
      setStatus('cancelled')
      addLog('[setTimeout] Cancelled')
    }
  }, [addLog])

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        BackgroundTimer.clearTimeout(timerRef.current)
      }
    }
  }, [])

  const statusColor =
    status === 'fired'
      ? '#27ae60'
      : status === 'cancelled'
        ? '#e74c3c'
        : status === 'pending'
          ? '#f39c12'
          : '#888'

  return (
    <Section title="1. setTimeout">
      <View style={styles.row}>
        <Text style={styles.label}>Duration (ms):</Text>
        <TextInput
          style={styles.input}
          value={duration}
          onChangeText={setDuration}
          keyboardType="numeric"
          placeholder="5000"
        />
      </View>
      <View style={styles.row}>
        <Pressable
          style={[styles.btn, styles.btnGreen, status === 'pending' && styles.btnDisabled]}
          onPress={schedule}
          disabled={status === 'pending'}
        >
          <Text style={styles.btnText}>Schedule</Text>
        </Pressable>
        <Pressable
          style={[styles.btn, styles.btnRed, status !== 'pending' && styles.btnDisabled]}
          onPress={cancel}
          disabled={status !== 'pending'}
        >
          <Text style={styles.btnText}>Cancel</Text>
        </Pressable>
      </View>
      <Text style={[styles.status, { color: statusColor }]}>
        Status: {status}
      </Text>
      {scheduledAt && (
        <Text style={styles.info}>Scheduled at: {scheduledAt}</Text>
      )}
      {firedAt && <Text style={styles.info}>Fired at: {firedAt}</Text>}
    </Section>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 8,
  },
  label: {
    fontSize: 13,
    color: '#333',
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 14,
  },
  btn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  btnGreen: { backgroundColor: '#27ae60' },
  btnRed: { backgroundColor: '#e74c3c' },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  status: {
    fontSize: 14,
    fontWeight: '700',
    marginTop: 4,
  },
  info: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
})
