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
  isPolicyCompatibilityDeletionNamedTestScopeEntry,
  normalizePolicyCompatibilityDeletionExecutionManifestEntry,
  validatePolicyCompatibilityDeletionExecutionManifestEntry,
} from './policyCompatibilityDeletionExecutionManifestEntry.mjs';
import {
  buildPolicyCompatibilityDeletionPreflightManifestObservationIdentity,
  isPolicyCompatibilityDeletionPreflightManifestObservationIdentity,
} from './policyCompatibilityDeletionPreflightManifestObservationIdentity.mjs';
import {
  hasMeaningfulReplacementEvidence,
} from './policyControlledCompatibilityPathRemovalSelection.mjs';
import {
  asArray,
  asObject,
  buildRisk,
  POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_ADAPTER_RISK_IDS,
} from './policyControlledCompatibilityNamedScopeRemovalAdapterShared.mjs';

function evaluatePolicyControlledCompatibilityNamedScopeRemovalSelection({
  executionGate,
  selectedEntryIdentity,
} = {}) {
  const gate = asObject(executionGate);
  const requestedIdentity = typeof selectedEntryIdentity === 'string'
    ? selectedEntryIdentity.trim()
    : '';
  const manifestEntries = asArray(gate.executionPlanArtifact?.executionPlan?.manifest?.entries);
  const risks = [];

  if (!requestedIdentity) {
    risks.push(buildRisk(
      POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_ADAPTER_RISK_IDS
        .SELECTED_ENTRY_IDENTITY_MISSING,
      'Scope-aware removal requires an exact selected named-scope observation identity.'
    ));
  } else if (!isPolicyCompatibilityDeletionPreflightManifestObservationIdentity(requestedIdentity) ||
    !requestedIdentity.startsWith('named_test_scope:')) {
    risks.push(buildRisk(
      POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_ADAPTER_RISK_IDS
        .SELECTED_ENTRY_IDENTITY_INVALID,
      'Scope-aware removal accepts only a server-derived named-test-scope observation identity.'
    ));
  }

  const matches = manifestEntries.filter(entry => (
    isPolicyCompatibilityDeletionNamedTestScopeEntry(entry) &&
    buildPolicyCompatibilityDeletionPreflightManifestObservationIdentity(entry) === requestedIdentity
  ));

  if (requestedIdentity && matches.length === 0) {
    risks.push(buildRisk(
      POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_ADAPTER_RISK_IDS
        .SELECTED_ENTRY_IDENTITY_MISSING,
      'The selected named-scope identity is not present in the approved execution manifest.',
      { entryIdentity: requestedIdentity }
    ));
  }
  if (matches.length > 1) {
    risks.push(buildRisk(
      POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_ADAPTER_RISK_IDS
        .SELECTED_ENTRY_IDENTITY_AMBIGUOUS,
      'The approved execution manifest contains duplicate selected named-scope identities.',
      { entryIdentity: requestedIdentity || null, matchCount: matches.length }
    ));
  }

  const entry = matches.length === 1 ? matches[0] : null;
  const normalizedEntry = normalizePolicyCompatibilityDeletionExecutionManifestEntry(entry || {});
  const entryValidation = validatePolicyCompatibilityDeletionExecutionManifestEntry(entry || {});

  if (entry && entryValidation.ok !== true) {
    risks.push(buildRisk(
      POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_ADAPTER_RISK_IDS
        .SELECTED_ENTRY_VALIDATION_FAILED,
      'Scope-aware removal requires a valid exact named-scope manifest entry.',
      { issueCount: entryValidation.issueCount }
    ));
  }
  if (entry && entry.ready !== true) {
    risks.push(buildRisk(
      POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_ADAPTER_RISK_IDS.SELECTED_ENTRY_NOT_READY,
      'Scope-aware removal requires the selected manifest entry to be marked ready.',
      { entryIdentity: requestedIdentity }
    ));
  }
  if (entry && !hasMeaningfulReplacementEvidence(entry.replacementEvidence)) {
    risks.push(buildRisk(
      POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_ADAPTER_RISK_IDS
        .SELECTED_ENTRY_REPLACEMENT_EVIDENCE_INVALID,
      'Scope-aware removal requires meaningful replacement evidence for the selected named scope.',
      { entryIdentity: requestedIdentity }
    ));
  }

  const preflightMatches = asArray(gate.preflightEvidenceArtifact?.manifest?.entries)
    .filter(observation => observation?.entryIdentity === requestedIdentity);

  if (requestedIdentity && preflightMatches.length === 0) {
    risks.push(buildRisk(
      POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_ADAPTER_RISK_IDS
        .PREFLIGHT_ENTRY_IDENTITY_MISSING,
      'Scope-aware removal requires an exact observed preflight record for the selected named scope.',
      { entryIdentity: requestedIdentity }
    ));
  }
  if (preflightMatches.length > 1) {
    risks.push(buildRisk(
      POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_ADAPTER_RISK_IDS
        .PREFLIGHT_ENTRY_IDENTITY_AMBIGUOUS,
      'Scope-aware removal refuses duplicate preflight observations for one selected named scope.',
      { entryIdentity: requestedIdentity || null, matchCount: preflightMatches.length }
    ));
  }
  if (preflightMatches.length === 1 && preflightMatches[0].statusId !== 'observed') {
    risks.push(buildRisk(
      POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_ADAPTER_RISK_IDS
        .PREFLIGHT_ENTRY_NOT_OBSERVED,
      'Scope-aware removal requires the selected named scope to be observed by current preflight evidence.',
      { entryIdentity: requestedIdentity, statusId: preflightMatches[0].statusId || null }
    ));
  }

  return {
    entry,
    entryValidation,
    normalizedEntry,
    preflightObservation: preflightMatches.length === 1 ? preflightMatches[0] : null,
    requestedIdentity: requestedIdentity || null,
    risks,
  };
}

export {
  evaluatePolicyControlledCompatibilityNamedScopeRemovalSelection,
};
