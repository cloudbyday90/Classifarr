/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import {
  buildPolicyIntentDraftFromEvidenceProjection,
} from './policyIntentEngine.mjs';
import {
  loadPolicyLibraryProfileEvidence,
} from './policyLibraryProfileEvidenceLoader.mjs';
import {
  buildPolicyOperatorWorkflow,
  buildPolicyOperatorWorkflowAudit,
} from './policyOperatorWorkflow.mjs';
import {
  buildPolicyAutomationReadinessFromContracts,
} from './policyAutomationReadinessEngine.mjs';
import {
  buildPolicyObservedSuggestionProjection,
} from './policyObservedSuggestionCandidates.mjs';
import {
  buildPolicyIntentSignalOptionProjection,
  buildPolicyIntentSignalOptionProjectionAudit,
} from './policyIntentSignalOptionProjection.mjs';
import {
  buildPolicyOperatorWorkflowEmptyStateAudit,
  buildPolicyOperatorWorkflowEmptyStateProjection,
} from './policyOperatorWorkflowEmptyState.mjs';
import {
  buildPolicyConstraintDecisionModelAudit,
  policyConstraintDecisionModel,
} from './policyConstraintDecisionModel.mjs';
import {
  buildPolicyConstraintValueEligibility,
  buildPolicyConstraintValueEligibilityAudit,
} from './policyConstraintValueEligibility.mjs';
import {
  buildPolicyOperatorWorkflowReadinessPresentation,
  buildPolicyOperatorWorkflowReadinessPresentationAudit,
} from './policyOperatorWorkflowReadinessPresentation.mjs';
import {
  buildPolicyAuthoringWorkflowPresentation,
  buildPolicyAuthoringWorkflowPresentationAudit,
} from './policyAuthoringWorkflowPresentation.mjs';
import {
  buildPolicyMaterialExceptionPresentation,
  validatePolicyMaterialExceptionPresentation,
} from './policyMaterialExceptionPresentation.mjs';

const POLICY_OPERATOR_WORKFLOW_READ_VERSION = 'policy.operator_workflow_read.v4';
const MAX_LABEL_LENGTH = 160;

const POLICY_OPERATOR_WORKFLOW_READ_STATUS_IDS = Object.freeze({
  READY: 'ready',
  PROFILE_NEEDS_REFRESH: 'profile_needs_refresh',
  PROFILE_UNAVAILABLE: 'profile_unavailable',
  INVALID_LIBRARY: 'invalid_library',
});

const POLICY_OPERATOR_WORKFLOW_READ_AUDIT_RISK_IDS = Object.freeze({
  INVALID_VERSION: 'invalid_version',
  INVALID_LIBRARY: 'invalid_library',
  INVALID_WORKFLOW: 'invalid_workflow',
  OBSERVED_VALUE_AUTO_DECLARED: 'observed_value_auto_declared',
  UNSAFE_SIDE_EFFECT: 'unsafe_side_effect',
  RAW_PAYLOAD_EXPOSED: 'raw_payload_exposed',
  INVALID_EMPTY_STATE_PROJECTION: 'invalid_empty_state_projection',
  INVALID_INTENT_SIGNAL_OPTION_PROJECTION: 'invalid_intent_signal_option_projection',
  INVALID_CONSTRAINT_DECISION_MODEL: 'invalid_constraint_decision_model',
  INVALID_CONSTRAINT_VALUE_ELIGIBILITY: 'invalid_constraint_value_eligibility',
  INVALID_READINESS_PRESENTATION: 'invalid_readiness_presentation',
  INVALID_PRESENTATION: 'invalid_presentation',
  INVALID_MATERIAL_EXCEPTION_PRESENTATION: 'invalid_material_exception_presentation',
});

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeString(value, maximumLength = MAX_LABEL_LENGTH) {
  if (typeof value !== 'string' && typeof value !== 'number') return '';

  return String(value)
    .normalize('NFKC')
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maximumLength);
}

function normalizeLibrary(library = {}) {
  const source = asObject(library);
  const libraryId = Number(source.id ?? source.libraryId);

  return {
    id: Number.isInteger(libraryId) && libraryId > 0 ? libraryId : null,
    name: normalizeString(source.name ?? source.libraryName),
    mediaType: normalizeString(source.media_type ?? source.mediaType),
  };
}

function normalizeRouting(routing = {}) {
  const source = asObject(routing);
  const targetName = normalizeString(
    source.targetName ?? source.target_name ?? source.arrType ?? source.arr_type
  );
  const configured = source.configured === true;
  const routeReady = source.routeReady === true;

  return {
    configured,
    routeReady,
    targetName: targetName || null,
  };
}

function buildProfileState(profileHandoff = {}) {
  if (profileHandoff?.ok !== true) {
    return {
      statusId: POLICY_OPERATOR_WORKFLOW_READ_STATUS_IDS.PROFILE_UNAVAILABLE,
      available: false,
      current: false,
    };
  }

  const stale = profileHandoff.profileFreshness?.stale === true;

  return {
    statusId: stale
      ? POLICY_OPERATOR_WORKFLOW_READ_STATUS_IDS.PROFILE_NEEDS_REFRESH
      : POLICY_OPERATOR_WORKFLOW_READ_STATUS_IDS.READY,
    available: true,
    current: !stale,
  };
}

function buildWorkflow({ profileHandoff, routing }) {
  const evidenceProjection = profileHandoff?.evidenceBoundary?.projection;
  const intentDraft = evidenceProjection?.version === 'policy.evidence.v1'
    ? buildPolicyIntentDraftFromEvidenceProjection(evidenceProjection)
    : undefined;
  const readiness = buildPolicyAutomationReadinessFromContracts({
    ...(evidenceProjection ? { evidenceProjection } : {}),
    ...(intentDraft ? { intentDraft } : {}),
    routing,
    profileFreshness: profileHandoff?.profileFreshness,
  });

  return {
    readiness,
    workflow: buildPolicyOperatorWorkflow({
      ...(evidenceProjection ? { evidenceProjection } : {}),
      ...(intentDraft ? { intentDraft } : {}),
      readiness,
      routing,
      profileFreshness: profileHandoff?.profileFreshness,
    }),
  };
}

function buildSideEffects(profileHandoff = {}) {
  return {
    cachedProfileRead: profileHandoff?.sideEffects?.libraryProfileRead === true,
    liveMediaServerLookupPerformed: false,
    liveProviderLookupPerformed: false,
    providerQuotaRead: false,
    policyStorageMutated: false,
    routingExecuted: false,
  };
}

function buildReadResult({
  library,
  profileHandoff,
  routing,
  statusId,
  intentSignalSources,
} = {}) {
  const { workflow, readiness } = buildWorkflow({ profileHandoff, routing });
  const observedSuggestionProjection = buildPolicyObservedSuggestionProjection(profileHandoff);
  const intentSignalProjection = buildPolicyIntentSignalOptionProjection({
    observedProjection: observedSuggestionProjection,
    starterTemplateSuggestions: asArray(intentSignalSources?.starterTemplateSuggestions),
    commonOptions: asArray(intentSignalSources?.commonOptions),
    customValueCandidates: asArray(intentSignalSources?.customValueCandidates),
    declaredSignals: asArray(intentSignalSources?.declaredSignals),
    conflictingSignals: asArray(intentSignalSources?.conflictingSignals),
  });
  const observedProfile = {
    ...buildProfileState(profileHandoff),
    itemCount: Number.isInteger(Number(profileHandoff?.profileEvidence?.summary?.itemCount))
      ? Number(profileHandoff.profileEvidence.summary.itemCount)
      : null,
    suggestionCount: intentSignalProjection.observedEvidence.length,
    suggestions: intentSignalProjection.observedEvidence,
    intentSignalProjection,
  };
  const emptyStateProjection = buildPolicyOperatorWorkflowEmptyStateProjection({
    library,
    profileHandoff,
    observedProfile,
    routing,
  });
  const readinessPresentation = buildPolicyOperatorWorkflowReadinessPresentation({
    readiness,
    observedProfile,
    intentSignalProjection,
    emptyStateProjection,
  });
  const presentation = buildPolicyAuthoringWorkflowPresentation({
    library,
    statusId,
    observedProfile,
    workflow,
    readinessPresentation,
  });
  const materialExceptionPresentation = buildPolicyMaterialExceptionPresentation({
    readinessState: readiness,
    constraintDecisionModel: policyConstraintDecisionModel,
    routingAvailable: routing?.configured === true && routing?.routeReady === true,
  });

  return {
    version: POLICY_OPERATOR_WORKFLOW_READ_VERSION,
    statusId,
    library,
    observedProfile,
    emptyStateProjection,
    constraintDecisionModel: policyConstraintDecisionModel,
    constraintValueEligibility: buildPolicyConstraintValueEligibility({ library }),
    workflow,
    readinessPresentation,
    presentation,
    materialExceptionPresentation,
    authority: {
      displayProjection: true,
      automationDecision: false,
      policyPersistence: false,
      routingExecution: false,
    },
    sideEffects: buildSideEffects(profileHandoff),
    rawPayloadExposed: false,
  };
}

function buildPolicyOperatorWorkflowReadAudit(result = {}) {
  const source = asObject(result);
  const issues = [];
  const library = normalizeLibrary(source.library);
  const observedSuggestions = asArray(source.observedProfile?.suggestions);
  const intentSignalProjectionAudit = buildPolicyIntentSignalOptionProjectionAudit(
    source.observedProfile?.intentSignalProjection,
  );
  const sideEffects = asObject(source.sideEffects);
  const workflowAudit = buildPolicyOperatorWorkflowAudit(source.workflow);
  const emptyStateAudit = buildPolicyOperatorWorkflowEmptyStateAudit(source.emptyStateProjection);
  const constraintDecisionModelAudit = buildPolicyConstraintDecisionModelAudit(
    source.constraintDecisionModel,
  );
  const constraintValueEligibilityAudit = buildPolicyConstraintValueEligibilityAudit(
    source.constraintValueEligibility,
    { library },
  );
  const readinessPresentationAudit = buildPolicyOperatorWorkflowReadinessPresentationAudit({
    presentation: source.readinessPresentation,
    readiness: source.workflow?.readiness,
    observedProfile: source.observedProfile,
    intentSignalProjection: source.observedProfile?.intentSignalProjection,
    emptyStateProjection: source.emptyStateProjection,
  });
  const presentationAudit = buildPolicyAuthoringWorkflowPresentationAudit({
    presentation: source.presentation,
    library: source.library,
    statusId: source.statusId,
    observedProfile: source.observedProfile,
    workflow: source.workflow,
    readinessPresentation: source.readinessPresentation,
  });

  if (source.version !== POLICY_OPERATOR_WORKFLOW_READ_VERSION) {
    issues.push({
      riskId: POLICY_OPERATOR_WORKFLOW_READ_AUDIT_RISK_IDS.INVALID_VERSION,
      message: 'Operator workflow reads must use the current read-contract version.',
    });
  }

  if (library.id === null || !library.name) {
    issues.push({
      riskId: POLICY_OPERATOR_WORKFLOW_READ_AUDIT_RISK_IDS.INVALID_LIBRARY,
      message: 'Operator workflow reads require a valid connected library.',
    });
  }

  if (!workflowAudit.ok) {
    issues.push({
      riskId: POLICY_OPERATOR_WORKFLOW_READ_AUDIT_RISK_IDS.INVALID_WORKFLOW,
      message: 'Operator workflow reads require a valid server-owned workflow projection.',
    });
  }

  if (!emptyStateAudit.ok) {
    issues.push({
      riskId: POLICY_OPERATOR_WORKFLOW_READ_AUDIT_RISK_IDS.INVALID_EMPTY_STATE_PROJECTION,
      message: 'Operator workflow reads require valid bounded empty-state actions.',
    });
  }

  if (observedSuggestions.some(suggestion => suggestion?.requiresExplicitAcceptance !== true)) {
    issues.push({
      riskId: POLICY_OPERATOR_WORKFLOW_READ_AUDIT_RISK_IDS.OBSERVED_VALUE_AUTO_DECLARED,
      message: 'Observed library values must remain suggestions until explicitly accepted.',
    });
  }

  if (!intentSignalProjectionAudit.ok) {
    issues.push({
      riskId: POLICY_OPERATOR_WORKFLOW_READ_AUDIT_RISK_IDS.INVALID_INTENT_SIGNAL_OPTION_PROJECTION,
      message: 'Intent-signal options must remain bounded, source-owned, and explicitly accepted.',
    });
  }

  if (!constraintDecisionModelAudit.ok) {
    issues.push({
      riskId: POLICY_OPERATOR_WORKFLOW_READ_AUDIT_RISK_IDS.INVALID_CONSTRAINT_DECISION_MODEL,
      message: 'Constraint decisions must remain a valid server-owned display projection.',
    });
  }

  if (!constraintValueEligibilityAudit.ok) {
    issues.push({
      riskId: POLICY_OPERATOR_WORKFLOW_READ_AUDIT_RISK_IDS.INVALID_CONSTRAINT_VALUE_ELIGIBILITY,
      message: 'Constraint values must remain a valid server-owned eligibility projection.',
    });
  }

  if (!readinessPresentationAudit.ok) {
    issues.push({
      riskId: POLICY_OPERATOR_WORKFLOW_READ_AUDIT_RISK_IDS.INVALID_READINESS_PRESENTATION,
      message: 'Operator workflow reads require an owned action or truthful automated guidance for every readiness state.',
    });
  }

  if (!presentationAudit.ok) {
    issues.push({
      riskId: POLICY_OPERATOR_WORKFLOW_READ_AUDIT_RISK_IDS.INVALID_PRESENTATION,
      message: 'Operator workflow reads require a valid page-level presentation projection.',
    });
  }

  const materialExceptionValidation = validatePolicyMaterialExceptionPresentation(
    source.materialExceptionPresentation,
    {
      readinessStateId: source.workflow?.readiness?.stateId,
      hasMaterialException: source.materialExceptionPresentation?.hasMaterialException,
    },
  );
  if (!materialExceptionValidation.ok) {
    issues.push({
      riskId: POLICY_OPERATOR_WORKFLOW_READ_AUDIT_RISK_IDS.INVALID_MATERIAL_EXCEPTION_PRESENTATION,
      message: 'Operator workflow reads require a valid material exception presentation projection.',
    });
  }

  if (
    sideEffects.liveMediaServerLookupPerformed !== false ||
    sideEffects.liveProviderLookupPerformed !== false ||
    sideEffects.providerQuotaRead !== false ||
    sideEffects.policyStorageMutated !== false ||
    sideEffects.routingExecuted !== false
  ) {
    issues.push({
      riskId: POLICY_OPERATOR_WORKFLOW_READ_AUDIT_RISK_IDS.UNSAFE_SIDE_EFFECT,
      message: 'Operator workflow reads must remain side-effect-free apart from a cached-profile read.',
    });
  }

  if (source.rawPayloadExposed !== false) {
    issues.push({
      riskId: POLICY_OPERATOR_WORKFLOW_READ_AUDIT_RISK_IDS.RAW_PAYLOAD_EXPOSED,
      message: 'Operator workflow reads must not expose raw media or provider payloads.',
    });
  }

  const authority = asObject(source.authority);
  if (
    authority.displayProjection !== true ||
    authority.automationDecision !== false ||
    authority.policyPersistence !== false ||
    authority.routingExecution !== false
  ) {
    issues.push({
      riskId: POLICY_OPERATOR_WORKFLOW_READ_AUDIT_RISK_IDS.UNSAFE_SIDE_EFFECT,
      message: 'Operator workflow reads are display-only and cannot authorize automation, writes, or routing.',
    });
  }

  return {
    ok: issues.length === 0,
    issueCount: issues.length,
    issues,
  };
}

function createPolicyOperatorWorkflowReadService({
  loadProfileEvidence = loadPolicyLibraryProfileEvidence,
} = {}) {
  async function getWorkflow({ library, routing = {}, intentSignalSources = {} } = {}) {
    const normalizedLibrary = normalizeLibrary(library);
    if (normalizedLibrary.id === null || !normalizedLibrary.name) {
      return buildReadResult({
        library: normalizedLibrary,
        profileHandoff: null,
        routing: normalizeRouting(routing),
        statusId: POLICY_OPERATOR_WORKFLOW_READ_STATUS_IDS.INVALID_LIBRARY,
        intentSignalSources,
      });
    }

    let profileHandoff = null;
    try {
      profileHandoff = await loadProfileEvidence({ libraryId: normalizedLibrary.id });
    } catch {
      profileHandoff = null;
    }

    const profileState = buildProfileState(profileHandoff);
    return buildReadResult({
      library: normalizedLibrary,
      profileHandoff,
      routing: normalizeRouting(routing),
      statusId: profileState.statusId,
      intentSignalSources,
    });
  }

  return {
    getWorkflow,
  };
}

const policyOperatorWorkflowReadService = createPolicyOperatorWorkflowReadService();

export {
  POLICY_OPERATOR_WORKFLOW_READ_AUDIT_RISK_IDS,
  POLICY_OPERATOR_WORKFLOW_READ_STATUS_IDS,
  POLICY_OPERATOR_WORKFLOW_READ_VERSION,
  buildPolicyOperatorWorkflowReadAudit,
  createPolicyOperatorWorkflowReadService,
  policyOperatorWorkflowReadService,
};
