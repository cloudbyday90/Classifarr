/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { createInventoryDiscoveryAdmission } from './inventoryDiscoveryAdmission.mjs';
import { createAutomaticSourcePairEvaluation } from './automaticSourcePairEvaluation.mjs';
import { createAutomaticSourcePairRepository } from './automaticSourcePairRepository.mjs';
import { createAdjudicationBudgetWorker } from './adjudicationBudgetWorker.mjs';
import { createAdjudicationBudgetRepository } from './adjudicationBudgetRepository.mjs';
import { createLocalDescriptionBenchmarkClient } from './localDescriptionBenchmarkClient.mjs';
import { FRESH_POLICY_CONFIG_SQL } from './freshInventoryPolicyRuntime.mjs';

/** One scheduler lifecycle, two separate permissions: replay cannot authorize inference. */
export function createAutomaticSourcePairWorkers(database) {
  const repository = createAutomaticSourcePairRepository(database), withAdmission = createInventoryDiscoveryAdmission(database);
  const evaluator = createAutomaticSourcePairEvaluation({ repository, withAdmission,
    withSessionAdvisoryLock: database.withSessionAdvisoryLock });
  const capture = createAdjudicationBudgetWorker({ repository, withAdmission,
    budget: createAdjudicationBudgetRepository(database), createClient: createLocalDescriptionBenchmarkClient,
    readConfig: async () => (await database.query(FRESH_POLICY_CONFIG_SQL)).rows[0] });
  return {
    async run() { const result = await evaluator.run(); await capture.run(); return result; },
    stop() { evaluator.stop(); capture.stop(); },
  };
}
