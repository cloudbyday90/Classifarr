/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { isQueueClaimToken } from './queueTaskAcknowledgementService.mjs';
import { buildClassificationRoutingMetadataUpdate } from './classificationRoutingMetadataPersistence.mjs';

function databaseId(value) {
  const text = typeof value === 'number' && Number.isSafeInteger(value) ? String(value) : value;
  if (typeof text !== 'string' || !/^[1-9][0-9]{0,18}$/.test(text) || BigInt(text) > 9223372036854775807n) {
    throw new Error('queued_routing_invalid_reference');
  }
  return text;
}

export function buildQueuedRoutingReplay(row) {
  const routed = row.status === 'routed' && row.routing === 'routed';
  return {
    success: true,
    classification_id: row.routing_classification_id,
    library: row.library_name ?? null,
    destination: { libraryId: row.library_id ?? null, libraryName: row.library_name ?? null },
    confidence: row.confidence ?? null,
    method: row.method ?? null,
    reason: routed ? 'Saved routing result recovered without replay.' : 'Routing outcome is unconfirmed; automatic write replay withheld.',
    routingOutcome: { shouldRoute: true, reason: 'saved_queue_routing_attempt', routeResult: {
      attempted: true, routed, reason: routed ? 'routed' : 'automatic_routing_unconfirmed',
    } },
    recovered: true,
  };
}

/** A claim controls admission, not retry permission for a possibly applied POST. */
export class QueuedRoutingReplayGuard {
  constructor({ db }) { this.db = db; }

  async withClaim(task, work) {
    const id = databaseId(task?.id), token = task?.claim_token;
    if (!isQueueClaimToken(token)) throw new Error('queued_routing_claim_not_owned');
    return this.db.withTransaction(async client => {
      await client.query("SET LOCAL lock_timeout = '2s'");
      await client.query("SET LOCAL statement_timeout = '10s'");
      await client.query("SET LOCAL idle_in_transaction_session_timeout = '10s'");
      await client.query("SET LOCAL transaction_timeout = '15s'");
      const { rows: [claim] } = await client.query(`SELECT routing_classification_id, visible_at::text AS deadline
        FROM task_queue WHERE id=$1 AND claim_token=$2::uuid
          AND task_type='classification' AND status='processing' FOR UPDATE`, [id, token]);
      const checkDeadline = async () => {
        if (!claim?.deadline) throw new Error('queued_routing_claim_not_owned');
        const { rows: [clock] } = await client.query('SELECT clock_timestamp() < $1::timestamptz AS live', [claim.deadline]);
        if (clock?.live !== true) throw new Error('queued_routing_claim_not_owned');
      };
      // Check after acquiring the lock; a waiting predicate can outlive its claim.
      await checkDeadline();
      const result = await work(client, claim, id);
      await checkDeadline();
      return result;
    });
  }

  async read(task) {
    return this.withClaim(task, async (client, claim) => {
      if (claim.routing_classification_id === null) return null;
      const { rows: [history] } = await client.query(`SELECT status,library_id,library_name,confidence,method,
        metadata #>> '{classification_details,routing}' AS routing FROM classification_history WHERE id=$1`,
      [claim.routing_classification_id]);
      return buildQueuedRoutingReplay({ ...history, routing_classification_id: claim.routing_classification_id });
    });
  }

  async admit(task, classificationId) {
    const historyId = databaseId(classificationId);
    await this.withClaim(task, async (client, claim, id) => {
      if (claim.routing_classification_id !== null) throw new Error('queued_routing_already_admitted');
      const statement = buildClassificationRoutingMetadataUpdate({ classificationId: historyId, routing: 'automatic_routing_pending' });
      const saved = await client.query(`${statement.text} AND status='completed' AND library_id IS NOT NULL RETURNING id`, statement.values);
      if (saved.rowCount !== 1) throw new Error('queued_routing_classification_unavailable');
      await client.query('UPDATE task_queue SET routing_classification_id=$2 WHERE id=$1', [id, historyId]);
    });
  }
}
