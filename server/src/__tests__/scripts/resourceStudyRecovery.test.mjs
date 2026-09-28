/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { load } from 'js-yaml';
import { createStudyQueueRecovery } from '../../scripts/resourceStudyQueueRecovery.mjs';
import { resourceStudyProfile, assertResourceStudyReceipt } from '../../scripts/resourceStudyProfiles.mjs';
import { resourceStudyEvaluationSnapshot } from '../../scripts/resourceStudyFixtures.mjs';
import { resourceStudyReceiptFixture as receipt } from '../helpers/resourceStudyReceiptFixture.mjs';

function setup() {
  let time = 0;
  const cohort = [], items = Array.from({ length: 20 }, (_, index) => ({ id: index + 1,
    library_id: index % 4 + 1, media_type: index % 4 < 2 ? 'movie' : 'tv' }));
  const db = { query: jest.fn(async text => ({ rows: text.includes('media_server_items') ? items : cohort })) };
  const queue = { queueRefillService: { buildMetadataEnrichmentPayload: item => ({ itemId: item.id }) },
    enqueue: jest.fn(async (_type, payload) => {
      const id = payload.itemId; cohort.push({ id, status: 'pending', attempts: 0 }); return id;
    }) };
  const admission = { classes: { queue: { active: 0 } } };
  const recovery = createStudyQueueRecovery({ db, queue, admission, now: () => time, wait: async ms => { time += ms; } });
  return { recovery, cohort, items, queue, admission, advance: ms => { time += ms; } };
}
async function held() {
  const fixture = setup();
  await fixture.recovery.hold(); await fixture.recovery.checkHeld();
  fixture.advance(6000); await fixture.recovery.checkHeld();
  return fixture;
}
test('real task entry, not empty admission attempts, establishes post-clear wakeup', async () => {
  const { recovery, cohort, advance, queue } = await held();
  recovery.clear(); advance(450); recovery.onStart({ id: 999 });
  expect(recovery.receipt.firstDispatchMs).toBeNull();
  cohort.forEach(row => { recovery.onStart(row); row.status = 'completed'; row.result = { enriched: true }; });
  advance(1000); await recovery.checkRecovery();
  expect(recovery.receipt).toEqual({ cohortSize: 20, started: 20, completed: 20, startedDuringPressure: 0,
    holdChecks: 2, heldMs: 6000, firstDispatchMs: 450, completedMs: 1450 });
  expect(queue.enqueue).toHaveBeenCalledTimes(20);
  expect(JSON.stringify(recovery.receipt)).not.toMatch(/itemId|payload|title/);
  advance(200000); await expect(recovery.checkRecovery()).resolves.toBeUndefined();
});
test('pressure must be observed and repeated setup is forbidden', async () => {
  const { recovery } = setup();
  expect(() => recovery.clear()).toThrow('pressure_missing');
  await expect(recovery.checkHeld()).rejects.toThrow('pressure_missing');
  await recovery.hold(); expect(() => recovery.clear()).toThrow('hold_not_observed');
  await expect(recovery.hold()).rejects.toThrow('pressure_repeated');
});
test('in-flight operations must settle before cohort creation', async () => {
  const { recovery, admission, queue } = setup();
  admission.classes.queue.active = 1;
  await expect(recovery.hold()).rejects.toThrow('inflight_did_not_settle');
  expect(queue.enqueue).not.toHaveBeenCalled();
});
test('existing operations may settle without being cancelled or having their permits forged', async () => {
  let time = 0;
  const fixture = setup(); fixture.admission.classes.queue.active = 1;
  const recovery = createStudyQueueRecovery({
    db: { query: async () => ({ rows: fixture.items }) }, queue: fixture.queue, admission: fixture.admission,
    now: () => time, wait: async ms => { time += ms; fixture.admission.classes.queue.active = 0; },
  });
  await recovery.hold();
  expect(time).toBe(25); expect(fixture.queue.enqueue).toHaveBeenCalledTimes(20);
});
test('missing inventory cannot produce vacuous passing evidence', async () => {
  const { recovery, items } = setup(); items.pop();
  await expect(recovery.hold()).rejects.toThrow('cohort_missing');
});
test('pressure cohort must cover all four libraries and both supported media types', async () => {
  const { recovery, items } = setup(); items.forEach(item => { item.library_id = 1; });
  await expect(recovery.hold()).rejects.toThrow('library_coverage_missing');
});
test.each(['processing', 'completed', 'failed', 'deleted', 'retry'])('detects lost or mutated held work: %s', async state => {
  const { recovery, cohort } = await held();
  if (state === 'deleted') cohort.pop();
  else if (state === 'retry') cohort[0].attempts = 1;
  else cohort[0].status = state;
  await expect(recovery.checkHeld()).rejects.toThrow();
});
test('early and duplicate dispatches cannot pass', async () => {
  const { recovery, cohort } = await held();
  expect(() => recovery.onStart(cohort[0])).toThrow('under_pressure');
  recovery.clear(); recovery.onStart(cohort[0]);
  expect(() => recovery.onStart(cohort[0])).toThrow('duplicate_dispatch');
});
test('missing wakeup fails after its deadline', async () => {
  const { recovery, advance } = await held(); recovery.clear(); advance(30001);
  await expect(recovery.checkRecovery()).rejects.toThrow('resume_deadline');
});
test('database latency counts toward the completion deadline', async () => {
  let time = 0, readDelay = 0;
  const fixture = setup();
  const recovery = createStudyQueueRecovery({ queue: fixture.queue, admission: fixture.admission, now: () => time,
    db: { query: async text => {
      time += readDelay;
      return { rows: text.includes('media_server_items') ? fixture.items : fixture.cohort };
    } },
  });
  await recovery.hold(); await recovery.checkHeld(); time = 6000; await recovery.checkHeld(); recovery.clear();
  fixture.cohort.forEach(row => { recovery.onStart(row); row.status = 'completed'; row.result = { enriched: true }; });
  time = 125999; readDelay = 2;
  await expect(recovery.checkRecovery()).rejects.toThrow('completion_deadline');
});
test.each(['pending', 'failed', 'skipped', 'retry'])('incomplete or failed recovery cannot pass: %s', async state => {
  const { recovery, cohort, advance } = await held(); recovery.clear(); recovery.onStart(cohort[0]);
  if (state === 'pending') advance(120001);
  if (state === 'failed') cohort[0].status = 'failed';
  if (state === 'retry') cohort[0].attempts = 1;
  if (state === 'skipped') { cohort[0].status = 'completed'; cohort[0].result = { skipped: true }; }
  await expect(recovery.checkRecovery()).rejects.toThrow(/deadline|recovery_failed/);
});
test('profile allowlist is immutable and dimensions cannot silently shrink', () => {
  expect(Object.isFrozen(resourceStudyProfile('capacity'))).toBe(true);
  expect(resourceStudyProfile('capacity')).toMatchObject({ rows: 6700, dimensions: 768, durationMs: 300000 });
  expect(() => resourceStudyProfile('__proto__')).toThrow();
  expect(() => resourceStudyEvaluationSnapshot({ rows: 10000 })).toThrow();
  expect(() => resourceStudyEvaluationSnapshot({ dimensions: 64 })).toThrow();
  const snapshot = resourceStudyEvaluationSnapshot(resourceStudyProfile('capacity'));
  expect(snapshot.inputs.source.vectors.size).toBe(6700);
  expect(snapshot.inputs.source.vectors.values().next().value).toHaveLength(768);
});
test.each([{ version: 'resource_study.v1' }, { version: 'resource_study.v2' }, { profile: 'capacity' }, { evaluationRows: 399 }, { vectorDimensions: 64 },
  { queueRecovery: null }, { durationMs: 300001 }])('old or wrong profile evidence fails: %j', changes => {
  expect(() => assertResourceStudyReceipt({ ...receipt(), ...changes }, 'smoke')).toThrow('receipt_invalid');
});
test.each([{ completed: 19 }, { started: 19 }, { startedDuringPressure: 1 }, { firstDispatchMs: null },
  { firstDispatchMs: 30001 }, { completedMs: 120001 }, { completedMs: 100 }, { heldMs: 100 }, { holdChecks: 1 }])('recovery evidence fails closed: %j', changes => {
  const value = receipt(); Object.assign(value.queueRecovery, changes);
  expect(() => assertResourceStudyReceipt(value, 'smoke')).toThrow('receipt_invalid');
});
test('valid versioned receipt passes', () => expect(() => assertResourceStudyReceipt(receipt(), 'smoke')).not.toThrow());
test('CI is isolated, bounded, least-privilege, SHA-pinned and never publishes images or releases', () => {
  const workflow = load(readFileSync(new URL('../../../../.github/workflows/resource-capacity.yml', import.meta.url), 'utf8'));
  expect(Object.keys(workflow.on).sort()).toEqual(['pull_request', 'push', 'workflow_dispatch']);
  expect(workflow.on.push).toEqual({ branches: ['main'] });
  expect(workflow.on.workflow_dispatch.inputs.profile.options).toEqual(['smoke', 'capacity', 'budgets']);
  expect(workflow.permissions).toEqual({ contents: 'read' });
  expect(workflow.concurrency).toEqual({ group: 'resource-capacity-${{ github.ref }}', 'cancel-in-progress': true });
  expect(Object.keys(workflow.jobs)).toEqual(['resource-capacity']);
  const job = workflow.jobs['resource-capacity'];
  expect(job['runs-on']).toBe('ubuntu-latest'); expect(job['timeout-minutes']).toBe(35);
  expect(job.steps.filter(step => step.uses).every(step => /^actions\/[a-z-]+@[a-f0-9]{40}$/.test(step.uses))).toBe(true);
  expect(job.steps[0].with['persist-credentials']).toBe(false);
  expect(job.steps.filter(step => step.run).map(step => step.run)).toEqual([
    'node scripts/run-resource-study.mjs --smoke', 'node scripts/run-resource-study.mjs --capacity',
    'node scripts/run-resource-study.mjs --budget-comparison']);
  expect(job.steps.at(-1).with).toMatchObject({ path: '.tmp/resource-study/classifarr-resource-study-*/result.json\n.tmp/resource-study/comparison-*/result.json\n',
    'include-hidden-files': true, 'if-no-files-found': 'error', 'retention-days': 14 });
  expect(JSON.stringify(workflow)).not.toMatch(/secrets\.|pull_request_target|self-hosted|continue-on-error|docker login|docker push/);
});
