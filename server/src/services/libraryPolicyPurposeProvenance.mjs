/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */

export const LIBRARY_POLICY_PURPOSE_PROVENANCE_STATUS_IDS = Object.freeze({
  NO_ACTIVE_VALIDATED_NATIVE_POLICY: 'no_active_validated_native_policy',
  PROFILE_ONLY_SPECIALIZED_PURPOSE: 'profile_only_specialized_purpose',
  NO_RETAINED_DECLARED_PURPOSE: 'no_retained_declared_purpose',
  RETAINED_DECLARED_PURPOSE_AVAILABLE: 'retained_declared_purpose_available',
});

function nonNegativeInteger(value) {
  const numericValue = Number(value);
  return Number.isInteger(numericValue) && numericValue >= 0 ? numericValue : 0;
}

function validLibraryId(value) {
  return Number.isSafeInteger(value) && value > 0 && value <= 2147483647;
}

/** Reduces aggregate policy-source facts; rules and their values never enter this contract. */
export function buildLibraryPolicyPurposeProvenance(record = {}) {
  const activeValidatedPolicyCount = nonNegativeInteger(record.active_validated_policy_count);
  const profileOnlySpecializedPurposePolicyCount = Math.min(
    activeValidatedPolicyCount,
    nonNegativeInteger(record.profile_only_specialized_purpose_policy_count),
  );
  const retainedDeclaredPurposePolicyCount = Math.min(
    activeValidatedPolicyCount,
    nonNegativeInteger(record.retained_declared_purpose_policy_count),
  );
  const statusId = activeValidatedPolicyCount === 0
    ? LIBRARY_POLICY_PURPOSE_PROVENANCE_STATUS_IDS.NO_ACTIVE_VALIDATED_NATIVE_POLICY
    : retainedDeclaredPurposePolicyCount > 0
      ? LIBRARY_POLICY_PURPOSE_PROVENANCE_STATUS_IDS.RETAINED_DECLARED_PURPOSE_AVAILABLE
      : profileOnlySpecializedPurposePolicyCount === activeValidatedPolicyCount
        ? LIBRARY_POLICY_PURPOSE_PROVENANCE_STATUS_IDS.PROFILE_ONLY_SPECIALIZED_PURPOSE
        : LIBRARY_POLICY_PURPOSE_PROVENANCE_STATUS_IDS.NO_RETAINED_DECLARED_PURPOSE;

  return {
    statusId,
    activeValidatedPolicyCount,
    profileOnlySpecializedPurposePolicyCount,
    retainedDeclaredPurposePolicyCount,
  };
}

/** Indexes a bounded selected-library list, ensuring every selected library has a fixed status. */
export function indexLibraryPolicyPurposeProvenance({ libraryIds = [], records = [] } = {}) {
  const selectedLibraryIds = [...new Set((Array.isArray(libraryIds) ? libraryIds : [])
    .filter(validLibraryId))];
  const recordsByLibraryId = new Map((Array.isArray(records) ? records : [])
    .filter((record) => validLibraryId(record?.library_id))
    .map((record) => [record.library_id, record]));

  return new Map(selectedLibraryIds.map((libraryId) => [
    libraryId,
    buildLibraryPolicyPurposeProvenance(recordsByLibraryId.get(libraryId)),
  ]));
}
