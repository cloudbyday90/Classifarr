/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { validateDescriptionRepresentation } from './inventoryDescriptionVectorCache.mjs';
import { DESCRIPTION_ISOLATION_CODES } from './inventoryDescriptionIsolation.mjs';

function parameters(identity, hashes, maximum = 10000) {
  const values = validateDescriptionRepresentation(identity);
  if (!Array.isArray(hashes) || hashes.length > maximum || new Set(hashes).size !== hashes.length ||
      Array.from(hashes).some(hash => typeof hash !== 'string' || !/^[a-f0-9]{64}$/.test(hash))) throw new Error('description_isolation_hashes_invalid');
  return [...values, hashes];
}

/** Mutations run under the existing shared description-cache advisory lock. */
export function createInventoryDescriptionIsolationRepository({ query }) {
  return {
    async read(identity, hashes) {
      const values = parameters(identity, hashes);
      if (!hashes.length) return new Map();
      const { rows } = await query(`SELECT description_hash, attempts, next_retry_at <= now() AS due
        FROM inventory_description_retry_journal WHERE projection_version=$1 AND model_name=$2
          AND model_digest=$3 AND dimensions=$4 AND description_hash=ANY($5::text[]) AND expires_at > now()
        ORDER BY next_retry_at, description_hash`, values);
      const requested = new Set(hashes), result = new Map();
      for (const row of rows) {
        if (!requested.has(row.description_hash) || result.has(row.description_hash) ||
            !Number.isInteger(row.attempts) || row.attempts < 0 || row.attempts > 7 || typeof row.due !== 'boolean') {
          throw new Error('description_isolation_state_invalid');
        }
        result.set(row.description_hash, { attempts: row.attempts, due: row.due });
      }
      return result;
    },
    async defer(identity, hashes, { code, attempts, delayMs }) {
      const values = parameters(identity, hashes, 8);
      if (!hashes.length || !DESCRIPTION_ISOLATION_CODES.includes(code) || !Number.isInteger(attempts) || attempts < 0 || attempts > 7 ||
          !Number.isInteger(delayMs) || delayMs < 60_000 || delayMs > 3_600_000) throw new Error('description_isolation_record_invalid');
      // Admit the entire small batch or none. The shared advisory lock serializes writers.
      const { rows } = await query(`WITH missing AS (
        SELECT h FROM unnest($5::text[]) AS h WHERE NOT EXISTS (
          SELECT 1 FROM inventory_description_retry_journal j WHERE j.projection_version=$1 AND j.model_name=$2
            AND j.model_digest=$3 AND j.dimensions=$4 AND j.description_hash=h)
      ) INSERT INTO inventory_description_retry_journal
        (projection_version,model_name,model_digest,dimensions,description_hash,attempts,failure_code,next_retry_at,last_failed_at,expires_at)
        SELECT $1,$2,$3,$4,h,$6,$7,now()+$8::integer*interval '1 millisecond',now(),now()+interval '30 days'
        FROM unnest($5::text[]) AS h
        WHERE (SELECT count(*) FROM inventory_description_retry_journal)+(SELECT count(*) FROM missing) <= 20000
        ON CONFLICT (projection_version,model_name,model_digest,dimensions,description_hash) DO UPDATE
          SET attempts=EXCLUDED.attempts,failure_code=EXCLUDED.failure_code,next_retry_at=EXCLUDED.next_retry_at,
            last_failed_at=EXCLUDED.last_failed_at,expires_at=EXCLUDED.expires_at
        RETURNING description_hash`, [...values, attempts, code, delayMs]);
      if (rows.length !== hashes.length) throw new Error('description_isolation_capacity_exceeded');
    },
    async clear(identity, hashes) {
      const values = parameters(identity, hashes);
      if (!hashes.length) return;
      await query(`DELETE FROM inventory_description_retry_journal WHERE projection_version=$1 AND model_name=$2
        AND model_digest=$3 AND dimensions=$4 AND description_hash=ANY($5::text[])`, values);
    },
    async pruneExpired() {
      await query(`DELETE FROM inventory_description_retry_journal WHERE ctid IN (
        SELECT ctid FROM inventory_description_retry_journal WHERE expires_at <= now() ORDER BY expires_at LIMIT 1000
      )`);
    },
  };
}
