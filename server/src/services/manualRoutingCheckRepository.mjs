/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { resolveRoutingConfig } from './classificationRoutingService.mjs';
import { manualRoutingLibraryFingerprint, manualRoutingEndpointFingerprint, validManualRoutingIntent } from './manualRoutingIntent.mjs';

const configSql = {
  radarr: 'SELECT * FROM radarr_config WHERE id=$1 AND is_active IS TRUE',
  sonarr: 'SELECT * FROM sonarr_config WHERE id=$1 AND is_active IS TRUE',
};
const states = new Set(['manual_routing_pending', 'arr_add_failed', 'unexpected_error']);

export function eligibleManualRoutingCheck(row) {
  const details = row?.metadata?.classification_details;
  const intent = details?.manual_routing_intent;
  return row?.method === 'manual_classification' && row.status === 'completed'
    && states.has(details?.routing) && validManualRoutingIntent(intent)
    && /^[a-f0-9-]{36}$/.test(details?.manual_routing_attempt_id ?? '')
    && intent.libraryId === row.library_id && intent.mediaType === row.media_type
    && intent.tmdbId === row.tmdb_id
    && intent.mediaType === (intent.arrType === 'radarr' ? 'movie' : 'tv');
}

export function createManualRoutingCheckRepository({ db, providers }) {
  async function load(client, id, lock = false) {
    const suffix = lock ? ' FOR SHARE' : '';
    const query = (sql, values) => client.query(sql + suffix, values);
    const { rows: [row] } = await query('SELECT * FROM classification_history WHERE id=$1', [id]);
    if (!row) return { reason: 'not_found' };
    if (!eligibleManualRoutingCheck(row)) return { reason: 'not_eligible' };
    const intent = row.metadata.classification_details.manual_routing_intent;
    const { rows: [library] } = await query('SELECT * FROM libraries WHERE id=$1 AND is_active IS TRUE', [row.library_id]);
    if (!library || library.media_type !== row.media_type) return { reason: 'configuration_changed' };
    const resolved = await resolveRoutingConfig(library, query);
    if (resolved.arr_type !== intent.arrType || Number(resolved.arr_id) !== intent.configId
      || manualRoutingLibraryFingerprint(resolved) !== intent.libraryFingerprint) return { reason: 'configuration_changed' };
    const { rows: [config] } = await query(configSql[intent.arrType], [intent.configId]);
    if (!config) return { reason: 'configuration_changed' };
    const baseUrl = config.url || providers[intent.arrType].buildUrl(config);
    if (manualRoutingEndpointFingerprint(baseUrl) !== intent.endpointFingerprint) return { reason: 'configuration_changed' };
    return { row, intent, baseUrl, apiKey: config.api_key };
  }

  return {
    load: id => db.withTransaction(async client => {
      await client.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY');
      await client.query("SET LOCAL statement_timeout = '2000ms'");
      await client.query("SET LOCAL lock_timeout = '250ms'");
      return load(client, id);
    }),
    async save(initial, observation) {
      return db.withTransaction(async client => {
        await client.query("SET LOCAL statement_timeout = '2000ms'");
        await client.query("SET LOCAL lock_timeout = '250ms'");
        // Serialize checks on this history row; configuration locks last only for local SQL.
        await client.query('SELECT id FROM classification_history WHERE id=$1 FOR UPDATE', [initial.row.id]);
        const current = await load(client, initial.row.id, true);
        if (current.reason) return false;
        const before = initial.row.metadata.classification_details;
        const after = current.row.metadata.classification_details;
        if (before.manual_routing_attempt_id !== after.manual_routing_attempt_id
          || JSON.stringify(initial.intent) !== JSON.stringify(current.intent)
          || JSON.stringify(before.manual_routing_observation) !== JSON.stringify(after.manual_routing_observation)
          || before.routing !== after.routing) return false;
        const result = await client.query(`UPDATE classification_history
          SET metadata=jsonb_set(metadata,'{classification_details,manual_routing_observation}',$1::jsonb)
          WHERE id=$2`, [JSON.stringify(observation), initial.row.id]);
        return result.rowCount === 1;
      });
    },
  };
}
