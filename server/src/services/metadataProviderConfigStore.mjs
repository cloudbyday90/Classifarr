/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */

import { metadataProviderDefinition } from './metadataProviderConfigSql.mjs';

/** Fixed provider identifiers only; callers never supply SQL table or column names. */
export function metadataProviderConfigQuery(provider, { activeOnly = false } = {}) {
    const definition = metadataProviderDefinition(provider);
    return activeOnly ? definition.active : definition.settings;
}

export async function readMetadataProviderConfig(db, provider, options = {}) {
    const result = await db.query(metadataProviderConfigQuery(provider, options));
    return result.rows[0] || null;
}

/** The caller owns the transaction. Lock before reading, including on an empty table. */
export async function persistMetadataProviderConfig(client, provider, buildPayload) {
    const definition = metadataProviderDefinition(provider);
    await client.query(definition.lock);
    const existing = await readMetadataProviderConfig(client, provider);
    const parameters = definition.values(buildPayload(existing));
    const result = await client.query(definition.upsert, parameters);
    if (!result.rows[0]) throw new Error('Metadata provider configuration was not saved');
    // An explicit replacement retains historical credentials but leaves one selected state.
    await client.query(definition.retire, [result.rows[0].id]);
    return result;
}
