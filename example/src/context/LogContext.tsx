import React, { createContext, useCallback, useContext, useRef, useState } from 'react'

type LogEntry = {
  id: number
  timestamp: string
  message: string
}

type LogContextType = {
  logs: LogEntry[]
  addLog: (message: string) => void
  clearLog: () => void
}

const LogContext = createContext<LogContextType>({
  logs: [],
  addLog: () => {},
  clearLog: () => {},
})

const MAX_LOGS = 100

function formatTime(): string {
  const d = new Date()
  const h = String(d.getHours()).padStart(2, '0')
  const m = String(d.getMinutes()).padStart(2, '0')
  const s = String(d.getSeconds()).padStart(2, '0')
  const ms = String(d.getMilliseconds()).padStart(3, '0')
  return `${h}:${m}:${s}.${ms}`
}

let nextLogId = 1

export function LogProvider({ children }: { children: React.ReactNode }) {
  const [logs, setLogs] = useState<LogEntry[]>([])
  const logsRef = useRef<LogEntry[]>([])

  const addLog = useCallback((message: string) => {
    const entry: LogEntry = { id: nextLogId++, timestamp: formatTime(), message }
    const next = [...logsRef.current, entry].slice(-MAX_LOGS)
    logsRef.current = next
    setLogs(next)
  }, [])

  const clearLog = useCallback(() => {
    logsRef.current = []
    setLogs([])
  }, [])

  return (
    <LogContext.Provider value={{ logs, addLog, clearLog }}>
      {children}
    </LogContext.Provider>
  )
}

export function useLog() {
  return useContext(LogContext)
}
