/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { readEnrichmentRetryPage } from '../services/enrichmentRetryCandidatePage.mjs';
import { hasEnrichmentRetryDispatchCandidate } from '../services/enrichmentRetryDispatchCandidate.mjs';
import { claimEnrichmentRetry } from '../services/enrichmentRetryClaimService.mjs';
import { isQueueClaimToken } from '../services/queueTaskAcknowledgementService.mjs';
import { STUDY_RETRY_TYPES, seedResourceStudyRetries, rotateResourceStudyRetryCredentials,
  readResourceStudyRetryState } from './resourceStudyRetryFixture.mjs';

/** Repeated database exercises, not provider throughput. Every claim is rolled back. */
export function createStudyRetryLoad({ db, admission, now = () => performance.now(),
  seed = seedResourceStudyRetries, rotate = rotateResourceStudyRetryCredentials,
  readState = readResourceStudyRetryState, page = readEnrichmentRetryPage,
  available = hasEnrichmentRetryDispatchCandidate, claim = claimEnrichmentRetry }) {
  let cohort, original, rotated = false, busy = false, passes = 0;
  const receipt = { cohortSize: 60, preserved: false, pressureDeferrals: 0, rotations: 0,
    types: Object.fromEntries(STUDY_RETRY_TYPES.map(type => [type,
      { beforePasses: 0, afterPasses: 0, rolledBackClaims: 0, recoveredClaims: 0, maxPassMs: 0 }])) };
  return {
    receipt,
    async pass(phase) {
      assert.ok(['warmup', 'steady', 'provider_outage', 'telemetry_pressure', 'recovery'].includes(phase));
      if (phase === 'warmup') return;
      assert.equal(busy, false, 'study_retry_overlap'); busy = true;
      let permit;
      try {
        assert.ok(++passes <= 1000, 'study_retry_pass_budget');
        if (!cohort) {
          assert.equal(phase, 'steady', 'study_retry_initial_phase_missing');
          cohort = await seed(db); original = await readState(db);
          assert.equal(cohort.length, 60); assert.equal(original.length, 60);
        }
        permit = admission.tryAcquire('queue');
        if (!permit.allowed) {
          if (phase === 'telemetry_pressure' && permit.reason === 'memory_pressure') receipt.pressureDeferrals++;
          return;
        }
        assert.notEqual(phase, 'telemetry_pressure', 'study_retry_pressure_admitted');
        if (phase === 'recovery' && !rotated) { await rotate(db); rotated = true; receipt.rotations++; }
        for (const type of STUDY_RETRY_TYPES) {
          const start = now(), metrics = receipt.types[type];
          const expected = cohort.filter(row => row.type === type && (row.category === 0 || (rotated && row.category === 1)));
          assert.equal(await available(db, type), true, 'study_retry_availability');
          const rows = await page(db, type, null, 50);
          assert.deepEqual(rows.map(row => row.queue_id), expected.map(row => row.id), 'study_retry_eligibility');
          const target = rotated ? expected.find(row => row.category === 1) : expected[0];
          assert.ok(target);
          await db.withTransaction(async client => {
            await client.query("SET LOCAL statement_timeout='5s'; SET LOCAL lock_timeout='2s'; SET LOCAL transaction_timeout='10s'");
            await client.query('SAVEPOINT study_retry_claim');
            try {
              const item = await claim({ query: (...args) => client.query(...args),
                withTransaction: () => { throw new Error('study_retry_nested_transaction'); } }, type, [], target.id);
              assert.equal(item?.queue_id, target.id, 'study_retry_claim_missing');
              assert.equal(isQueueClaimToken(item.claim_token), true, 'study_retry_token_missing');
            } finally {
              await client.query('ROLLBACK TO SAVEPOINT study_retry_claim');
              await client.query('RELEASE SAVEPOINT study_retry_claim');
            }
          });
          metrics[rotated ? 'afterPasses' : 'beforePasses']++;
          metrics.rolledBackClaims++; if (rotated) metrics.recoveredClaims++;
          const elapsed = now() - start;
          assert.ok(Number.isFinite(elapsed) && elapsed >= 0);
          metrics.maxPassMs = Math.max(metrics.maxPassMs, elapsed);
        }
        assert.deepEqual(await readState(db), original, 'study_retry_state_changed');
      } finally { if (permit?.allowed) permit.release(); busy = false; }
    },
    async finish() {
      assert.equal(busy, false, 'study_retry_not_settled');
      assert.ok(cohort && rotated, 'study_retry_coverage_missing');
      assert.deepEqual(await readState(db), original, 'study_retry_state_changed');
      receipt.preserved = true;
      return receipt;
    },
  };
}
