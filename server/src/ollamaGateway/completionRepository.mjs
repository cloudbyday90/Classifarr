/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { gatewayError } from './errors.mjs';

export async function completeGatewayRequest(query,{ requestId,busy,owner,providerHash,outcome }) {
  const detail = outcome ?? { state: 'completion_observed',httpStatus: null };
  const valid = detail && Object.keys(detail).length === 2 &&
    ((detail.state === 'response_completed' && detail.httpStatus === 200) ||
     (detail.state === 'provider_rejected' && [400,401,403,404,429,503].includes(detail.httpStatus)) ||
     (['not_dispatched','completion_observed'].includes(detail.state) && detail.httpStatus === null));
  if (!valid) throw gatewayError('gateway_completion_invalid');
  const result = await query(`WITH completed AS (
    UPDATE ollama_gateway.admission SET active_request=NULL, installation=NULL,
      started_at=NULL, completed_at=clock_timestamp(),
      cooldown_until=CASE WHEN $2 THEN clock_timestamp()+interval '5 seconds' ELSE cooldown_until END
    WHERE singleton AND version=7 AND owner_id=$3 AND active_request=$1 AND provider_hash=$4
      AND EXISTS (SELECT 1 FROM ollama_gateway.request_binding b WHERE b.request_id=$1
        AND b.owner_id=$3 AND b.provider_hash=$4)
    RETURNING id,completed_at)
    INSERT INTO ollama_gateway.completion_receipt (request_id,outcome,http_status,recorded_at)
    SELECT $1,$5,$6,completed_at FROM completed RETURNING id`,
  [requestId,busy,owner,providerHash,detail.state,detail.httpStatus]);
  if (result.rowCount !== 1) throw gatewayError('gateway_ledger_unavailable');
}
