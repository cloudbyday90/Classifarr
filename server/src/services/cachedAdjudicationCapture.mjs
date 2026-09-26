/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { ADJUDICATION_CAPTURE_CONTEXT, readAdjudicationBatch, adjudicationBatchDigest, adjudicationDigest } from './cachedAdjudicationContract.mjs';
import { validCaptureAdmission, planCaptureAdmission } from './adjudicationCaptureAdmission.mjs';
import { projectAdjudicationConfig, createCachedAdjudicationWriter } from './cachedAdjudicationRepository.mjs';
import { createAutomaticSourcePairRepository } from './automaticSourcePairRepository.mjs';
import { runAutomaticSourcePairThread } from './automaticSourcePairThreadClient.mjs';
import { createLocalDescriptionBenchmarkClient } from './localDescriptionBenchmarkClient.mjs';
import { createInventoryDiscoveryAdmission } from './inventoryDiscoveryAdmission.mjs';
import { FRESH_POLICY_CONFIG_SQL } from './freshInventoryPolicyRuntime.mjs';
import { LOG_CONFIG } from '../utils/logging/logConfig.mjs';
import { fingerprintAutomaticSourcePairInputs } from './automaticSourcePairComputation.mjs';

const sameIdentity = (a, b) => a?.model === b?.model && a?.digest === b?.digest && a?.contextLength === b?.contextLength;

/** Explicit local inference only. Domain writes and partial-cache publication are absent. */
export async function captureCachedAdjudication({ maxCalls }, { repository, readConfig, createClient, save,
  withAdmission, runThread = runAutomaticSourcePairThread, signal, checkpoint, onPublished } = {}) {
  if (!Number.isInteger(maxCalls) || maxCalls < 1 || maxCalls > 50) throw new Error('adjudication_capture_budget_invalid');
  const deadline = AbortSignal.any([AbortSignal.timeout(20 * 60000), ...[signal].filter(Boolean)]);
  return withAdmission(async abort => {
    abort.throwIfAborted();
    const state = await repository.readState(abort), snapshot = await repository.readSnapshot(abort);
    const prepared = await runThread(snapshot, state, abort, { includePlan: true });
    if (!validCaptureAdmission(prepared.captureAdmission, prepared.plan)) throw new Error('adjudication_capture_plan_invalid');
    if (!prepared.plan.length) {
      abort.throwIfAborted();
      if (fingerprintAutomaticSourcePairInputs(await repository.readSnapshot(abort), prepared) !==
        fingerprintAutomaticSourcePairInputs(snapshot, prepared)) throw new Error('adjudication_capture_source_changed');
      await onPublished?.(fingerprintAutomaticSourcePairInputs(snapshot, prepared), true, abort);
      return { status: 'no_eligible_cases', calls: 0, reused: 0, stored: 0, routingWrites: 0 };
    }
    const config = await readConfig();
    const configuration = snapshot.inputs.source.adjudicationConfig?.fingerprint;
    if (!configuration || projectAdjudicationConfig(config)?.fingerprint !== configuration) throw new Error('adjudication_capture_config_changed');
    const client = createClient(config), identity = await client.inspect(abort);
    const previous = checkpoint ? await checkpoint.open(prepared.plan,
      { version: 'cached_adjudication.v1', configuration, identity, records: [] }, abort)
      : readAdjudicationBatch(snapshot.inputs.source.adjudicationBatch, configuration);
    const retained = sameIdentity(identity, previous?.identity) ? previous
      : { version: 'cached_adjudication.v1', configuration, identity, records: [] };
    const cache = new Map(retained.records.map(row => [row.key, row.generated]));
    let admission = prepared.captureAdmission;
    if (adjudicationBatchDigest(retained) !== adjudicationBatchDigest(snapshot.inputs.source.adjudicationBatch)) {
      const refreshed = await runThread({ ...snapshot, inputs: { ...snapshot.inputs,
        source: { ...snapshot.inputs.source, adjudicationBatch: retained } } }, state, abort, { includePlan: true });
      if (!validCaptureAdmission(refreshed.captureAdmission, refreshed.plan) ||
          adjudicationDigest(refreshed.plan) !== adjudicationDigest(prepared.plan)) throw new Error('adjudication_capture_plan_changed');
      admission = refreshed.captureAdmission;
    }
    const order = planCaptureAdmission(admission, prepared.plan), requests = new Map(prepared.plan.map(row => [row.key, row]));
    abort.throwIfAborted();
    if (fingerprintAutomaticSourcePairInputs(await repository.readSnapshot(abort), prepared) !==
        fingerprintAutomaticSourcePairInputs(snapshot, prepared)) throw new Error('adjudication_capture_source_changed');
    let calls = 0;
    const reused = prepared.plan.filter(request => cache.has(request.key)).length;
    for (const key of order) {
      const request = requests.get(key);
      abort.throwIfAborted();
      let generated = cache.get(request.key);
      if (!generated) {
        if (calls >= maxCalls) continue;
        generated = await client.generate({ prompt: request.prompt, count: request.count,
          context: ADJUDICATION_CAPTURE_CONTEXT, identity, signal: abort, responseContract: 'adjudication',
          onGenerationCall: () => {
            if (++calls > maxCalls) throw new Error('adjudication_capture_budget_exceeded');
            return checkpoint?.reserve(abort);
          } });
        await checkpoint?.record({ key: request.key, generated }, abort);
        cache.set(request.key, generated);
      }
    }
    abort.throwIfAborted();
    if (fingerprintAutomaticSourcePairInputs(await repository.readSnapshot(abort), prepared) !==
        fingerprintAutomaticSourcePairInputs(snapshot, prepared) || !sameIdentity(identity, await client.inspect(abort))) {
      throw new Error('adjudication_capture_source_changed');
    }
    const records = prepared.plan.filter(request => cache.has(request.key)).map(request => ({ key: request.key, generated: cache.get(request.key) }));
    const missing = order.filter(key => !cache.has(key)).length;
    const batch = { version: 'cached_adjudication.v1', configuration, identity, records };
    await save(batch, abort);
    // Pin completion to the evidence actually used, not a newer snapshot observed after publication.
    const published = { ...snapshot, inputs: { ...snapshot.inputs,
      source: { ...snapshot.inputs.source, adjudicationBatch: batch } } };
    await onPublished?.(fingerprintAutomaticSourcePairInputs(published, prepared), missing === 0, abort);
    return { status: 'complete', calls, reused, stored: records.length,
      missing, routingWrites: 0 };
  }, { signal: deadline });
}

export async function runCachedAdjudicationCapture(options) {
  if (LOG_CONFIG.level !== 'fatal' || LOG_CONFIG.fileLoggingEnabled !== false) throw new Error('adjudication_capture_private_logging_required');
  const db = await import('../config/database.mjs');
  try {
    return await captureCachedAdjudication(options, { repository: createAutomaticSourcePairRepository(db),
      readConfig: async () => (await db.query(FRESH_POLICY_CONFIG_SQL)).rows[0],
      createClient: createLocalDescriptionBenchmarkClient, save: createCachedAdjudicationWriter(db),
      withAdmission: createInventoryDiscoveryAdmission(db) });
  } finally { await db.pool.end(); }
}
