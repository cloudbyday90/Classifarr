/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { createAutomaticSourcePairRepository } from './automaticSourcePairRepository.mjs';
import { createInventoryDiscoveryAdmission } from './inventoryDiscoveryAdmission.mjs';
import { LOG_CONFIG } from '../utils/logging/logConfig.mjs';
import { runSourcePairQualityThread } from './sourcePairQualityThreadClient.mjs';
export { runSourcePairQualityThread };

export async function runSourcePairQualityRuntime({ protocol = null, reference = null } = {},
  { signal, logging = LOG_CONFIG, loadDatabase = () => import('../config/database.mjs'), runThread = runSourcePairQualityThread } = {}) {
  if (logging.level !== 'fatal' || logging.fileLoggingEnabled !== false ||
      !process.env.PGOPTIONS?.includes('default_transaction_read_only=on')) throw new Error('quality_private_runtime_required');
  const database = await loadDatabase();
  try {
    const withAdmission = createInventoryDiscoveryAdmission(database);
    return await withAdmission(async abort => {
      // Deliberately never use readState: that maintenance path prunes retained rows.
      const snapshot = await createAutomaticSourcePairRepository(database).readSnapshot(abort);
      return runThread(snapshot, protocol, reference, { signal: abort });
    }, { signal: AbortSignal.any([AbortSignal.timeout(180000), ...[signal].filter(Boolean)]) });
  } finally { await database.pool.end(); }
}
