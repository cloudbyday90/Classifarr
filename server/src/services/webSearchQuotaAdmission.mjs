/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { isDeepStrictEqual } from 'node:util';
import { providerCredentialContext } from './providerCredentialRejection.mjs';
import { probeDefinition } from './providerRecoveryProbeQueries.mjs';
import { reserveWebSearchQuota, webSearchRequestCost } from './webSearchQuotaReservation.mjs';
import { WebSearchProviderError } from './webSearchProviderErrorTaxonomy.mjs';

export function webSearchAdmissionDeferred(provider, retryAfterSeconds = 60) {
  return new WebSearchProviderError({ provider, operation: 'admission', errorCode: 'admission_deferred',
    safeMessage: 'Web search is waiting for provider admission', retryable: true,
    cooldownEligible: false, retryAfterSeconds });
}

export async function admitWebSearch(db, { providerKey, config, purpose }) {
  const context = providerCredentialContext(config?.credentialContext?.source, {
    id: config?.credentialContext?.id, credential_generation: config?.credentialContext?.generation,
  });
  if (!context || !['web_search', 'legacy_tavily'].includes(context.source) ||
    !['tavily', 'brave', 'serper'].includes(providerKey) ||
    (context.source === 'legacy_tavily' && providerKey !== 'tavily')) throw webSearchAdmissionDeferred(providerKey);
  try {
    const result = await db.withTransaction(async client => {
      await client.query("SET LOCAL lock_timeout='1s'");
      await client.query("SET LOCAL statement_timeout='5s'");
      await client.query("SET LOCAL transaction_timeout='15s'");
      await client.query("SET LOCAL idle_in_transaction_session_timeout='10s'");
      const definition = probeDefinition(context.source);
      if (definition.lock) await client.query(definition.lock);
      // Unlike a probe candidate, ordinary admission waits briefly for preceding reservations.
      const { rows: [row] } = await client.query(definition.select.replace('FOR UPDATE SKIP LOCKED', 'FOR UPDATE'), [context.id]);
      const options = context.source === 'legacy_tavily' && row ? {
        searchDepth: row.search_depth || 'advanced', maxResults: Number.parseInt(row.max_results, 10) || 5,
        includeDomains: row.include_domains || ['imdb.com', 'rottentomatoes.com'], excludeDomains: row.exclude_domains || [],
      } : row?.config || {};
      if (!row || (context.source === 'web_search' && row.provider_key !== providerKey) ||
        row.credential_generation !== context.generation || row.api_key !== config.apiKey ||
        row.credential_rejected_at || !isDeepStrictEqual(options, config.config || {})) return null;
      const { rows: [{ ready }] } = await client.query('SELECT $1::timestamptz IS NULL OR $1::timestamptz<=clock_timestamp() AS ready',
        [row.cooldown_until ?? null]);
      if (!ready) return null;
      return reserveWebSearchQuota(client, { provider: providerKey, config: row, context,
        costUnits: webSearchRequestCost(providerKey, config), purpose });
    });
    if (!result?.allowed) throw webSearchAdmissionDeferred(providerKey, result?.retryAfterSeconds);
    return result;
  } catch (error) {
    if (error instanceof WebSearchProviderError) throw error;
    // Database details and credentials are never propagated to routing diagnostics.
    throw webSearchAdmissionDeferred(providerKey);
  }
}
