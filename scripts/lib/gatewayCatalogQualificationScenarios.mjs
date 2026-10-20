/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { requirePressureCapture } from './gatewayPressureContract.mjs';

/** All mutations target the harness's synthetic database and labeled volumes only. */
export async function qualifyCatalogScenario({ shape, fixture, create, wait, run, hasState, kill, resume, report,measure=false }) {
  hasState(await run('archiver'), 'catalog_empty');
  if (shape === 'catalog-protected') {
    fixture('evidence-seed'); let size;
    for (let batch=0;batch<25;batch++) {
      fixture('evidence-generate');
      hasState(await wait(create('batch-verifier','normal','verifier')),'verified');
      size=fixture('evidence-accept'); report({ scenario:shape,batch:batch+1,...size });
      if (size.evidencebytes > 9*1048576) break;
    }
    assert.ok(size.evidencebytes > 9*1048576,'qualification_valid_evidence_size');
    assert.ok(size.payloadbytes > 8*1048576,'qualification_full_payload_size');
    const before=fixture('inspect'),fingerprint=fixture('fingerprint');
    fixture('evidence-tamper');
    const refused=await run('archiver'); hasState(refused,'archive_blocked');
    assert.ok(refused.some(row => row.reason==='gateway_archive_protection_fence'));
    const cleanupRefused=await run('cleanup'); hasState(cleanupRefused,'cleanup_blocked');
    assert.ok(cleanupRefused.some(row => row.reason==='gateway_archive_protection_fence'));
    assert.deepEqual(fixture('inspect'),before); assert.deepEqual(fixture('fingerprint'),fingerprint);
    fixture('evidence-repair-fixture');
    // Every file must pass before SQL independently refuses low-pressure cleanup.
    const lowPressure=await run('cleanup'); hasState(lowPressure,'cleanup_blocked');
    assert.ok(lowPressure.some(row => row.reason==='gateway_cleanup_identity_changed'));
    assert.equal(fixture('inspect').cleanupOperations,0);
    hasState(await run('archiver'),'awaiting_catalog_verification');
    hasState(await run('catalog-verifier'),'verified');
    hasState(await run('archiver'),'catalog_attempts_exhausted');
    const after=fixture('inspect');
    assert.equal(after.jobs.length,1); assert.equal(after.jobs[0].status,'verified'); assert.equal(after.jobs[0].attempt,3);
    assert.equal(after.jobs[0].tables['gateway_archive.job'].count,size.archives);
    assert.equal(after.inferenceJobs,size.archives); assert.equal(after.roots.length,1);
    assert.ok(after.dependencies>=size.archives); assert.deepEqual(fixture('fingerprint'),fingerprint);
    hasState(await run('archiver'),'catalog_attempts_exhausted'); assert.deepEqual(fixture('inspect'),after);
    report({ scenario:shape,state:'large_valid_protected_evidence_verified',...size }); return;
  }
  fixture('admit'); report({ scenario: shape, ...fixture('history') });
  hasState(await run('archiver'), 'awaiting_verification');
  hasState(await run('verifier'), 'verified');
  if (['catalog-wide','catalog-pressure'].includes(shape)) {
    // Accept the real isolated verifier's prerequisite receipt, then capture wide
    // failed history twice through the packaged worker and restore both snapshots.
    fixture('acknowledge-inference'); const history=fixture('wide'); report({ scenario: shape, ...history });
    if (shape==='catalog-wide') report({ scenario:shape,...fixture('compare-reads') });
    const captures=[];
    for (let index=0;index<2;index++) {
      const logs=await run('archiver');hasState(logs,'awaiting_catalog_verification');
      const metrics=shape==='catalog-pressure' ? requirePressureCapture(logs,measure) :
        logs.find(row=>row.fixture==='metrics');assert.ok(metrics);
      captures.push(metrics);report({scenario:shape,stage:`large_capture_${index+1}`,...metrics});
      hasState(await run('catalog-verifier'),'verified');
    }
    hasState(await run('archiver'), 'catalog_unchanged');
    if (shape==='catalog-pressure') {
      const after=fixture('pressure-history'),inspection=fixture('inspect');
      assert.equal(after.sha256,history.sha256);assert.equal(after.bytes,history.bytes);assert.equal(after.rows,history.rows);
      assert.equal(inspection.jobs.length,2);assert.ok(inspection.jobs.every(job=>job.status==='verified'));
      assert.equal(inspection.roots.length,2);assert.equal(inspection.cleanupOperations,0);
    }
    fixture('history-change');
    const before = fixture('inspect'), fingerprint = fixture('fingerprint');
    hasState(await run('archiver'), 'catalog_attempts_exhausted');
    assert.deepEqual(fixture('inspect'), before); assert.deepEqual(fixture('fingerprint'), fingerprint);
    report({ scenario: shape, ...fixture('oversized-evidence') });
    const corrupted = fixture('inspect');
    const refused = await run('archiver'); hasState(refused,'archive_blocked');
    assert.ok(refused.some(row => row.reason === 'gateway_archive_history_size_limit'));
    assert.deepEqual(fixture('inspect'), corrupted); assert.deepEqual(fixture('fingerprint'), fingerprint);
    return shape==='catalog-pressure' ? {captures,history,historyPreserved:true} : undefined;
  }
  if (shape === 'catalog-capacity' || shape === 'catalog-interruption') {
    const exporting = create('archiver','pause');
    const boundary = await wait(exporting,true); report({ scenario: shape, ...boundary.find(row => row.fixture === 'boundary') });
    const before = fixture('inspect'); assert.equal(before.jobs[0].status,'exporting'); assert.equal(before.jobs[0].attempt,2);
    hasState(await wait(create('archiver','contention','contender')), 'contender_refused');
    assert.deepEqual(fixture('inspect').jobs,before.jobs);
    if (shape === 'catalog-interruption') {
      kill(exporting); hasState(await run('archiver'),'catalog_interrupted');
      const after = fixture('inspect'); assert.equal(after.jobs.length,1); assert.equal(after.jobs[0].attempt,2);
      assert.equal(after.jobs[0].status,'interrupted'); hasState(await run('archiver'),'catalog_interrupted'); return;
    }
    assert.equal(fixture('admit').attempts,'2'); resume(exporting);
    hasState(await wait(exporting),'awaiting_catalog_verification');
    const published = fixture('inspect'); assert.equal(published.jobs[0].content.request_binding.count,1);
    assert.equal(published.admission.binding_count,2);
    assert.equal(published.jobs[0].tables['gateway_archive.job'].count,10000);
    const restoring=create('catalog-verifier','pause');
    const restoreBoundary=await wait(restoring,true); report({ scenario:shape,...restoreBoundary.find(row => row.fixture==='boundary') });
    const pending=fixture('inspect'); kill(restoring);
    assert.deepEqual(fixture('inspect'),pending);
    hasState(await run('catalog-verifier'),'verified');
    // Inference changed after the snapshot. Its normal daily cadence is preserved.
    await run('archiver'); const accepted = fixture('inspect'); assert.equal(accepted.jobs[0].status,'verified');
    report({ scenario: shape,...fixture('quota'), concurrentInferenceContinued: true }); return;
  }
  if (shape === 'catalog-publication') {
    const active = create('archiver','publication'), events = await wait(active,true);
    report({ scenario: shape,...events.find(row => row.fixture === 'boundary') });
    const before = fixture('inspect'); assert.equal(before.jobs[0].status,'exporting');
    assert.ok(before.files.some(file => file.file === 'manifest.json'));
    kill(active);
    // PostgreSQL may complete a queued statement when the fixture blocker dies,
    // even though its client was killed. Read durable truth; neither outcome refunds work.
    const stopped=fixture('inspect');
    assert.ok(['exporting','awaiting_verification'].includes(stopped.jobs[0].status));
    const confirmed=stopped.jobs[0].status==='awaiting_verification';
    hasState(await run('archiver'),confirmed ? 'awaiting_catalog_verification' : 'catalog_interrupted');
    const after = fixture('inspect'); assert.equal(after.jobs.length,1);
    assert.equal(after.jobs[0].status,confirmed ? 'awaiting_verification' : 'interrupted');
    assert.equal(after.jobs[0].attempt,2); assert.deepEqual(after.files,before.files);
    report({ scenario:shape,publicationCommittedAfterKill:confirmed }); return;
  }
  hasState(await run('archiver'),'awaiting_catalog_verification');
  hasState(await run('catalog-verifier'),'verified');
  const active = create('archiver','acknowledgment'), events = await wait(active,true);
  report({ scenario: shape,...events.find(row => row.fixture === 'boundary') });
  const before = fixture('inspect'); assert.equal(before.roots.length,1); assert.equal(before.jobs[0].status,'awaiting_verification');
  kill(active); hasState(await run('archiver'),'awaiting_catalog_verification');
  const after = fixture('inspect'); assert.equal(after.jobs[0].status,'verified'); assert.equal(after.jobs[0].attempt,2);
  assert.deepEqual(after.roots,before.roots); assert.equal(after.dependencies,before.dependencies);
  hasState(await run('catalog-verifier'),'verified'); hasState(await run('archiver'),'catalog_unchanged');
  assert.deepEqual(fixture('inspect').jobs.map(job => job.attempt),[2,3]);
}
