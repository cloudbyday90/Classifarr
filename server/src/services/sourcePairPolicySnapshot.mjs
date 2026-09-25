/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { getActivePolicies } from './policyEngineQueries.mjs';
import { projectFreshPolicyConfiguration } from './freshInventoryPolicyRuntime.mjs';
import { OPERATOR_POLICY_SOURCE_REVISION_SQL } from './operatorCorrectionPolicyProvenance.mjs';

export async function readSourcePairPolicySnapshot(client) {
  // Bulk policy readers use Promise.all; serialize statements on this transaction connection.
  let pending = Promise.resolve();
  const reader = { query: (...args) => { pending = pending.then(() => client.query(...args)); return pending; } };
  const policies = (await getActivePolicies({ dbClient: reader, throwOnError: true, movieTvOnly: true }))
    .map(projectFreshPolicyConfiguration);
  if (JSON.stringify(policies).length > 2_000_000) throw new Error('source_pair_policy_budget');
  const policySourceRevisionRows = (await reader.query(`SELECT * FROM (${OPERATOR_POLICY_SOURCE_REVISION_SQL}) revisions
    WHERE media_type IN ('movie', 'tv') ORDER BY policy_id LIMIT 65`)).rows;
  if (policySourceRevisionRows.length > 64) throw new Error('source_pair_policy_budget');
  return { policies, policySourceRevisionRows };
}
