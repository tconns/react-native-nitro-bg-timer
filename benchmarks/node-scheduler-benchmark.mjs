import { performance } from 'node:perf_hooks'

const taskCount = Number(process.env.BG_TIMER_BENCH_TASKS ?? 50000)
const lookups = Number(process.env.BG_TIMER_BENCH_LOOKUPS ?? 200000)

function runMinHeapStyleBenchmark() {
  const queue = []
  const startedAt = performance.now()

  for (let i = 0; i < taskCount; i += 1) {
    queue.push({
      id: i,
      dueAt: Date.now() + Math.floor(Math.random() * 120000),
    })
  }

  queue.sort((a, b) => a.dueAt - b.dueAt)

  let checksum = 0
  for (let i = 0; i < lookups; i += 1) {
    const item = queue[i % queue.length]
    checksum += item.id
  }

  const elapsedMs = performance.now() - startedAt
  return { elapsedMs, checksum }
}

const result = runMinHeapStyleBenchmark()
console.log(
  JSON.stringify(
    {
      benchmark: 'nodeSchedulerBaseline',
      taskCount,
      lookups,
      elapsedMs: Number(result.elapsedMs.toFixed(3)),
      checksum: result.checksum,
    },
    null,
    2
  )
)
