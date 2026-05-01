import { performance } from 'node:perf_hooks'

const iterations = Number(process.env.BG_TIMER_BRIDGE_BENCH_ITERS ?? 200000)

function jsonPath() {
  const startedAt = performance.now()
  let checksum = 0
  for (let i = 0; i < iterations; i += 1) {
    const text = JSON.stringify({
      kind: 'interval',
      intervalMs: 1000 + (i % 5),
      group: 'sync',
      driftPolicy: 'coalesce',
      maxRuns: 0,
    })
    const parsed = JSON.parse(text)
    checksum += parsed.intervalMs
  }
  return {
    elapsedMs: performance.now() - startedAt,
    checksum,
  }
}

function typedPath() {
  const startedAt = performance.now()
  let checksum = 0
  for (let i = 0; i < iterations; i += 1) {
    const kind = 'interval'
    const intervalMs = 1000 + (i % 5)
    const group = 'sync'
    const driftPolicy = 'coalesce'
    const maxRuns = 0
    checksum += intervalMs + kind.length + group.length + driftPolicy.length + maxRuns
  }
  return {
    elapsedMs: performance.now() - startedAt,
    checksum,
  }
}

const jsonResult = jsonPath()
const typedResult = typedPath()
const improvementPercent = ((jsonResult.elapsedMs - typedResult.elapsedMs) / jsonResult.elapsedMs) * 100

console.log(
  JSON.stringify(
    {
      benchmark: 'bridgeOverheadComparison',
      iterations,
      jsonElapsedMs: Number(jsonResult.elapsedMs.toFixed(3)),
      typedElapsedMs: Number(typedResult.elapsedMs.toFixed(3)),
      improvementPercent: Number(improvementPercent.toFixed(2)),
      checksum: jsonResult.checksum + typedResult.checksum,
    },
    null,
    2
  )
)
