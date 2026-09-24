/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { createHash } from 'node:crypto';
import { validateDescriptionRepresentation } from './inventoryDescriptionVectorCache.mjs';

export const INVENTORY_DESCRIPTION_REPRESENTATION_MAX_AGE_MINUTES = 10;

export function descriptionConfigDigest(configKey) {
  if (typeof configKey !== 'string' || !configKey || configKey.length > 1024) {
    throw new Error('inventory_description_config_key_invalid');
  }
  return createHash('sha256').update(configKey).digest('hex');
}

/** Called only after a successful local provider inspection under the cache lock. */
export async function recordDescriptionRepresentation(db, identity, configKey) {
  const [projectionVersion, model, digest, dimensions] = validateDescriptionRepresentation(identity);
  const configDigest = descriptionConfigDigest(configKey);
  await db.query(`INSERT INTO inventory_description_representation_checkpoint
    (singleton_id,projection_version,config_digest,model_name,model_digest,dimensions,verified_at)
    VALUES (1,$1,$2,$3,$4,$5,now()) ON CONFLICT (singleton_id) DO UPDATE SET
      projection_version=EXCLUDED.projection_version,config_digest=EXCLUDED.config_digest,
      model_name=EXCLUDED.model_name,model_digest=EXCLUDED.model_digest,
      dimensions=EXCLUDED.dimensions,verified_at=now()`,
  [projectionVersion, configDigest, model, digest, dimensions]);
}

/** A stale or changed configuration cannot authorize a 'current cache' claim. */
export async function readCurrentDescriptionRepresentation(query, configKey) {
  const { rows } = await query(`SELECT projection_version, model_name, model_digest, dimensions
    FROM inventory_description_representation_checkpoint
    WHERE singleton_id=1 AND config_digest=$1
      AND verified_at >= now() - interval '10 minutes'`, [descriptionConfigDigest(configKey)]);
  if (!rows.length) return null;
  const row = rows[0];
  const identity = { provider: 'ollama', model: row.model_name, digest: row.model_digest,
    dimensions: row.dimensions };
  const [version] = validateDescriptionRepresentation(identity);
  return row.projection_version === version ? identity : null;
}
