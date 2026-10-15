/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { gatewayError } from './errors.mjs';
import { gatewayHistoryQuery,gatewayHistoryResponse,GATEWAY_HISTORY_PAGE_SIZE } from './historyContract.mjs';

/** A single read-only statement: no session settings, locks, inference or admission. */
export async function readGatewayHistory(query,{ installation,owner,providerHash,filter }) {
  const { taskId,before } = gatewayHistoryQuery(filter);
  if (typeof installation !== 'string' || !/^[a-zA-Z0-9_-]{1,64}$/.test(installation)) throw gatewayError('gateway_history_unavailable');
  const result = await query(`SELECT b.request_id,b.admitted_at,b.attempt::text,b.operation,b.model,
    b.source_kind,b.source_task_id,b.source_task_type,b.source_attempt,
    a.active_request=b.request_id AS active,c.outcome,c.http_status,c.recorded_at,
    r.recorded_at AS abandoned_at
    FROM ollama_gateway.admission a
    LEFT JOIN LATERAL (SELECT request_id,admitted_at,attempt,operation,model,
      source_kind,source_task_id,source_task_type,source_attempt
      FROM ollama_gateway.request_binding
      WHERE ledger_id=a.id AND provider_hash=$2 AND installation=$3
        AND ($4::text IS NULL OR source_task_id=$4) AND ($5::bigint IS NULL OR attempt<$5)
      ORDER BY attempt DESC LIMIT 26) b ON true
    LEFT JOIN ollama_gateway.completion_receipt c ON c.request_id=b.request_id
    LEFT JOIN ollama_gateway.recovery_receipt r ON r.request_id=b.request_id
      AND r.action='acknowledge-stop' AND r.provider_hash=$2 AND r.installation=$3
    WHERE a.singleton AND a.version=7 AND a.owner_id=$1 AND a.provider_hash=$2
    ORDER BY b.attempt DESC`,[owner,providerHash,installation,taskId ?? null,before ?? null]);
  if (!result.rowCount) throw gatewayError('gateway_ledger_unavailable');
  const rows = result.rows.filter(row => row.request_id),items = rows.slice(0,GATEWAY_HISTORY_PAGE_SIZE).map(row => ({
    requestId: row.request_id,admittedAt: row.admitted_at.toISOString(),gatewayAttempt: row.attempt,
    operation: row.operation,model: row.model,
    source: row.source_kind ? { version: 1,kind: row.source_kind,taskId: row.source_task_id,taskType: row.source_task_type,attempt: row.source_attempt } : null,
    outcome: { state: row.active ? 'active_or_uncertain' : row.abandoned_at ? 'abandoned_after_review' : row.outcome ?? 'outcome_not_recorded',
      recordedAt: (row.abandoned_at ?? row.recorded_at)?.toISOString() ?? null,httpStatus: row.http_status ?? null },
  }));
  return gatewayHistoryResponse({ version: 1,installation,items,nextBefore: rows.length > GATEWAY_HISTORY_PAGE_SIZE ? items.at(-1).gatewayAttempt : null });
}
