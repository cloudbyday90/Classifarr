/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { gatewayError } from './contract.mjs';
import { gatewayRecoveryReview, gatewayRecoverySnapshot } from './recoveryContract.mjs';
import { readGatewayRequestBinding } from './requestBindingRepository.mjs';
import { readProviderStopHistory } from './providerStopRepository.mjs';

async function recordRecovery(client, row, review) {
  const stop = review.action === 'acknowledge-stop';
  const origin = stop ? { request_id: row.active_request,...row } :
    (await client.query(`SELECT request_id, installation, started_at::text FROM ollama_gateway.recovery_receipt
      WHERE id=$1 AND ledger_id=$2 AND provider_hash=$3 AND action='acknowledge-stop'`,
    [row.maintenance_receipt,row.id,row.provider_hash])).rows[0];
  if (!origin) throw gatewayError('gateway_recovery_state_changed');
  const result = await client.query(`INSERT INTO ollama_gateway.recovery_receipt
    (ledger_id,action,provider_hash,owner_id,request_id,installation,started_at,attempts,cooldown_until,
      operator_ref,evidence_ref,observed_at,stop_receipt_id)
    SELECT $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13
    WHERE $12::timestamptz <= clock_timestamp() AND $12::timestamptz >= clock_timestamp()-interval '15 minutes'
      AND $12::timestamptz >= $7::timestamptz RETURNING id`,
  [row.id,review.action,row.provider_hash,row.owner_id,origin.request_id,origin.installation,origin.started_at,
    row.attempts,row.cooldown_until,review.operatorRef,review.evidenceRef,review.observedAt,stop ? null : row.maintenance_receipt]);
  if (result.rowCount !== 1) throw gatewayError('gateway_recovery_observation_invalid');
  const receiptId = result.rows[0].id;
  // Do not update completed_at, cooldown_until, attempts, ownership or provider identity.
  const changed = await client.query(`UPDATE ollama_gateway.admission SET active_request=NULL, installation=NULL,
    started_at=NULL, maintenance_receipt=$1, last_recovery_receipt=$3 WHERE id=$2 RETURNING id`,[stop ? receiptId : null,row.id,receiptId]);
  if (changed.rowCount !== 1) throw gatewayError('gateway_recovery_state_changed');
  return { receiptId,action: review.action,evidenceKind: 'administrator_attested',attempts: row.attempts,
    state: stop ? 'maintenance' : 'resumed',replayed: false };
}

/** Exclusive dedicated connected session; caller closes it on every outcome. No retries or HTTP. */
export async function runGatewayRecovery(client, { providerHash, action, review, signal }) {
  if (!/^[a-f0-9]{64}$/.test(providerHash) || !['inspect','acknowledge-stop','resume'].includes(action)) {
    throw gatewayError('gateway_recovery_review_invalid');
  }
  if (action !== 'inspect') review = gatewayRecoveryReview(review,action);
  let locked = false, transaction = false, committing = false;
  try {
    signal?.throwIfAborted();
    const held = await client.query(`SELECT EXISTS (SELECT 1 FROM pg_locks WHERE locktype='advisory'
      AND pid=pg_backend_pid() AND classid=11435 AND objid=1 AND objsubid=2 AND granted) AS held`);
    if (held.rows[0].held) throw gatewayError('gateway_recovery_dedicated_session_required');
    locked = (await client.query('SELECT pg_try_advisory_lock(11435, 1) AS acquired')).rows[0].acquired;
    if (!locked) throw gatewayError('gateway_recovery_gateway_running');
    await client.query('BEGIN'); transaction = true;
    await client.query("SET LOCAL lock_timeout='2s'; SET LOCAL statement_timeout='4s'; SET LOCAL idle_in_transaction_session_timeout='5s'; SET LOCAL synchronous_commit=on");
    const result = await client.query(`SELECT id, provider_hash, owner_id, active_request, installation,
      started_at::text, attempts::text, cooldown_until::text, maintenance_receipt, last_recovery_receipt
      FROM ollama_gateway.admission WHERE singleton AND version=6 AND provider_hash=$1 FOR UPDATE`,[providerHash]);
    if (result.rowCount !== 1) throw gatewayError('gateway_recovery_ledger_unavailable');
    const row = result.rows[0], expected = gatewayRecoverySnapshot(row);
    let output;
    if (action === 'inspect') {
      const latest = await client.query(`SELECT id, action, evidence_kind, recorded_at, request_id FROM ollama_gateway.recovery_receipt
        WHERE id=$1 AND ledger_id=$2`,[row.last_recovery_receipt,row.id]);
      output = { expected,latestReceipt: latest.rows[0] ?? null,
        requestBinding: await readGatewayRequestBinding(client,row.active_request ?? latest.rows[0]?.request_id),
        providerStop: await readProviderStopHistory(client,row.active_request ?? latest.rows[0]?.request_id) };
    } else {
      if (Object.keys(expected).some(key => expected[key] !== review.expected[key])) throw gatewayError('gateway_recovery_state_changed');
      signal?.throwIfAborted(); output = await recordRecovery(client,row,review);
    }
    signal?.throwIfAborted(); committing = true;
    await client.query('COMMIT'); transaction = false; committing = false;
    return output;
  } catch (error) {
    if (transaction) { try { await client.query('ROLLBACK'); } catch { /* Close the dedicated session; never replay. */ } }
    if (committing) throw gatewayError('gateway_recovery_commit_unknown');
    if (signal?.aborted) throw gatewayError('gateway_recovery_cancelled');
    const safe = ['gateway_recovery_dedicated_session_required','gateway_recovery_gateway_running',
      'gateway_recovery_ledger_unavailable','gateway_recovery_state_changed','gateway_recovery_observation_invalid'];
    throw gatewayError(safe.includes(error.code) ? error.code : 'gateway_recovery_unavailable');
  } finally {
    if (locked) { try { await client.query('SELECT pg_advisory_unlock(11435, 1)'); } catch { /* Caller must close session. */ } }
  }
}
