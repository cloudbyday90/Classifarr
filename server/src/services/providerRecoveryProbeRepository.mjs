/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { randomUUID } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { SOURCE_CONFLICT_AUTHORITY_RETENTION_DAYS } from './sourceConflictAuthorityGuard.mjs';
import { TAVILY_MONTHLY_DEFERRED_REASON } from '../utils/enrichmentState.mjs';
import { probeDefinition, PROBE_CANDIDATES_SQL, PROBE_DEMAND_SQL } from './providerRecoveryProbeQueries.mjs';
import { reserveProviderProbeQuota } from './providerRecoveryProbeQuota.mjs';
import { normalizeProbeOutcome, providerProbeDelay } from './providerRecoveryProbePolicy.mjs';
import { lockWebSearchProvider, recordWebSearchPacingDelay } from './webSearchPacingStore.mjs';

async function selectConfiguration(client, candidate) {
  const definition = probeDefinition(candidate?.source);
  if (!definition || !Number.isSafeInteger(candidate.id) || candidate.id < 1) return null;
  const providerMatches = candidate.source === 'omdb' ? candidate.provider_key === 'omdb'
    : candidate.source === 'legacy_tavily' ? candidate.provider_key === 'tavily'
      : ['tavily', 'brave', 'serper'].includes(candidate.provider_key);
  if (!providerMatches) return null;
  await client.query("SET LOCAL lock_timeout='1s'");
  await client.query("SET LOCAL statement_timeout='5s'");
  await client.query("SET LOCAL idle_in_transaction_session_timeout='10s'");
  await client.query("SET LOCAL transaction_timeout='15s'");
  if (definition.lock) await client.query(definition.lock);
  return (await client.query(definition.select, [candidate.id])).rows[0] ?? null;
}

export function createProviderRecoveryProbeRepository(db, { random = Math.random } = {}) {
  return {
    async candidates() { return (await db.query(PROBE_CANDIDATES_SQL)).rows; },
    async claim(candidate) {
      return db.withTransaction(async client => {
        await client.query("SET LOCAL statement_timeout='5s'");
        await client.query("SET LOCAL transaction_timeout='15s'");
        const dependency = candidate.source === 'omdb' ? 'omdb' : 'web_search';
        const demand = await client.query(PROBE_DEMAND_SQL,
          [dependency, SOURCE_CONFLICT_AUTHORITY_RETENTION_DAYS, TAVILY_MONTHLY_DEFERRED_REASON]);
        if (!demand.rows[0]?.needed) return null;
        const config = await selectConfiguration(client, candidate);
        if (!config?.credential_rejected_at || !config.api_key?.trim() ||
          (candidate.source === 'web_search' && config.provider_key !== candidate.provider_key)) return null;
        const { rows: [{ now }] } = await client.query('SELECT clock_timestamp() AS now');
        const time = new Date(now).getTime();
        await client.query(`INSERT INTO provider_credential_probes(source,config_id,generation,next_probe_at)
          VALUES ($1,$2,$3,$4::timestamptz+interval '15 minutes') ON CONFLICT (source,config_id) DO UPDATE
          SET generation=EXCLUDED.generation,next_probe_at=EXCLUDED.next_probe_at,
            lease_token=NULL,lease_until=NULL,failures=0,last_outcome=NULL
          WHERE provider_credential_probes.generation<>EXCLUDED.generation`,
        [candidate.source, config.id, config.credential_generation, config.credential_rejected_at]);
        const { rows: [state] } = await client.query(`SELECT * FROM provider_credential_probes
          WHERE source=$1 AND config_id=$2 FOR UPDATE`, [candidate.source, config.id]);
        if (new Date(state.next_probe_at).getTime() > time ||
          (state.lease_until && new Date(state.lease_until).getTime() > time)) return null;
        if (!await reserveProviderProbeQuota(client, candidate, config, time)) {
          await client.query(`UPDATE provider_credential_probes SET next_probe_at=clock_timestamp()+interval '15 minutes',
            last_outcome='quota_wait',lease_token=NULL,lease_until=NULL WHERE source=$1 AND config_id=$2`,
          [candidate.source, config.id]);
          return null;
        }
        const token = randomUUID(), delay = providerProbeDelay(state.failures, 0, random);
        await client.query(`UPDATE provider_credential_probes SET lease_token=$3,
          lease_until=clock_timestamp()+interval '1 minute',last_probe_at=clock_timestamp(),
          next_probe_at=clock_timestamp()+($4::double precision*interval '1 millisecond'),
          failures=LEAST(failures+1,1000000) WHERE source=$1 AND config_id=$2`,
        [candidate.source, config.id, token, delay]);
        return { ...candidate, config, token, generation: config.credential_generation, failures: state.failures };
      });
    },
    async finish(claim, input) {
      const outcome = normalizeProbeOutcome(input);
      return db.withTransaction(async client => {
        const config = await selectConfiguration(client, claim);
        if (!config?.credential_rejected_at || config.credential_generation !== claim.generation ||
          !isDeepStrictEqual(config.config, claim.config.config)) return false;
        const { rows: [state] } = await client.query(`SELECT *,lease_until>clock_timestamp() AS live
          FROM provider_credential_probes WHERE source=$1 AND config_id=$2 FOR UPDATE`, [claim.source, claim.id]);
        if (!state?.live || state.lease_token !== claim.token || state.generation !== claim.generation) return false;
        // Rotate on verification, not just key edits: pre-recovery failures must become stale.
        let generation = claim.generation;
        if (outcome.verified) {
          const recovered = await client.query(probeDefinition(claim.source).recover, [claim.id, claim.generation]);
          generation = recovered.rows[0].credential_generation;
        }
        if (claim.source !== 'omdb' && outcome.retryAfterMs > 0) {
          await lockWebSearchProvider(client, claim.provider_key);
          await recordWebSearchPacingDelay(client, claim.provider_key,
            { source: claim.source, id: claim.id, generation }, Math.ceil(outcome.retryAfterMs / 1000));
        }
        const finished = await client.query(`UPDATE provider_credential_probes SET lease_token=NULL,lease_until=NULL,
          next_probe_at=GREATEST(next_probe_at,clock_timestamp()+($3::double precision*interval '1 millisecond')),
          last_outcome=$4,last_recovered_at=CASE WHEN $5 THEN clock_timestamp() ELSE last_recovered_at END
          WHERE source=$1 AND config_id=$2 AND lease_token=$6 AND generation=$7
            AND lease_until>clock_timestamp() RETURNING config_id`, [claim.source, claim.id,
          providerProbeDelay(claim.failures, outcome.retryAfterMs, random), outcome.category, outcome.verified,
          claim.token, claim.generation]);
        if (finished.rows.length !== 1) throw new Error('provider_probe_lease_expired');
        return true;
      });
    },
  };
}
