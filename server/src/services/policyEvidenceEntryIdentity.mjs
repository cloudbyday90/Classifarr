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
  'strictConstraint',
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

function comparePolicyEvidenceEntries(left, right) {
  const leftKey = buildPolicyEvidenceEntrySemanticKey(left);
  const rightKey = buildPolicyEvidenceEntrySemanticKey(right);

  if (leftKey === rightKey) return 0;
  if (!leftKey) return 1;
  if (!rightKey) return -1;

  return leftKey < rightKey ? -1 : 1;
}

function sortPolicyEvidenceEntries(entries = []) {
  return (Array.isArray(entries) ? entries : [])
    .slice()
    .sort(comparePolicyEvidenceEntries);
}

function findPolicyEvidenceEntryOutOfOrderIndexes(entries = []) {
  const outOfOrderIndexes = [];
  let previousKey = null;

  (Array.isArray(entries) ? entries : []).forEach((entry, index) => {
    const key = buildPolicyEvidenceEntrySemanticKey(entry);
    if (!key) return;

    if (previousKey && previousKey > key) {
      outOfOrderIndexes.push(index);
    }

    previousKey = key;
  });

  return outOfOrderIndexes;
}

export {
  POLICY_EVIDENCE_ENTRY_IDENTITY_FIELD_IDS,
  buildPolicyEvidenceEntrySemanticKey,
  comparePolicyEvidenceEntries,
  findPolicyEvidenceEntryDuplicateIndexes,
  findPolicyEvidenceEntryOutOfOrderIndexes,
  sortPolicyEvidenceEntries,
};
