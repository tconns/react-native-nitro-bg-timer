import React, { useRef } from 'react'
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { useLog } from '../context/LogContext'

export function LogView() {
  const { logs, clearLog } = useLog()
  const scrollRef = useRef<ScrollView>(null)

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Log</Text>
        <Pressable onPress={clearLog} style={styles.clearBtn}>
          <Text style={styles.clearText}>Clear</Text>
        </Pressable>
      </View>
      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        nestedScrollEnabled
        onContentSizeChange={() =>
          scrollRef.current?.scrollToEnd({ animated: false })
        }
      >
        {logs.length === 0 ? (
          <Text style={styles.empty}>No logs yet</Text>
        ) : (
          logs.map((entry) => (
            <Text key={entry.id} style={styles.logLine}>
              <Text style={styles.timestamp}>[{entry.timestamp}]</Text>{' '}
              {entry.message}
            </Text>
          ))
        )}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 32,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1a1a2e',
  },
  clearBtn: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    backgroundColor: '#e74c3c',
    borderRadius: 6,
  },
  clearText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  scroll: {
    maxHeight: 200,
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 12,
  },
  empty: {
    fontFamily: 'monospace',
    fontSize: 11,
    color: '#666',
  },
  logLine: {
    fontFamily: 'monospace',
    fontSize: 11,
    color: '#e0e0e0',
    lineHeight: 16,
  },
  timestamp: {
    color: '#888',
  },
})
