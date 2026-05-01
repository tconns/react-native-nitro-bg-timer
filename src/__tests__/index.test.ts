import assert from 'node:assert/strict'
import test from 'node:test'
import { cronToIntervalMs } from '../scheduler-utils'

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
