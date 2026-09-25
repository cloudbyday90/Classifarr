/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { ADJUDICATION_CAPTURE_CONTEXT, readAdjudicationBatch, validAdjudicationPlan } from './cachedAdjudicationContract.mjs';
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
    const config = await readConfig();
    const configuration = snapshot.inputs.source.adjudicationConfig?.fingerprint;
    if (!configuration || projectAdjudicationConfig(config)?.fingerprint !== configuration) throw new Error('adjudication_capture_config_changed');
    const prepared = await runThread(snapshot, state, abort, { includePlan: true });
    if (!validAdjudicationPlan(prepared.plan)) throw new Error('adjudication_capture_plan_invalid');
    if (!prepared.plan.length) {
      await onPublished?.(fingerprintAutomaticSourcePairInputs(snapshot, prepared), true, abort);
      return { status: 'no_eligible_cases', calls: 0, reused: 0, stored: 0, routingWrites: 0 };
    }
    const client = createClient(config), identity = await client.inspect(abort);
    const previous = checkpoint ? await checkpoint.open(prepared.plan,
      { version: 'cached_adjudication.v1', configuration, identity, records: [] }, abort)
      : readAdjudicationBatch(snapshot.inputs.source.adjudicationBatch, configuration);
    const cache = new Map(sameIdentity(identity, previous?.identity) ? previous.records.map(row => [row.key, row.generated]) : []);
    const records = []; let calls = 0, reused = 0;
    for (const request of prepared.plan) {
      abort.throwIfAborted();
      let generated = cache.get(request.key);
      if (generated) reused++;
      else {
        if (calls >= maxCalls) continue;
        generated = await client.generate({ prompt: request.prompt, count: request.count,
          context: ADJUDICATION_CAPTURE_CONTEXT, identity, signal: abort, responseContract: 'adjudication',
          onGenerationCall: () => {
            if (++calls > maxCalls) throw new Error('adjudication_capture_budget_exceeded');
            return checkpoint?.reserve(abort);
          } });
        await checkpoint?.record({ key: request.key, generated }, abort);
      }
      records.push({ key: request.key, generated });
    }
    abort.throwIfAborted();
    if (fingerprintAutomaticSourcePairInputs(await repository.readSnapshot(abort), prepared) !==
        fingerprintAutomaticSourcePairInputs(snapshot, prepared) || !sameIdentity(identity, await client.inspect(abort))) {
      throw new Error('adjudication_capture_source_changed');
    }
    const batch = { version: 'cached_adjudication.v1', configuration, identity, records };
    await save(batch, abort);
    // Pin completion to the evidence actually used, not a newer snapshot observed after publication.
    const published = { ...snapshot, inputs: { ...snapshot.inputs,
      source: { ...snapshot.inputs.source, adjudicationBatch: batch } } };
    await onPublished?.(fingerprintAutomaticSourcePairInputs(published, prepared), records.length === prepared.plan.length, abort);
    return { status: 'complete', calls, reused, stored: records.length,
      missing: prepared.plan.length - records.length, routingWrites: 0 };
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
