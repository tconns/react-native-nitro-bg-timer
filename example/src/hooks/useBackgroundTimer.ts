import { useEffect, useRef, useCallback, useState } from 'react'
import { BackgroundTimer } from 'react-native-nitro-bg-timer'

export const useBackgroundTimer = (
  callback: () => void,
  interval: number,
  immediate: boolean = false
) => {
  const intervalRef = useRef<number | null>(null)
  const savedCallback = useRef(callback)
  const [isRunning, setIsRunning] = useState(false)
  const prevIntervalRef = useRef(interval)

  useEffect(() => {
    savedCallback.current = callback
  }, [callback])

  const start = useCallback(() => {
    if (intervalRef.current) return

    if (immediate) {
      savedCallback.current()
    }

    intervalRef.current = BackgroundTimer.setInterval(() => {
      savedCallback.current()
    }, interval)
    setIsRunning(true)
  }, [interval, immediate])

  const stop = useCallback(() => {
    if (intervalRef.current) {
      BackgroundTimer.clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    setIsRunning(false)
  }, [])

  const restart = useCallback(() => {
    stop()
    start()
  }, [stop, start])

  // Restart with new interval only if interval value actually changed while running
  useEffect(() => {
    if (!isRunning) {
      prevIntervalRef.current = interval
      return
    }
    if (interval === prevIntervalRef.current) return
    prevIntervalRef.current = interval

    if (intervalRef.current) {
      BackgroundTimer.clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    intervalRef.current = BackgroundTimer.setInterval(() => {
      savedCallback.current()
    }, interval)
  }, [interval, isRunning])

  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        BackgroundTimer.clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [])

  return { start, stop, restart, isRunning }
}
