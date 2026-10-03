/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { createHash, randomUUID } from 'node:crypto';
import { createLogger } from '../utils/logger.mjs';

export function routingProviderRevision({ intent, baseUrl, apiKey }) {
  return createHash('sha256').update(JSON.stringify([intent.arrType, intent.configId, baseUrl, apiKey])).digest('hex');
}
const columnFor = context => {
  if (context.intent.arrType === 'radarr') return 'radarr_id';
  if (context.intent.arrType === 'sonarr') return 'sonarr_id';
  throw new Error('Unsupported routing provider');
};
const projection = row => row && (row.reason || row.cooling)
  ? { reason: row.reason || 'provider_paused', nextCheckAt: row.next_check_at } : null;

export function createManualRoutingProviderGuard({ db, random = Math.random,
  logger = createLogger('ManualRoutingProviderGuard') }) {
  const query = (sql, values) => db.withTransaction(async client => {
    await client.query("SET LOCAL statement_timeout='2000ms'");
    await client.query("SET LOCAL lock_timeout='250ms'");
    return client.query(sql, values);
  });
  async function load(context) {
    const { rows: [row] } = await query(`SELECT *, next_check_at>NOW() AS cooling
      FROM manual_routing_provider_state WHERE ${columnFor(context)}=$1 AND revision=$2`,
    [context.intent.configId, routingProviderRevision(context)]);
    return row;
  }
  return {
    async read(context) { return projection(await load(context)); },
    // Called only while the routing-check session advisory lock is held.
    async prepare(context, automatic) {
      const column = columnFor(context);
      await query(`INSERT INTO manual_routing_provider_state(${column},revision) VALUES($1,$2)
        ON CONFLICT(${column}) DO UPDATE SET revision=EXCLUDED.revision, failures=0,
        reason=NULL, reservation_id=NULL, next_check_at=NOW(), updated_at=NOW()
        WHERE manual_routing_provider_state.revision<>EXCLUDED.revision`,
      [context.intent.configId, routingProviderRevision(context)]);
      const row = await load(context);
      if (!row) throw new Error('Routing provider state changed');
      if (row.cooling || (automatic && row.reason && row.reason !== 'provider_paused')) return projection(row);
      return null;
    },
    async reserve(context) {
      const reservationId = randomUUID();
      const result = await query(`UPDATE manual_routing_provider_state SET
        reservation_id=$3, next_check_at=NOW()+INTERVAL '60 seconds', updated_at=NOW()
        WHERE ${columnFor(context)}=$1 AND revision=$2`, [context.intent.configId, routingProviderRevision(context), reservationId]);
      if (result.rowCount !== 1) throw new Error('Routing provider state changed');
      return reservationId;
    },
    async finish(context, failure, reservationId) {
      const before = await load(context);
      if (!reservationId || before?.reservation_id !== reservationId) throw new Error('Routing provider state changed');
      const failures = failure ? Math.min(16, before.failures + 1) : 0;
      const reason = !failure ? null : failure.kind === 'authentication' ? 'provider_auth_required'
        : failure.kind === 'configuration' ? 'provider_configuration_required' : 'provider_paused';
      const delay = !failure ? 0 : Math.max(Math.min(3600, 300 * 2 ** Math.min(failures - 1, 4)),
        Math.min(86400, failure.retryAfterSeconds || 0)) + Math.floor(random() * 31);
      const result = await query(`UPDATE manual_routing_provider_state SET failures=$3, reason=$4, reservation_id=NULL,
        next_check_at=NOW()+$5::double precision*INTERVAL '1 second', updated_at=NOW()
        WHERE ${columnFor(context)}=$1 AND revision=$2 AND reservation_id=$6`,
      [context.intent.configId, routingProviderRevision(context), failures, reason, delay, reservationId]);
      if (result.rowCount !== 1) throw new Error('Routing provider state changed');
      if ((before.failures === 0 && failure) || before.reason !== reason) {
        logger.info('Routing provider check state changed', { provider: context.intent.arrType,
          configId: context.intent.configId, reason: reason || 'available' });
      }
    },
  };
}
