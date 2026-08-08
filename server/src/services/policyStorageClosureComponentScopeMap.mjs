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
  POLICY_STORAGE_CLOSURE_SCOPE_IDS,
} from './policyStorageClosureScopes.mjs';

const POLICY_STORAGE_INSTANCE_CUTOVER_COMPONENT_IDS = Object.freeze([
  'compatibility_path_deletion_readiness',
  'compatibility_path_deletion_execution_plan',
  'compatibility_path_deletion_execution_gate',
  'controlled_compatibility_path_removal',
  'controlled_compatibility_path_removal_apply',
  'post_removal_runtime_verification',
  'next_compatibility_removal_batch_authorization',
  'compatibility_removal_completion_audit',
  'compatibility_removal_evidence_regeneration',
]);

const INSTANCE_CUTOVER_COMPONENT_ID_SET = new Set(
  POLICY_STORAGE_INSTANCE_CUTOVER_COMPONENT_IDS
);

function normalizeComponentId(value = '') {
  return String(value || '').trim().toLowerCase();
}

function getPolicyStorageClosureComponentEvidenceScope(componentId = '') {
  return INSTANCE_CUTOVER_COMPONENT_ID_SET.has(normalizeComponentId(componentId))
    ? POLICY_STORAGE_CLOSURE_SCOPE_IDS.ACTIVE_INSTALLATION
    : POLICY_STORAGE_CLOSURE_SCOPE_IDS.REPOSITORY;
}

function collectComponentIds(components = []) {
  return [...new Set(components
    .map(component => normalizeComponentId(component?.componentId || component))
    .filter(Boolean))];
}

function buildPolicyStorageClosureComponentScopeMap({
  implementationComponents = [],
} = {}) {
  const implementationComponentIds = collectComponentIds(implementationComponents)
    .filter(componentId => (
      getPolicyStorageClosureComponentEvidenceScope(componentId) ===
        POLICY_STORAGE_CLOSURE_SCOPE_IDS.REPOSITORY
    ));

  return {
    implementationReadiness: {
      scope: POLICY_STORAGE_CLOSURE_SCOPE_IDS.REPOSITORY,
      componentIds: implementationComponentIds,
      componentCount: implementationComponentIds.length,
    },
    instanceCutover: {
      scope: POLICY_STORAGE_CLOSURE_SCOPE_IDS.ACTIVE_INSTALLATION,
      componentIds: POLICY_STORAGE_INSTANCE_CUTOVER_COMPONENT_IDS,
      componentCount: POLICY_STORAGE_INSTANCE_CUTOVER_COMPONENT_IDS.length,
      requiredForStorageClosure: true,
    },
  };
}

export {
  POLICY_STORAGE_INSTANCE_CUTOVER_COMPONENT_IDS,
  buildPolicyStorageClosureComponentScopeMap,
  getPolicyStorageClosureComponentEvidenceScope,
};
