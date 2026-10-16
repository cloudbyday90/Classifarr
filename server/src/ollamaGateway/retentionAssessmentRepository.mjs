/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { archiveCategorySql } from './archiveRetentionQueries.mjs';
import { assessGatewayRetention, gatewayRetentionDays } from './retentionAssessment.mjs';
import { gatewayError } from './errors.mjs';

// Fixed identifier substitutions only; eligibility stays identical to archive selection.
const category = archiveCategorySql.replaceAll('$1::uuid', 'a.active_request').replaceAll('$2::timestamptz', 'a.cutoff');

/** One read-only statement on a separate bounded diagnostic connection. No offline lock. */
export async function readGatewayRetentionAssessment(query, { owner, providerHash, retentionDays = 90 }) {
  gatewayRetentionDays(retentionDays);
  const result = await query(`WITH a AS MATERIALIZED (
    SELECT id,active_request,binding_count,statement_timestamp() AS observed_at,
      statement_timestamp()-make_interval(days=>$3::int) AS cutoff
    FROM ollama_gateway.admission WHERE singleton AND version=7 AND owner_id=$1 AND provider_hash=$2
  ), classified AS MATERIALIZED (
    SELECT ${category} AS category FROM a CROSS JOIN ollama_gateway.request_binding b
    LEFT JOIN ollama_gateway.completion_receipt c ON c.request_id=b.request_id
  ), counts AS (SELECT category,count(*)::int AS n FROM classified GROUP BY category)
  SELECT uuidv7() AS reference,a.observed_at,a.cutoff,a.binding_count,
    a.active_request IS NOT NULL AND NOT EXISTS(SELECT 1 FROM ollama_gateway.request_binding WHERE request_id=a.active_request) AS legacy_active,
    jsonb_build_object('active',0,'lifecycle',0,'unknown',0,'recent',0,'older_terminal_review',0)
      || COALESCE((SELECT jsonb_object_agg(category,n) FROM counts),'{}'::jsonb) AS categories
    FROM a`, [owner, providerHash, retentionDays]);
  if (result.rowCount !== 1) throw gatewayError('gateway_retention_unavailable');
  return assessGatewayRetention(result.rows[0], retentionDays);
}
