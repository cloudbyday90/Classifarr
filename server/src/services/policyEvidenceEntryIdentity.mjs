const POLICY_EVIDENCE_ENTRY_IDENTITY_FIELD_IDS = Object.freeze([
  'bucketId',
  'sourceId',
  'authoritySourceId',
  'key',
  'label',
  'value',
  'count',
  'confidence',
  'reasonCode',
  'observedAt',
  'stale',
]);

function buildPolicyEvidenceEntrySemanticKey(entry = {}) {
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return null;

  return JSON.stringify(
    POLICY_EVIDENCE_ENTRY_IDENTITY_FIELD_IDS.map(fieldId => entry[fieldId] ?? null)
  );
}

function findPolicyEvidenceEntryDuplicateIndexes(entries = []) {
  const seen = new Set();
  const duplicates = [];

  (Array.isArray(entries) ? entries : []).forEach((entry, index) => {
    const key = buildPolicyEvidenceEntrySemanticKey(entry);
    if (!key) return;

    if (seen.has(key)) {
      duplicates.push(index);
      return;
    }

    seen.add(key);
  });

  return duplicates;
}

export {
  POLICY_EVIDENCE_ENTRY_IDENTITY_FIELD_IDS,
  buildPolicyEvidenceEntrySemanticKey,
  findPolicyEvidenceEntryDuplicateIndexes,
};
