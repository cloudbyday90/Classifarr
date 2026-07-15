/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

import {
  POLICY_STORAGE_COMPLETION_COMPONENTS,
} from '../../services/policyStorageCompletionCheckpoint.mjs';
import {
  buildCompletionAuditArtifactFixture,
} from './policyCompatibilityRemovalCompletionAuditArtifactFixture.mjs';
import {
  buildPolicyStorageClosureValidationEvidenceFixture,
} from './policyStorageClosureValidationEvidenceFixture.mjs';

const POLICY_STORAGE_COMPLETION_COMPONENT_IDS = Object.freeze(
  POLICY_STORAGE_COMPLETION_COMPONENTS.map(component => component.componentId)
);

function buildPolicyStorageCompletionCheckpointComponentEvidence(overrides = {}) {
  return POLICY_STORAGE_COMPLETION_COMPONENTS.map(component => ({
    componentId: component.componentId,
    label: component.label,
    implemented: true,
    designDocPresent: true,
    contractEvidencePresent: true,
    testEvidencePresent: true,
    changelogEntryPresent: true,
    ...overrides[component.componentId],
  }));
}

function buildPolicyStorageCompletionCheckpointRoadmapEvidence(overrides = {}) {
  return {
    componentSequenceIds: POLICY_STORAGE_COMPLETION_COMPONENT_IDS,
    implementationStatusComponentIds: POLICY_STORAGE_COMPLETION_COMPONENT_IDS,
    ...overrides,
  };
}

function buildPolicyStorageCompletionCheckpointValidationEvidence(overrides = {}) {
  const {
    commandResultOverrides = {},
    ...artifactOverrides
  } = overrides;

  return {
    ...buildPolicyStorageClosureValidationEvidenceFixture({ commandResultOverrides }),
    ...artifactOverrides,
  };
}

function buildPolicyStorageCompletionCheckpointChangelogEvidence(overrides = {}) {
  return {
    updated: true,
    componentIds: POLICY_STORAGE_COMPLETION_COMPONENT_IDS,
    ...overrides,
  };
}

async function buildPolicyStorageCompletionCheckpointArtifactInputs({
  componentEvidenceOverrides = {},
  roadmapEvidenceOverrides = {},
  completionAuditArtifact = undefined,
  validationEvidenceOverrides = {},
  changelogEvidenceOverrides = {},
} = {}) {
  return {
    componentEvidence:
      buildPolicyStorageCompletionCheckpointComponentEvidence(componentEvidenceOverrides),
    roadmapEvidence:
      buildPolicyStorageCompletionCheckpointRoadmapEvidence(roadmapEvidenceOverrides),
    completionAuditArtifact:
      completionAuditArtifact === undefined
        ? await buildCompletionAuditArtifactFixture()
        : completionAuditArtifact,
    validationEvidence:
      buildPolicyStorageCompletionCheckpointValidationEvidence(validationEvidenceOverrides),
    changelogEvidence:
      buildPolicyStorageCompletionCheckpointChangelogEvidence(changelogEvidenceOverrides),
  };
}

export {
  POLICY_STORAGE_COMPLETION_COMPONENT_IDS,
  buildPolicyStorageCompletionCheckpointArtifactInputs,
  buildPolicyStorageCompletionCheckpointChangelogEvidence,
  buildPolicyStorageCompletionCheckpointComponentEvidence,
  buildPolicyStorageCompletionCheckpointRoadmapEvidence,
  buildPolicyStorageCompletionCheckpointValidationEvidence,
};
