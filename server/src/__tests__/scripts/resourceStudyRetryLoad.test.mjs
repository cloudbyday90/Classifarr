/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest } from '@jest/globals';
import { createStudyRetryLoad } from '../../scripts/resourceStudyRetryLoad.mjs';
import { assertStudyRetryReceipt } from '../../scripts/resourceStudyRetryReceipt.mjs';
import { seedResourceStudyRetries } from '../../scripts/resourceStudyRetryFixture.mjs';

const legacyReceipt = () => ({ cohortSize: 60, preserved: true, rotations: 1, pressureDeferrals: 5,
  types: Object.fromEntries(['omdb', 'web_search', 'tavily'].map(type => [type,
    { beforePasses: 5, afterPasses: 5, rolledBackClaims: 10, recoveredClaims: 5, maxPassMs: 20 }])) });

function setup() {
  let rotated = false, pressure = false, time = 0;
  const cohort = Array.from({ length: 60 }, (_, index) => ({ id: index + 1,
    type: ['omdb', 'web_search', 'tavily'][index % 3], category: index % 4 }));
  const state = cohort.map(row => ({ id: row.id, status: 'pending', attempts: 0 }));
  const query = jest.fn(async () => ({ rows: [] }));
  const options = { db: { withTransaction: async work => work({ query }) },
    seed: jest.fn(async () => cohort), rotate: jest.fn(async () => { rotated = true; }),
    readState: jest.fn(async () => structuredClone(state)), available: jest.fn(async () => true),
    page: jest.fn(async (_db, type) => cohort.filter(row => row.type === type &&
      (row.category === 0 || (rotated && row.category === 1))).map(row => ({ queue_id: row.id }))),
    claim: jest.fn(async (_db, _type, _visited, id) => ({ queue_id: id, claim_token: '00000000-0000-4000-8000-000000000001' })),
    admission: { tryAcquire: jest.fn(() => pressure ? { allowed: false, reason: 'memory_pressure' }
      : { allowed: true, release }) }, now: () => time++,
  };
  const release = jest.fn();
  return { options, query, cohort, state, release, pressure: value => { pressure = value; }, load: createStudyRetryLoad(options) };
}

test('real-shaped eligibility oracle covers protected waits and targets recovered claims', async () => {
  const f = setup(); await f.load.pass('warmup'); expect(f.options.seed).not.toHaveBeenCalled();
  for (let i = 0; i < 5; i++) await f.load.pass('steady');
  f.pressure(true); await f.load.pass('telemetry_pressure'); await f.load.pass('telemetry_pressure');
  f.pressure(false); for (let i = 0; i < 5; i++) await f.load.pass('recovery');
  const receipt = await f.load.finish(); expect(() => assertStudyRetryReceipt(receipt)).not.toThrow();
  expect(f.options.seed).toHaveBeenCalledTimes(1); expect(f.options.rotate).toHaveBeenCalledTimes(1);
  expect(f.options.claim).toHaveBeenCalledTimes(30); expect(f.release).toHaveBeenCalledTimes(10);
  expect(f.query.mock.calls.filter(([sql]) => sql === 'ROLLBACK TO SAVEPOINT study_retry_claim')).toHaveLength(30);
  expect(f.options.claim.mock.calls.slice(15).every(([, , , id]) => f.cohort.find(row => row.id === id).category === 1)).toBe(true);
  expect(JSON.stringify(receipt)).not.toMatch(/claim_token|queue_id|media_item_id|api_key|title/);
});

test.each(['availability', 'page', 'missing_claim', 'token', 'claim_error', 'mutated_state'])('failure %s is not passing evidence and releases admission', async failure => {
  const f = setup();
  if (failure === 'availability') f.options.available.mockResolvedValue(false);
  if (failure === 'page') f.options.page.mockResolvedValue([{ queue_id: 9999 }]);
  if (failure === 'missing_claim') f.options.claim.mockResolvedValue(null);
  if (failure === 'token') f.options.claim.mockResolvedValue({ queue_id: 1, claim_token: '' });
  if (failure === 'claim_error') f.options.claim.mockRejectedValue(new Error('synthetic_claim_failure'));
  if (failure === 'mutated_state') f.options.readState.mockResolvedValueOnce(structuredClone(f.state)).mockResolvedValue([]);
  await expect(f.load.pass('steady')).rejects.toThrow(); expect(f.release).toHaveBeenCalledTimes(1);
  if (['missing_claim', 'token', 'claim_error'].includes(failure)) {
    expect(f.query.mock.calls.map(([sql]) => sql)).toContain('ROLLBACK TO SAVEPOINT study_retry_claim');
  }
  expect(() => assertStudyRetryReceipt(f.load.receipt)).toThrow();
});

test('overlapping passes are rejected and finish cannot race ongoing work', async () => {
  const f = setup(); let complete;
  f.options.seed.mockImplementation(() => new Promise(resolve => { complete = resolve; }));
  const running = f.load.pass('steady');
  await expect(f.load.pass('steady')).rejects.toThrow('overlap');
  await expect(f.load.finish()).rejects.toThrow('not_settled');
  complete(f.cohort); await running;
});

test('missing warmup inventory, phase coverage and pressure enforcement fail closed', async () => {
  const f = setup(); await expect(f.load.finish()).rejects.toThrow('coverage_missing');
  await expect(f.load.pass('recovery')).rejects.toThrow('initial_phase_missing');
  await f.load.pass('steady'); await expect(f.load.pass('telemetry_pressure')).rejects.toThrow('pressure_admitted');
  expect(f.release).toHaveBeenCalledTimes(2);
  const empty = setup(); empty.options.seed.mockResolvedValue([]);
  await expect(empty.load.pass('steady')).rejects.toThrow();
});

test('loop budget prevents an unbounded probe even if the clock stops advancing', async () => {
  const f = setup(); await f.load.pass('steady'); f.pressure(true);
  for (let i = 0; i < 999; i++) await f.load.pass('telemetry_pressure');
  await expect(f.load.pass('telemetry_pressure')).rejects.toThrow('pass_budget');
});

test('seed refuses an ordinary environment before opening a transaction', async () => {
  const db = { withTransaction: jest.fn() };
  await expect(seedResourceStudyRetries(db)).rejects.toThrow(); expect(db.withTransaction).not.toHaveBeenCalled();
});

test.each([{ beforePasses: 4 }, { afterPasses: 0 }, { rolledBackClaims: 9 }, { recoveredClaims: 4 },
  { maxPassMs: NaN }, { maxPassMs: -1 }, { beforePasses: '5' },
  { beforePasses: 500, afterPasses: 500, rolledBackClaims: 1000, recoveredClaims: 500 }])('retry evidence rejects invalid counters: %j', changes => {
  const receipt = legacyReceipt(); Object.assign(receipt.types.web_search, changes);
  expect(() => assertStudyRetryReceipt(receipt)).toThrow('retry_receipt_invalid');
});

test.each([{ preserved: false }, { cohortSize: 59 }, { rotations: 0 }, { pressureDeferrals: 1 }, { types: {} }])('missing coverage fails: %j', changes => {
  const receipt = legacyReceipt(); Object.assign(receipt, changes);
  expect(() => assertStudyRetryReceipt(receipt)).toThrow('retry_receipt_invalid');
});
