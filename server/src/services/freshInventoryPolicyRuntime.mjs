/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { createHash } from 'node:crypto';
import pg from 'pg';
import { readDescriptionBenchmarkSnapshot, decodeDescriptionBenchmarkSnapshot } from './inventoryDescriptionBenchmarkRepository.mjs';
import { describeInventorySnapshotDigests } from './inventoryDescriptionSnapshotDigests.mjs';
import { getActivePolicies } from './policyEngineQueries.mjs';
import { createLocalStudyEmbeddingClient } from './localStudyEmbeddingClient.mjs';
import { createLocalDescriptionBenchmarkClient } from './localDescriptionBenchmarkClient.mjs';
import { readLibraryObservationTraits } from './libraryProfileObservation.mjs';
import { LOG_CONFIG } from '../utils/logging/logConfig.mjs';
import { runDatabaseTransaction } from '../utils/databaseTransaction.mjs';
import { databaseConnectionErrorCode } from '../utils/databaseClientLease.mjs';
import { createLogger } from '../utils/logger.mjs';
import { createInventoryDiscoveryAdmission } from './inventoryDiscoveryAdmission.mjs';
import { INVENTORY_OUTCOME_LABEL_SQL } from './inventoryOutcomeLabels.mjs';
import { OPERATOR_POLICY_SOURCE_REVISION_SQL } from './operatorCorrectionPolicyProvenance.mjs';

const policyFields = ['id', 'library_id', 'name', 'enabled', 'priority', 'auto_classify_threshold', 'prompt_threshold',
  'trust_patterns', 'trust_rag', 'trust_history', 'combination_mode', 'preset_weight', 'profile_weight',
  'pattern_weight', 'rag_weight', 'history_weight', 'library_name', 'library_media_type', 'presets',
  'policy_runtime_authority', 'policy_intent_contract', 'policy_intent_read_trace'];

// Keep resolved evaluator inputs, not duplicate authoring views or unused observation-expiry timestamps.
export const projectFreshPolicyConfiguration = policy => Object.fromEntries(policyFields
  .filter(field => Object.hasOwn(policy, field)).map(field => [field, policy[field]]));

export const FRESH_POLICY_CONFIG_SQL = `SELECT rag_enabled, embedding_provider_mode, primary_provider,
  embedding_model, embedding_ollama_host, embedding_ollama_port, embedding_ollama_model,
  ollama_host, ollama_port, ollama_model, configuration_revision FROM ai_provider_config WHERE id=1`;

export function describeFreshPolicySnapshot(snapshot) {
  const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
  const hash = createHash('sha256');
  for (const row of snapshot.evaluationRows) hash.update(JSON.stringify([row.media_type, row.tmdb_id, row.library_id,
    row.title, row.year, row.overview, readLibraryObservationTraits({ ...row, metadata: row.evaluation_metadata })])).update('\n');
  return { ...describeInventorySnapshotDigests(snapshot, snapshot.vectors).hashes,
    configuration: digest(snapshot.config), policies: digest(snapshot.policies.map(projectFreshPolicyConfiguration)),
    observedTraits: hash.digest('hex'),
    ...(Array.isArray(snapshot.operatorFeedbackRows) ? { operatorCorrections: digest(snapshot.operatorFeedbackRows) } : {}),
    ...(Array.isArray(snapshot.policySourceRevisionRows) ? { policySourceRevisions: digest(snapshot.policySourceRevisionRows) } : {}),
    ...(snapshot.trainingExclusions instanceof Set ? { provenance: digest([...snapshot.trainingExclusions].sort()) } : {}) };
}

export function fingerprintFreshPolicySnapshot(snapshot) {
  return createHash('sha256').update(JSON.stringify(describeFreshPolicySnapshot(snapshot))).digest('hex');
}

/** Configuration, policies, bounded metadata and cached vectors share one read snapshot. */
export function createFreshInventoryPolicyRepository({ withTransaction, loadPolicies = getActivePolicies,
  includeTrainingProvenance = false, includeOperatorCorrectionLabels = false }) {
  return { async read(identity) {
    const captured = await withTransaction(async client => {
      // Production bulk readers may use Promise.all; a transaction has exactly one connection.
      let pending = Promise.resolve();
      const reader = { query: (sql, parameters) => {
        pending = pending.then(() => client.query(sql, parameters));
        return pending;
      } };
      const snapshot = await readDescriptionBenchmarkSnapshot(reader, identity, true, includeTrainingProvenance);
      const config = (await reader.query(FRESH_POLICY_CONFIG_SQL)).rows[0];
      const loadedPolicies = await loadPolicies({ dbClient: reader, throwOnError: true });
      const operatorFeedbackRows = includeOperatorCorrectionLabels ? (await reader.query(INVENTORY_OUTCOME_LABEL_SQL)).rows : undefined;
      const policySourceRevisionRows = includeOperatorCorrectionLabels
        ? (await reader.query(OPERATOR_POLICY_SOURCE_REVISION_SQL)).rows : undefined;
      return { snapshot, config, loadedPolicies, operatorFeedbackRows, policySourceRevisionRows };
    });
    const policies = captured.loadedPolicies.map(projectFreshPolicyConfiguration);
    if (!captured.config || policies.length > 64 || JSON.stringify(policies).length > 2_000_000 ||
        captured.snapshot.rows.some(row => JSON.stringify(row).length > 110_000)) {
      throw new Error('fresh_policy_snapshot_budget');
    }
    const source = { ...decodeDescriptionBenchmarkSnapshot(captured.snapshot, identity, true),
      config: captured.config, policies,
      ...(includeOperatorCorrectionLabels ? { operatorFeedbackRows: captured.operatorFeedbackRows,
        policySourceRevisionRows: captured.policySourceRevisionRows } : {}) };
    return { ...source, fingerprint: fingerprintFreshPolicySnapshot(source) };
  } };
}

/** No domain writers. Default read-only also protects statements outside explicit transactions. */
export async function loadFreshInventoryPolicyRuntime({ logging = LOG_CONFIG, includeTrainingProvenance = false,
  includeOperatorCorrectionLabels = false } = {}) {
  // Logging configuration is captured during ESM initialization, not when the
  // first snapshot is read. Refuse content access if startup flags were omitted.
  if (logging.level !== 'fatal' || logging.fileLoggingEnabled !== false) {
    throw new Error('fresh_policy_private_logging_required');
  }
  const db = await import('../config/database.mjs');
  const pool = new pg.Pool({ ...db.pool.options, max: 1, min: 0,
    options: '-c default_transaction_read_only=on -c statement_timeout=15000 -c lock_timeout=1000',
    application_name: 'classifarr-fresh-policy-evaluation' });
  const logger = createLogger('freshInventoryPolicy');
  pool.on?.('error', error => logger.warn('Evaluation database connection lost',
    { code: databaseConnectionErrorCode(error) }, { skipDbPersist: true }));
  const close = async () => { await pool.end(); await db.pool.end(); };
  try {
    const config = (await pool.query(FRESH_POLICY_CONFIG_SQL)).rows[0];
    const withTransaction = async callback => runDatabaseTransaction(await pool.connect(), callback, { logger });
    return { config, embedder: createLocalStudyEmbeddingClient(config),
      repository: createFreshInventoryPolicyRepository({ withTransaction, includeTrainingProvenance, includeOperatorCorrectionLabels }),
      withDiscoveryAdmission: createInventoryDiscoveryAdmission(db),
      createClient: () => createLocalDescriptionBenchmarkClient(config), close };
  } catch (error) { await close(); throw error; }
}
