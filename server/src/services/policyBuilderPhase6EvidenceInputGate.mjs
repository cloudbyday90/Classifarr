import {
  AUTHORITY_SOURCE_IDS,
  getPolicyAuthoritySource,
} from './policyAuthorityVocabulary.mjs';
import {
  PHASE6R_EVIDENCE_SOURCE_IDS,
  getPolicyBuilderPhase6EvidenceSource,
} from './policyBuilderPhase6EvidenceEngine.mjs';

const PHASE6R_EVIDENCE_INPUT_GATE_VERSION = 'phase6r.evidence_input_gate.v1';

const PHASE6R_EVIDENCE_INPUT_SECTION_IDS = Object.freeze({
  LIBRARY_PROFILE: 'libraryProfile',
  OPERATOR_INTENT: 'operatorIntent',
  CLASSIFICATION_OUTCOMES: 'classificationOutcomes',
  MANUAL_CORRECTIONS: 'manualCorrections',
  PENDING_ITEM_ANSWERS: 'pendingItemAnswers',
  ARR_ROUTING_OUTCOMES: 'arrRoutingOutcomes',
  METADATA_EVIDENCE: 'metadataEvidence',
  PROFILE_FRESHNESS: 'profileFreshness',
});

const PHASE6R_EVIDENCE_INPUT_GATE_RISK_IDS = Object.freeze({
  UNKNOWN_SECTION: 'unknown_section',
  MISSING_SECTION_SOURCE: 'missing_section_source',
  UNKNOWN_SECTION_SOURCE: 'unknown_section_source',
  MISSING_SECTION_AUTHORITY: 'missing_section_authority',
  UNKNOWN_SECTION_AUTHORITY: 'unknown_section_authority',
  RAW_PROVIDER_PAYLOAD: 'raw_provider_payload',
  LIVE_PROVIDER_LOOKUP: 'live_provider_lookup',
  TRANSIENT_PROVIDER_STATE: 'transient_provider_state',
  UI_DIAGNOSTIC_LANGUAGE: 'ui_diagnostic_language',
  REPLAY_OR_IMPACT_PAYLOAD: 'replay_or_impact_payload',
  SCAN_DEPTH_LIMIT: 'scan_depth_limit',
});

const MAX_SCAN_DEPTH = 8;
const MAX_ISSUES = 50;

const PHASE6R_EVIDENCE_INPUT_SECTIONS = Object.freeze([
  {
    id: PHASE6R_EVIDENCE_INPUT_SECTION_IDS.LIBRARY_PROFILE,
    label: 'Library profile',
    sourceId: PHASE6R_EVIDENCE_SOURCE_IDS.MEDIA_SERVER_LIBRARY_PROFILE,
    authoritySourceId: AUTHORITY_SOURCE_IDS.MEDIA_SERVER_CONTENTS,
  },
  {
    id: PHASE6R_EVIDENCE_INPUT_SECTION_IDS.OPERATOR_INTENT,
    label: 'Operator intent',
    sourceId: PHASE6R_EVIDENCE_SOURCE_IDS.OPERATOR_DECLARED_INTENT,
    authoritySourceId: AUTHORITY_SOURCE_IDS.OPERATOR_DECLARED_INTENT,
  },
  {
    id: PHASE6R_EVIDENCE_INPUT_SECTION_IDS.CLASSIFICATION_OUTCOMES,
    label: 'Classification outcomes',
    sourceId: PHASE6R_EVIDENCE_SOURCE_IDS.CLASSIFICATION_FINAL_OUTCOMES,
    authoritySourceId: AUTHORITY_SOURCE_IDS.MANUAL_OUTCOME,
  },
  {
    id: PHASE6R_EVIDENCE_INPUT_SECTION_IDS.MANUAL_CORRECTIONS,
    label: 'Manual corrections',
    sourceId: PHASE6R_EVIDENCE_SOURCE_IDS.MANUAL_CORRECTIONS,
    authoritySourceId: AUTHORITY_SOURCE_IDS.MANUAL_OUTCOME,
  },
  {
    id: PHASE6R_EVIDENCE_INPUT_SECTION_IDS.PENDING_ITEM_ANSWERS,
    label: 'Pending-item answers',
    sourceId: PHASE6R_EVIDENCE_SOURCE_IDS.PENDING_ITEM_ANSWERS,
    authoritySourceId: AUTHORITY_SOURCE_IDS.MANUAL_OUTCOME,
  },
  {
    id: PHASE6R_EVIDENCE_INPUT_SECTION_IDS.ARR_ROUTING_OUTCOMES,
    label: 'Arr routing outcomes',
    sourceId: PHASE6R_EVIDENCE_SOURCE_IDS.ARR_ROUTING_OUTCOMES,
    authoritySourceId: AUTHORITY_SOURCE_IDS.MANUAL_OUTCOME,
  },
  {
    id: PHASE6R_EVIDENCE_INPUT_SECTION_IDS.METADATA_EVIDENCE,
    label: 'Metadata evidence',
    sourceId: PHASE6R_EVIDENCE_SOURCE_IDS.METADATA_ENRICHMENT,
    authoritySourceId: AUTHORITY_SOURCE_IDS.METADATA_PROVIDER,
  },
  {
    id: PHASE6R_EVIDENCE_INPUT_SECTION_IDS.PROFILE_FRESHNESS,
    label: 'Profile freshness',
    sourceId: PHASE6R_EVIDENCE_SOURCE_IDS.PROFILE_FRESHNESS,
    authoritySourceId: AUTHORITY_SOURCE_IDS.MEDIA_SERVER_CONTENTS,
  },
]);

const PROHIBITED_KEY_RULES = Object.freeze([
  {
    riskId: PHASE6R_EVIDENCE_INPUT_GATE_RISK_IDS.RAW_PROVIDER_PAYLOAD,
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
    riskId: PHASE6R_EVIDENCE_INPUT_GATE_RISK_IDS.LIVE_PROVIDER_LOOKUP,
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
    riskId: PHASE6R_EVIDENCE_INPUT_GATE_RISK_IDS.TRANSIENT_PROVIDER_STATE,
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
    riskId: PHASE6R_EVIDENCE_INPUT_GATE_RISK_IDS.UI_DIAGNOSTIC_LANGUAGE,
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
    riskId: PHASE6R_EVIDENCE_INPUT_GATE_RISK_IDS.REPLAY_OR_IMPACT_PAYLOAD,
    keys: Object.freeze([
      'impactPayload',
      'impactPreview',
      'replayPayload',
      'replayPreview',
      'sampleDiagnostics',
    ]),
    message: 'Evidence inputs must not carry replay or impact preview payloads into normal engine flow.',
  },
]);

const KNOWN_SECTION_IDS = new Set(PHASE6R_EVIDENCE_INPUT_SECTIONS.map(section => section.id));
const PROHIBITED_KEYS_BY_NAME = new Map(
  PROHIBITED_KEY_RULES.flatMap(rule =>
    rule.keys.map(key => [key.toLowerCase(), rule])
  )
);

function asPlainObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function listPolicyBuilderPhase6EvidenceInputSections() {
  return PHASE6R_EVIDENCE_INPUT_SECTIONS;
}

function getPolicyBuilderPhase6EvidenceInputSection(sectionId) {
  return PHASE6R_EVIDENCE_INPUT_SECTIONS.find(section => section.id === sectionId) || null;
}

function pushIssue(issues, issue) {
  if (issues.length >= MAX_ISSUES) return;
  issues.push(issue);
}

function buildInputGateIssue({ riskId, message, sectionId = null, path = [] }) {
  return {
    riskId,
    message,
    sectionId,
    path: path.join('.'),
  };
}

function scanEvidenceInputNode({ value, sectionId, path, depth, issues }) {
  if (issues.length >= MAX_ISSUES) return;

  if (!value || typeof value !== 'object') return;

  if (depth > MAX_SCAN_DEPTH) {
    pushIssue(issues, buildInputGateIssue({
      riskId: PHASE6R_EVIDENCE_INPUT_GATE_RISK_IDS.SCAN_DEPTH_LIMIT,
      message: 'Evidence input scan stopped at the bounded depth limit.',
      sectionId,
      path,
    }));
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      scanEvidenceInputNode({
        value: item,
        sectionId,
        path: [...path, String(index)],
        depth: depth + 1,
        issues,
      });
    });
    return;
  }

  Object.entries(value).forEach(([key, child]) => {
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

    scanEvidenceInputNode({
      value: child,
      sectionId,
      path: childPath,
      depth: depth + 1,
      issues,
    });
  });
}

function buildPolicyBuilderPhase6EvidenceInputGate({ evidenceInput = {} } = {}) {
  const input = asPlainObject(evidenceInput);
  const issues = [];
  const presentSections = [];

  Object.entries(input).forEach(([sectionId, value]) => {
    if (!KNOWN_SECTION_IDS.has(sectionId)) {
      pushIssue(issues, buildInputGateIssue({
        riskId: PHASE6R_EVIDENCE_INPUT_GATE_RISK_IDS.UNKNOWN_SECTION,
        message: `Evidence input section "${sectionId}" is not part of the Phase 6R input envelope.`,
        sectionId,
        path: [sectionId],
      }));
      return;
    }

    presentSections.push(sectionId);
    scanEvidenceInputNode({
      value,
      sectionId,
      path: [sectionId],
      depth: 0,
      issues,
    });
  });

  return {
    version: PHASE6R_EVIDENCE_INPUT_GATE_VERSION,
    ok: issues.length === 0,
    issueCount: issues.length,
    presentSections,
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

function validatePolicyBuilderPhase6EvidenceInputSection(section = {}) {
  const issues = [];

  if (!section.sourceId) {
    pushIssue(issues, buildInputGateIssue({
      riskId: PHASE6R_EVIDENCE_INPUT_GATE_RISK_IDS.MISSING_SECTION_SOURCE,
      message: 'Evidence input section must declare an evidence source.',
      sectionId: section.id || null,
      path: [section.id || 'unknown', 'sourceId'],
    }));
  } else if (!getPolicyBuilderPhase6EvidenceSource(section.sourceId)) {
    pushIssue(issues, buildInputGateIssue({
      riskId: PHASE6R_EVIDENCE_INPUT_GATE_RISK_IDS.UNKNOWN_SECTION_SOURCE,
      message: `Evidence input section references unknown source "${section.sourceId}".`,
      sectionId: section.id || null,
      path: [section.id || 'unknown', 'sourceId'],
    }));
  }

  if (!section.authoritySourceId) {
    pushIssue(issues, buildInputGateIssue({
      riskId: PHASE6R_EVIDENCE_INPUT_GATE_RISK_IDS.MISSING_SECTION_AUTHORITY,
      message: 'Evidence input section must declare an authority source.',
      sectionId: section.id || null,
      path: [section.id || 'unknown', 'authoritySourceId'],
    }));
  } else if (!getPolicyAuthoritySource(section.authoritySourceId)) {
    pushIssue(issues, buildInputGateIssue({
      riskId: PHASE6R_EVIDENCE_INPUT_GATE_RISK_IDS.UNKNOWN_SECTION_AUTHORITY,
      message: `Evidence input section references unknown authority source "${section.authoritySourceId}".`,
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

function buildPolicyBuilderPhase6EvidenceInputGateAudit({
  sections = PHASE6R_EVIDENCE_INPUT_SECTIONS,
} = {}) {
  const sectionResults = sections.map(validatePolicyBuilderPhase6EvidenceInputSection);
  const issueCount = sectionResults.reduce((count, result) => count + result.issues.length, 0);

  return {
    ok: issueCount === 0,
    issueCount,
    checkedSectionCount: sectionResults.length,
    sectionResults,
    nextPhase: {
      phaseId: '6r_2',
      label: 'Intent Engine',
      reason: 'Evidence inputs are now gated before projection, so intent inference can consume bounded evidence contracts.',
    },
  };
}

export {
  PHASE6R_EVIDENCE_INPUT_GATE_RISK_IDS,
  PHASE6R_EVIDENCE_INPUT_GATE_VERSION,
  PHASE6R_EVIDENCE_INPUT_SECTION_IDS,
  buildPolicyBuilderPhase6EvidenceInputGate,
  buildPolicyBuilderPhase6EvidenceInputGateAudit,
  getPolicyBuilderPhase6EvidenceInputSection,
  listPolicyBuilderPhase6EvidenceInputSections,
  validatePolicyBuilderPhase6EvidenceInputSection,
};
