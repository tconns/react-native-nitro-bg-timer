import EventEmitter from 'eventemitter3'
import { NitroModules } from 'react-native-nitro-modules'
import type { NitroBackgroundTimer as NitroBackgroundTimerSpec } from './specs/NitroBackgroundTimer.nitro'
import { cronToIntervalMs } from './scheduler-utils'

type NativeTimerLike = Pick<
  NitroBackgroundTimerSpec,
  | 'schedule'
  | 'cancel'
  | 'pauseGroup'
  | 'resumeGroup'
  | 'cancelGroup'
  | 'listActiveTimerIds'
  | 'getStatsJson'
  | 'setTimeout'
  | 'clearTimeout'
  | 'setInterval'
  | 'clearInterval'
>

let nativeTimerInstance: NativeTimerLike | null = null

function getNativeTimer(): NativeTimerLike {
  if (nativeTimerInstance == null) {
    nativeTimerInstance =
      NitroModules.createHybridObject<NitroBackgroundTimerSpec>(
        'NitroBackgroundTimer'
      )
  }
  return nativeTimerInstance
}

export function setNitroBackgroundTimerForTests(timer: NativeTimerLike) {
  nativeTimerInstance = timer
}

export const NitroBackgroundTimer = {
  schedule: (...args: Parameters<NitroBackgroundTimerSpec['schedule']>) =>
    getNativeTimer().schedule(...args),
  cancel: (...args: Parameters<NitroBackgroundTimerSpec['cancel']>) =>
    getNativeTimer().cancel(...args),
  pauseGroup: (...args: Parameters<NitroBackgroundTimerSpec['pauseGroup']>) =>
    getNativeTimer().pauseGroup(...args),
  resumeGroup: (...args: Parameters<NitroBackgroundTimerSpec['resumeGroup']>) =>
    getNativeTimer().resumeGroup(...args),
  cancelGroup: (...args: Parameters<NitroBackgroundTimerSpec['cancelGroup']>) =>
    getNativeTimer().cancelGroup(...args),
  listActiveTimerIds: (
    ...args: Parameters<NitroBackgroundTimerSpec['listActiveTimerIds']>
  ) => getNativeTimer().listActiveTimerIds(...args),
  getStatsJson: (
    ...args: Parameters<NitroBackgroundTimerSpec['getStatsJson']>
  ) => getNativeTimer().getStatsJson(...args),
  setTimeout: (...args: Parameters<NitroBackgroundTimerSpec['setTimeout']>) =>
    getNativeTimer().setTimeout(...args),
  clearTimeout: (
    ...args: Parameters<NitroBackgroundTimerSpec['clearTimeout']>
  ) => getNativeTimer().clearTimeout(...args),
  setInterval: (...args: Parameters<NitroBackgroundTimerSpec['setInterval']>) =>
    getNativeTimer().setInterval(...args),
  clearInterval: (
    ...args: Parameters<NitroBackgroundTimerSpec['clearInterval']>
  ) => getNativeTimer().clearInterval(...args),
}

let nextId = 1
const timeoutCallbacks = new Map<number, () => void>()
const intervalCallbacks = new Map<number, () => void>()
const advancedCallbacks = new Map<number, () => void>()
const schedulerEvents = new EventEmitter<{ stats: [SchedulerStats] }>()

export type TimerPriority = 'realtime' | 'interactive' | 'background'
export type DriftPolicy = 'catchUp' | 'skipLate' | 'coalesce'
export type ScheduleKind = 'timeout' | 'interval'

export interface ScheduleOptions {
  kind: ScheduleKind
  intervalMs?: number
  runAtMs?: number
  group?: string
  priority?: TimerPriority
  driftPolicy?: DriftPolicy
  maxRuns?: number
}

export interface SchedulerStats {
  activeCount: number
  callbackCount: number
  missedCount: number
  wakeupCount: number
  lateDispatchCount: number
  avgLatenessMs: number
  p95LatenessMs: number
  groups: Record<string, number>
}

export interface ScheduledTaskHandle {
  id: number
  cancel: () => void
}

const DEFAULT_GROUP = 'default'

function normalizeOptions(options: ScheduleOptions): ScheduleOptions {
  return {
    kind: options.kind,
    intervalMs: options.intervalMs,
    runAtMs: options.runAtMs,
    group: options.group ?? DEFAULT_GROUP,
    priority: options.priority ?? 'interactive',
    driftPolicy: options.driftPolicy ?? 'coalesce',
    maxRuns: options.maxRuns,
  }
}

function toDelayMs(options: ScheduleOptions): number {
  if (options.runAtMs != null) {
    return Math.max(0, options.runAtMs - Date.now())
  }
  if (options.kind === 'interval') {
    return Math.max(1, options.intervalMs ?? 1000)
  }
  return Math.max(0, options.intervalMs ?? 0)
}

function safeReadStats(): SchedulerStats {
  try {
    return JSON.parse(NitroBackgroundTimer.getStatsJson()) as SchedulerStats
  } catch {
    return {
      activeCount: NitroBackgroundTimer.listActiveTimerIds().length,
      callbackCount: 0,
      missedCount: 0,
      wakeupCount: 0,
      lateDispatchCount: 0,
      avgLatenessMs: 0,
      p95LatenessMs: 0,
      groups: {},
    }
  }
}

function runAndCleanup(id: number) {
  if (timeoutCallbacks.has(id)) {
    timeoutCallbacks.get(id)?.()
    timeoutCallbacks.delete(id)
    return
  }
  if (intervalCallbacks.has(id)) {
    intervalCallbacks.get(id)?.()
    return
  }
  if (advancedCallbacks.has(id)) {
    advancedCallbacks.get(id)?.()
  }
}

export const BackgroundTimer = {
  schedule(
    callback: () => void,
    options: ScheduleOptions
  ): ScheduledTaskHandle {
    const id = nextId++
    const normalized = normalizeOptions(options)
    advancedCallbacks.set(id, callback)
    NitroBackgroundTimer.schedule(
      id,
      toDelayMs(normalized),
      normalized.kind,
      Math.max(1, normalized.intervalMs ?? 0),
      normalized.group ?? DEFAULT_GROUP,
      normalized.driftPolicy ?? 'coalesce',
      normalized.maxRuns ?? 0,
      () => {
        runAndCleanup(id)
        schedulerEvents.emit('stats', safeReadStats())
      }
    )
    return {
      id,
      cancel: () => {
        advancedCallbacks.delete(id)
        NitroBackgroundTimer.cancel(id)
      },
    }
  },

  // Legacy v1 API supported for migration.
  setTimeout(callback: () => void, duration: number): number {
    const id = nextId++
    timeoutCallbacks.set(id, callback)
    NitroBackgroundTimer.schedule(
      id,
      Math.max(0, duration),
      'timeout',
      Math.max(1, duration),
      DEFAULT_GROUP,
      'coalesce',
      1,
      () => runAndCleanup(id)
    )
    return id
  },

  clearTimeout(id: number) {
    timeoutCallbacks.delete(id)
    NitroBackgroundTimer.cancel(id)
  },

  // Legacy v1 API supported for migration.
  setInterval(callback: () => void, interval: number): number {
    const id = nextId++
    intervalCallbacks.set(id, callback)
    NitroBackgroundTimer.schedule(
      id,
      Math.max(1, interval),
      'interval',
      Math.max(1, interval),
      DEFAULT_GROUP,
      'coalesce',
      0,
      () => runAndCleanup(id)
    )
    return id
  },

  clearInterval(id: number) {
    intervalCallbacks.delete(id)
    NitroBackgroundTimer.cancel(id)
  },

  pauseGroup(group: string) {
    return NitroBackgroundTimer.pauseGroup(group)
  },

  resumeGroup(group: string) {
    return NitroBackgroundTimer.resumeGroup(group)
  },

  cancelGroup(group: string) {
    const removed = NitroBackgroundTimer.cancelGroup(group)
    if (removed > 0) {
      const active = new Set(NitroBackgroundTimer.listActiveTimerIds())
      for (const [id] of advancedCallbacks) {
        if (!active.has(id)) {
          advancedCallbacks.delete(id)
        }
      }
    }
    return removed
  },

  listActiveTimerIds() {
    return NitroBackgroundTimer.listActiveTimerIds()
  },

  getStats(): SchedulerStats {
    return safeReadStats()
  },

  onStats(listener: (stats: SchedulerStats) => void): () => void {
    schedulerEvents.on('stats', listener)
    return () => schedulerEvents.off('stats', listener)
  },
}

export const BackgroundScheduler = {
  scheduleAt(
    callback: () => void,
    runAtMs: number,
    options?: Omit<ScheduleOptions, 'kind' | 'runAtMs'>
  ) {
    return BackgroundTimer.schedule(callback, {
      kind: 'timeout',
      runAtMs,
      ...(options ?? {}),
    })
  },

  scheduleInterval(
    callback: () => void,
    intervalMs: number,
    options?: Omit<ScheduleOptions, 'kind' | 'intervalMs'>
  ) {
    return BackgroundTimer.schedule(callback, {
      kind: 'interval',
      intervalMs,
      ...(options ?? {}),
    })
  },

  scheduleCron(
    callback: () => void,
    expression: string,
    options?: Omit<ScheduleOptions, 'kind' | 'runAtMs' | 'intervalMs'>
  ): ScheduledTaskHandle {
    const intervalMs = cronToIntervalMs(expression)
    return BackgroundTimer.schedule(callback, {
      kind: 'interval',
      intervalMs,
      ...(options ?? {}),
    })
  },
}

export function clearAllKnownTimers() {
  for (const [id] of timeoutCallbacks) {
    NitroBackgroundTimer.cancel(id)
  }
  timeoutCallbacks.clear()
  for (const [id] of intervalCallbacks) {
    NitroBackgroundTimer.cancel(id)
  }
  intervalCallbacks.clear()
  for (const [id] of advancedCallbacks) {
    NitroBackgroundTimer.cancel(id)
  }
  advancedCallbacks.clear()
}
