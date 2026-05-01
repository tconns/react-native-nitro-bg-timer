import assert from 'node:assert/strict'
import test from 'node:test'
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
