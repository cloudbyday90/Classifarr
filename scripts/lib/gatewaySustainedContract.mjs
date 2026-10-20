/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { soakArrivals } from '../fixtures/ollamaGatewayRehearsal/soakWorkload.mjs';
import { soakProfile } from '../fixtures/ollamaGatewayRehearsal/soakProfile.mjs';
import { requireStudyCoverage } from '../fixtures/ollamaGatewayRehearsal/studyMeasurements.mjs';
import { requireStudyDatabaseCoverage } from '../fixtures/ollamaGatewayRehearsal/studyDatabase.mjs';

const keys = (value, expected) => assert.deepEqual(Object.keys(value).sort(), [...expected].sort());
const finite = value => assert.ok(Number.isFinite(value) && value >= 0 && value < 2000000);
function distribution(value, count) {
  keys(value, ['count','p50','p95','p99','max']); assert.equal(value.count, count);
  let previous = 0;
  for (const key of ['p50','p95','p99','max']) { finite(value[key]); assert.ok(value[key] >= previous); previous = value[key]; }
}
function population(value, foreground, busy, bin = false) {
  keys(value, ['offered','completed','busy','latencyMs','busyLatencyMs','latenessMs','preClaimMs','claimMs',
    ...(bin ? ['minute','startMs','endMs'] : [])]);
  assert.equal(value.offered, foreground + busy); assert.equal(value.completed, foreground); assert.equal(value.busy, busy);
  for (const field of ['latencyMs','preClaimMs','claimMs']) distribution(value[field], foreground);
  distribution(value.busyLatencyMs, busy); distribution(value.latenessMs, foreground + busy);
  assert.ok(value.latenessMs.max <= 500);
}
function resource(value, limit) {
  assert.ok(Number.isSafeInteger(value?.peakBytes) && value.peakBytes > 0 && value.peakBytes <= limit);
  assert.ok(value.memoryEvents && Object.keys(value.memoryEvents).length > 0 && Object.values(value.memoryEvents).every(v => Number(v) === 0));
  assert.match(value.pidsEvents, /^max\s+0\s*$/);
  return { peakBytes:value.peakBytes, memoryEvents:'zero', pidsEvents:'zero' };
}

/** Independently validate returned proof, then project only bounded synthetic observations. */
export function requireGatewaySustainedArm(value, profileName) {
  try {
    assert.ok(['comparison-off','comparison-on'].includes(profileName));
    assert.ok(Buffer.byteLength(JSON.stringify(value)) < 1048576);
    assert.equal(value.profile, profileName); assert.equal(value.cleanup, 'verified');
    const baseline = profileName === 'comparison-off', profile = soakProfile(profileName), inference = value.inference;
    assert.equal(inference.passed, true); assert.equal(inference.providerAttempts, 1800); assert.equal(inference.peakProviderConcurrency, 1);
    const summary = inference.comparison, plan = soakArrivals(profileName);
    keys(summary, ['version','planSha256','overall','minutes','worst']); assert.equal(summary.version, 1);
    assert.equal(summary.planSha256, createHash('sha256').update(JSON.stringify(plan)).digest('hex'));
    population(summary.overall, 1800, 180);
    assert.equal(summary.minutes.length, 30);
    for (const [minute, bin] of summary.minutes.entries()) {
      assert.equal(bin.minute, minute); assert.equal(bin.startMs, minute * 60000); assert.equal(bin.endMs, (minute + 1) * 60000);
      population(bin, 60, 6, true);
    }
    for (const field of ['latencyMs','busyLatencyMs','latenessMs','preClaimMs','claimMs']) {
      assert.equal(summary.overall[field].max, Math.max(...summary.minutes.map(bin => bin[field].max)));
    }
    keys(summary.worst, ['id','installation','atMs','latencyMs','latenessMs','preClaimMs','claimMs']);
    const slot = plan.find(row => row.id === summary.worst.id);
    assert.ok(slot && slot.installation !== 'background'); assert.equal(slot.installation, summary.worst.installation);
    assert.equal(slot.at, summary.worst.atMs); assert.equal(summary.worst.latencyMs, summary.overall.latencyMs.max);
    for (const field of ['latencyMs','latenessMs','preClaimMs','claimMs']) finite(summary.worst[field]);
    assert.ok(summary.worst.latenessMs <= 500);
    requireStudyCoverage(inference.study, profile.durationMs + profile.settleMs - 2500, true);
    requireStudyDatabaseCoverage(inference.study, baseline);
    const history = value.history;
    assert.equal(history.rows, 3000); assert.ok(history.bytes > 220000000 && history.bytes < 268435456);
    assert.match(history.sha256, /^[a-f0-9]{64}$/);
    const preserved = value.data.filter(row => row.fixture === 'history-preserved'); assert.equal(preserved.length, 1);
    assert.equal(preserved[0].sha256, history.sha256); assert.equal(preserved[0].bytes, history.bytes); assert.equal(preserved[0].rows, 3000);
    assert.equal(preserved[0].retainedRoots, baseline ? 0 : 2);
    assert.equal(preserved[0].dumps.length, baseline ? 0 : 2);
    assert.ok(preserved[0].dumps.every(row => row.bytes > 220000000 && row.bytes <= 268435456));
    const checks = value.data.filter(row => row.fixture === 'soak-check'); assert.equal(checks.length, 1);
    const proof = checks[0]; assert.equal(proof.cleanupOperations, 0);
    assert.deepEqual(proof.admission, { attempts:1801, binding_count:1801, active_request:null });
    assert.deepEqual(proof.rows, { n:1800, fingerprints:1800, v7:1800 });
    assert.equal(proof.catalogJobs.length, baseline ? 0 : 2);
    assert.ok(proof.catalogJobs.every(row => row.status === 'verified' && row.attempt === 1));
    assert.ok(proof.overlaps.length <= 20); assert.equal(value.workers.length, baseline ? 0 : 2);
    if (baseline) assert.equal(proof.overlaps.length, 0);
    else assert.deepEqual(value.workers.map(row => row.kind), ['archiver','catalog-verifier']);
    const workers = value.workers.map(({kind,rows}) => {
      assert.ok(proof.overlaps.some(row => row.kind === kind && Number.isSafeInteger(row.admittedRequests) && row.admittedRequests > 0));
      const resources = rows.filter(row => row.fixture === 'resources'), observations = rows.filter(row => row.fixture === 'study-observations');
      assert.equal(resources.length, 1); assert.equal(observations.length, 1); assert.equal(observations[0].coveragePassed, true);
      requireStudyCoverage(observations[0], profile.durationMs - 120000 - (kind === 'archiver' ? 0 : 20000) - 5000);
      return { kind, ...resource(resources[0], kind === 'archiver' ? 268435456 : 1610612736),
        samples:observations[0].samples, anonymousPeakBytes:observations[0].peaks.anonBytes, filePeakBytes:observations[0].peaks.fileBytes };
    });
    return { profile:profileName, latency:structuredClone(summary), history:{rows:3000,bytes:history.bytes,sha256:history.sha256},
      providerAttempts:1800, verifiedCatalogs:proof.catalogJobs.length, source:{...resource(inference.resources,2147483648),
        samples:inference.study.samples, transactionAgePeakMs:inference.study.peaks.maxCatalogTransactionAgeMs}, workers };
  } catch { throw new Error('sustained_arm_contract_invalid'); }
}
