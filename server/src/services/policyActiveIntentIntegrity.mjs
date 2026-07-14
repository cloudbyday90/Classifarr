const POLICY_ACTIVE_INTENT_INTEGRITY_VERSION = 'policy.active_intent_integrity.v1';

const POLICY_ACTIVE_INTENT_INTEGRITY_STATUS_IDS = Object.freeze({
  CLEAN: 'clean',
  REPAIRABLE_DUPLICATE: 'repairable_duplicate',
  BLOCKED_UNSAFE_DUPLICATE: 'blocked_unsafe_duplicate',
});

const SAFE_ACTIVE_INTENT_VALIDATION_STATUSES = new Set(['valid', 'warning']);

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizePolicyId(value) {
  const numericValue = Number(value);
  return Number.isInteger(numericValue) && numericValue > 0 ? numericValue : null;
}

function asTimestamp(value) {
  const parsed = new Date(value || 0).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function compareCandidateAuthority(left, right) {
  const validationPriority = { valid: 0, warning: 1 };
  const leftValidationPriority = validationPriority[left.validationStatus] ?? 2;
  const rightValidationPriority = validationPriority[right.validationStatus] ?? 2;
  if (leftValidationPriority !== rightValidationPriority) {
    return leftValidationPriority - rightValidationPriority;
  }

  if (left.intentVersion !== right.intentVersion) {
    return right.intentVersion - left.intentVersion;
  }

  for (const field of ['acceptedAt', 'updatedAt', 'createdAt']) {
    const timestampDifference = asTimestamp(right[field]) - asTimestamp(left[field]);
    if (timestampDifference !== 0) return timestampDifference;
  }

  return right.id - left.id;
}

function normalizeActiveIntent(row = {}) {
  const policyId = normalizePolicyId(row.policyId ?? row.policy_id);
  const id = Number(row.id);
  const intentVersion = Number(row.intentVersion ?? row.intent_version);

  if (!policyId || !Number.isInteger(id) || id <= 0 || !Number.isInteger(intentVersion) || intentVersion <= 0) {
    return null;
  }

  return {
    id,
    policyId,
    intentVersion,
    validationStatus: normalizeString(row.validationStatus ?? row.validation_status).toLowerCase(),
    acceptedAt: row.acceptedAt ?? row.accepted_at ?? null,
    updatedAt: row.updatedAt ?? row.updated_at ?? null,
    createdAt: row.createdAt ?? row.created_at ?? null,
  };
}

function buildPolicyActiveIntentIntegrityReport({ activeIntents = [] } = {}) {
  const byPolicy = new Map();

  asArray(activeIntents)
    .map(normalizeActiveIntent)
    .filter(Boolean)
    .forEach(intent => {
      const intents = byPolicy.get(intent.policyId) || [];
      intents.push(intent);
      byPolicy.set(intent.policyId, intents);
    });

  const findings = [...byPolicy.entries()]
    .filter(([, intents]) => intents.length > 1)
    .sort(([leftPolicyId], [rightPolicyId]) => leftPolicyId - rightPolicyId)
    .map(([policyId, intents]) => {
      const safeCandidates = intents
        .filter(intent => SAFE_ACTIVE_INTENT_VALIDATION_STATUSES.has(intent.validationStatus))
        .sort(compareCandidateAuthority);
      const canonicalIntent = safeCandidates[0] || null;
      const duplicateIntentIds = intents
        .map(intent => intent.id)
        .filter(intentId => intentId !== canonicalIntent?.id)
        .sort((left, right) => left - right);

      return {
        policyId,
        statusId: canonicalIntent
          ? POLICY_ACTIVE_INTENT_INTEGRITY_STATUS_IDS.REPAIRABLE_DUPLICATE
          : POLICY_ACTIVE_INTENT_INTEGRITY_STATUS_IDS.BLOCKED_UNSAFE_DUPLICATE,
        activeIntentCount: intents.length,
        canonicalIntentId: canonicalIntent?.id ?? null,
        canonicalIntentVersion: canonicalIntent?.intentVersion ?? null,
        duplicateIntentIds,
        activeIntentIds: intents.map(intent => intent.id).sort((left, right) => left - right),
      };
    });

  const repairableCount = findings.filter(finding =>
    finding.statusId === POLICY_ACTIVE_INTENT_INTEGRITY_STATUS_IDS.REPAIRABLE_DUPLICATE
  ).length;
  const blockedCount = findings.length - repairableCount;
  const statusId = findings.length === 0
    ? POLICY_ACTIVE_INTENT_INTEGRITY_STATUS_IDS.CLEAN
    : blockedCount > 0
      ? POLICY_ACTIVE_INTENT_INTEGRITY_STATUS_IDS.BLOCKED_UNSAFE_DUPLICATE
      : POLICY_ACTIVE_INTENT_INTEGRITY_STATUS_IDS.REPAIRABLE_DUPLICATE;

  return {
    version: POLICY_ACTIVE_INTENT_INTEGRITY_VERSION,
    statusId,
    duplicatePolicyCount: findings.length,
    repairableCount,
    blockedCount,
    findings,
    sideEffects: {
      writesDatabase: false,
      mutatesSchema: false,
      writesFiles: false,
      deletesIntentPayloads: false,
    },
    nextStep: {
      stepId: blockedCount > 0 ? 'resolve_unsafe_active_intents' : 'apply_active_intent_integrity_migration',
      label: blockedCount > 0 ? 'Resolve Unsafe Active Intents' : 'Apply Active Intent Integrity Migration',
      reason: blockedCount > 0
        ? 'At least one policy has duplicate active intents without a validated repair candidate.'
        : 'The report found no unsafe duplicate active intents.',
    },
  };
}

async function loadPolicyActiveIntentIntegrityReport(client) {
  const result = await client.query(
    `WITH duplicate_policies AS (
       SELECT policy_id
       FROM policy_intents
       WHERE active = TRUE
       GROUP BY policy_id
       HAVING COUNT(*) > 1
     )
     SELECT
       intent.id,
       intent.policy_id,
       intent.intent_version,
       intent.validation_status,
       intent.accepted_at,
       intent.updated_at,
       intent.created_at
     FROM policy_intents AS intent
     JOIN duplicate_policies ON duplicate_policies.policy_id = intent.policy_id
     WHERE intent.active = TRUE
     ORDER BY intent.policy_id ASC, intent.id ASC`
  );

  return buildPolicyActiveIntentIntegrityReport({ activeIntents: result.rows });
}

export {
  POLICY_ACTIVE_INTENT_INTEGRITY_STATUS_IDS,
  POLICY_ACTIVE_INTENT_INTEGRITY_VERSION,
  SAFE_ACTIVE_INTENT_VALIDATION_STATUSES,
  buildPolicyActiveIntentIntegrityReport,
  loadPolicyActiveIntentIntegrityReport,
};
