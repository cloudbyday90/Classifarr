/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { readEnrichmentRetryPage } from '../../services/enrichmentRetryCandidates.mjs';
import { readRetryReadinessPage } from '../../services/retryReadinessRepository.mjs';
import { claimEnrichmentRetry } from '../../services/enrichmentRetryClaimService.mjs';
import { baselineRetryPage } from './baselinePage.mjs';

/** Capture the exact parameterized production query without opening application dependencies. */
export async function captureRetryBenchmarkQuery(operation, type, cursor = null, candidateId = null) {
  const queries = [];
  const db = { query: async (sql, params) => { queries.push({ sql, params }); return { rows: [] }; },
    withTransaction: () => { throw new Error('Unexpected benchmark transaction'); } };
  if (['baseline_page', 'baseline_middle_page', 'baseline_deep_page'].includes(operation)) return baselineRetryPage(type, cursor);
  if (['page', 'middle_page', 'deep_page'].includes(operation)) await readEnrichmentRetryPage(db, type, cursor, 50);
  else if (operation === 'readiness') await readRetryReadinessPage(db, type);
  else if (operation === 'claim') await claimEnrichmentRetry(db, type);
  else if (operation === 'claim_by_id') await claimEnrichmentRetry(db, type, [], candidateId);
  else throw new TypeError('Invalid retry benchmark operation');
  if (queries.length !== 1) throw new Error('Retry benchmark query boundary changed');
  return queries[0];
}
