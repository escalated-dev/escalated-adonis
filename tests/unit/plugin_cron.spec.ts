import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { cronDue } from '../../src/support/plugin_cron.ts'

/*
 * domain-model/plugin-contract.md (Cron): SDK `cron` keys are five-field
 * expressions evaluated in UTC; one the host cannot read is skipped.
 */
describe('plugin cron expressions', () => {
  const cases: Array<[string, string, boolean]> = [
    ['* * * * *', '2026-10-29T13:37:00Z', true],
    ['37 13 * * *', '2026-10-29T13:37:45Z', true],
    ['38 13 * * *', '2026-10-29T13:37:00Z', false],
    ['*/15 * * * *', '2026-10-29T13:45:00Z', true],
    ['*/15 * * * *', '2026-10-29T13:46:00Z', false],
    ['0-10/5 9-17 * * *', '2026-10-29T09:10:00Z', true],
    ['0-10/5 9-17 * * *', '2026-10-29T18:10:00Z', false],
    ['1,2,3 * * * *', '2026-10-29T13:02:00Z', true],
    // 2026-10-29 is a Thursday; 2026-11-01 a Sunday.
    ['0 9 * * thu', '2026-10-29T09:00:00Z', true],
    ['0 9 * * MON-WED', '2026-10-29T09:00:00Z', false],
    ['0 0 * * 7', '2026-11-01T00:00:00Z', true],
    ['0 0 1 nov *', '2026-11-01T00:00:00Z', true],
    ['0 0 13 * 4', '2026-10-29T00:00:00Z', true],
    ['0 0 13 * 5', '2026-10-29T00:00:00Z', false],
    ['0 0 29 * *', '2026-10-29T00:00:00Z', true],
    ['0 9 * * *', '2026-10-29T05:00:00-04:00', true],
    ['@hourly', '2026-10-29T13:00:00Z', true],
    ['@daily', '2026-10-29T13:00:00Z', false],
    ['@weekly', '2026-11-01T00:00:00Z', true],
  ]

  for (const [expression, at, due] of cases) {
    it(`"${expression}" at ${at} is ${due ? 'due' : 'not due'}`, () => {
      assert.equal(cronDue(expression, new Date(at)), due)
    })
  }

  for (const bad of [
    '',
    '* * * *',
    '61 * * * *',
    '* * * * * *',
    'a b c d e',
    '*/0 * * * *',
    '5-1 * * * *',
  ]) {
    it(`refuses "${bad}"`, () => {
      assert.throws(() => cronDue(bad, new Date()), /Invalid cron expression/)
    })
  }
})
