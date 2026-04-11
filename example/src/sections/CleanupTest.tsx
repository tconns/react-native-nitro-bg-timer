import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { BackgroundTimer } from 'react-native-nitro-bg-timer'
import { Section } from '../components/Section'
import { useLog } from '../context/LogContext'

const INTERVALS = [800, 1200, 2000]

function TimerChild({
  onLog,
}: {
  onLog: (msg: string) => void
}) {
  const idsRef = useRef<number[]>([])
  const onLogRef = useRef(onLog)
  useEffect(() => {
    onLogRef.current = onLog
  }, [onLog])

  useEffect(() => {
    const ids = INTERVALS.map((ms, i) => {
      const id = BackgroundTimer.setInterval(() => {
        onLogRef.current(`Timer ${i + 1} (${ms}ms) fired`)
      }, ms)
      return id
    })
    idsRef.current = ids
    onLogRef.current(`Mounted — started ${ids.length} intervals`)

    return () => {
      ids.forEach((id) => BackgroundTimer.clearInterval(id))
      onLogRef.current('Unmounted — cleanup called, all intervals cleared')
    }
  }, [])

  return (
    <View style={styles.childBox}>
      <Text style={styles.childText}>
        Child mounted with {INTERVALS.length} intervals
      </Text>
    </View>
  )
}

export function CleanupTest() {
  const [mounted, setMounted] = useState(false)
  const [localLogs, setLocalLogs] = useState<{ id: number; msg: string }[]>([])
  const localLogIdRef = useRef(0)
  const { addLog } = useLog()
  const scrollRef = useRef<ScrollView>(null)

  const handleLog = useCallback(
    (msg: string) => {
      localLogIdRef.current += 1
      const id = localLogIdRef.current
      setLocalLogs((prev) => [...prev.slice(-49), { id, msg }])
      addLog(`[Cleanup] ${msg}`)
    },
    [addLog]
  )

  return (
    <Section title="5. Cleanup on Unmount">
      <Text style={styles.desc}>
        Mount/unmount a child component that creates 3 intervals. Verify that
        after unmount, no more ticks appear.
      </Text>
      <Pressable
        style={[styles.btn, mounted ? styles.btnRed : styles.btnGreen]}
        onPress={() => setMounted((v) => !v)}
      >
        <Text style={styles.btnText}>
          {mounted ? 'Unmount Component' : 'Mount Component'}
        </Text>
      </Pressable>
      {mounted && <TimerChild onLog={handleLog} />}
      <ScrollView
        ref={scrollRef}
        style={styles.logBox}
        nestedScrollEnabled
        onContentSizeChange={() =>
          scrollRef.current?.scrollToEnd({ animated: false })
        }
      >
        {localLogs.length === 0 ? (
          <Text style={styles.logEmpty}>No events yet</Text>
        ) : (
          localLogs.map((entry) => (
            <Text key={entry.id} style={styles.logLine}>
              {entry.msg}
            </Text>
          ))
        )}
      </ScrollView>
    </Section>
  )
}

const styles = StyleSheet.create({
  desc: {
    fontSize: 13,
    color: '#666',
    marginBottom: 10,
    lineHeight: 18,
  },
  btn: {
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 10,
  },
  btnGreen: { backgroundColor: '#27ae60' },
  btnRed: { backgroundColor: '#e74c3c' },
  btnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  childBox: {
    backgroundColor: '#e8f5e9',
    padding: 10,
    borderRadius: 8,
    marginBottom: 10,
  },
  childText: {
    fontSize: 13,
    color: '#27ae60',
    textAlign: 'center',
  },
  logBox: {
    maxHeight: 120,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 8,
  },
  logEmpty: {
    fontSize: 11,
    color: '#999',
    fontFamily: 'monospace',
  },
  logLine: {
    fontSize: 11,
    color: '#333',
    fontFamily: 'monospace',
    lineHeight: 16,
  },
})
