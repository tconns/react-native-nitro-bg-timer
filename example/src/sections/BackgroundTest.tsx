import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { BackgroundTimer } from 'react-native-nitro-bg-timer'
import { Section } from '../components/Section'
import { useLog } from '../context/LogContext'

const INTERVAL = 1000

export function BackgroundTest() {
  const [nativeTicks, setNativeTicks] = useState(0)
  const [jsTicks, setJsTicks] = useState(0)
  const [running, setRunning] = useState(false)
  const [showJs, setShowJs] = useState(true)
  const [lastExpected, setLastExpected] = useState(0)
  const startTimeRef = useRef<number>(0)
  const nativeIdRef = useRef<number | null>(null)
  const jsIdRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const nativeTicksRef = useRef(0)
  const jsTicksRef = useRef(0)
  const { addLog } = useLog()

  const expectedTicks = running
    ? Math.floor((Date.now() - startTimeRef.current) / INTERVAL)
    : lastExpected

  const nativeMatch =
    nativeTicks === 0 && !running
      ? true
      : Math.abs(nativeTicks - expectedTicks) <= 2

  const start = useCallback(() => {
    nativeTicksRef.current = 0
    jsTicksRef.current = 0
    setNativeTicks(0)
    setJsTicks(0)
    setLastExpected(0)
    startTimeRef.current = Date.now()
    setRunning(true)
    addLog('[Background] Started — put app in background now!')

    nativeIdRef.current = BackgroundTimer.setInterval(() => {
      nativeTicksRef.current += 1
      setNativeTicks(nativeTicksRef.current)
    }, INTERVAL)

    if (showJs) {
      jsIdRef.current = setInterval(() => {
        jsTicksRef.current += 1
        setJsTicks(jsTicksRef.current)
      }, INTERVAL)
    }
  }, [showJs, addLog])

  const stop = useCallback(() => {
    const finalExpected = Math.floor(
      (Date.now() - startTimeRef.current) / INTERVAL
    )
    if (nativeIdRef.current !== null) {
      BackgroundTimer.clearInterval(nativeIdRef.current)
      nativeIdRef.current = null
    }
    if (jsIdRef.current !== null) {
      clearInterval(jsIdRef.current)
      jsIdRef.current = null
    }
    setLastExpected(finalExpected)
    setRunning(false)
    addLog(
      `[Background] Stopped — Native: ${nativeTicksRef.current}, JS: ${jsTicksRef.current}, Expected: ~${finalExpected}`
    )
  }, [addLog])

  useEffect(() => {
    return () => {
      if (nativeIdRef.current !== null) {
        BackgroundTimer.clearInterval(nativeIdRef.current)
      }
      if (jsIdRef.current !== null) {
        clearInterval(jsIdRef.current)
      }
    }
  }, [])

  return (
    <Section title="3. Background Test">
      <Text style={styles.instructions}>
        Press Start, then put the app in background for 30+ seconds, then come
        back.
      </Text>

      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <Text style={styles.statLabel}>Native</Text>
          <Text
            style={[
              styles.statValue,
              { color: nativeMatch ? '#27ae60' : '#e74c3c' },
            ]}
          >
            {nativeTicks}
          </Text>
        </View>
        {showJs && (
          <View style={styles.stat}>
            <Text style={styles.statLabel}>JS</Text>
            <Text style={[styles.statValue, { color: '#f39c12' }]}>
              {jsTicks}
            </Text>
          </View>
        )}
        <View style={styles.stat}>
          <Text style={styles.statLabel}>Expected</Text>
          <Text style={styles.statValue}>{expectedTicks}</Text>
        </View>
      </View>

      {(running || lastExpected > 0) && (
        <Text
          style={[
            styles.matchIndicator,
            { backgroundColor: nativeMatch ? '#27ae60' : '#e74c3c' },
          ]}
        >
          {nativeMatch ? 'MATCH' : 'MISMATCH'}
        </Text>
      )}

      <View style={styles.row}>
        <Pressable
          style={[styles.btn, styles.btnGreen, running && styles.btnDisabled]}
          onPress={start}
          disabled={running}
        >
          <Text style={styles.btnText}>Start</Text>
        </Pressable>
        <Pressable
          style={[styles.btn, styles.btnRed, !running && styles.btnDisabled]}
          onPress={stop}
          disabled={!running}
        >
          <Text style={styles.btnText}>Stop</Text>
        </Pressable>
      </View>

      <Pressable
        style={[styles.toggleBtn, running && styles.btnDisabled]}
        onPress={() => setShowJs((v) => !v)}
        disabled={running}
      >
        <Text style={styles.toggleText}>
          JS Comparison: {showJs ? 'ON' : 'OFF'}
        </Text>
      </Pressable>
    </Section>
  )
}

const styles = StyleSheet.create({
  instructions: {
    fontSize: 13,
    color: '#666',
    marginBottom: 12,
    lineHeight: 18,
  },
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
    fontSize: 28,
    fontWeight: '700',
    color: '#1a1a2e',
  },
  matchIndicator: {
    textAlign: 'center',
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
    paddingVertical: 6,
    borderRadius: 8,
    marginBottom: 12,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
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
  toggleBtn: {
    alignItems: 'center',
    paddingVertical: 8,
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
  },
  toggleText: {
    fontSize: 13,
    color: '#333',
  },
})
