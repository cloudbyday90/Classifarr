/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
const statements = new Map([
  ['omdb', `UPDATE omdb_config SET credential_rejected_at = clock_timestamp()
    WHERE id = $1 AND credential_generation = $2::uuid AND credential_rejected_at IS NULL RETURNING id`],
  ['legacy_tavily', `UPDATE tavily_config SET credential_rejected_at = clock_timestamp()
    WHERE id = $1 AND credential_generation = $2::uuid AND credential_rejected_at IS NULL RETURNING id`],
  ['web_search', `UPDATE web_search_provider_config SET credential_rejected_at = clock_timestamp()
    WHERE id = $1 AND credential_generation = $2::uuid AND credential_rejected_at IS NULL RETURNING id`],
]);

/** Opaque random generation, never a credential or credential-derived digest. */
export function providerCredentialContext(source, row) {
  if (!statements.has(source) || !Number.isSafeInteger(row?.id) || row.id < 1 ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(row.credential_generation ?? '')) return null;
  return Object.freeze({ source, id: row.id, generation: row.credential_generation });
}

export async function rejectProviderCredential(db, context) {
  const validated = providerCredentialContext(context?.source, {
    id: context?.id, credential_generation: context?.generation,
  });
  if (!validated) throw new TypeError('provider_credential_context_missing');
  const { rows } = await db.query(statements.get(validated.source), [validated.id, validated.generation]);
  return rows.length === 1;
}

/** Fixed classification only; messages/bodies are not trusted recovery authority. */
export function isProviderCredentialRejection(error) {
  return ['OMDB_AUTHENTICATION', 'OMDB_ACCESS_DENIED', 'auth_failed', 'forbidden'].includes(error?.code);
}
