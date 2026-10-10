/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
export const COMPARISON_WARNING = 'Library comparison context is retrying automatically; ordinary retrieval remains available';
export const MAX_COMPARISON_INCIDENT_IDS = 128;
export const isIncidentId = value => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

export function createComparisonIncidentRepository(database) {
  return {
    async resolve({ episodeId, scopeId, errorIds, status, version = 1, isCurrent = () => true }) {
      if (!isIncidentId(episodeId) || !isIncidentId(scopeId) || !Array.isArray(errorIds) ||
          !errorIds.length || errorIds.length > MAX_COMPARISON_INCIDENT_IDS ||
          !errorIds.every(isIncidentId) || ![1, 2].includes(version) || !['ready', 'revalidated'].includes(status)) {
        throw new TypeError('Invalid comparison incident recovery');
      }
      const check = () => { if (!isCurrent()) throw new Error('Comparison incident owner changed'); };
      check();
      return database.withTransaction(async client => {
        await client.query("SET LOCAL statement_timeout = '3s'; SET LOCAL lock_timeout = '1s'; SET LOCAL transaction_timeout = '5s'");
        check();
        const { rows } = await client.query(`
          UPDATE error_log SET resolved = true, resolved_at = CURRENT_TIMESTAMP,
            resolution_notes = 'Automatically resolved after verified library comparison recovery. Original evidence retained.',
            metadata = metadata || jsonb_build_object('comparisonRecovery', jsonb_build_object(
              'version', $6::integer, 'episodeId', $2::text, 'scopeId', $3::text,
              'status', $4::text, 'observedAt', CURRENT_TIMESTAMP))
          WHERE error_id = ANY($1::uuid[]) AND resolved = false
            AND module = 'LibraryComparisonContext' AND level = 'WARN' AND message = $5
            AND metadata->'comparisonIncident' = jsonb_build_object(
              'version', $6::integer, 'episodeId', $2::text, 'scopeId', $3::text)
          RETURNING error_id
        `, [errorIds, episodeId, scopeId, status, COMPARISON_WARNING, version]);
        check();
        return rows.map(row => row.error_id);
      });
    },
  };
}
