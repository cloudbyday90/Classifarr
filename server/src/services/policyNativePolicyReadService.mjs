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
} = {}) {
  if (!intent) {
    return authority
      ? {
        ...policy,
        native_intent_authority: authority,
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
    native_intent_authority: authority || buildNativeIntentAuthority({ activeIntents: [intent] }),
    native_intent_active: intent.active !== false,
    native_intent_version: intent.intent_version ?? null,
    native_intent: {
      active: intent.active !== false,
      intent_version: intent.intent_version ?? null,
      contract,
    },
  };
}

async function fetchActiveNativeIntentForPolicy(dbClient, policyId) {
  const intentResult = await dbClient.query(`
    SELECT *
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
  ]);

  return {
    authority,
    intent,
    rules: rulesResult.rows || [],
    templates: templatesResult.rows || [],
    validation: validationResult.rows?.[0] || null,
  };
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

export {
  attachActiveNativeIntentForPolicy,
  attachNativeIntentToPolicy,
  buildNativeContractFromRows,
  fetchActiveNativeIntentForPolicy,
};
