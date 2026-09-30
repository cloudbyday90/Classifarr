/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { metadataProviderDefinition } from './metadataProviderConfigSql.mjs';
import { providerCredentialContext } from './providerCredentialRejection.mjs';
import { OMDB_MAX_WAIT_SECONDS } from './omdbPacingPolicy.mjs';

export async function boundOmdbAdmissionTransaction(client) {
  await client.query("SET LOCAL lock_timeout='1s'");
  await client.query("SET LOCAL statement_timeout='5s'");
  await client.query("SET LOCAL idle_in_transaction_session_timeout='10s'");
  await client.query("SET LOCAL transaction_timeout='15s'");
}

/** Configuration lock must be held. The floor survives credential rotation. */
export async function omdbPacingWait(client, context) {
  if (!context) throw new TypeError('omdb_credential_context_missing');
  const { rows: [row] } = await client.query(`SELECT GREATEST(0,CEIL(EXTRACT(epoch FROM (
    GREATEST(next_admission_at,CASE WHEN config_id=$1 AND credential_generation=$2::uuid
      THEN blocked_until END)-clock_timestamp()))))::integer AS wait
    FROM omdb_request_pacing WHERE singleton`, [context.id, context.generation]);
  return row?.wait ?? 0;
}

export async function advanceOmdbPacing(client) {
  await client.query(`INSERT INTO omdb_request_pacing(singleton,next_admission_at)
    VALUES (true,clock_timestamp()+interval '1 second') ON CONFLICT (singleton) DO UPDATE
    SET next_admission_at=EXCLUDED.next_admission_at`);
}

/** Caller holds the selected configuration lock; never shortens a matching wait. */
export async function recordOmdbPacingDelay(client, context, seconds) {
  if (!Number.isSafeInteger(seconds) || seconds < 1 || seconds > OMDB_MAX_WAIT_SECONDS) return;
  await client.query(`UPDATE omdb_request_pacing SET blocked_until=GREATEST(
    CASE WHEN config_id=$1 AND credential_generation=$2::uuid THEN blocked_until END,
    clock_timestamp()+($3::integer*interval '1 second')),config_id=$1,credential_generation=$2::uuid
    WHERE singleton`, [context.id, context.generation, seconds]);
}

export async function deferOmdbPacing(db, context, seconds) {
  const checked = providerCredentialContext(context?.source, { id: context?.id, credential_generation: context?.generation });
  if (checked?.source !== 'omdb') return;
  await db.withTransaction(async client => {
    await boundOmdbAdmissionTransaction(client);
    await client.query(metadataProviderDefinition('omdb').lock);
    const { rows: [config] } = await client.query(`SELECT id,credential_generation FROM omdb_config
      WHERE is_active ORDER BY id DESC LIMIT 1`);
    if (config?.id !== checked.id || config.credential_generation !== checked.generation) return;
    await recordOmdbPacingDelay(client, checked, seconds);
  });
}

/** Verified recovery keeps same-key wait evidence; key edits do not inherit it. */
export async function transferOmdbPacingGeneration(client, id, previous, generation) {
  await client.query(`UPDATE omdb_request_pacing SET credential_generation=$3::uuid
    WHERE singleton AND config_id=$1 AND credential_generation=$2::uuid`, [id, previous, generation]);
}

/** Advisory only; no lock, reservation, provider request or state mutation. */
export async function readOmdbPacingReadiness(db) {
  const { rows: [row] } = await db.query(`SELECT GREATEST(0,CEIL(EXTRACT(epoch FROM (
    GREATEST(p.next_admission_at,CASE WHEN p.config_id=c.id AND p.credential_generation=c.credential_generation
      THEN p.blocked_until END)-clock_timestamp()))))::integer AS wait,
    GREATEST(p.next_admission_at,CASE WHEN p.config_id=c.id AND p.credential_generation=c.credential_generation
      THEN p.blocked_until END) AS retry_at
    FROM omdb_request_pacing p LEFT JOIN LATERAL
      (SELECT id,credential_generation FROM omdb_config WHERE is_active ORDER BY id DESC LIMIT 1) c ON true
    WHERE p.singleton`);
  return { wait: row?.wait ?? 0, retryAt: row?.wait > 0 ? new Date(row.retry_at).toISOString() : null };
}
