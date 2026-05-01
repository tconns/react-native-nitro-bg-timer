import './nitro-native-bootstrap'
import EventEmitter from 'eventemitter3'
import {
  NitroBackgroundTimer,
  setNitroBackgroundTimerForTests,
} from './nitro-timer-proxy'
import { cronToIntervalMs, tagMaskFromStrings } from './scheduler-utils'

export { NitroBackgroundTimer, setNitroBackgroundTimerForTests }

let nextId = 1
const timeoutCallbacks = new Map<number, () => void>()
const intervalCallbacks = new Map<number, () => void>()
const advancedCallbacks = new Map<number, () => void>()
const schedulerEvents = new EventEmitter<{ stats: [SchedulerStats] }>()

export type TimerPriority = 'realtime' | 'interactive' | 'background'
export type DriftPolicy = 'catchUp' | 'skipLate' | 'coalesce'
export type ScheduleKind = 'timeout' | 'interval'
export type PolicyProfile = 'batterySaver' | 'balanced' | 'latencyFirst'
const MAX_CANCELLATION_TOKEN_LEN = 256
const VALID_POLICY_PROFILES: readonly PolicyProfile[] = [
  'batterySaver',
  'balanced',
  'latencyFirst',
]

export interface ScheduleOptions {
  kind: ScheduleKind
  intervalMs?: number
  runAtMs?: number
  group?: string
  /** Hint for upcoming native routing; not forwarded on the Nitro bridge today. */
  priority?: TimerPriority
  driftPolicy?: DriftPolicy
  maxRuns?: number
  /**
   * Opaque bitmask for tagging — use {@link tagMaskFromStrings}.
   * Kept client-side unless you enrich the native wire separately.
   */
  tagMaskHint?: number
  /** Convenience: populated into `tagMaskHint` unless you override it explicitly. */
  tags?: readonly string[]
  /** Correlation for app telemetry — not persisted in the native wire yet. */
  correlationToken?: number
  retryMaxAttempts?: number
  retryInitialBackoffMs?: number
  cancellationToken?: string
  policyProfile?: PolicyProfile
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

const STATS_EMIT_MIN_INTERVAL_MS = 250
let lastStatsEmitAt = 0

function emitStatsThrottled(): void {
  const now = Date.now()
  if (now - lastStatsEmitAt >= STATS_EMIT_MIN_INTERVAL_MS) {
    lastStatsEmitAt = now
    schedulerEvents.emit('stats', safeReadStats())
  }
}

function normalizeOptions(options: ScheduleOptions): ScheduleOptions {
  const tagHint =
    options.tagMaskHint ??
    (options.tags != null && options.tags.length > 0
      ? tagMaskFromStrings(options.tags)
      : undefined)

  const normalizedCancellationToken = options.cancellationToken?.slice(
    0,
    MAX_CANCELLATION_TOKEN_LEN
  )
  const normalizedPolicyProfile = VALID_POLICY_PROFILES.includes(
    (options.policyProfile ?? 'balanced') as PolicyProfile
  )
    ? (options.policyProfile ?? 'balanced')
    : 'balanced'

  return {
    kind: options.kind,
    intervalMs: options.intervalMs,
    runAtMs: options.runAtMs,
    group: options.group ?? DEFAULT_GROUP,
    priority: options.priority ?? 'interactive',
    driftPolicy: options.driftPolicy ?? 'coalesce',
    maxRuns: options.maxRuns,
    ...(tagHint !== undefined ? { tagMaskHint: tagHint } : {}),
    ...(options.tags != null ? { tags: [...options.tags] } : {}),
    ...(options.correlationToken !== undefined
      ? { correlationToken: options.correlationToken }
      : {}),
    ...(options.retryMaxAttempts !== undefined
      ? { retryMaxAttempts: options.retryMaxAttempts }
      : {}),
    ...(options.retryInitialBackoffMs !== undefined
      ? { retryInitialBackoffMs: options.retryInitialBackoffMs }
      : {}),
    ...(normalizedCancellationToken !== undefined
      ? { cancellationToken: normalizedCancellationToken }
      : {}),
    policyProfile: normalizedPolicyProfile,
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
      normalized.correlationToken ?? 0,
      normalized.retryMaxAttempts ?? 0,
      normalized.retryInitialBackoffMs ?? 0,
      normalized.cancellationToken ?? '',
      normalized.tagMaskHint ?? 0,
      normalized.policyProfile ?? 'balanced',
      () => {
        runAndCleanup(id)
        emitStatsThrottled()
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
      0,
      0,
      0,
      '',
      0,
      'balanced',
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
      0,
      0,
      0,
      '',
      0,
      'balanced',
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

export { cronToIntervalMs, tagMaskFromStrings }

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
