import './nitro-native-bootstrap'
import EventEmitter from 'eventemitter3'
import {
  NitroBackgroundTimer,
  setNitroBackgroundTimerForTests,
} from './nitro-timer-proxy'
import {
  cronToIntervalMs,
  normalizeRetryPolicy,
  tagMaskFromStrings,
  validatePersistWireSchema,
} from './scheduler-utils'

export { NitroBackgroundTimer, setNitroBackgroundTimerForTests }

let nextId = 1
const timeoutCallbacks = new Map<number, () => void>()
const intervalCallbacks = new Map<number, () => void>()
const advancedCallbacks = new Map<number, () => void>()
const schedulerEvents = new EventEmitter<{ stats: [SchedulerStats] }>()
const schedulerLifecycleEvents = new EventEmitter<{
  event: [SchedulerLifecycleEvent]
}>()
const cancelledTokens = new Set<string>()

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

export type SchedulerLifecycleEventName =
  | 'scheduled'
  | 'fired'
  | 'cancelled'
  | 'restored'
  | 'expired'
  | 'retry'
  | 'missed'

export interface SchedulerLifecycleEvent {
  name: SchedulerLifecycleEventName
  timerId: number
  timestampMs: number
  kind?: ScheduleKind
  group?: string
  policyProfile?: PolicyProfile
  reason?: string
  driftMs?: number
  attempt?: number
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

function emitLifecycle(event: SchedulerLifecycleEvent): void {
  schedulerLifecycleEvents.emit('event', event)
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
  const retryNormalized = normalizeRetryPolicy({
    maxAttempts: options.retryMaxAttempts,
    initialBackoffMs: options.retryInitialBackoffMs,
  })

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
    retryMaxAttempts: retryNormalized.maxAttempts,
    retryInitialBackoffMs: retryNormalized.initialBackoffMs,
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

function runAndCleanup(id: number, advancedKind?: ScheduleKind) {
  if (timeoutCallbacks.has(id)) {
    emitLifecycle({
      name: 'fired',
      timerId: id,
      timestampMs: Date.now(),
      kind: 'timeout',
    })
    timeoutCallbacks.get(id)?.()
    timeoutCallbacks.delete(id)
    return
  }
  if (intervalCallbacks.has(id)) {
    emitLifecycle({
      name: 'fired',
      timerId: id,
      timestampMs: Date.now(),
      kind: 'interval',
    })
    intervalCallbacks.get(id)?.()
    return
  }
  if (advancedCallbacks.has(id)) {
    emitLifecycle({ name: 'fired', timerId: id, timestampMs: Date.now() })
    advancedCallbacks.get(id)?.()
    if (advancedKind === 'timeout') {
      advancedCallbacks.delete(id)
    }
  }
}

function invokeWithRetry(
  id: number,
  normalized: ScheduleOptions,
  retryAttempt: number,
  invoke: () => void
): void {
  if (
    normalized.cancellationToken &&
    cancelledTokens.has(normalized.cancellationToken)
  ) {
    emitLifecycle({
      name: 'cancelled',
      timerId: id,
      timestampMs: Date.now(),
      reason: 'cancellation_token',
    })
    advancedCallbacks.delete(id)
    return
  }
  try {
    invoke()
    emitStatsThrottled()
  } catch (error) {
    const maxAttempts = normalized.retryMaxAttempts ?? 0
    if (retryAttempt < maxAttempts) {
      const nextAttempt = retryAttempt + 1
      const retryDelayMs = Math.max(0, normalized.retryInitialBackoffMs ?? 0)
      emitLifecycle({
        name: 'retry',
        timerId: id,
        timestampMs: Date.now(),
        attempt: nextAttempt,
        reason: error instanceof Error ? error.message : 'callback_error',
      })
      NitroBackgroundTimer.schedule(
        id,
        retryDelayMs,
        'timeout',
        Math.max(1, retryDelayMs || 1),
        normalized.group ?? DEFAULT_GROUP,
        normalized.driftPolicy ?? 'coalesce',
        1,
        normalized.correlationToken ?? 0,
        maxAttempts,
        normalized.retryInitialBackoffMs ?? 0,
        normalized.cancellationToken ?? '',
        normalized.tagMaskHint ?? 0,
        normalized.policyProfile ?? 'balanced',
        () =>
          invokeWithRetry(id, normalized, nextAttempt, () =>
            runAndCleanup(id, normalized.kind)
          )
      )
      return
    }
    emitLifecycle({
      name: 'missed',
      timerId: id,
      timestampMs: Date.now(),
      reason: error instanceof Error ? error.message : 'callback_error',
    })
    throw error
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
    emitLifecycle({
      name: 'scheduled',
      timerId: id,
      timestampMs: Date.now(),
      kind: normalized.kind,
      group: normalized.group,
      policyProfile: normalized.policyProfile,
    })
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
      () =>
        invokeWithRetry(id, normalized, 0, () =>
          runAndCleanup(id, normalized.kind)
        )
    )
    return {
      id,
      cancel: () => {
        advancedCallbacks.delete(id)
        if (normalized.cancellationToken) {
          cancelledTokens.add(normalized.cancellationToken)
        }
        NitroBackgroundTimer.cancel(id)
        emitLifecycle({
          name: 'cancelled',
          timerId: id,
          timestampMs: Date.now(),
          reason: 'handle_cancel',
        })
      },
    }
  },

  // Legacy v1 API supported for migration.
  setTimeout(callback: () => void, duration: number): number {
    const id = nextId++
    timeoutCallbacks.set(id, callback)
    emitLifecycle({
      name: 'scheduled',
      timerId: id,
      timestampMs: Date.now(),
      kind: 'timeout',
      group: DEFAULT_GROUP,
      policyProfile: 'balanced',
    })
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
    emitLifecycle({
      name: 'cancelled',
      timerId: id,
      timestampMs: Date.now(),
      reason: 'clearTimeout',
    })
  },

  // Legacy v1 API supported for migration.
  setInterval(callback: () => void, interval: number): number {
    const id = nextId++
    intervalCallbacks.set(id, callback)
    emitLifecycle({
      name: 'scheduled',
      timerId: id,
      timestampMs: Date.now(),
      kind: 'interval',
      group: DEFAULT_GROUP,
      policyProfile: 'balanced',
    })
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
    emitLifecycle({
      name: 'cancelled',
      timerId: id,
      timestampMs: Date.now(),
      reason: 'clearInterval',
    })
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
    emitLifecycle({
      name: 'cancelled',
      timerId: -1,
      timestampMs: Date.now(),
      group,
      reason: 'cancelGroup',
    })
    return removed
  },

  listActiveTimerIds() {
    return NitroBackgroundTimer.listActiveTimerIds()
  },

  getStats(): SchedulerStats {
    return safeReadStats()
  },

  getPersistWireJson(): string {
    return NitroBackgroundTimer.getPersistWireJson()
  },

  restorePersistWireJson(wireJson: string): void {
    const wireValidation = validatePersistWireSchema(wireJson)
    if (!wireValidation.valid) {
      emitLifecycle({
        name: 'missed',
        timerId: -1,
        timestampMs: Date.now(),
        reason: `restore_rejected_${wireValidation.reason ?? 'unknown'}`,
      })
      return
    }
    NitroBackgroundTimer.restorePersistWireJson(wireJson)
    emitLifecycle({
      name: 'restored',
      timerId: -1,
      timestampMs: Date.now(),
      reason: 'manual_restore',
    })
  },

  onStats(listener: (stats: SchedulerStats) => void): () => void {
    schedulerEvents.on('stats', listener)
    return () => schedulerEvents.off('stats', listener)
  },

  onEvent(listener: (event: SchedulerLifecycleEvent) => void): () => void {
    schedulerLifecycleEvents.on('event', listener)
    return () => schedulerLifecycleEvents.off('event', listener)
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

export {
  cronToIntervalMs,
  normalizeRetryPolicy,
  tagMaskFromStrings,
  validatePersistWireSchema,
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
  cancelledTokens.clear()
  emitLifecycle({
    name: 'expired',
    timerId: -1,
    timestampMs: Date.now(),
    reason: 'clearAllKnownTimers',
  })
}
