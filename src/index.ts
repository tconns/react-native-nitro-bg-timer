import { NitroModules } from 'react-native-nitro-modules'
import type { NitroBackgroundTimer as NitroBackgroundTimerSpec } from './specs/NitroBackgroundTimer.nitro'

export const NitroBackgroundTimer =
  NitroModules.createHybridObject<NitroBackgroundTimerSpec>(
    'NitroBackgroundTimer'
  )
let nextId = 1
const timeoutCallbacks = new Map<number, () => void>()
const intervalCallbacks = new Map<number, () => void>()

export const BackgroundTimer = {
  setTimeout(callback: () => void, duration: number): number {
    const id = nextId++
    timeoutCallbacks.set(id, callback)
    NitroBackgroundTimer.setTimeout(id, duration, () => {
      timeoutCallbacks.get(id)?.()
      timeoutCallbacks.delete(id)
    })
    return id
  },

  clearTimeout(id: number) {
    timeoutCallbacks.delete(id)
    NitroBackgroundTimer.clearTimeout(id)
  },

  setInterval(callback: () => void, interval: number): number {
    const id = nextId++
    intervalCallbacks.set(id, callback)
    NitroBackgroundTimer.setInterval(id, interval, () => {
      intervalCallbacks.get(id)?.()
    })
    return id
  },

  clearInterval(id: number) {
    intervalCallbacks.delete(id)
    NitroBackgroundTimer.clearInterval(id)
  },
}
