/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { providerCredentialContext } from './providerCredentialRejection.mjs';
import { probeDefinition } from './providerRecoveryProbeQueries.mjs';
import { WEB_SEARCH_MAX_WAIT_SECONDS } from './webSearchPacingPolicy.mjs';

const locks = new Map([['tavily', 1], ['brave', 2], ['serper', 3]]);
export async function lockWebSearchProvider(client, provider) {
  if (!locks.has(provider)) throw new TypeError('unknown_web_search_provider');
  await client.query('SELECT pg_advisory_xact_lock(742610,$1::integer)', [locks.get(provider)]);
}

/** Selected configuration and provider locks must already be held. */
export async function webSearchPacingWait(client, provider, context) {
  const { rows: [row] } = await client.query(`SELECT GREATEST(0,CEIL(EXTRACT(epoch FROM (
    GREATEST(next_admission_at,CASE WHEN source=$2 AND config_id=$3 AND credential_generation=$4::uuid
      THEN blocked_until END)-clock_timestamp()))))::integer AS wait
    FROM web_search_provider_pacing WHERE provider_key=$1`,
  [provider, context.source, context.id, context.generation]);
  return row?.wait ?? 0;
}

export async function advanceWebSearchPacing(client, provider) {
  await client.query(`INSERT INTO web_search_provider_pacing(provider_key,next_admission_at)
    VALUES ($1,clock_timestamp()+interval '1 second') ON CONFLICT (provider_key) DO UPDATE
    SET next_admission_at=EXCLUDED.next_admission_at`, [provider]);
}

/** Verified same-key recovery rotates rejection authority, not the provider's valid wait. */
export async function transferWebSearchPacingGeneration(client, provider, context, generation) {
  await lockWebSearchProvider(client, provider);
  await client.query(`UPDATE web_search_provider_pacing SET credential_generation=$5::uuid
    WHERE provider_key=$1 AND source=$2 AND config_id=$3 AND credential_generation=$4::uuid`,
  [provider, context.source, context.id, context.generation, generation]);
}

/** Caller owns current configuration + provider lock; delays can only extend. */
export async function recordWebSearchPacingDelay(client, provider, context, seconds) {
  if (!Number.isSafeInteger(seconds) || seconds < 1 || seconds > WEB_SEARCH_MAX_WAIT_SECONDS) return;
  await client.query(`UPDATE web_search_provider_pacing SET blocked_until=GREATEST(
    CASE WHEN source=$2 AND config_id=$3 AND credential_generation=$4::uuid THEN blocked_until END,
    clock_timestamp()+($5::integer*interval '1 second')),source=$2,config_id=$3,credential_generation=$4::uuid
    WHERE provider_key=$1`, [provider, context.source, context.id, context.generation, seconds]);
}

export async function deferWebSearchPacing(db, provider, context, seconds) {
  const checked = providerCredentialContext(context?.source, { id: context?.id, credential_generation: context?.generation });
  if (!checked || !['web_search', 'legacy_tavily'].includes(checked.source) || !locks.has(provider) ||
    (checked.source === 'legacy_tavily' && provider !== 'tavily')) return;
  await db.withTransaction(async client => {
    await client.query("SET LOCAL lock_timeout='1s'");
    await client.query("SET LOCAL statement_timeout='5s'");
    await client.query("SET LOCAL transaction_timeout='15s'");
    const definition = probeDefinition(checked.source);
    if (definition.lock) await client.query(definition.lock);
    const { rows: [row] } = await client.query(definition.select.replace('FOR UPDATE SKIP LOCKED', 'FOR UPDATE'), [checked.id]);
    if (!row || row.credential_generation !== checked.generation ||
      (checked.source === 'web_search' && row.provider_key !== provider)) return;
    await lockWebSearchProvider(client, provider);
    await recordWebSearchPacingDelay(client, provider, checked, seconds);
  });
}

/** Automatic-call health is generation fenced; pacing, not telemetry, owns delay updates. */
export async function updatePacedProviderHealth(db, provider, usage) {
  const context = usage.credentialContext;
  if (context?.source !== 'web_search' || !providerCredentialContext(context.source,
    { id: context.id, credential_generation: context.generation })) return null;
  const error = usage.error;
  return db.query(`UPDATE web_search_provider_config SET
    last_success_at=CASE WHEN $4::boolean THEN clock_timestamp() ELSE last_success_at END,
    last_error_at=CASE WHEN $4::boolean THEN NULL ELSE clock_timestamp() END,
    last_error_code=$5,last_error_message=$6,last_error_http_status=$7,updated_at=clock_timestamp()
    WHERE provider_key=$1 AND id=$2 AND credential_generation=$3::uuid AND is_enabled RETURNING *`,
  [provider, context.id, context.generation, !error && usage.status === 'success',
    error?.code ?? null, error?.message ?? null, error?.httpStatus ?? null]);
}
