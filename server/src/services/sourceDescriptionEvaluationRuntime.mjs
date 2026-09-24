/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { readDescriptionBenchmarkSnapshot, decodeDescriptionBenchmarkSnapshot } from './inventoryDescriptionBenchmarkRepository.mjs';
import { INVENTORY_OUTCOME_LABEL_SQL, INVENTORY_OUTCOME_LABEL_LIMIT } from './inventoryOutcomeLabels.mjs';
import { loadFreshInventoryPolicyRuntime, FRESH_POLICY_CONFIG_SQL } from './freshInventoryPolicyRuntime.mjs';
import { resolveLocalStudyEmbeddingConfig } from './localStudyEmbeddingClient.mjs';
import { evaluateSourceDescriptionPair } from './sourceDescriptionPairedEvaluation.mjs';

export function createSourceDescriptionEvaluationRepository({ withTransaction }) {
  return { async read(identity) {
    const captured = await withTransaction(async client => {
      const snapshot = await readDescriptionBenchmarkSnapshot(client, identity, false, false,
        { includeSourceItems: true, requireCompleteCache: false });
      const config = (await client.query(FRESH_POLICY_CONFIG_SQL)).rows[0];
      const operatorFeedbackRows = (await client.query(INVENTORY_OUTCOME_LABEL_SQL)).rows;
      if (!config || operatorFeedbackRows.length > INVENTORY_OUTCOME_LABEL_LIMIT) throw new Error('source_pair_snapshot_budget');
      return { snapshot, config, operatorFeedbackRows };
    });
    return { ...decodeDescriptionBenchmarkSnapshot(captured.snapshot, identity), rows: captured.snapshot.rows,
      config: captured.config, operatorFeedbackRows: captured.operatorFeedbackRows };
  } };
}

/** No model generation, embedding, cache writes, routing or policy loading. */
export async function runSourceDescriptionEvaluation(options, { loadRuntime = loadFreshInventoryPolicyRuntime, signal } = {}) {
  const runtime = await loadRuntime({ createRepository: createSourceDescriptionEvaluationRepository });
  try {
    signal?.throwIfAborted();
    const identity = await runtime.embedder.inspect({ signal });
    const source = await runtime.repository.read(identity);
    if (JSON.stringify(resolveLocalStudyEmbeddingConfig(source.config)) !== JSON.stringify(resolveLocalStudyEmbeddingConfig(runtime.config))) {
      throw new Error('source_pair_configuration_changed');
    }
    signal?.throwIfAborted();
    return evaluateSourceDescriptionPair(source, identity, options);
  } finally { await runtime.close(); }
}
