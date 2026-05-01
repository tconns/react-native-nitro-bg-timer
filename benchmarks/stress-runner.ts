import { performance } from 'node:perf_hooks'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import type { NativeTimerLike } from '../src/nitro-native-registry'
import {
  NitroBackgroundTimer,
  setNitroBackgroundTimerForTests,
} from '../src/nitro-timer-proxy'

const N = 25_000

function noopCallback(_id: number): void {}

function readHeapMb(): number {
  return process.memoryUsage().heapUsed / (1024 * 1024)
}

function runStressOnce(): { ms: number; n: number } {
  const timers = new Map<number, number>()

  const mock: NativeTimerLike = {
    schedule: (
      id,
      _delayMs,
      _kind,
      _intervalMs,
      _group,
      _driftPolicy,
      _maxRuns,
      _cb
    ) => {
      timers.set(id, Date.now())
      return id
    },
    cancel: (id) => {
      timers.delete(id)
    },
    pauseGroup: () => 0,
    resumeGroup: () => 0,
    cancelGroup: () => 0,
    listActiveTimerIds: () => [...timers.keys()],
    getStatsJson: () =>
      JSON.stringify({
        activeCount: timers.size,
        callbackCount: 0,
        missedCount: 0,
        wakeupCount: 0,
        lateDispatchCount: 0,
        avgLatenessMs: 0,
        p95LatenessMs: 0,
        groups: {},
      }),
    setTimeout: (id, _duration, _cb) =>
      mock.schedule(id, 0, 'timeout', 1, 'default', 'coalesce', 1, noopCallback),
    clearTimeout: (id) => mock.cancel(id),
    setInterval: (id, _interval, _cb) =>
      mock.schedule(id, 0, 'interval', 1, 'default', 'coalesce', 0, noopCallback),
    clearInterval: (id) => mock.cancel(id),
    getPersistWireJson: () => '{"version":1,"tasks":[]}',
    restorePersistWireJson: () => {},
  }

  setNitroBackgroundTimerForTests(mock)

  const t0 = performance.now()
  for (let i = 1; i <= N; i++) {
    NitroBackgroundTimer.schedule(
      i,
      i % 1000,
      'interval',
      1000 + (i % 200),
      `g${i % 8}`,
      'coalesce',
      0,
      noopCallback
    )
  }

  for (let i = 1; i <= N; i += 37) {
    NitroBackgroundTimer.cancel(i)
    NitroBackgroundTimer.getPersistWireJson()
  }

  NitroBackgroundTimer.restorePersistWireJson(
    `{"version":1,"tasks":[{"id":777,"dueAtMs":1,"kind":"timeout","intervalMs":1,"group":"default","driftPolicy":"coalesce","maxRuns":1,"runCount":0,"paused":false}]}`
  )

  const ms = performance.now() - t0
  return { ms, n: N }
}

function main(): void {
  const rounds = Number(process.env.NITRO_BG_STRESS_ROUNDS ?? 5)
  const maxMsEnv = process.env.NITRO_BG_STRESS_MAX_MS
  const ceiling = maxMsEnv ? Number(maxMsEnv) : 800
  const maxHeapDeltaMb = Number(process.env.NITRO_BG_STRESS_MAX_HEAP_MB ?? 32)
  const timings: number[] = []
  const heapBefore = readHeapMb()
  let n = N

  for (let i = 0; i < rounds; i += 1) {
    const result = runStressOnce()
    n = result.n
    timings.push(result.ms)
  }
  const heapAfter = readHeapMb()
  const heapDeltaMb = heapAfter - heapBefore
  const sorted = [...timings].sort((a, b) => a - b)
  const p50 = sorted[Math.floor((sorted.length - 1) * 0.5)] ?? 0
  const p95 = sorted[Math.floor((sorted.length - 1) * 0.95)] ?? 0

  console.log(
    `stress-runner: rounds=${rounds}, n=${n}, p50=${p50.toFixed(1)}ms, p95=${p95.toFixed(
      1
    )}ms, heapDelta=${heapDeltaMb.toFixed(2)}MB`
  )
  if (p95 > ceiling) {
    console.error('stress-runner: exceeded ceiling — treat as regression signal')
    process.exit(1)
  }
  if (heapDeltaMb > maxHeapDeltaMb) {
    console.error(
      `stress-runner: heap delta ${heapDeltaMb.toFixed(2)}MB exceeded max ${maxHeapDeltaMb}MB`
    )
    process.exit(1)
  }
}

const isMainScript =
  process.argv[1] != null &&
  path.resolve(fileURLToPath(import.meta.url)) === path.resolve(process.argv[1])
if (isMainScript) {
  main()
}
