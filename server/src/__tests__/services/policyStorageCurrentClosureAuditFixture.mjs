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
  POLICY_STORAGE_CLOSURE_EVIDENCE_ARTIFACT_MAP,
} from '../../services/policyStorageClosureEvidenceRun.mjs';
import {
  buildPolicyStorageCurrentClosureAudit,
} from '../../services/policyStorageCurrentClosureAudit.mjs';
import {
  buildCompletionAuditArtifactFixture,
} from './policyCompatibilityRemovalCompletionAuditArtifactFixture.mjs';
import {
  buildPolicyStorageClosureValidationEvidenceFixture,
} from './policyStorageClosureValidationEvidenceFixture.mjs';

function completeRoadmapContent() {
  const componentSections = POLICY_STORAGE_CLOSURE_EVIDENCE_ARTIFACT_MAP
    .map(component => `### ${component.label}`)
    .join('\n');
  const sequenceItems = POLICY_STORAGE_CLOSURE_EVIDENCE_ARTIFACT_MAP
    .map((component, index) => `${index + 1}. **${component.label}**`)
    .join('\n');

  return `${componentSections}\n\n## Policy Storage Closure Work Sequence\n\n${sequenceItems}`;
}

function completeChangelogContent() {
  return `
## [Unreleased]

### Added

- **Native Policy Intent Storage** — added durable policy storage.
`;
}

function buildCurrentClosureValidationEvidence({
  commandResultOverrides = {},
  ...artifactOverrides
} = {}) {
  const artifact = buildPolicyStorageClosureValidationEvidenceFixture({
    commandResultOverrides,
  });

  return {
    ...artifact,
    ...artifactOverrides,
  };
}

function readCurrentClosureFixtureText(filePath) {
  return filePath.replace(/\\/g, '/').endsWith('CHANGELOG.md')
    ? completeChangelogContent()
    : completeRoadmapContent();
}

async function buildPolicyStorageCurrentClosureAuditFixture({
  completionAuditArtifact,
  validationEvidence,
  generatedAt = '2026-07-14T20:00:00.000Z',
  sideEffects = {},
  fileExists = () => true,
  readTextFile = readCurrentClosureFixtureText,
} = {}) {
  return buildPolicyStorageCurrentClosureAudit({
    cwd: '/repo',
    completionAuditArtifact:
      completionAuditArtifact || await buildCompletionAuditArtifactFixture(),
    validationEvidence:
      validationEvidence || buildCurrentClosureValidationEvidence(),
    generatedAt,
    sideEffects,
    fileExists,
    readTextFile,
  });
}

export {
  buildCurrentClosureValidationEvidence,
  buildPolicyStorageCurrentClosureAuditFixture,
  completeChangelogContent,
  completeRoadmapContent,
  readCurrentClosureFixtureText,
};
