import {
  AUTHORITY_SOURCE_IDS,
  getPolicyAuthoritySource,
} from './policyAuthorityVocabulary.mjs';
import {
  POLICY_EVIDENCE_SOURCE_IDS,
  getPolicyEvidenceSource,
} from './policyEvidenceEngine.mjs';
import {
  MAX_POLICY_EVIDENCE_INPUT_COLLECTION_ITEMS,
  normalizeMaximumCollectionItems,
} from './policyEvidenceInputCardinality.mjs';

const POLICY_EVIDENCE_INPUT_GATE_VERSION = 'policy.evidence.input_gate.v1';

const POLICY_EVIDENCE_INPUT_SECTION_IDS = Object.freeze({
  LIBRARY_PROFILE: 'libraryProfile',
  OPERATOR_INTENT: 'operatorIntent',
  CLASSIFICATION_OUTCOMES: 'classificationOutcomes',
  MANUAL_CORRECTIONS: 'manualCorrections',
  PENDING_ITEM_ANSWERS: 'pendingItemAnswers',
  ARR_ROUTING_OUTCOMES: 'arrRoutingOutcomes',
  METADATA_EVIDENCE: 'metadataEvidence',
  PROFILE_FRESHNESS: 'profileFreshness',
});

const POLICY_EVIDENCE_INPUT_GATE_RISK_IDS = Object.freeze({
  UNKNOWN_SECTION: 'unknown_section',
  MISSING_SECTION_SOURCE: 'missing_section_source',
  UNKNOWN_SECTION_SOURCE: 'unknown_section_source',
  MISSING_SECTION_AUTHORITY: 'missing_section_authority',
  UNKNOWN_SECTION_AUTHORITY: 'unknown_section_authority',
  SECTION_AUTHORITY_NOT_ALLOWED_FOR_SOURCE: 'section_authority_not_allowed_for_source',
  RAW_PROVIDER_PAYLOAD: 'raw_provider_payload',
  LIVE_PROVIDER_LOOKUP: 'live_provider_lookup',
  TRANSIENT_PROVIDER_STATE: 'transient_provider_state',
  UI_DIAGNOSTIC_LANGUAGE: 'ui_diagnostic_language',
  REPLAY_OR_IMPACT_PAYLOAD: 'replay_or_impact_payload',
  COLLECTION_LIMIT_EXCEEDED: 'collection_limit_exceeded',
  SCAN_DEPTH_LIMIT: 'scan_depth_limit',
  UNSAFE_OBJECT_SHAPE: 'unsafe_object_shape',
  PROTOTYPE_POLLUTION_KEY: 'prototype_pollution_key',
});

const MAX_SCAN_DEPTH = 8;
const MAX_ISSUES = 50;

const POLICY_EVIDENCE_INPUT_SECTIONS = Object.freeze([
  {
    id: POLICY_EVIDENCE_INPUT_SECTION_IDS.LIBRARY_PROFILE,
    label: 'Library profile',
    sourceId: POLICY_EVIDENCE_SOURCE_IDS.MEDIA_SERVER_LIBRARY_PROFILE,
    authoritySourceId: AUTHORITY_SOURCE_IDS.MEDIA_SERVER_CONTENTS,
  },
  {
    id: POLICY_EVIDENCE_INPUT_SECTION_IDS.OPERATOR_INTENT,
    label: 'Operator intent',
    sourceId: POLICY_EVIDENCE_SOURCE_IDS.OPERATOR_DECLARED_INTENT,
    authoritySourceId: AUTHORITY_SOURCE_IDS.OPERATOR_DECLARED_INTENT,
  },
  {
    id: POLICY_EVIDENCE_INPUT_SECTION_IDS.CLASSIFICATION_OUTCOMES,
    label: 'Classification outcomes',
    sourceId: POLICY_EVIDENCE_SOURCE_IDS.CLASSIFICATION_FINAL_OUTCOMES,
    authoritySourceId: AUTHORITY_SOURCE_IDS.MANUAL_OUTCOME,
  },
  {
    id: POLICY_EVIDENCE_INPUT_SECTION_IDS.MANUAL_CORRECTIONS,
    label: 'Manual corrections',
    sourceId: POLICY_EVIDENCE_SOURCE_IDS.MANUAL_CORRECTIONS,
    authoritySourceId: AUTHORITY_SOURCE_IDS.MANUAL_OUTCOME,
  },
  {
    id: POLICY_EVIDENCE_INPUT_SECTION_IDS.PENDING_ITEM_ANSWERS,
    label: 'Pending-item answers',
    sourceId: POLICY_EVIDENCE_SOURCE_IDS.PENDING_ITEM_ANSWERS,
    authoritySourceId: AUTHORITY_SOURCE_IDS.MANUAL_OUTCOME,
  },
  {
    id: POLICY_EVIDENCE_INPUT_SECTION_IDS.ARR_ROUTING_OUTCOMES,
    label: 'Arr routing outcomes',
    sourceId: POLICY_EVIDENCE_SOURCE_IDS.ARR_ROUTING_OUTCOMES,
    authoritySourceId: AUTHORITY_SOURCE_IDS.MANUAL_OUTCOME,
  },
  {
    id: POLICY_EVIDENCE_INPUT_SECTION_IDS.METADATA_EVIDENCE,
    label: 'Metadata evidence',
    sourceId: POLICY_EVIDENCE_SOURCE_IDS.METADATA_ENRICHMENT,
    authoritySourceId: AUTHORITY_SOURCE_IDS.METADATA_PROVIDER,
  },
  {
    id: POLICY_EVIDENCE_INPUT_SECTION_IDS.PROFILE_FRESHNESS,
    label: 'Profile freshness',
    sourceId: POLICY_EVIDENCE_SOURCE_IDS.PROFILE_FRESHNESS,
    authoritySourceId: AUTHORITY_SOURCE_IDS.MEDIA_SERVER_CONTENTS,
  },
]);

const PROHIBITED_KEY_RULES = Object.freeze([
  {
    riskId: POLICY_EVIDENCE_INPUT_GATE_RISK_IDS.RAW_PROVIDER_PAYLOAD,
    keys: Object.freeze([
      'apiResponse',
      'omdbRaw',
      'providerPayload',
      'providerResponse',
      'raw',
      'rawProviderPayload',
      'tmdbRaw',
    ]),
    message: 'Evidence inputs must not pass raw provider payloads into the projection boundary.',
  },
  {
    riskId: POLICY_EVIDENCE_INPUT_GATE_RISK_IDS.LIVE_PROVIDER_LOOKUP,
    keys: Object.freeze([
      'fetchProvider',
      'liveLookup',
      'liveLookupPerformed',
      'providerLookup',
      'providerRequest',
    ]),
    message: 'Evidence inputs must be offline snapshots and cannot perform or describe live provider lookups.',
  },
  {
    riskId: POLICY_EVIDENCE_INPUT_GATE_RISK_IDS.TRANSIENT_PROVIDER_STATE,
    keys: Object.freeze([
      'cooldownState',
      'providerQuota',
      'quotaState',
      'rateLimitState',
      'remainingQuota',
    ]),
    message: 'Evidence inputs must not treat transient provider quota or cooldown state as policy evidence.',
  },
  {
    riskId: POLICY_EVIDENCE_INPUT_GATE_RISK_IDS.UI_DIAGNOSTIC_LANGUAGE,
    keys: Object.freeze([
      'chipLabel',
      'diagnosticPanel',
      'panelLabel',
      'previewLabel',
      'uiChipLabel',
    ]),
    message: 'Evidence inputs must not carry UI diagnostic labels into server evidence contracts.',
  },
  {
    riskId: POLICY_EVIDENCE_INPUT_GATE_RISK_IDS.REPLAY_OR_IMPACT_PAYLOAD,
    keys: Object.freeze([
      'impactPayload',
      'impactPreview',
      'replayPayload',
      'replayPreview',
      'sampleDiagnostics',
    ]),
    message: 'Evidence inputs must not carry replay or impact preview payloads into normal engine flow.',
  },
  {
    riskId: POLICY_EVIDENCE_INPUT_GATE_RISK_IDS.PROTOTYPE_POLLUTION_KEY,
    keys: Object.freeze([
      '__proto__',
      'constructor',
      'prototype',
    ]),
    message: 'Evidence inputs must not contain prototype-pollution keys.',
  },
]);

const KNOWN_SECTION_IDS = new Set(POLICY_EVIDENCE_INPUT_SECTIONS.map(section => section.id));
const PROHIBITED_KEYS_BY_NAME = new Map(
  PROHIBITED_KEY_RULES.flatMap(rule =>
    rule.keys.map(key => [key.toLowerCase(), rule])
  )
);

function isPlainDataRecord(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function isPlainDataArray(value) {
  return Array.isArray(value) && Object.getPrototypeOf(value) === Array.prototype;
}

function asPlainObject(value) {
  return isPlainDataRecord(value) ? value : {};
}

function getOwnDataEntries(value) {
  return Object.keys(value).map(key => ({
    key,
    descriptor: Object.getOwnPropertyDescriptor(value, key),
  }));
}

function listPolicyEvidenceInputSections() {
  return POLICY_EVIDENCE_INPUT_SECTIONS;
}

function getPolicyEvidenceInputSection(sectionId) {
  return POLICY_EVIDENCE_INPUT_SECTIONS.find(section => section.id === sectionId) || null;
}

function pushIssue(issues, issue) {
  if (issues.length >= MAX_ISSUES) return;
  issues.push(issue);
}

function buildInputGateIssue({
  riskId,
  message,
  sectionId = null,
  path = [],
  details = {},
}) {
  return {
    riskId,
    message,
    sectionId,
    path: path.join('.'),
    ...details,
  };
}

function scanEvidenceInputNode({
  value,
  sectionId,
  path,
  depth,
  issues,
  maximumCollectionItems,
}) {
  if (issues.length >= MAX_ISSUES) return;

  if (!value || typeof value !== 'object') return;

  if (depth > MAX_SCAN_DEPTH) {
    pushIssue(issues, buildInputGateIssue({
      riskId: POLICY_EVIDENCE_INPUT_GATE_RISK_IDS.SCAN_DEPTH_LIMIT,
      message: 'Evidence input scan stopped at the bounded depth limit.',
      sectionId,
      path,
    }));
    return;
  }

  if (Array.isArray(value)) {
    if (!isPlainDataArray(value)) {
      pushIssue(issues, buildInputGateIssue({
        riskId: POLICY_EVIDENCE_INPUT_GATE_RISK_IDS.UNSAFE_OBJECT_SHAPE,
        message: 'Evidence input arrays must use the standard Array prototype with own data entries.',
        sectionId,
        path,
      }));
      return;
    }

    const itemCount = value.length;
    if (itemCount > maximumCollectionItems) {
      pushIssue(issues, buildInputGateIssue({
        riskId: POLICY_EVIDENCE_INPUT_GATE_RISK_IDS.COLLECTION_LIMIT_EXCEEDED,
        message: 'Evidence input collection exceeds the bounded item limit.',
        sectionId,
        path,
        details: {
          itemCount,
          maximumItemCount: maximumCollectionItems,
        },
      }));
    }

    const inspectedItemCount = Math.min(itemCount, maximumCollectionItems);
    for (let index = 0; index < inspectedItemCount; index += 1) {
      const itemPath = [...path, String(index)];
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));

      if (!descriptor || !Object.prototype.hasOwnProperty.call(descriptor, 'value')) {
        pushIssue(issues, buildInputGateIssue({
          riskId: POLICY_EVIDENCE_INPUT_GATE_RISK_IDS.UNSAFE_OBJECT_SHAPE,
          message: 'Evidence input arrays must contain own data entries without accessors or gaps.',
          sectionId,
          path: itemPath,
        }));
        continue;
      }

      scanEvidenceInputNode({
        value: descriptor.value,
        sectionId,
        path: itemPath,
        depth: depth + 1,
        issues,
        maximumCollectionItems,
      });
    }
    return;
  }

  if (!isPlainDataRecord(value)) {
    pushIssue(issues, buildInputGateIssue({
      riskId: POLICY_EVIDENCE_INPUT_GATE_RISK_IDS.UNSAFE_OBJECT_SHAPE,
      message: 'Evidence inputs must use plain data objects without inherited or accessor-backed properties.',
      sectionId,
      path,
    }));
    return;
  }

  getOwnDataEntries(value).forEach(({ key, descriptor }) => {
    const childPath = [...path, key];
    const rule = PROHIBITED_KEYS_BY_NAME.get(key.toLowerCase());

    if (rule) {
      pushIssue(issues, buildInputGateIssue({
        riskId: rule.riskId,
        message: rule.message,
        sectionId,
        path: childPath,
      }));
    }

    if (!descriptor || !Object.prototype.hasOwnProperty.call(descriptor, 'value')) {
      pushIssue(issues, buildInputGateIssue({
        riskId: POLICY_EVIDENCE_INPUT_GATE_RISK_IDS.UNSAFE_OBJECT_SHAPE,
        message: 'Evidence inputs must use plain data objects without inherited or accessor-backed properties.',
        sectionId,
        path: childPath,
      }));
      return;
    }

    scanEvidenceInputNode({
      value: descriptor.value,
      sectionId,
      path: childPath,
      depth: depth + 1,
      issues,
      maximumCollectionItems,
    });
  });
}

function buildPolicyEvidenceInputGate({
  evidenceInput = {},
  maximumCollectionItems = MAX_POLICY_EVIDENCE_INPUT_COLLECTION_ITEMS,
} = {}) {
  const issues = [];
  const presentSections = [];
  const boundedMaximumCollectionItems = normalizeMaximumCollectionItems(maximumCollectionItems);

  if (!isPlainDataRecord(evidenceInput)) {
    pushIssue(issues, buildInputGateIssue({
      riskId: POLICY_EVIDENCE_INPUT_GATE_RISK_IDS.UNSAFE_OBJECT_SHAPE,
      message: 'Policy evidence input must be a plain data record without inherited or accessor-backed properties.',
    }));
  }

  const input = asPlainObject(evidenceInput);

  getOwnDataEntries(input).forEach(({ key: sectionId, descriptor }) => {
    if (!KNOWN_SECTION_IDS.has(sectionId)) {
      pushIssue(issues, buildInputGateIssue({
        riskId: POLICY_EVIDENCE_INPUT_GATE_RISK_IDS.UNKNOWN_SECTION,
        message: `Evidence input section "${sectionId}" is not part of the policy evidence input envelope.`,
        sectionId,
        path: [sectionId],
      }));
      return;
    }

    if (!descriptor || !Object.prototype.hasOwnProperty.call(descriptor, 'value')) {
      pushIssue(issues, buildInputGateIssue({
        riskId: POLICY_EVIDENCE_INPUT_GATE_RISK_IDS.UNSAFE_OBJECT_SHAPE,
        message: 'Policy evidence input sections must use own data properties.',
        sectionId,
        path: [sectionId],
      }));
      return;
    }

    presentSections.push(sectionId);
    scanEvidenceInputNode({
      value: descriptor.value,
      sectionId,
      path: [sectionId],
      depth: 0,
      issues,
      maximumCollectionItems: boundedMaximumCollectionItems,
    });
  });

  const collectionLimitCount = issues.filter(issue =>
    issue.riskId === POLICY_EVIDENCE_INPUT_GATE_RISK_IDS.COLLECTION_LIMIT_EXCEEDED
  ).length;

  return {
    version: POLICY_EVIDENCE_INPUT_GATE_VERSION,
    ok: issues.length === 0,
    issueCount: issues.length,
    presentSections,
    maximumCollectionItems: boundedMaximumCollectionItems,
    collectionLimitCount,
    maxIssueCount: MAX_ISSUES,
    sideEffects: {
      liveProviderLookupPerformed: false,
      providerQuotaRead: false,
      evidenceProjectionBuilt: false,
      policyStorageMutated: false,
    },
    issues,
  };
}

function validatePolicyEvidenceInputSection(section = {}) {
  const issues = [];
  const source = getPolicyEvidenceSource(section.sourceId);

  if (!section.sourceId) {
    pushIssue(issues, buildInputGateIssue({
      riskId: POLICY_EVIDENCE_INPUT_GATE_RISK_IDS.MISSING_SECTION_SOURCE,
      message: 'Evidence input section must declare an evidence source.',
      sectionId: section.id || null,
      path: [section.id || 'unknown', 'sourceId'],
    }));
  } else if (!source) {
    pushIssue(issues, buildInputGateIssue({
      riskId: POLICY_EVIDENCE_INPUT_GATE_RISK_IDS.UNKNOWN_SECTION_SOURCE,
      message: `Evidence input section references unknown source "${section.sourceId}".`,
      sectionId: section.id || null,
      path: [section.id || 'unknown', 'sourceId'],
    }));
  }

  if (!section.authoritySourceId) {
    pushIssue(issues, buildInputGateIssue({
      riskId: POLICY_EVIDENCE_INPUT_GATE_RISK_IDS.MISSING_SECTION_AUTHORITY,
      message: 'Evidence input section must declare an authority source.',
      sectionId: section.id || null,
      path: [section.id || 'unknown', 'authoritySourceId'],
    }));
  } else if (!getPolicyAuthoritySource(section.authoritySourceId)) {
    pushIssue(issues, buildInputGateIssue({
      riskId: POLICY_EVIDENCE_INPUT_GATE_RISK_IDS.UNKNOWN_SECTION_AUTHORITY,
      message: `Evidence input section references unknown authority source "${section.authoritySourceId}".`,
      sectionId: section.id || null,
      path: [section.id || 'unknown', 'authoritySourceId'],
    }));
  } else if (source && !source.authoritySourceIds.includes(section.authoritySourceId)) {
    pushIssue(issues, buildInputGateIssue({
      riskId: POLICY_EVIDENCE_INPUT_GATE_RISK_IDS.SECTION_AUTHORITY_NOT_ALLOWED_FOR_SOURCE,
      message: `Evidence source "${section.sourceId}" cannot use authority source "${section.authoritySourceId}".`,
      sectionId: section.id || null,
      path: [section.id || 'unknown', 'authoritySourceId'],
    }));
  }

  return {
    ok: issues.length === 0,
    sectionId: section.id || null,
    issues,
  };
}

function buildPolicyEvidenceInputGateAudit({
  sections = POLICY_EVIDENCE_INPUT_SECTIONS,
} = {}) {
  const sectionResults = sections.map(validatePolicyEvidenceInputSection);
  const issueCount = sectionResults.reduce((count, result) => count + result.issues.length, 0);

  return {
    ok: issueCount === 0,
    issueCount,
    checkedSectionCount: sectionResults.length,
    sectionResults,
    nextStep: {
      stepId: 'intent_inference',
      label: 'Intent Inference',
      reason: 'Evidence inputs are now gated before projection, so intent inference can consume bounded evidence contracts.',
    },
  };
}

export {
  POLICY_EVIDENCE_INPUT_GATE_RISK_IDS,
  POLICY_EVIDENCE_SOURCE_IDS,
  POLICY_EVIDENCE_INPUT_GATE_VERSION,
  POLICY_EVIDENCE_INPUT_SECTION_IDS,
  buildPolicyEvidenceInputGate,
  buildPolicyEvidenceInputGateAudit,
  getPolicyEvidenceInputSection,
  listPolicyEvidenceInputSections,
  validatePolicyEvidenceInputSection,
};
