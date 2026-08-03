import { POLICY_INTENT_CONTRACT_SCHEMA_VERSION } from './policyIntentSchema.mjs';
import {
  buildNativeIntentAuthority,
} from './policyNativeIntentAuthority.mjs';

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function parseJsonValue(value, fallback) {
  if (value === null || value === undefined) return fallback;
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function normalizeRule(row = {}) {
  return {
    intent_role: row.intent_role,
    signal_type: row.signal_type,
    operator: row.operator,
    values: asObject(parseJsonValue(row.values, {})),
    constraint_mode: row.constraint_mode ?? null,
    semantics: row.semantics ?? null,
    source: row.source ?? null,
    inference_state: row.inference_state,
  };
}

function normalizeTemplateLink(row = {}) {
  return {
    preset_id: row.preset_id ?? null,
    preset_key: row.preset_key ?? null,
    preset_name: row.preset_name ?? null,
    source: 'native_intent',
    weight: row.weight === null || row.weight === undefined ? null : Number(row.weight),
    signal_count: Number(row.signal_count ?? 0),
    link_state: row.link_state ?? 'applied',
  };
}

function buildNativeContractFromRows({ policy = {}, intent = {}, rules = [], templates = [], validation = null } = {}) {
  const normalizedRules = asArray(rules).map(normalizeRule);
  const validationRow = asObject(validation);
  const warnings = asArray(parseJsonValue(validationRow.warnings, []));
  const errors = asArray(parseJsonValue(validationRow.errors, []));

  return {
    schema_version: intent.schema_version ?? POLICY_INTENT_CONTRACT_SCHEMA_VERSION,
    policy_id: policy.id ?? intent.policy_id ?? null,
    library_id: policy.library_id ?? intent.library_id ?? null,
    library_name: policy.library_name ?? null,
    library_media_type: policy.library_media_type ?? null,
    source: 'native_intent',
    inference_state: intent.inference_state ?? 'inferred',
    model: {
      mode: 'native_intent',
      intent_supported: true,
      native_intent: true,
      conversion_available: false,
    },
    purpose: normalizedRules.filter(rule => rule.intent_role === 'purpose'),
    hard_limits: normalizedRules.filter(rule => rule.intent_role === 'hard_limit'),
    helpful_hints: normalizedRules.filter(rule => rule.intent_role === 'helpful_hint'),
    avoid: normalizedRules.filter(rule => rule.intent_role === 'avoid'),
    review_behavior: asObject(parseJsonValue(intent.review_behavior, {})),
    template_links: asArray(templates).map(normalizeTemplateLink),
    warnings,
    unsupported_signals: [],
    validation: {
      valid: (validationRow.status ?? intent.validation_status) !== 'invalid' && errors.length === 0,
      error_count: Number(validationRow.error_count ?? 0),
      warning_count: Number(validationRow.warning_count ?? warnings.length),
      errors,
      warnings,
    },
  };
}

function attachNativeIntentToPolicy({
  policy = {},
  intent = null,
  rules = [],
  templates = [],
  validation = null,
  authority = null,
  routingTarget = null,
  observedEvidenceReference = null,
} = {}) {
  const resolvedAuthority = authority || buildNativeIntentAuthority({
    activeIntents: intent ? [intent] : [],
  });

  if (!intent || resolvedAuthority.authoritative !== true) {
    return resolvedAuthority.activeIntentCount > 0
      ? {
        ...policy,
        native_intent_authority: resolvedAuthority,
      }
      : policy;
  }

  const contract = buildNativeContractFromRows({
    policy,
    intent,
    rules,
    templates,
    validation,
  });

  return {
    ...policy,
    native_intent_authority: resolvedAuthority,
    native_intent_active: intent.active !== false,
    native_intent_version: intent.intent_version ?? null,
    policy_intent_authority_context: {
      routing_target: asObject(routingTarget),
      observed_evidence_reference: asObject(observedEvidenceReference),
    },
    native_intent: {
      active: intent.active !== false,
      intent_version: intent.intent_version ?? null,
      contract,
    },
  };
}

async function fetchActiveNativeIntentForPolicy(dbClient, policyId) {
  const intentResult = await dbClient.query(`
    SELECT
      policy_intents.*,
      (
        SELECT COUNT(*)
        FROM policy_intent_rules authority_purpose_rule
        WHERE authority_purpose_rule.intent_id = policy_intents.id
          AND authority_purpose_rule.intent_role = 'purpose'
      ) AS purpose_rule_count
    FROM policy_intents
    WHERE policy_id = $1
      AND active = TRUE
    ORDER BY intent_version DESC, id DESC
    LIMIT 2
  `, [policyId]);
  const activeIntents = asArray(intentResult.rows);
  const authority = buildNativeIntentAuthority({ activeIntents });

  if (authority.activeIntentCount === 0) {
    return null;
  }

  if (!authority.authoritative) {
    return {
      authority,
      intent: null,
      rules: [],
      templates: [],
      validation: null,
    };
  }

  const intent = activeIntents[0] || null;
  if (!intent) {
    return {
      authority,
      intent: null,
      rules: [],
      templates: [],
      validation: null,
    };
  }

  const [
    rulesResult,
    templatesResult,
    validationResult,
    routingTargetResult,
    observedEvidenceReferenceResult,
  ] = await Promise.all([
    dbClient.query(`
      SELECT *
      FROM policy_intent_rules
      WHERE intent_id = $1
      ORDER BY collection, sort_order, id
    `, [intent.id]),
    dbClient.query(`
      SELECT *
      FROM policy_intent_template_applications
      WHERE intent_id = $1
      ORDER BY id
    `, [intent.id]),
    dbClient.query(`
      SELECT *
      FROM policy_intent_validation_status
      WHERE intent_id = $1
      ORDER BY validated_at DESC, id DESC
      LIMIT 1
    `, [intent.id]),
    dbClient.query(`
      SELECT arr_type, target_status
      FROM policy_intent_routing_targets
      WHERE intent_id = $1
      ORDER BY id DESC
      LIMIT 1
    `, [intent.id]),
    dbClient.query(`
      SELECT
        source_id,
        capture_state,
        capture_reason_id,
        profile_freshness_state,
        expires_at,
        payload_redacted
      FROM policy_observed_evidence_provenance_snapshots
      WHERE intent_id = $1
      ORDER BY id DESC
      LIMIT 1
    `, [intent.id]),
  ]);

  return {
    authority,
    intent,
    rules: rulesResult.rows || [],
    templates: templatesResult.rows || [],
    validation: validationResult.rows?.[0] || null,
    routingTarget: routingTargetResult.rows?.[0] || null,
    observedEvidenceReference: observedEvidenceReferenceResult.rows?.[0] || null,
  };
}

function normalizePolicyIds(policies = []) {
  return [...new Set(
    asArray(policies)
      .map((policy) => Number(policy?.id ?? policy))
      .filter(Number.isInteger)
  )];
}

function groupRowsBy(rows = [], key) {
  return asArray(rows).reduce((grouped, row) => {
    const value = row?.[key];
    if (value === null || value === undefined) return grouped;
    const entries = grouped.get(value) || [];
    entries.push(row);
    grouped.set(value, entries);
    return grouped;
  }, new Map());
}

async function fetchActiveNativeIntentsForPolicies(dbClient, policies = []) {
  const policyIds = normalizePolicyIds(policies);
  const nativeIntentsByPolicyId = new Map();

  if (!dbClient || typeof dbClient.query !== 'function' || policyIds.length === 0) {
    return nativeIntentsByPolicyId;
  }

  const intentResult = await dbClient.query(`
    WITH ranked_active_intents AS (
      SELECT
        policy_intents.*,
        (
          SELECT COUNT(*)
          FROM policy_intent_rules authority_purpose_rule
          WHERE authority_purpose_rule.intent_id = policy_intents.id
            AND authority_purpose_rule.intent_role = 'purpose'
        ) AS purpose_rule_count,
        ROW_NUMBER() OVER (
          PARTITION BY policy_id
          ORDER BY intent_version DESC, id DESC
        ) AS active_intent_rank
      FROM policy_intents
      WHERE policy_id = ANY($1::integer[])
        AND active = TRUE
    )
    SELECT *
    FROM ranked_active_intents
    WHERE active_intent_rank <= 2
    ORDER BY policy_id, active_intent_rank
  `, [policyIds]);

  const activeIntentsByPolicyId = groupRowsBy(intentResult.rows, 'policy_id');
  const authoritativeEntries = [];

  for (const policyId of policyIds) {
    const activeIntents = activeIntentsByPolicyId.get(policyId) || [];
    const authority = buildNativeIntentAuthority({ activeIntents });
    if (authority.activeIntentCount === 0) continue;

    if (!authority.authoritative) {
      nativeIntentsByPolicyId.set(policyId, {
        authority,
        intent: null,
        rules: [],
        templates: [],
        validation: null,
      });
      continue;
    }

    authoritativeEntries.push({
      policyId,
      authority,
      intent: activeIntents[0],
    });
  }

  if (authoritativeEntries.length === 0) {
    return nativeIntentsByPolicyId;
  }

  const intentIds = authoritativeEntries.map(({ intent }) => intent.id);
  const [
    rulesResult,
    templatesResult,
    validationsResult,
    routingTargetsResult,
    observedEvidenceReferencesResult,
  ] = await Promise.all([
    dbClient.query(`
      SELECT *
      FROM policy_intent_rules
      WHERE intent_id = ANY($1::integer[])
      ORDER BY intent_id, collection, sort_order, id
    `, [intentIds]),
    dbClient.query(`
      SELECT *
      FROM policy_intent_template_applications
      WHERE intent_id = ANY($1::integer[])
      ORDER BY intent_id, id
    `, [intentIds]),
    dbClient.query(`
      SELECT DISTINCT ON (intent_id) *
      FROM policy_intent_validation_status
      WHERE intent_id = ANY($1::integer[])
      ORDER BY intent_id, validated_at DESC, id DESC
    `, [intentIds]),
    dbClient.query(`
      SELECT DISTINCT ON (intent_id)
        intent_id,
        arr_type,
        target_status
      FROM policy_intent_routing_targets
      WHERE intent_id = ANY($1::integer[])
      ORDER BY intent_id, id DESC
    `, [intentIds]),
    dbClient.query(`
      SELECT DISTINCT ON (intent_id)
        intent_id,
        source_id,
        capture_state,
        capture_reason_id,
        profile_freshness_state,
        expires_at,
        payload_redacted
      FROM policy_observed_evidence_provenance_snapshots
      WHERE intent_id = ANY($1::integer[])
      ORDER BY intent_id, id DESC
    `, [intentIds]),
  ]);

  const rulesByIntentId = groupRowsBy(rulesResult.rows, 'intent_id');
  const templatesByIntentId = groupRowsBy(templatesResult.rows, 'intent_id');
  const validationsByIntentId = groupRowsBy(validationsResult.rows, 'intent_id');
  const routingTargetsByIntentId = groupRowsBy(routingTargetsResult.rows, 'intent_id');
  const observedEvidenceReferencesByIntentId = groupRowsBy(
    observedEvidenceReferencesResult.rows,
    'intent_id'
  );

  for (const { policyId, authority, intent } of authoritativeEntries) {
    nativeIntentsByPolicyId.set(policyId, {
      authority,
      intent,
      rules: rulesByIntentId.get(intent.id) || [],
      templates: templatesByIntentId.get(intent.id) || [],
      validation: validationsByIntentId.get(intent.id)?.[0] || null,
      routingTarget: routingTargetsByIntentId.get(intent.id)?.[0] || null,
      observedEvidenceReference: observedEvidenceReferencesByIntentId.get(intent.id)?.[0] || null,
    });
  }

  return nativeIntentsByPolicyId;
}

async function attachActiveNativeIntentForPolicy({ dbClient, policy } = {}) {
  if (!policy?.id || !dbClient || typeof dbClient.query !== 'function') {
    return policy;
  }

  const nativeIntent = await fetchActiveNativeIntentForPolicy(dbClient, policy.id);
  if (!nativeIntent) return policy;

  return attachNativeIntentToPolicy({
    policy,
    ...nativeIntent,
  });
}

async function attachActiveNativeIntentsForPolicies({ dbClient, policies = [] } = {}) {
  const policyList = asArray(policies);
  const nativeIntentsByPolicyId = await fetchActiveNativeIntentsForPolicies(dbClient, policyList);

  return policyList.map((policy) => {
    const nativeIntent = nativeIntentsByPolicyId.get(policy?.id);
    if (!nativeIntent) return policy;
    return attachNativeIntentToPolicy({ policy, ...nativeIntent });
  });
}

export {
  attachActiveNativeIntentForPolicy,
  attachActiveNativeIntentsForPolicies,
  attachNativeIntentToPolicy,
  buildNativeContractFromRows,
  fetchActiveNativeIntentForPolicy,
  fetchActiveNativeIntentsForPolicies,
};
