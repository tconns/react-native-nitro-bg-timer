import assert from 'node:assert/strict'
import test from 'node:test'
import {
  NitroBackgroundTimer,
  setNitroBackgroundTimerForTests,
} from '../nitro-timer-proxy'
import { cronToIntervalMs, tagMaskFromStrings } from '../scheduler-utils'

test('supports cron interval shorthand', () => {
  assert.equal(cronToIntervalMs('*/2 * * * *'), 120000)
  assert.equal(cronToIntervalMs('*/15 * * * *'), 900000)
})

test('throws for unsupported cron expression', () => {
  assert.throws(
    () => cronToIntervalMs('* * * * *'),
    /Unsupported cron expression/
  )
})

test('tag bitmask is deterministic and sensitive to ordering', () => {
  assert.equal(tagMaskFromStrings(['alpha']), tagMaskFromStrings(['alpha']))
  assert.notEqual(tagMaskFromStrings(['alpha']), tagMaskFromStrings(['beta']))
  assert.notEqual(
    tagMaskFromStrings(['a', 'b']),
    tagMaskFromStrings(['b', 'a'])
  )
})

test('accepts retry/token/tag/policy fields on typed bridge schedule', () => {
  let captured: unknown[] = []
  setNitroBackgroundTimerForTests({
    schedule: (...args: unknown[]) => {
      captured = args
      return Number(args[0] ?? 0)
    },
    cancel: () => {},
    pauseGroup: () => 0,
    resumeGroup: () => 0,
    cancelGroup: () => 0,
    listActiveTimerIds: () => [],
    getStatsJson: () =>
      '{"activeCount":0,"callbackCount":0,"missedCount":0,"wakeupCount":0,"lateDispatchCount":0,"avgLatenessMs":0,"p95LatenessMs":0,"groups":{}}',
    getPersistWireJson: () => '{"version":1,"tasks":[]}',
    restorePersistWireJson: () => {},
    setTimeout: (id: number) => id,
    clearTimeout: () => {},
    setInterval: (id: number) => id,
    clearInterval: () => {},
  } as any)

  NitroBackgroundTimer.schedule(
    77,
    250,
    'interval',
    250,
    'qa',
    'coalesce',
    3,
    9001,
    5,
    300,
    'token-abc',
    99,
    'latencyFirst',
    () => {}
  )

  assert.equal(captured[6], 3)
  assert.equal(captured[7], 9001)
  assert.equal(captured[8], 5)
  assert.equal(captured[9], 300)
  assert.equal(captured[10], 'token-abc')
  assert.equal(captured[11], 99)
  assert.equal(captured[12], 'latencyFirst')
  assert.equal(typeof captured[13], 'function')
})
