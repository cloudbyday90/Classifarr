/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { EnrichmentRetryService } from '../services/enrichmentRetryService.mjs';
import { getByTitle } from '../services/omdbLookup.mjs';
import { checkAndIncrementUsage } from '../services/omdbQuota.mjs';
import { createStudyProviderHttp } from './resourceStudyProviderHttp.mjs';
import { seedStudyProviderCohort, resetStudyProviderDay, repairStudyProviderCredential,
  readStudyProviderCohort } from './resourceStudyProviderFixture.mjs';
import { assertStudyProviderReceipt } from './resourceStudyProviderReceipt.mjs';

/** Real HTTP, quota, candidate admission, claims and persistence; explicit study loop owns wakeups. */
export async function createStudyProviderLoad({ db, admission, logger }) {
  const http = await createStudyProviderHttp();
  const retry = new EnrichmentRetryService({ db, logger, omdbService: {
    getByTitle: (title, year, type) => getByTitle(title, year, type, undefined, {
      baseUrl: http.url, queueOwned: true,
      checkAndIncrementUsage: () => checkAndIncrementUsage({ metadataProviderIntegrityService: { warnProviderRuntimeFailure() {} } }),
      warnProviderRuntimeFailure() {}, shouldLogSslWarning: () => false,
    }),
    getByIMDBId() { throw new Error('study_provider_unexpected_identity'); },
  } });
  // No singleton or production timer is modified; one bounded loop owns this instance.
  retry.scheduleProcessing = () => {};
  let cohort, busy = false, recoveryAt, pressureHttp;
  const receipt = { cohortSize: 8, passes: 0, resets: 0, repairs: 0, preservedWaitChecks: 0,
    pressureDeferrals: 0, httpDuringPressure: 0, peakPending: 0, maxActive: 0, recoveryMs: null };
  return {
    receipt,
    async pass(phase) {
      assert.ok(['warmup', 'steady', 'provider_outage', 'telemetry_pressure', 'recovery', 'drain'].includes(phase));
      if (phase === 'warmup') return;
      assert.equal(busy, false, 'study_provider_overlap'); busy = true;
      let permit;
      try {
        assert.ok(++receipt.passes <= 1000, 'study_provider_pass_budget');
        if (!cohort) { assert.equal(phase, 'steady'); cohort = await seedStudyProviderCohort(db); }
        const before = await readStudyProviderCohort(db, cohort);
        assert.equal(before.length, 8);
        receipt.peakPending = Math.max(receipt.peakPending, before.filter(row => row.status === 'pending').length);
        permit = admission.tryAcquire('queue');
        if (!permit.allowed) {
          if (phase === 'telemetry_pressure' && permit.reason === 'memory_pressure') {
            pressureHttp ??= http.receipt.httpAttempts;
            receipt.httpDuringPressure += http.receipt.httpAttempts - pressureHttp;
            pressureHttp = http.receipt.httpAttempts; receipt.pressureDeferrals++;
          }
          return;
        }
        assert.notEqual(phase, 'telemetry_pressure', 'study_provider_pressure_admitted');
        receipt.maxActive = 1;
        if (phase === 'provider_outage' && !receipt.resets) {
          await resetStudyProviderDay(db, cohort); receipt.resets++;
        }
        if (phase === 'recovery' && !receipt.repairs) {
          await repairStudyProviderCredential(db, cohort); receipt.repairs++; recoveryAt = performance.now();
        }
        const attempts = http.receipt.httpAttempts;
        const result = await retry.processRetryQueue(1, 'omdb', { maintenance: false });
        const after = await readStudyProviderCohort(db, cohort);
        if (result.processed === 0) {
          assert.equal(http.receipt.httpAttempts, attempts, 'study_provider_wait_sent_http');
          assert.deepEqual(after, before, 'study_provider_wait_mutated');
          if (before.some(row => row.status === 'pending')) receipt.preservedWaitChecks++;
        }
        if (after.every(row => row.status === 'completed') && receipt.recoveryMs === null) {
          receipt.recoveryMs = performance.now() - recoveryAt;
        }
      } finally { if (permit?.allowed) permit.release(); busy = false; }
    },
    async finish() {
      assert.equal(busy, false); assert.ok(cohort);
      const rows = await readStudyProviderCohort(db, cohort);
      assert.equal(rows.length, 8);
      assert.ok(rows.every(row => row.status === 'completed' && row.evidence === true && row.claim_token === null));
      assert.equal((await db.query('SELECT count(*)::integer n FROM enrichment_retry_queue')).rows[0].n, 8);
      const result = { ...receipt, ...http.receipt, uniqueCompleted: new Set(rows.map(row => row.media_item_id)).size,
        pending: rows.filter(row => row.status === 'pending' || row.status === 'processing').length,
        chargedAttempts: rows.reduce((sum, row) => sum + row.attempts, 0) };
      assertStudyProviderReceipt(result); return result;
    },
    async close() { retry.cancelScheduledProcessing(); await http.close(); },
  };
}
