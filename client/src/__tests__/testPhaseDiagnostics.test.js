/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
// @vitest-environment node
import assert from 'node:assert/strict'
import { test, vi, afterEach } from 'vitest'
import { createTestPhaseDiagnostics } from '../../scripts/lib/testPhaseDiagnostics.mjs'

afterEach(() => vi.unstubAllEnvs())

function fixture(overrides = {}) {
  let time = 0n
  let ticks = 0
  const records = []
  const diagnostics = createTestPhaseDiagnostics('csrf-usage', {
    enabled: true,
    clock: () => { time += 1_000_000n; return time },
    cpu: () => ({ user: ++ticks * 10, system: ticks * 2 }),
    emit: record => records.push(record),
    ...overrides,
  })
  return { diagnostics, records }
}

test('aggregates repeated phases and correlates bounded start/end records', () => {
  const { diagnostics: d, records } = fixture()
  const value = { privateData: 'never log this' }
  assert.equal(d.runSync(() => {
    d.measureSync('read', () => value)
    return d.measureSync('read', () => value)
  }), value)
  assert.equal(records.length, 2)
  const [start, end] = records
  assert.deepEqual(Object.keys(start).sort(), ['event', 'schemaVersion', 'id', 'scope', 'pid', 'type', 'at'].sort())
  assert.match(start.id, /^[0-9a-f-]{36}$/)
  assert.equal(end.id, start.id)
  assert.equal(start.type, 'start')
  assert.equal(end.type, 'end')
  assert.equal(end.outcome, 'returned')
  assert.equal(end.scope, 'csrf-usage')
  assert.equal(end.pid, process.pid)
  assert.deepEqual(end.total, { wallMs: 5, cpuUserUs: 50, cpuSystemUs: 10 })
  assert.deepEqual(end.phases, [{ phase: 'read', calls: 2, failedCalls: 0, wallMs: 2, cpuUserUs: 20, cpuSystemUs: 4 }])
  assert.doesNotMatch(JSON.stringify(records), /privateData|never log this/)
  assert.throws(() => d.runSync(() => {}), /already started/)
})

test('preserves thrown error identity without serializing it', () => {
  const { diagnostics: d, records } = fixture()
  const failure = new Error('sensitive source path and error')
  assert.throws(() => d.runSync(() => d.measureSync('assert', () => { throw failure })), error => error === failure)
  assert.equal(records[1].outcome, 'threw')
  assert.equal(records[1].phases[0].failedCalls, 1)
  assert.doesNotMatch(JSON.stringify(records), /sensitive|stack|message/)
})

test('preserves asynchronous values and rejection identity', async () => {
  const success = fixture()
  assert.equal(await success.diagnostics.runAsync(() => success.diagnostics.measureAsync('eslint-config', async () => 42)), 42)
  assert.equal(success.records[1].outcome, 'returned')
  const failure = fixture()
  const error = new Error('private rejection')
  await assert.rejects(failure.diagnostics.runAsync(() => failure.diagnostics.measureAsync('eslint-config', async () => { throw error })), e => e === error)
  assert.equal(failure.records[1].outcome, 'threw')
  assert.equal(failure.records[1].phases[0].failedCalls, 1)
  assert.doesNotMatch(JSON.stringify(failure.records), /private rejection/)
})

test('a pending callback emits only its start until it actually completes', async () => {
  const { diagnostics: d, records } = fixture()
  let finish
  const result = d.runAsync(() => d.measureAsync('eslint-config', () => new Promise(resolve => { finish = resolve })))
  assert.equal(records.length, 1)
  finish(7)
  assert.equal(await result, 7)
  assert.equal(records.length, 2)
})

test('disabled mode does not sample or emit and still preserves errors', async () => {
  const unexpected = () => { throw new Error('must not sample or emit') }
  const { diagnostics: d } = fixture({ enabled: false, clock: unexpected, cpu: unexpected, emit: unexpected })
  assert.equal(d.runSync(() => d.measureSync('read', () => 1)), 1)
  assert.equal(await d.runAsync(() => d.measureAsync('read', async () => 2)), 2)
  const failure = new Error('original')
  assert.throws(() => d.runSync(() => d.measureSync('read', () => { throw failure })), e => e === failure)
  await assert.rejects(d.runAsync(() => d.measureAsync('read', async () => { throw failure })), e => e === failure)
})

test('only the exact opt-in value enables recording', () => {
  for (const value of [undefined, '', 'true', '0', '1']) {
    vi.stubEnv('CLASSIFARR_TEST_PHASE_DIAGNOSTICS', value)
    const records = []
    createTestPhaseDiagnostics('lint-tooling', { emit: record => records.push(record) }).runSync(() => 1)
    assert.equal(records.length, value === '1' ? 2 : 0)
  }
})

test('output failure cannot mask a callback failure or turn a pass into failure', async () => {
  const emit = () => { throw new Error('output failed') }
  assert.equal(fixture({ emit }).diagnostics.runSync(() => 3), 3)
  const error = new Error('original')
  assert.throws(() => fixture({ emit }).diagnostics.runSync(() => { throw error }), e => e === error)
  await assert.rejects(fixture({ emit }).diagnostics.runAsync(async () => { throw error }), e => e === error)
})

test('rejects arbitrary scope/phase strings and retains no free-form fields', async () => {
  assert.throws(() => createTestPhaseDiagnostics('/private/source'), /Unknown diagnostic scope/)
  const { diagnostics: d, records } = fixture()
  assert.throws(() => d.measureSync('/private/source', () => 1), /Unknown diagnostic phase/)
  await assert.rejects(d.measureAsync('secret', async () => 1), /Unknown diagnostic phase/)
  d.runSync(() => 1)
  assert.deepEqual(records[1].phases, [])
  assert.notEqual(fixture().diagnostics, d)
})
