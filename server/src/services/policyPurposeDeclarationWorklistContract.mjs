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
  buildPolicyNativeIntentPurposeChangeProvenance,
} from './policyNativeIntentPurposeChangeProvenance.mjs';
import {
  buildStoredPurposeChangeCommandSignature,
} from './policyNativeIntentPurposeChangeCommandProjection.mjs';

export const POLICY_PURPOSE_DECLARATION_WORKLIST_VERSION = 1;

export const POLICY_PURPOSE_DECLARATION_WORKLIST_STATUS_IDS = Object.freeze({
  DECLARATION_REVIEW_REQUIRED: 'declaration_review_required',
  NO_DECLARATION_REVIEW_REQUIRED: 'no_declaration_review_required',
});

export const POLICY_PURPOSE_DECLARATION_WORKLIST_ACTION_IDS = Object.freeze({
  REVIEW_AND_DECLARE_PURPOSE: 'review_and_declare_purpose',
});

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function asNonEmptyString(value, fallback) {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function asPositiveInteger(value) {
  const numericValue = Number(value);
  return Number.isInteger(numericValue) && numericValue > 0 ? numericValue : null;
}

function buildWorklistEntry(record = {}) {
  const policyId = asPositiveInteger(record.policy_id);
  const libraryId = asPositiveInteger(record.library_id);
  const purposeRules = asArray(record.purpose_rules);
  if (!policyId || !libraryId || purposeRules.length === 0) return null;

  const purposeProvenance = buildPolicyNativeIntentPurposeChangeProvenance(purposeRules);
  if (!purposeProvenance.declarationRequired) return null;

  try {
    return {
      signature: buildStoredPurposeChangeCommandSignature(purposeRules),
      entry: {
        policy: {
          id: policyId,
          name: asNonEmptyString(record.policy_name, 'Unnamed policy'),
        },
        library: {
          id: libraryId,
          name: asNonEmptyString(record.library_name, 'Unnamed library'),
          mediaType: asNonEmptyString(record.library_media_type, null),
        },
        purposeProvenance,
        action: {
          actionId: POLICY_PURPOSE_DECLARATION_WORKLIST_ACTION_IDS.REVIEW_AND_DECLARE_PURPOSE,
          available: true,
        },
      },
    };
  } catch {
    return null;
  }
}

function groupEntries(records = []) {
  const entries = asArray(records)
    .map(buildWorklistEntry)
    .filter(Boolean)
    .sort((left, right) => left.entry.policy.id - right.entry.policy.id);
  const groupsBySignature = new Map();

  for (const value of entries) {
    const group = groupsBySignature.get(value.signature) || [];
    group.push(value.entry);
    groupsBySignature.set(value.signature, group);
  }

  return [...groupsBySignature.values()].map((entriesForGroup, index) => ({
    id: `purpose_declaration_group_${index + 1}`,
    policyCount: entriesForGroup.length,
    libraryCount: new Set(entriesForGroup.map((entry) => entry.library.id)).size,
    entries: entriesForGroup,
  }));
}

/**
 * Groups exact server-owned prefilled purpose drafts for review. The group
 * identifier is only an in-response ordinal: signatures and rule values never
 * leave this server-side reduction.
 */
export function buildPolicyPurposeDeclarationWorklist({
  records = [],
  truncated = false,
} = {}) {
  const groups = groupEntries(records);
  const declarationRequiredPolicyCount = groups.reduce(
    (count, group) => count + group.policyCount,
    0,
  );

  return {
    version: `policy_purpose_declaration_worklist.v${POLICY_PURPOSE_DECLARATION_WORKLIST_VERSION}`,
    statusId: declarationRequiredPolicyCount > 0
      ? POLICY_PURPOSE_DECLARATION_WORKLIST_STATUS_IDS.DECLARATION_REVIEW_REQUIRED
      : POLICY_PURPOSE_DECLARATION_WORKLIST_STATUS_IDS.NO_DECLARATION_REVIEW_REQUIRED,
    groups,
    summary: {
      reviewedPolicyCount: asArray(records).length,
      declarationRequiredPolicyCount,
      groupCount: groups.length,
      truncated: truncated === true,
    },
    rawPurposeRulesExposed: false,
    policyStorageMutated: false,
    semanticSelectionAffected: false,
    routingAffected: false,
  };
}
